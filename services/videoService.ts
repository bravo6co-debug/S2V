/**
 * Video Service - Remotion 기반 비디오 렌더링 서비스
 *
 * 이 서비스는 Remotion을 사용하여 클라이언트 측에서 비디오를 생성합니다.
 * Veo API 대비 99% 비용 절감이 가능합니다.
 * TTS 나레이션 오디오 지원 포함.
 */

import type { Scene, AspectRatio, NarrationAudio } from '../types';
import { scenesToRemotionScenes, type RemotionSceneData, type TransitionConfig } from '../remotion/types';
import type { ExportConfig } from '../components/video/VideoExportModal';

// 오디오 데이터 타입
interface AudioSegment {
  buffer: AudioBuffer;
  startTime: number; // 초 단위
  duration: number;
}

// 렌더링 상태 타입
export type RenderStatus = 'idle' | 'preparing' | 'rendering' | 'encoding' | 'complete' | 'error';

// 렌더링 진행 상황
export interface RenderProgress {
  status: RenderStatus;
  progress: number; // 0-100
  currentFrame?: number;
  totalFrames?: number;
  estimatedTimeRemaining?: number; // 초
  error?: string;
}

// 렌더링 결과
export interface RenderResult {
  success: boolean;
  videoBlob?: Blob;
  videoUrl?: string;
  duration: number;
  error?: string;
}

// 렌더링 콜백
export type ProgressCallback = (progress: RenderProgress) => void;

/**
 * Scene 배열을 Remotion 씬 데이터로 변환
 */
export function prepareScenes(scenes: Scene[]): RemotionSceneData[] {
  return scenesToRemotionScenes(scenes);
}

/**
 * Base64 오디오 데이터를 AudioBuffer로 변환
 */
async function base64ToAudioBuffer(
  audioContext: AudioContext,
  base64Data: string,
  mimeType: string = 'audio/wav'
): Promise<AudioBuffer> {
  // Base64를 ArrayBuffer로 변환
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // ArrayBuffer를 AudioBuffer로 디코딩
  return await audioContext.decodeAudioData(bytes.buffer);
}

/**
 * 씬들의 나레이션 오디오를 AudioSegment 배열로 변환
 */
async function prepareAudioSegments(
  audioContext: AudioContext,
  remotionScenes: RemotionSceneData[]
): Promise<AudioSegment[]> {
  const segments: AudioSegment[] = [];
  let currentTime = 0;

  for (const scene of remotionScenes) {
    if (scene.narrationAudio?.data) {
      try {
        const buffer = await base64ToAudioBuffer(
          audioContext,
          scene.narrationAudio.data,
          scene.narrationAudio.mimeType
        );

        segments.push({
          buffer,
          startTime: currentTime,
          duration: scene.duration,
        });
      } catch (error) {
        console.warn(`Failed to decode audio for scene ${scene.id}:`, error);
      }
    }
    currentTime += scene.duration;
  }

  return segments;
}

/**
 * 모든 오디오 세그먼트를 하나의 AudioBuffer로 병합
 */
function mergeAudioSegments(
  audioContext: AudioContext,
  segments: AudioSegment[],
  totalDuration: number,
  sampleRate: number = 44100
): AudioBuffer {
  const totalSamples = Math.ceil(totalDuration * sampleRate);
  const mergedBuffer = audioContext.createBuffer(2, totalSamples, sampleRate);

  for (const segment of segments) {
    const startSample = Math.floor(segment.startTime * sampleRate);
    const sourceBuffer = segment.buffer;

    // 각 채널별로 복사
    for (let channel = 0; channel < Math.min(2, sourceBuffer.numberOfChannels); channel++) {
      const sourceData = sourceBuffer.getChannelData(channel);
      const targetData = mergedBuffer.getChannelData(channel);

      for (let i = 0; i < sourceData.length && (startSample + i) < totalSamples; i++) {
        targetData[startSample + i] += sourceData[i];
      }
    }

    // 모노 오디오를 스테레오로 복사
    if (sourceBuffer.numberOfChannels === 1) {
      const sourceData = sourceBuffer.getChannelData(0);
      const targetData = mergedBuffer.getChannelData(1);

      for (let i = 0; i < sourceData.length && (startSample + i) < totalSamples; i++) {
        targetData[startSample + i] += sourceData[i];
      }
    }
  }

  return mergedBuffer;
}

/**
 * AudioBuffer를 MediaStreamTrack으로 변환
 */
function audioBufferToStream(
  audioContext: AudioContext,
  audioBuffer: AudioBuffer
): MediaStreamAudioDestinationNode {
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;

  const destination = audioContext.createMediaStreamDestination();
  source.connect(destination);
  source.start(0);

  return destination;
}

/**
 * 모든 씬의 이미지를 미리 로딩하여 렌더링 시 비동기 대기를 제거
 */
async function preloadSceneImages(
  scenes: RemotionSceneData[]
): Promise<Map<string, HTMLImageElement>> {
  const imageMap = new Map<string, HTMLImageElement>();

  await Promise.all(scenes.map(scene => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        imageMap.set(scene.id, img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = `data:${scene.imageData.mimeType};base64,${scene.imageData.data}`;
    });
  }));

  return imageMap;
}

/**
 * 프레임 번호로부터 해당 씬 인덱스와 씬 내 프레임 위치를 계산
 * Remotion의 Sequence와 동일한 로직으로 정확한 씬 전환 보장
 */
function getSceneAtFrame(
  remotionScenes: RemotionSceneData[],
  frame: number,
  fps: number
): { sceneIndex: number; frameInScene: number; sceneDurationFrames: number } {
  let accumulatedFrames = 0;

  for (let i = 0; i < remotionScenes.length; i++) {
    const sceneDurationFrames = Math.round(remotionScenes[i].duration * fps);
    if (frame < accumulatedFrames + sceneDurationFrames) {
      return {
        sceneIndex: i,
        frameInScene: frame - accumulatedFrames,
        sceneDurationFrames,
      };
    }
    accumulatedFrames += sceneDurationFrames;
  }

  // 마지막 씬 (프레임이 범위를 초과한 경우)
  const lastIndex = remotionScenes.length - 1;
  const lastSceneDuration = Math.round(remotionScenes[lastIndex].duration * fps);
  return {
    sceneIndex: lastIndex,
    frameInScene: lastSceneDuration - 1,
    sceneDurationFrames: lastSceneDuration,
  };
}

/**
 * Canvas에 이미지를 cover 방식으로 그리기 (Ken Burns 효과 포함)
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  scale: number = 1,
  offsetX: number = 0,
  offsetY: number = 0
): void {
  const imgRatio = img.width / img.height;
  const canvasRatio = canvas.width / canvas.height;

  let drawWidth, drawHeight;
  if (imgRatio > canvasRatio) {
    drawHeight = canvas.height * scale;
    drawWidth = drawHeight * imgRatio;
  } else {
    drawWidth = canvas.width * scale;
    drawHeight = drawWidth / imgRatio;
  }

  const drawX = (canvas.width - drawWidth) / 2 - offsetX;
  const drawY = (canvas.height - drawHeight) / 2 - offsetY;

  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

/**
 * 보간 유틸리티 (Remotion의 interpolate와 동일한 동작, clamp 포함)
 */
function interpolateValue(
  value: number,
  inputRange: number[],
  outputRange: number[]
): number {
  const clampedValue = Math.max(inputRange[0], Math.min(inputRange[inputRange.length - 1], value));

  for (let i = 0; i < inputRange.length - 1; i++) {
    if (clampedValue >= inputRange[i] && clampedValue <= inputRange[i + 1]) {
      const inputSpan = inputRange[i + 1] - inputRange[i];
      if (inputSpan === 0) return outputRange[i];
      const t = (clampedValue - inputRange[i]) / inputSpan;
      return outputRange[i] + t * (outputRange[i + 1] - outputRange[i]);
    }
  }

  return outputRange[outputRange.length - 1];
}

/**
 * Canvas 기반 장면 전환 효과 렌더링
 * Remotion의 Transition 컴포넌트(remotion/components/Transitions.tsx)와 동일한 로직
 */
function renderTransitionFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  type: TransitionConfig['type'],
  progress: number,
  fromImg: HTMLImageElement,
  toImg: HTMLImageElement
): void {
  switch (type) {
    case 'fade':
      // 페이드: from 이미지 페이드 아웃, to 이미지 페이드 인
      ctx.globalAlpha = 1 - progress;
      drawImageCover(ctx, canvas, fromImg);
      ctx.globalAlpha = progress;
      drawImageCover(ctx, canvas, toImg);
      ctx.globalAlpha = 1;
      break;

    case 'dissolve':
      // 디졸브: 크로스 디졸브 (더 부드러운 블렌딩)
      ctx.globalAlpha = 1 - progress * 0.5;
      drawImageCover(ctx, canvas, fromImg);
      ctx.globalAlpha = progress;
      drawImageCover(ctx, canvas, toImg);
      ctx.globalAlpha = 1;
      break;

    case 'slide': {
      // 슬라이드: from 이미지가 왼쪽으로 나가고 to 이미지가 오른쪽에서 들어옴
      ctx.save();
      ctx.translate(-canvas.width * progress, 0);
      drawImageCover(ctx, canvas, fromImg);
      ctx.restore();

      ctx.save();
      ctx.translate(canvas.width * (1 - progress), 0);
      drawImageCover(ctx, canvas, toImg);
      ctx.restore();
      break;
    }

    case 'zoom': {
      // 줌: from 이미지 확대+페이드아웃, to 이미지 축소→원본+페이드인
      const fromScale = interpolateValue(progress, [0, 1], [1, 1.5]);
      const toScale = interpolateValue(progress, [0, 1], [0.5, 1]);
      const fromOpacity = interpolateValue(progress, [0, 0.5, 1], [1, 0.5, 0]);
      const toOpacity = interpolateValue(progress, [0, 0.5, 1], [0, 0.5, 1]);

      ctx.save();
      ctx.globalAlpha = fromOpacity;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(fromScale, fromScale);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      drawImageCover(ctx, canvas, fromImg);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = toOpacity;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(toScale, toScale);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      drawImageCover(ctx, canvas, toImg);
      ctx.restore();
      break;
    }

    case 'none':
    default:
      // 즉시 전환: 중간 지점에서 이미지 교체
      drawImageCover(ctx, canvas, progress < 0.5 ? fromImg : toImg);
      break;
  }
}

/**
 * 총 비디오 길이 계산 (초)
 */
export function calculateTotalDuration(scenes: Scene[]): number {
  const remotionScenes = prepareScenes(scenes);
  return remotionScenes.reduce((acc, scene) => acc + scene.duration, 0);
}

/**
 * 해상도 설정 가져오기
 */
export function getResolutionDimensions(
  resolution: ExportConfig['resolution'],
  aspectRatio: AspectRatio
): { width: number; height: number } {
  const resolutionMap = {
    '720p': { width: 720, height: 1280 },
    '1080p': { width: 1080, height: 1920 },
  };

  const base = resolutionMap[resolution];

  // 가로 비율인 경우 가로세로 반전
  if (aspectRatio === '16:9') {
    return { width: base.height, height: base.width };
  }

  return base;
}

/**
 * 클라이언트 측 비디오 렌더링 (오디오 지원)
 *
 * 참고: 이 함수는 Canvas + MediaRecorder를 사용하여 비디오를 생성합니다.
 * TTS 나레이션 오디오가 있으면 비디오에 합성됩니다.
 */
export async function renderVideo(
  scenes: Scene[],
  config: ExportConfig,
  onProgress?: ProgressCallback
): Promise<RenderResult> {
  const remotionScenes = prepareScenes(scenes);

  if (remotionScenes.length === 0) {
    return {
      success: false,
      duration: 0,
      error: '렌더링할 씬이 없습니다',
    };
  }

  onProgress?.({
    status: 'preparing',
    progress: 0,
  });

  try {
    // 총 프레임 수 계산
    const fps = config.fps;
    const totalDuration = calculateTotalDuration(scenes);
    const totalFrames = Math.round(totalDuration * fps);

    const dimensions = getResolutionDimensions(config.resolution, config.aspectRatio);

    onProgress?.({
      status: 'preparing',
      progress: 5,
      totalFrames,
    });

    // Canvas 설정
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context를 생성할 수 없습니다');
    }

    // 오디오 준비 (includeAudio가 true이고 나레이션이 있는 경우)
    let audioContext: AudioContext | null = null;
    let audioDestination: MediaStreamAudioDestinationNode | null = null;
    let audioSource: AudioBufferSourceNode | null = null;
    const hasNarrationAudio = config.includeAudio !== false &&
      remotionScenes.some(s => s.narrationAudio?.data);

    if (hasNarrationAudio) {
      onProgress?.({
        status: 'preparing',
        progress: 8,
        totalFrames,
      });

      try {
        audioContext = new AudioContext({ sampleRate: 44100 });

        // 오디오 세그먼트 준비
        const audioSegments = await prepareAudioSegments(audioContext, remotionScenes);

        if (audioSegments.length > 0) {
          // 오디오 병합
          const mergedBuffer = mergeAudioSegments(
            audioContext,
            audioSegments,
            totalDuration,
            audioContext.sampleRate
          );

          // MediaStream 생성
          audioDestination = audioContext.createMediaStreamDestination();
          audioSource = audioContext.createBufferSource();
          audioSource.buffer = mergedBuffer;
          audioSource.connect(audioDestination);
        }
      } catch (audioError) {
        console.warn('오디오 준비 실패, 오디오 없이 진행:', audioError);
        audioContext = null;
        audioDestination = null;
      }
    }

    onProgress?.({
      status: 'preparing',
      progress: 10,
      totalFrames,
    });

    // 이미지 프리로딩 (비동기 대기 제거로 렌더링 속도 향상)
    onProgress?.({
      status: 'preparing',
      progress: 12,
      totalFrames,
    });

    const imageMap = await preloadSceneImages(remotionScenes);

    onProgress?.({
      status: 'preparing',
      progress: 15,
      totalFrames,
    });

    // 비디오 스트림 생성 (수동 프레임 캡처 모드)
    // captureStream(0)은 자동 캡처를 비활성화하고,
    // requestFrame() 호출 시에만 프레임을 캡처합니다.
    // 이는 requestAnimationFrame 스로틀링 문제를 방지합니다.
    const videoStream = canvas.captureStream(0);
    const videoTrack = videoStream.getVideoTracks()[0] as any;
    const canRequestFrame = videoTrack && typeof videoTrack.requestFrame === 'function';

    // 오디오 트랙이 있으면 추가
    let combinedStream: MediaStream;
    if (audioDestination) {
      combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ]);
    } else {
      combinedStream = videoStream;
    }

    // MediaRecorder 설정 (오디오 코덱 포함)
    const mimeType = config.format === 'webm'
      ? (audioDestination ? 'video/webm;codecs=vp9,opus' : 'video/webm')
      : 'video/mp4';

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: config.resolution === '1080p' ? 10000000 : 5000000,
      audioBitsPerSecond: audioDestination ? 128000 : undefined,
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        // 오디오 컨텍스트 정리
        if (audioSource) {
          try {
            audioSource.stop();
          } catch (e) {
            // 이미 중지되었을 수 있음
          }
        }
        if (audioContext) {
          audioContext.close();
        }

        const blob = new Blob(chunks, { type: `video/${config.format}` });
        const url = URL.createObjectURL(blob);

        onProgress?.({
          status: 'complete',
          progress: 100,
          totalFrames,
          currentFrame: totalFrames,
        });

        resolve({
          success: true,
          videoBlob: blob,
          videoUrl: url,
          duration: totalDuration,
        });
      };

      // 오디오 재생 시작 (있는 경우)
      if (audioSource) {
        audioSource.start(0);
      }

      mediaRecorder.start();

      onProgress?.({
        status: 'rendering',
        progress: 20,
        totalFrames,
        currentFrame: 0,
      });

      // 프레임 렌더링 - 순차적 프레임 기반
      // 이전 방식(requestAnimationFrame + 시간 기반)의 문제:
      // - 탭 비활성화 시 rAF가 ~1fps로 스로틀링 → 캔버스 갱신 정지
      // - captureStream이 같은 프레임을 반복 캡처 → 정지된 영상 출력
      // 수정: setTimeout + 순차 프레임 + captureStream(0)/requestFrame()
      let currentFrame = 0;
      const frameInterval = 1000 / fps; // ms 단위 프레임 간격

      const renderFrame = () => {
        // 종료 조건: 모든 프레임 렌더링 완료
        if (currentFrame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }

        // 현재 프레임에 해당하는 씬 계산 (Remotion Sequence와 동일한 로직)
        const { sceneIndex, frameInScene, sceneDurationFrames } = getSceneAtFrame(
          remotionScenes,
          currentFrame,
          fps
        );

        const scene = remotionScenes[sceneIndex];
        const img = imageMap.get(scene.id);

        // 배경 클리어
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (img) {
          // 장면 전환 영역 감지
          const transitionDurationFrames = config.transitionType !== 'none' ? config.transitionDuration : 0;
          const isInTransition = transitionDurationFrames > 0 &&
            sceneIndex < remotionScenes.length - 1 &&
            frameInScene >= sceneDurationFrames - transitionDurationFrames;

          if (isInTransition) {
            // 장면 전환 효과 렌더링
            const nextScene = remotionScenes[sceneIndex + 1];
            const nextImg = imageMap.get(nextScene.id);

            if (nextImg) {
              const transitionFrame = frameInScene - (sceneDurationFrames - transitionDurationFrames);
              const transitionProgress = Math.min(1, Math.max(0, transitionFrame / transitionDurationFrames));

              renderTransitionFrame(ctx, canvas, config.transitionType, transitionProgress, img, nextImg);
            } else {
              const progress = frameInScene / sceneDurationFrames;
              const scale = 1 + progress * 0.1;
              const offsetX = progress * 20;
              drawImageCover(ctx, canvas, img, scale, offsetX);
            }
          } else {
            // 일반 씬 렌더링 (Ken Burns 효과)
            const progress = frameInScene / sceneDurationFrames;
            const scale = 1 + progress * 0.1;
            const offsetX = progress * 20;
            drawImageCover(ctx, canvas, img, scale, offsetX);
          }

          // 자막 그리기 (선택적) - 큰 폰트, 자동 줄바꿈
          if (config.showSubtitles && scene.narration) {
            const fontSize = Math.round(canvas.height * 0.06);
            ctx.font = `bold ${fontSize}px Pretendard, sans-serif`;
            ctx.textAlign = 'center';

            const maxLineWidth = canvas.width * 0.9;
            const wrapText = (text: string): string[] => {
              const words = text.split('');
              const lines: string[] = [];
              let currentLine = '';

              for (const char of words) {
                const testLine = currentLine + char;
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxLineWidth && currentLine) {
                  lines.push(currentLine);
                  currentLine = char;
                } else {
                  currentLine = testLine;
                }
              }
              if (currentLine) {
                lines.push(currentLine);
              }
              return lines;
            };

            const lines = wrapText(scene.narration);
            const lineHeight = fontSize * 1.5;
            const padding = 28;
            const textX = canvas.width / 2;

            let maxWidth = 0;
            lines.forEach(line => {
              const w = ctx.measureText(line).width;
              if (w > maxWidth) maxWidth = w;
            });

            const boxHeight = lines.length * lineHeight + padding;
            const boxY = canvas.height * 0.92 - boxHeight;

            const boxX = textX - maxWidth / 2 - padding;
            const boxWidth = maxWidth + padding * 2;
            const radius = 16;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, radius);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            lines.forEach((line, index) => {
              const textY = boxY + padding / 2 + fontSize + (index * lineHeight);
              ctx.fillText(line, textX, textY);
            });
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          }
        }

        // 프레임 캡처 요청 (captureStream(0) 모드에서 명시적 캡처)
        if (canRequestFrame) {
          videoTrack.requestFrame();
        }

        currentFrame++;

        // 진행률 업데이트
        const progressPercent = 20 + (currentFrame / totalFrames) * 70;
        onProgress?.({
          status: 'rendering',
          progress: Math.min(progressPercent, 90),
          currentFrame,
          totalFrames,
        });

        // setTimeout 사용 (requestAnimationFrame 대신)
        // rAF는 탭 비활성화 시 스로틀링되어 프레임이 누락됨
        // setTimeout은 더 안정적으로 프레임 간격을 유지
        setTimeout(renderFrame, frameInterval);
      };

      // 렌더링 시작
      setTimeout(renderFrame, 0);
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
      error: error instanceof Error ? error.message : '렌더링 실패',
    };
  }
}

/**
 * 비디오 다운로드
 */
export function downloadVideo(videoBlob: Blob, filename: string): void {
  const url = URL.createObjectURL(videoBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 썸네일 생성
 */
export async function generateThumbnail(
  scene: Scene,
  width: number = 320,
  height: number = 180
): Promise<string | null> {
  const imageData = scene.customImage || scene.generatedImage;
  if (!imageData) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = `data:${imageData.mimeType};base64,${imageData.data}`;
  });
}
