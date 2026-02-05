/**
 * Longform Video Service — 10초 그리드 기반 단순화 렌더러
 *
 * 모든 것을 10초 단위 세그먼트로 고정:
 * - 이미지 뷰포트: 전체 → 오른쪽 → 왼쪽 → 오른쪽... (10초마다 전환)
 * - 자막: 나레이션을 세그먼트 수로 균등 분할, 10초마다 교체
 * - 오디오: 10초 단위로 슬라이싱하여 독립 스케줄링 (씽크 보장)
 */

import type { LongformScene, LongformScenario } from '../types/longform';
import { calculateSplitPoint } from '../types/longform';
import type { RemotionSceneData } from '../remotion/types';

// ─── 타입 ──────────────────────────────────────

export type LongformRenderStatus = 'idle' | 'preparing' | 'rendering' | 'complete' | 'error';

export interface LongformRenderProgress {
  status: LongformRenderStatus;
  progress: number;
  currentFrame?: number;
  totalFrames?: number;
  error?: string;
}

export interface LongformRenderResult {
  success: boolean;
  videoBlob?: Blob;
  videoUrl?: string;
  duration: number;
  sceneCount: number;
  error?: string;
}

export type LongformProgressCallback = (progress: LongformRenderProgress) => void;

// ─── 상수 ──────────────────────────────────────

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const SEGMENT_SEC = 10;
const SEGMENT_FRAMES = SEGMENT_SEC * FPS; // 300
const SCENE_TRANSITION_FRAMES = 15;       // 씬 간 크로스페이드 (0.5초)
const CHARS_PER_SEGMENT = 73;             // 10초당 목표 글자수 (72~74 중간값)

// ─── 시네마틱 카메라 경로 (Ken Burns) ──────────────

interface CameraKeyframe {
  scale: number;
  offsetXPercent: number;
  offsetYPercent: number;
}

/**
 * 60초 슬라이드 사이클 카메라 경로
 * 7개 키프레임(6세그먼트 경계) 기준:
 * - 0-10초: 고정 (중앙)
 * - 10-20초: 중앙 → 왼쪽
 * - 20-30초: 왼쪽 → 중앙
 * - 30-40초: 중앙 → 오른쪽
 * - 40-50초: 오른쪽 → 중앙
 * - 50-60초: 고정 (중앙)
 *
 * ease-in-out으로 부드럽게 전환되어 고급스러운 움직임 제공
 */
const SLIDE_AMOUNT = 6; // 좌우 이동량 (%)

const CAMERA_PATHS: CameraKeyframe[][] = [
  // 60초 슬라이드 사이클 (모든 씬에 동일 적용)
  [
    { scale: 1.15, offsetXPercent: 0,             offsetYPercent: 0 },  // 0초: 중앙
    { scale: 1.15, offsetXPercent: 0,             offsetYPercent: 0 },  // 10초: 중앙 (고정 끝)
    { scale: 1.15, offsetXPercent: -SLIDE_AMOUNT, offsetYPercent: 0 },  // 20초: 왼쪽
    { scale: 1.15, offsetXPercent: 0,             offsetYPercent: 0 },  // 30초: 중앙
    { scale: 1.15, offsetXPercent: SLIDE_AMOUNT,  offsetYPercent: 0 },  // 40초: 오른쪽
    { scale: 1.15, offsetXPercent: 0,             offsetYPercent: 0 },  // 50초: 중앙
    { scale: 1.15, offsetXPercent: 0,             offsetYPercent: 0 },  // 60초: 중앙 (고정 끝)
  ],
];

/** 씬의 세그먼트 수에 맞게 카메라 키프레임 생성 (패턴 순환) */
function getCameraKeyframesForScene(segmentCount: number, sceneIndex: number): CameraKeyframe[] {
  const path = CAMERA_PATHS[sceneIndex % CAMERA_PATHS.length];

  // 6세그먼트(7키프레임)이면 그대로 사용
  if (segmentCount + 1 === path.length) return path;

  // 다른 세그먼트 수: 경로를 균등 샘플링
  const keyframes: CameraKeyframe[] = [];
  for (let i = 0; i <= segmentCount; i++) {
    const t = i / segmentCount;
    const srcIdx = t * (path.length - 1);
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, path.length - 1);
    const frac = srcIdx - lo;
    keyframes.push({
      scale: lerp(path[lo].scale, path[hi].scale, frac),
      offsetXPercent: lerp(path[lo].offsetXPercent, path[hi].offsetXPercent, frac),
      offsetYPercent: lerp(path[lo].offsetYPercent, path[hi].offsetYPercent, frac),
    });
  }
  return keyframes;
}

/** 현재 프레임의 카메라 상태를 easeInOut 보간으로 계산 */
function getCameraState(
  keyframes: CameraKeyframe[],
  segmentIndex: number,
  frameInSegment: number
): CameraKeyframe {
  const from = keyframes[Math.min(segmentIndex, keyframes.length - 1)];
  const to = keyframes[Math.min(segmentIndex + 1, keyframes.length - 1)];
  const t = easeInOutCubic(frameInSegment / SEGMENT_FRAMES);
  return {
    scale: lerp(from.scale, to.scale, t),
    offsetXPercent: lerp(from.offsetXPercent, to.offsetXPercent, t),
    offsetYPercent: lerp(from.offsetYPercent, to.offsetYPercent, t),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Cubic ease-in-out: 시작/끝에서 감속, 중간에서 가속 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ─── 변환 유틸 ─────────────────────────────────

export function longformSceneToRemotionScene(scene: LongformScene): RemotionSceneData | null {
  if (!scene.generatedImage) return null;

  // 텍스트 기반 세그먼트 수 계산 (72-74자 = 10초)
  const textLength = scene.narration?.length || 0;
  const segmentCount = textLength > 0
    ? Math.max(1, Math.ceil(textLength / CHARS_PER_SEGMENT))
    : 1;
  const duration = segmentCount * SEGMENT_SEC;

  return {
    id: scene.id,
    sceneNumber: scene.sceneNumber,
    duration,
    imageData: scene.generatedImage,
    narration: scene.narration,
    narrationAudio: scene.narrationAudio,
    animation: { type: 'slideCycle', direction: 'in', intensity: 0.5 },
    mood: scene.mood,
  };
}

export function longformScenesToRemotionScenes(scenes: LongformScene[]): RemotionSceneData[] {
  return scenes
    .map(longformSceneToRemotionScene)
    .filter((s): s is RemotionSceneData => s !== null);
}

export function splitScenesForExport(scenario: LongformScenario): {
  part1: LongformScene[];
  part2: LongformScene[];
} {
  const splitPoint = calculateSplitPoint(scenario.scenes.length);
  return {
    part1: scenario.scenes.slice(0, splitPoint),
    part2: scenario.scenes.slice(splitPoint),
  };
}

// ─── 씬 타이밍 (10초 그리드) ─────────────────────

interface SceneTiming {
  scene: RemotionSceneData;
  startFrame: number;
  durationFrames: number;
  segmentCount: number;
  subtitleSegments: string[];
  startTimeSec: number;
  cameraKeyframes: CameraKeyframe[];
}

function calculateSceneTimings(scenes: RemotionSceneData[]): SceneTiming[] {
  const timings: SceneTiming[] = [];
  let currentFrame = 0;

  for (let idx = 0; idx < scenes.length; idx++) {
    const scene = scenes[idx];
    const segmentCount = Math.round(scene.duration / SEGMENT_SEC);
    const durationFrames = segmentCount * SEGMENT_FRAMES;
    const subtitleSegments = splitNarrationFixed(scene.narration, segmentCount);
    const cameraKeyframes = getCameraKeyframesForScene(segmentCount, idx);

    timings.push({
      scene,
      startFrame: currentFrame,
      durationFrames,
      segmentCount,
      subtitleSegments,
      startTimeSec: currentFrame / FPS,
      cameraKeyframes,
    });

    currentFrame += durationFrames;
  }

  return timings;
}

// ─── 나레이션 텍스트 분할 (72-74자 자동 맞춤) ──────

/**
 * 나레이션을 segmentCount개의 세그먼트로 분할하되,
 * 각 세그먼트가 72~74자에 최대한 가깝도록 자동 조정합니다.
 *
 * 1단계: 목표 길이 기준 초기 분할 (문장/단어 경계 우선)
 * 2단계: 인접 세그먼트 간 리밸런싱 (72-74자 범위에 맞춤)
 */
function splitNarrationFixed(narration: string, segmentCount: number): string[] {
  if (!narration || segmentCount <= 0) return [];
  if (segmentCount === 1) return [narration.trim()];

  // ── 1단계: 초기 분할 ──
  const targetLen = Math.round(narration.length / segmentCount);
  const segments: string[] = [];
  let remaining = narration;

  for (let i = 0; i < segmentCount - 1; i++) {
    if (!remaining) { segments.push(''); continue; }

    let cutIdx = Math.min(targetLen, remaining.length);

    // 문장 경계 우선 탐색
    let bestCut = -1;
    for (let j = Math.max(0, cutIdx - 15); j <= Math.min(remaining.length - 1, cutIdx + 15); j++) {
      if ('.!?。'.includes(remaining[j]) && j > 5) {
        bestCut = j + 1;
        break;
      }
    }
    if (bestCut === -1) {
      for (let j = cutIdx; j >= Math.max(0, cutIdx - 20); j--) {
        if (',، '.includes(remaining[j])) {
          bestCut = j + 1;
          break;
        }
      }
    }

    cutIdx = bestCut > 0 ? bestCut : cutIdx;
    segments.push(remaining.slice(0, cutIdx).trim());
    remaining = remaining.slice(cutIdx).trim();
  }

  if (remaining) segments.push(remaining.trim());
  while (segments.length < segmentCount) segments.push('');

  // ── 2단계: 리밸런싱 (72-74자 범위로 조정) ──
  return rebalanceSegments(segments);
}

/**
 * 인접 세그먼트 간 단어를 이동시켜 각 세그먼트를 72~74자에 맞춥니다.
 * - 앞 세그먼트가 너무 길면 마지막 단어를 다음 세그먼트로 이동
 * - 앞 세그먼트가 너무 짧으면 다음 세그먼트의 첫 단어를 가져옴
 * - 3회 반복으로 수렴
 */
function rebalanceSegments(segments: string[]): string[] {
  const result = [...segments];
  const target = CHARS_PER_SEGMENT;
  const tolerance = 2; // 72-74 = target(73) ± 1 → 실질적으로 ±2까지 허용

  for (let pass = 0; pass < 3; pass++) {
    let changed = false;

    for (let i = 0; i < result.length - 1; i++) {
      const curr = result[i];
      const next = result[i + 1];
      if (!curr && !next) continue;

      const currLen = curr.length;
      const nextLen = next.length;

      // 현재 세그먼트가 너무 길면 → 마지막 단어/어절을 다음으로 이동
      if (currLen > target + tolerance && nextLen < target + tolerance) {
        const lastSpace = curr.lastIndexOf(' ');
        if (lastSpace > 0) {
          const moved = curr.slice(lastSpace + 1);
          result[i] = curr.slice(0, lastSpace).trim();
          result[i + 1] = (moved + ' ' + next).trim();
          changed = true;
        }
      }
      // 현재 세그먼트가 너무 짧으면 → 다음에서 첫 단어/어절을 가져옴
      else if (currLen < target - tolerance && nextLen > target - tolerance) {
        const firstSpace = next.indexOf(' ');
        if (firstSpace > 0) {
          const moved = next.slice(0, firstSpace);
          result[i] = (curr + ' ' + moved).trim();
          result[i + 1] = next.slice(firstSpace + 1).trim();
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  return result;
}

// ─── 프레임 → 씬/세그먼트 매핑 ──────────────────

function getSceneAtFrame(timings: SceneTiming[], frame: number): {
  timing: SceneTiming;
  sceneIndex: number;
  frameInScene: number;
  segmentIndex: number;
  frameInSegment: number;
} {
  for (let i = 0; i < timings.length; i++) {
    const t = timings[i];
    if (frame < t.startFrame + t.durationFrames) {
      const frameInScene = frame - t.startFrame;
      const segmentIndex = Math.min(
        Math.floor(frameInScene / SEGMENT_FRAMES),
        t.segmentCount - 1
      );
      const frameInSegment = frameInScene - segmentIndex * SEGMENT_FRAMES;
      return { timing: t, sceneIndex: i, frameInScene, segmentIndex, frameInSegment };
    }
  }
  const last = timings[timings.length - 1];
  return {
    timing: last,
    sceneIndex: timings.length - 1,
    frameInScene: last.durationFrames - 1,
    segmentIndex: last.segmentCount - 1,
    frameInSegment: SEGMENT_FRAMES - 1,
  };
}

// ─── 이미지 프리로딩 ───────────────────────────

async function preloadSceneImages(
  scenes: RemotionSceneData[]
): Promise<Map<string, HTMLImageElement>> {
  const imageMap = new Map<string, HTMLImageElement>();
  await Promise.all(scenes.map(async (scene) => {
    try {
      // [H] fetch API로 base64→Blob 변환 (브라우저 네이티브, 수동 바이트 복사보다 빠름)
      const dataUrl = `data:${scene.imageData.mimeType};base64,${scene.imageData.data}`;
      const response = await fetch(dataUrl);
      const imgBlob = await response.blob();
      const imgUrl = URL.createObjectURL(imgBlob);

      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(imgUrl); imageMap.set(scene.id, img); resolve(); };
        img.onerror = () => { URL.revokeObjectURL(imgUrl); resolve(); };
        img.src = imgUrl;
      });
    } catch {
      // fetch 실패 시 무시 (이미지 없이 진행)
    }
  }));
  return imageMap;
}

// ─── 오디오 유틸 ───────────────────────────────

async function base64ToAudioBuffer(
  audioContext: AudioContext,
  base64Data: string
): Promise<AudioBuffer> {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await audioContext.decodeAudioData(bytes.buffer);
}

/** AudioBuffer를 10초 단위로 슬라이싱 */
function sliceAudioBuffer(
  audioContext: AudioContext,
  buffer: AudioBuffer,
  startSec: number,
  durationSec: number
): AudioBuffer | null {
  const startSample = Math.floor(startSec * buffer.sampleRate);
  const numSamples = Math.min(
    Math.floor(durationSec * buffer.sampleRate),
    buffer.length - startSample
  );
  if (numSamples <= 0) return null;

  const sliced = audioContext.createBuffer(
    buffer.numberOfChannels,
    numSamples,
    buffer.sampleRate
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    sliced.getChannelData(ch).set(
      buffer.getChannelData(ch).subarray(startSample, startSample + numSamples)
    );
  }
  return sliced;
}

// ─── 이미지 드로잉 (카메라 상태 기반) ────────────

function drawImageWithCamera(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  camera: CameraKeyframe
): void {
  const imgRatio = img.width / img.height;
  const canvasRatio = canvas.width / canvas.height;

  let drawW: number;
  let drawH: number;

  if (imgRatio > canvasRatio) {
    drawH = canvas.height;
    drawW = drawH * imgRatio;
  } else {
    drawW = canvas.width;
    drawH = drawW / imgRatio;
  }

  drawW *= camera.scale;
  drawH *= camera.scale;

  const offsetX = (camera.offsetXPercent / 100) * canvas.width;
  const offsetY = (camera.offsetYPercent / 100) * canvas.height;
  const x = (canvas.width - drawW) / 2 + offsetX;
  const y = (canvas.height - drawH) / 2 + offsetY;

  ctx.drawImage(img, x, y, drawW, drawH);
}

// ─── 자막 드로잉 (10초 고정 세그먼트) ──────────

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string,
  frameInSegment: number
): void {
  if (!text) return;

  // 페이드: 처음 0.3초 fadeIn, 마지막 0.3초 fadeOut
  const fadeFrames = Math.round(FPS * 0.3);
  let opacity = 1;
  if (frameInSegment < fadeFrames) {
    opacity = frameInSegment / fadeFrames;
  } else if (frameInSegment > SEGMENT_FRAMES - fadeFrames) {
    opacity = (SEGMENT_FRAMES - frameInSegment) / fadeFrames;
  }
  opacity = Math.max(0, Math.min(1, opacity));

  const fontSize = Math.round(canvas.height * 0.055);
  ctx.font = `bold ${fontSize}px Pretendard, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';

  // 줄바꿈
  const maxLineWidth = canvas.width * 0.85;
  const lines: string[] = [];
  let currentLine = '';
  for (const char of text) {
    const testLine = currentLine + char;
    if (ctx.measureText(testLine).width > maxLineWidth && currentLine) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  // 배경 박스
  const lineHeight = fontSize * 1.5;
  const padding = 20;
  const textX = canvas.width / 2;

  let maxWidth = 0;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    if (w > maxWidth) maxWidth = w;
  }

  const boxH = lines.length * lineHeight + padding;
  const boxY = canvas.height * 0.88 - boxH;
  const boxX = textX - maxWidth / 2 - padding;
  const boxW = maxWidth + padding * 2;

  ctx.globalAlpha = opacity;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 12);
  ctx.fill();

  // 텍스트
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  lines.forEach((line, i) => {
    ctx.fillText(line, textX, boxY + padding / 2 + fontSize + i * lineHeight);
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.globalAlpha = 1;
}

// ─── UI 블로킹 방지 ────────────────────────────

function yieldToMain(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

// ─── 메인 렌더링 ───────────────────────────────

export async function renderLongformPart(
  scenes: RemotionSceneData[],
  onProgress?: LongformProgressCallback,
  abortSignal?: AbortSignal
): Promise<LongformRenderResult> {
  if (scenes.length === 0) {
    return { success: false, duration: 0, sceneCount: 0, error: '렌더링할 씬이 없습니다' };
  }

  onProgress?.({ status: 'preparing', progress: 0 });

  try {
    // ── 1. 타이밍 계산 (10초 그리드) ──
    const timings = calculateSceneTimings(scenes);
    const totalFrames = timings.reduce((acc, t) => acc + t.durationFrames, 0);
    const totalDuration = totalFrames / FPS;

    // ── 2. Canvas 설정 ──
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context 생성 실패');

    // ── 3. 이미지 프리로드 ──
    const imageMap = await preloadSceneImages(scenes);
    // [I] base64 데이터 참조 해제 — ~3-6MB/씬 × 6씬 = ~18-36MB 메모리 절감
    for (const scene of scenes) {
      (scene.imageData as any).data = '';
    }
    onProgress?.({ status: 'preparing', progress: 10, totalFrames });

    // ── 4. 오디오: 10초 단위 슬라이싱 + 독립 스케줄링 ──
    let audioContext: AudioContext | null = null;
    let audioDestination: MediaStreamAudioDestinationNode | null = null;
    const audioSources: { source: AudioBufferSourceNode; startTime: number }[] = [];
    const hasAudio = scenes.some(s => s.narrationAudio?.data);

    if (hasAudio) {
      try {
        audioContext = new AudioContext({ sampleRate: 44100 });
        audioDestination = audioContext.createMediaStreamDestination();

        for (const timing of timings) {
          if (!timing.scene.narrationAudio?.data) continue;

          try {
            const fullBuffer = await base64ToAudioBuffer(
              audioContext,
              timing.scene.narrationAudio.data
            );

            // 10초 단위로 슬라이싱하여 각각 스케줄
            for (let seg = 0; seg < timing.segmentCount; seg++) {
              const sliceStart = seg * SEGMENT_SEC;
              const sliced = sliceAudioBuffer(audioContext, fullBuffer, sliceStart, SEGMENT_SEC);
              if (!sliced) continue;

              const source = audioContext.createBufferSource();
              source.buffer = sliced;
              source.connect(audioDestination);

              const absoluteStartSec = timing.startTimeSec + seg * SEGMENT_SEC;
              audioSources.push({ source, startTime: absoluteStartSec });
            }
          } catch (e) {
            console.warn(`Audio decode failed for scene ${timing.scene.id}:`, e);
          }
        }
      } catch (e) {
        console.warn('오디오 준비 실패:', e);
        audioContext = null;
        audioDestination = null;
      }
    }

    onProgress?.({ status: 'preparing', progress: 15, totalFrames });

    // ── 5. MediaRecorder 설정 ──
    const videoStream = canvas.captureStream(0);
    const videoTrack = videoStream.getVideoTracks()[0] as any;
    const canRequestFrame = videoTrack && typeof videoTrack.requestFrame === 'function';

    const combinedStream = audioDestination
      ? new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioDestination.stream.getAudioTracks(),
        ])
      : videoStream;

    const mimeType = audioDestination ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 10_000_000,
      audioBitsPerSecond: audioDestination ? 128_000 : undefined,
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    // ── 6. 렌더링 루프 ──
    // [F] 렌더 루프 에러 플래그 — onstop에서 성공/실패 분기에 사용
    let renderError: Error | null = null;

    return new Promise<LongformRenderResult>((resolve) => {
      mediaRecorder.onstop = () => {
        // ── 리소스 정리 ──
        for (const { source } of audioSources) {
          try { source.disconnect(); } catch {}
          try { source.stop(); } catch {}
        }
        if (audioContext && audioContext.state !== 'closed') {
          audioContext.close().catch(() => {});
        }
        combinedStream.getTracks().forEach(track => track.stop());
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
        imageMap.clear();

        // [F] abort 또는 에러 시 실패로 resolve — orphan Blob URL 방지
        if (abortSignal?.aborted || renderError) {
          resolve({
            success: false,
            duration: 0,
            sceneCount: 0,
            error: renderError?.message || '렌더링이 취소되었습니다',
          });
          return;
        }

        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        onProgress?.({ status: 'complete', progress: 100, totalFrames, currentFrame: totalFrames });

        resolve({
          success: true,
          videoBlob: blob,
          videoUrl: url,
          duration: totalDuration,
          sceneCount: scenes.length,
        });
      };

      mediaRecorder.start();

      // 오디오: 10초 세그먼트별 독립 시작
      const audioStartTime = audioContext ? audioContext.currentTime : 0;
      for (const { source, startTime } of audioSources) {
        source.start(audioStartTime + startTime);
      }

      onProgress?.({ status: 'rendering', progress: 20, totalFrames, currentFrame: 0 });

      const renderLoop = async () => {
        const renderStartMs = performance.now();
        for (let frame = 0; frame < totalFrames; frame++) {
          if (abortSignal?.aborted) {
            combinedStream.getTracks().forEach(track => track.stop());
            imageMap.clear();
            mediaRecorder.stop();
            return;
          }

          const { timing, sceneIndex, frameInScene, segmentIndex, frameInSegment } =
            getSceneAtFrame(timings, frame);
          const img = imageMap.get(timing.scene.id);

          // 캔버스 클리어
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          if (img) {
            const isLastScene = sceneIndex >= timings.length - 1;
            const isInSceneTransition = !isLastScene &&
              frameInScene >= timing.durationFrames - SCENE_TRANSITION_FRAMES;

            // 현재 카메라 상태 (easeInOut 보간)
            const camera = getCameraState(timing.cameraKeyframes, segmentIndex, frameInSegment);

            if (isInSceneTransition) {
              // ── 씬 간 크로스페이드 ──
              const nextImg = imageMap.get(timings[sceneIndex + 1].scene.id);
              if (nextImg) {
                const tf = frameInScene - (timing.durationFrames - SCENE_TRANSITION_FRAMES);
                const tp = Math.min(1, Math.max(0, tf / SCENE_TRANSITION_FRAMES));

                // 현재 씬 (페이드 아웃)
                ctx.globalAlpha = 1 - tp;
                drawImageWithCamera(ctx, canvas, img, camera);

                // 다음 씬 (다음 씬의 시작 카메라로 페이드 인)
                const nextCamera = timings[sceneIndex + 1].cameraKeyframes[0];
                ctx.globalAlpha = tp;
                drawImageWithCamera(ctx, canvas, nextImg, nextCamera);
                ctx.globalAlpha = 1;
              } else {
                drawImageWithCamera(ctx, canvas, img, camera);
              }
            } else {
              // ── 카메라 연속 이동 (easeInOut) ──
              drawImageWithCamera(ctx, canvas, img, camera);
            }

            // ── 자막 (10초 고정) ──
            const subtitleText = timing.subtitleSegments[segmentIndex] || '';
            drawSubtitle(ctx, canvas, subtitleText, frameInSegment);
          }

          // 프레임 푸시
          if (canRequestFrame) videoTrack.requestFrame();

          // 진행률 (1초마다 업데이트)
          if (frame % FPS === 0) {
            const pct = 20 + ((frame + 1) / totalFrames) * 75;
            onProgress?.({
              status: 'rendering',
              progress: Math.min(pct, 95),
              currentFrame: frame + 1,
              totalFrames,
            });
          }

          // ── wall-clock 기반 30fps 페이싱 (오디오 유무 무관) ──
          const targetMs = renderStartMs + ((frame + 1) / FPS) * 1000;
          const nowMs = performance.now();
          const waitMs = targetMs - nowMs;
          if (waitMs > 2) {
            await new Promise<void>(r => setTimeout(r, waitMs));
          } else if (frame % 2 === 0) {
            await yieldToMain();
          }
        }

        // 마지막 데이터 플러시
        await new Promise<void>(r => setTimeout(r, 500));
        mediaRecorder.stop();
      };

      renderLoop().catch((err) => {
        // [F] 에러 플래그 설정 — onstop에서 success:false로 resolve
        renderError = err instanceof Error ? err : new Error('렌더링 실패');

        // [G] 오디오 리소스 정리 (에러 경로에서 누락되어 있었음)
        for (const { source } of audioSources) {
          try { source.disconnect(); } catch {}
          try { source.stop(); } catch {}
        }
        if (audioContext && audioContext.state !== 'closed') {
          audioContext.close().catch(() => {});
        }

        combinedStream.getTracks().forEach(track => { try { track.stop(); } catch {} });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
        imageMap.clear();
        onProgress?.({
          status: 'error',
          progress: 0,
          error: renderError.message,
        });
        try { mediaRecorder.stop(); } catch { /* ignore */ }
      });
    });
  } catch (error) {
    onProgress?.({
      status: 'error',
      progress: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });
    return {
      success: false,
      duration: 0,
      sceneCount: 0,
      error: error instanceof Error ? error.message : '렌더링 실패',
    };
  }
}

// ─── 다운로드 ──────────────────────────────────

export function downloadLongformVideo(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
