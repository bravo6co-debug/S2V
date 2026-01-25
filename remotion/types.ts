import type { ImageData, AnimationConfig, AspectRatio, Scene, NarrationAudio } from '../types';

// Remotion용 장면 데이터
export interface RemotionSceneData {
  id: string;
  sceneNumber: number;
  duration: number; // 초 단위
  imageData: ImageData;
  narration?: string;
  narrationAudio?: NarrationAudio;  // TTS 오디오 데이터
  animation?: AnimationConfig;
  mood?: string;
}

// 트랜지션 설정
export interface TransitionConfig {
  type: 'fade' | 'dissolve' | 'slide' | 'zoom' | 'none';
  duration: number; // 프레임 단위
  direction?: 'left' | 'right' | 'up' | 'down';
}

// 비디오 구성 설정
export interface VideoCompositionConfig {
  scenes: RemotionSceneData[];
  aspectRatio: AspectRatio;
  fps?: number;
  transitionType?: TransitionConfig['type'];
  transitionDuration?: number;
  showSubtitles?: boolean;
}

// Scene 타입을 RemotionSceneData로 변환하는 유틸리티 함수
export function sceneToRemotionScene(scene: Scene): RemotionSceneData | null {
  const imageData = scene.customImage || scene.generatedImage;
  if (!imageData) return null;

  return {
    id: scene.id,
    sceneNumber: scene.sceneNumber,
    duration: scene.duration,
    imageData,
    narration: scene.narration,
    narrationAudio: scene.narrationAudio,  // TTS 오디오 포함
    animation: {
      type: 'kenBurns',
      direction: 'in',
      intensity: 0.5,
    },
    mood: scene.mood,
  };
}

// 여러 Scene을 변환
export function scenesToRemotionScenes(scenes: Scene[]): RemotionSceneData[] {
  return scenes
    .map(sceneToRemotionScene)
    .filter((s): s is RemotionSceneData => s !== null);
}
