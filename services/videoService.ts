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
    '4k': { width: 2160, height: 3840 },
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

    // 비디오 스트림 생성
    const videoStream = canvas.captureStream(fps);

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
      videoBitsPerSecond: config.resolution === '4k' ? 20000000 :
                          config.resolution === '1080p' ? 10000000 : 5000000,
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

      // 각 씬을 순차적으로 렌더링
      let currentFrame = 0;
      let sceneIndex = 0;
      let frameInScene = 0;

      const renderFrame = () => {
        if (currentFrame >= totalFrames || sceneIndex >= remotionScenes.length) {
          mediaRecorder.stop();
          return;
        }

        const scene = remotionScenes[sceneIndex];
        const sceneDurationFrames = Math.round(scene.duration * fps);

        // 이미지 그리기
        const img = new Image();
        img.onload = () => {
          // 배경 클리어
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Ken Burns 효과 계산
          const progress = frameInScene / sceneDurationFrames;
          const scale = 1 + progress * 0.1; // 10% 확대
          const offsetX = progress * 20; // 약간의 이동

          // 이미지 그리기 (cover 방식)
          const imgRatio = img.width / img.height;
          const canvasRatio = canvas.width / canvas.height;

          let drawWidth, drawHeight, drawX, drawY;

          if (imgRatio > canvasRatio) {
            drawHeight = canvas.height * scale;
            drawWidth = drawHeight * imgRatio;
          } else {
            drawWidth = canvas.width * scale;
            drawHeight = drawWidth / imgRatio;
          }

          drawX = (canvas.width - drawWidth) / 2 - offsetX;
          drawY = (canvas.height - drawHeight) / 2;

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

          // 자막 그리기 (선택적)
          if (config.showSubtitles && scene.narration) {
            const fontSize = Math.round(canvas.height * 0.025);
            ctx.font = `${fontSize}px Pretendard, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';

            const textWidth = ctx.measureText(scene.narration).width;
            const padding = 20;
            const textX = canvas.width / 2;
            const textY = canvas.height * 0.9;

            ctx.fillRect(
              textX - textWidth / 2 - padding,
              textY - fontSize - padding / 2,
              textWidth + padding * 2,
              fontSize + padding
            );

            ctx.fillStyle = '#fff';
            ctx.fillText(scene.narration, textX, textY);
          }

          frameInScene++;
          currentFrame++;

          if (frameInScene >= sceneDurationFrames) {
            sceneIndex++;
            frameInScene = 0;
          }

          // 진행률 업데이트
          const progressPercent = 20 + (currentFrame / totalFrames) * 70;
          onProgress?.({
            status: 'rendering',
            progress: progressPercent,
            currentFrame,
            totalFrames,
          });

          // 다음 프레임 요청 (FPS에 맞춰)
          setTimeout(renderFrame, 1000 / fps);
        };

        img.src = `data:${scene.imageData.mimeType};base64,${scene.imageData.data}`;
      };

      renderFrame();
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
