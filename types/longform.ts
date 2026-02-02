// types/longform.ts

import type { ImageData, NarrationAudio } from '../types';

// ─── 이미지 모델 ──────────────────────────────────
export type LongformImageModel =
  | 'gemini-3-pro-image-preview'
  | 'gemini-2.5-flash-image'
  | 'imagen-4.0-generate-001'
  | 'imagen-4.0-fast-generate-001'
  | 'flux-kontext-pro'
  | 'flux-kontext-max';

// ─── TTS 모델 ────────────────────────────────────
export type TtsProvider = 'openai' | 'gemini';

export type OpenAiTtsModel = 'tts-1' | 'tts-1-hd';
export type GeminiTtsModel = 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts';
export type LongformTtsModel = OpenAiTtsModel | GeminiTtsModel;

export type OpenAiVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type GeminiVoice = 'Kore' | 'Aoede' | 'Charon' | 'Fenrir' | 'Puck';

export interface TtsConfig {
  provider: TtsProvider;
  model: LongformTtsModel;
  voice: OpenAiVoice | GeminiVoice;
}

// ─── 기본 설정 ────────────────────────────────────
export type LongformDuration = 10 | 20 | 30 | 40 | 50 | 60;

export interface LongformConfig {
  topic: string;
  referenceText?: string;
  duration: LongformDuration;
  imageModel: LongformImageModel;
  textModel?: string;
  tts: TtsConfig;
}

// ─── 후킹 씬 ─────────────────────────────────────
export type AssetStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface HookScene {
  visualDescription: string;
  motionPrompt: string;
  hookText: string;
  generatedImage?: ImageData;
  generatedVideo?: {
    url: string;
    thumbnailUrl: string;
  };
  imageStatus: AssetStatus;
  videoStatus: AssetStatus;
}

// ─── 본편 씬 ─────────────────────────────────────
export type StoryPhase = '도입' | '전개' | '심화' | '절정' | '마무리';

export interface LongformScene {
  id: string;
  sceneNumber: number;
  timeRange: string;
  imagePrompt: string;
  narration: string;
  narrationCharCount: number;
  storyPhase: StoryPhase;
  mood: string;
  generatedImage?: ImageData;
  narrationAudio?: NarrationAudio;
  imageStatus: AssetStatus;
  narrationStatus: AssetStatus;
}

// ─── 캐릭터 ─────────────────────────────────────
export type CharacterRole = 'main' | 'supporting' | 'minor';

export interface LongformCharacter {
  id: string;
  name: string;                    // 한국어 이름
  nameEn: string;                  // 영어 이름 (이미지 프롬프트용)
  role: CharacterRole;
  appearanceDescription: string;   // 영어 외형 묘사 (상세)
  outfit: string;                  // 영어 의상 묘사
  personality: string;             // 한국어 성격 요약
  sceneNumbers: number[];          // 등장 씬 번호
  referenceImage?: ImageData;      // 레퍼런스 포트레이트
  imageStatus: AssetStatus;
}

// ─── 전체 시나리오 ────────────────────────────────
export interface LongformScenario {
  id: string;
  config: LongformConfig;
  hookScene: HookScene;
  scenes: LongformScene[];
  characters?: LongformCharacter[];
  metadata: {
    title: string;
    synopsis: string;
    totalScenes: number;
    estimatedDuration: string;
  };
  createdAt: number;
}

// ─── 생성 진행 상태 ───────────────────────────────
export type GenerationStep = 'hook-image' | 'hook-video' | 'scene-images' | 'narrations' | 'completed';

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
}

export interface GenerationProgress {
  currentStep: GenerationStep;
  hookImage: AssetStatus;
  hookVideo: AssetStatus;
  sceneImages: BatchProgress;
  narrations: BatchProgress;
  overallPercent: number;
}

// ─── 출력물 ──────────────────────────────────────
export interface LongformOutput {
  hookVideo: {
    url: string;
    duration: 10;
    format: 'mp4';
  } | null;
  partOne: {
    blob?: Blob;
    duration: number;
    sceneCount: number;
    format: 'mp4' | 'webm';
  } | null;
  partTwo: {
    blob?: Blob;
    duration: number;
    sceneCount: number;
    format: 'mp4' | 'webm';
  } | null;
}

// ─── 워크플로우 상태 ──────────────────────────────
export type LongformStep = 1 | 2 | 3 | 4 | 5;

export interface LongformState {
  currentStep: LongformStep;
  config: LongformConfig | null;
  scenario: LongformScenario | null;
  progress: GenerationProgress | null;
  output: LongformOutput | null;
}

// ─── 이미지 모델 옵션 (UI용) ─────────────────────
export interface ImageModelOption {
  value: LongformImageModel;
  label: string;
  provider: 'google' | 'eachlabs';
  costPerImage: string;
  description: string;
}

export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', provider: 'google', costPerImage: '~$0.039', description: '빠른 생성, 기본 추천' },
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image', provider: 'google', costPerImage: '~$0.24', description: '최고 품질 (4K)' },
  { value: 'imagen-4.0-generate-001', label: 'Imagen 4.0', provider: 'google', costPerImage: '~$0.039', description: '고품질' },
  { value: 'imagen-4.0-fast-generate-001', label: 'Imagen 4.0 Fast', provider: 'google', costPerImage: '~$0.039', description: '속도 우선' },
  { value: 'flux-kontext-pro', label: 'FLUX Kontext Pro', provider: 'eachlabs', costPerImage: '$0.04', description: '고품질' },
  { value: 'flux-kontext-max', label: 'FLUX Kontext Max', provider: 'eachlabs', costPerImage: '$0.08', description: '최고 품질' },
];

export const OPENAI_VOICE_OPTIONS: { value: OpenAiVoice; label: string; description: string }[] = [
  { value: 'alloy', label: 'Alloy', description: '중성적, 균형 잡힌 톤' },
  { value: 'echo', label: 'Echo', description: '남성적, 따뜻한 톤' },
  { value: 'fable', label: 'Fable', description: '표현력 풍부, 내레이터 스타일' },
  { value: 'onyx', label: 'Onyx', description: '깊고 굵은 남성 음성' },
  { value: 'nova', label: 'Nova', description: '밝고 활기찬 여성 음성 (한국어 추천)' },
  { value: 'shimmer', label: 'Shimmer', description: '부드럽고 차분한 여성 음성' },
];

export const GEMINI_VOICE_OPTIONS: { value: GeminiVoice; label: string }[] = [
  { value: 'Kore', label: 'Kore' },
  { value: 'Aoede', label: 'Aoede' },
  { value: 'Charon', label: 'Charon' },
  { value: 'Fenrir', label: 'Fenrir' },
  { value: 'Puck', label: 'Puck' },
];

export const DURATION_OPTIONS: { value: LongformDuration; label: string }[] = [
  { value: 10, label: '10분' },
  { value: 20, label: '20분' },
  { value: 30, label: '30분' },
  { value: 40, label: '40분' },
  { value: 50, label: '50분' },
  { value: 60, label: '60분' },
];

// ─── 기본값 ──────────────────────────────────────
export const DEFAULT_TTS_CONFIG: TtsConfig = {
  provider: 'openai',
  model: 'tts-1',
  voice: 'nova',
};

export const DEFAULT_LONGFORM_CONFIG: Omit<LongformConfig, 'topic'> = {
  duration: 30,
  imageModel: 'gemini-2.5-flash-image',
  tts: DEFAULT_TTS_CONFIG,
};

// ─── 유틸리티 함수 ────────────────────────────────
export function calculateSceneCount(duration: LongformDuration): number {
  return duration - 1;
}

export function calculateSplitPoint(totalScenes: number): number {
  return Math.ceil(totalScenes / 2);
}

export function estimateImageCost(model: LongformImageModel, sceneCount: number): string {
  const costs: Record<LongformImageModel, number> = {
    'gemini-2.5-flash-image': 0.039,
    'gemini-3-pro-image-preview': 0.24,
    'imagen-4.0-generate-001': 0.039,
    'imagen-4.0-fast-generate-001': 0.039,
    'flux-kontext-pro': 0.04,
    'flux-kontext-max': 0.08,
  };
  const total = costs[model] * (sceneCount + 1); // +1 for hook image
  return `~$${total.toFixed(2)}`;
}

export function estimateTtsCost(model: LongformTtsModel, sceneCount: number): string {
  const charsPerScene = 438;
  const totalChars = sceneCount * charsPerScene;
  if (model === 'tts-1') {
    return `~$${((totalChars / 1_000_000) * 15).toFixed(2)}`;
  }
  if (model === 'tts-1-hd') {
    return `~$${((totalChars / 1_000_000) * 30).toFixed(2)}`;
  }
  return 'API 키 종량제';
}
