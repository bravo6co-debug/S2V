import type { LongformConfig, LongformScenario, LongformScene, LongformCharacter } from '../types/longform';
import type { ImageData } from '../types';

const API_BASE = '';
const TOKEN_KEY = 's2v_auth_token';

export class LongformApiError extends Error {
  code: string;
  retryable: boolean;
  status: number;

  constructor(
    message: string,
    options: { code?: string; retryable?: boolean; status?: number } = {},
  ) {
    super(message);
    this.name = 'LongformApiError';
    this.code = options.code ?? 'UNKNOWN';
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? 0;
  }
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

async function handleResponse<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new LongformApiError(
      errorData.error || `${context} failed: ${response.status}`,
      {
        code: typeof errorData.code === 'string' ? errorData.code : undefined,
        retryable: Boolean(errorData.retryable),
        status: response.status,
      },
    );
  }
  return response.json();
}

async function post<T>(endpoint: string, data: unknown, context: string): Promise<T> {
  const authToken = getAuthToken();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<T>(response, context);
}

// ─── 시나리오 생성 ────────────────────────────────
export async function generateLongformScenario(config: LongformConfig): Promise<LongformScenario> {
  const result = await post<{ scenario: any }>('/api/longform/generate-scenario', {
    topic: config.topic,
    duration: config.duration,
    ...(config.textModel && { textModel: config.textModel }),
    ...(config.referenceText && { referenceText: config.referenceText }),
    ...(config.imageFrequency && { imageFrequency: config.imageFrequency }),
  }, 'Generate Longform Scenario');

  return {
    id: result.scenario.id,
    config,
    scenes: result.scenario.scenes,
    metadata: result.scenario.metadata,
    createdAt: result.scenario.createdAt,
  } as LongformScenario;
}

// ─── 나레이션 보정 ────────────────────────────────
export async function validateNarration(
  narration: string,
  context?: string,
  textModel?: string
): Promise<{ narration: string; charCount: number; adjusted: boolean }> {
  return post('/api/longform/validate-narration', {
    narration,
    targetMin: 432,
    targetMax: 444,
    context,
    ...(textModel && { textModel }),
  }, 'Validate Narration');
}

// ─── 씬 이미지 일괄 생성 ─────────────────────────
export interface SceneImageInput {
  sceneNumber: number;
  subIndex?: number;             // 씬 내 sub-image 인덱스 (롱폼2 용, 미지정 시 0)
  imagePrompt: string;
  cameraAngle?: string;
  lightingMood?: string;
  mood?: string;
  characterIndices?: number[];   // characterImages 풀 인덱스 — 페이로드 중복 방지
}

export interface SceneImageResult {
  sceneNumber: number;
  subIndex: number;              // 백엔드가 항상 응답에 포함
  success: boolean;
  image?: { mimeType: string; data: string };
  error?: string;
}

/**
 * 씬 이미지 일괄 생성.
 * @param characterImages — 캐릭터 참조 이미지 풀 (deduplicated). 각 sceneInput.characterIndices가 이 배열을 인덱스로 참조
 */
export async function generateSceneImages(
  scenes: SceneImageInput[],
  imageModel: string,
  batchSize: number = 5,
  characterImages: ImageData[] = []
): Promise<{ results: SceneImageResult[] }> {
  return post('/api/longform/generate-scene-images', {
    scenes,
    imageModel,
    batchSize,
    characterImages,
  }, 'Generate Scene Images');
}

// ─── 캐릭터 추출 ────────────────────────────────
export async function extractLongformCharacters(
  scenes: { sceneNumber: number; imagePrompt: string; narration: string }[],
  metadata: { title: string; synopsis: string },
  textModel?: string
): Promise<{ characters: LongformCharacter[] }> {
  return post('/api/longform/extract-characters', {
    scenes,
    metadata,
    ...(textModel && { textModel }),
  }, 'Extract Longform Characters');
}

// ─── 캐릭터 이미지 생성 (개별) ──────────────────
export async function generateCharacterImage(
  characterName: string,
  appearanceDescription: string,
  outfit: string,
  imageModel: string
): Promise<{ image: { mimeType: string; data: string } }> {
  return post('/api/longform/generate-character-image', {
    characterName,
    appearanceDescription,
    outfit,
    imageModel,
  }, 'Generate Character Image');
}

// ─── 나레이션 일괄 생성 ──────────────────────────
export async function generateNarrations(
  scenes: { sceneNumber: number; narration: string }[],
  ttsProvider: string,
  ttsModel: string,
  voice: string,
  batchSize: number = 5
): Promise<{
  results: {
    sceneNumber: number;
    success: boolean;
    audio?: { mimeType: string; data: string };
    durationSeconds?: number;
    error?: string;
  }[];
}> {
  return post('/api/longform/generate-narrations', {
    scenes,
    ttsProvider,
    ttsModel,
    voice,
    batchSize,
  }, 'Generate Narrations');
}
