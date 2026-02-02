import type { LongformConfig, LongformScenario, LongformScene, LongformCharacter } from '../types/longform';

const API_BASE = '';
const TOKEN_KEY = 's2v_auth_token';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

async function handleResponse<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `${context} failed: ${response.status}`);
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
  }, 'Generate Longform Scenario');

  return {
    id: result.scenario.id,
    config,
    hookScene: result.scenario.hookScene,
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

// ─── 후킹 이미지 생성 ────────────────────────────
export async function generateHookImage(
  visualDescription: string,
  imageModel: string
): Promise<{ image: { mimeType: string; data: string } }> {
  return post('/api/longform/generate-hook-image', {
    visualDescription,
    style: 'animation',
    imageModel,
  }, 'Generate Hook Image');
}

// ─── 후킹 영상 생성 ────────────────────────────
export async function generateHookVideo(
  sourceImage: string,
  motionPrompt: string
): Promise<{ videoUrl: string; thumbnailUrl: string }> {
  return post('/api/longform/generate-hook-video', {
    sourceImage,
    motionPrompt,
    durationSeconds: 10,
  }, 'Generate Hook Video');
}

// ─── 씬 이미지 일괄 생성 ─────────────────────────
export async function generateSceneImages(
  scenes: { sceneNumber: number; imagePrompt: string }[],
  imageModel: string,
  batchSize: number = 5
): Promise<{
  results: {
    sceneNumber: number;
    success: boolean;
    image?: { mimeType: string; data: string };
    error?: string;
  }[];
}> {
  return post('/api/longform/generate-scene-images', {
    scenes,
    imageModel,
    batchSize,
  }, 'Generate Scene Images');
}

// ─── 캐릭터 추출 ────────────────────────────────
export async function extractLongformCharacters(
  scenes: { sceneNumber: number; imagePrompt: string; narration: string }[],
  hookScene: { visualDescription: string; hookText: string },
  metadata: { title: string; synopsis: string },
  textModel?: string
): Promise<{ characters: LongformCharacter[] }> {
  return post('/api/longform/extract-characters', {
    scenes,
    hookScene,
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
