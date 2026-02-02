/**
 * API Client for server-side Gemini API calls
 * All Gemini API calls are now routed through Vercel serverless functions
 * to keep API keys secure on the server side.
 */

import { Character, ImageData, AspectRatio, ScenarioConfig, AdScenarioConfig, AdScenarioConfigV2, ClipScenarioConfig, Scenario, Scene, ImageStyle, NarrationAudio, StoryBeat } from '../types';

// ============================================
// CLOUD PROJECT TYPES
// ============================================

export interface CloudProjectListItem {
    _id: string;
    type: string;
    title: string;
    synopsis?: string;
    productName?: string;
    createdAt: string;
    updatedAt: string;
}

interface ProjectListResponse {
    success: boolean;
    projects: CloudProjectListItem[];
}

interface ProjectDetailResponse {
    success: boolean;
    project: {
        _id: string;
        type: string;
        title: string;
        synopsis?: string;
        productName?: string;
        scenarioData: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    };
}

interface ProjectSaveResponse {
    success: boolean;
    projectId: string;
}

interface ProjectDeleteResponse {
    success: boolean;
}
import {
    ApiError,
    QuotaExceededError,
    PermissionDeniedError,
    NetworkError,
    ImageGenerationError,
    VideoGenerationError,
    withRetry,
} from './errors';
import { getAudioDurationFromBase64 } from './audioUtils';
import { compressImage, getBase64Size } from './imageCompression';

// API base URL - empty for same-origin requests
const API_BASE = '';

// 인증 토큰 키
const TOKEN_KEY = 's2v_auth_token';

// 인증 토큰 가져오기
function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

// Generic API response handler with structured error handling
async function handleResponse<T>(response: Response, context: string): Promise<T> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `API error: ${response.status}`;
        const errorCode = errorData.code || 'UNKNOWN_ERROR';

        // Map HTTP status codes to specific error types
        switch (response.status) {
            case 413:
                throw new ApiError(
                    '요청 데이터가 너무 큽니다. 이미지 크기를 줄여주세요.',
                    'PAYLOAD_TOO_LARGE',
                    413,
                    false
                );
            case 429:
                throw new QuotaExceededError(errorMessage);
            case 403:
                throw new PermissionDeniedError(errorMessage);
            case 400:
                throw new ApiError(errorMessage, 'VALIDATION_ERROR', 400, false);
            case 404:
                throw new ApiError(errorMessage, 'NOT_FOUND', 404, false);
            case 408:
                throw new ApiError(errorMessage, 'TIMEOUT', 408, true);
            default:
                if (context.includes('image')) {
                    throw new ImageGenerationError(errorMessage);
                }
                if (context.includes('video')) {
                    throw new VideoGenerationError(errorMessage);
                }
                throw new ApiError(errorMessage, errorCode, response.status, response.status >= 500);
        }
    }
    return response.json();
}

// Generic POST request with retry logic
async function post<T>(endpoint: string, data: unknown, context: string = 'api'): Promise<T> {
    return withRetry(
        async () => {
            let response: Response;
            try {
                // 인증 토큰 포함
                const token = getAuthToken();
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                response = await fetch(`${API_BASE}${endpoint}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(data),
                });
            } catch (e) {
                throw new NetworkError(
                    e instanceof Error ? e.message : '네트워크 요청 실패',
                    e instanceof Error ? e : undefined
                );
            }
            return handleResponse<T>(response, context);
        },
        {
            maxRetries: 2,
            initialDelay: 1000,
            shouldRetry: (err) => err.retryable && err.code !== 'VALIDATION_ERROR',
        }
    );
}

// Generic GET request
async function get<T>(endpoint: string, context: string = 'api'): Promise<T> {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    let response: Response;
    try {
        response = await fetch(`${API_BASE}${endpoint}`, { method: 'GET', headers });
    } catch (e) {
        throw new NetworkError(
            e instanceof Error ? e.message : '네트워크 요청 실패',
            e instanceof Error ? e : undefined
        );
    }
    return handleResponse<T>(response, context);
}

// Generic DELETE request
async function del<T>(endpoint: string, context: string = 'api'): Promise<T> {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    let response: Response;
    try {
        response = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE', headers });
    } catch (e) {
        throw new NetworkError(
            e instanceof Error ? e.message : '네트워크 요청 실패',
            e instanceof Error ? e : undefined
        );
    }
    return handleResponse<T>(response, context);
}

// ============================================
// CHARACTER EXTRACTION
// ============================================

interface ExtractCharacterResponse {
    name: string;
    age: string;
    personality: string;
    outfit: string;
    englishDescription: string;
}

export const extractCharacterData = async (
    description: string
): Promise<Omit<Character, 'id' | 'image'> & { englishDescription: string }> => {
    return post<ExtractCharacterResponse>('/api/extract-character', { description }, 'character');
};

// ============================================
// IMAGE GENERATION
// ============================================

interface GenerateImagesResponse {
    images: ImageData[];
}

export const generateCharacterPortraits = async (
    prompt: string,
    numberOfImages: number,
    aspectRatio: AspectRatio,
    imageStyle?: ImageStyle
): Promise<ImageData[]> => {
    const response = await post<GenerateImagesResponse>('/api/generate-portraits', {
        prompt,
        numberOfImages,
        aspectRatio,
        imageStyle,
    }, 'image-portrait');
    return response.images;
};

export const generatePropImages = async (
    prompt: string,
    numberOfImages: number,
    aspectRatio: AspectRatio,
    imageStyle?: ImageStyle
): Promise<ImageData[]> => {
    const response = await post<GenerateImagesResponse>('/api/generate-props', {
        prompt,
        numberOfImages,
        aspectRatio,
        imageStyle,
    }, 'image-prop');
    return response.images;
};

export const generateBackgroundImages = async (
    prompt: string,
    locationType: string,
    timeOfDay: string,
    weather: string,
    numberOfImages: number,
    aspectRatio: AspectRatio,
    imageStyle?: ImageStyle
): Promise<ImageData[]> => {
    const response = await post<GenerateImagesResponse>('/api/generate-backgrounds', {
        prompt,
        locationType,
        timeOfDay,
        weather,
        numberOfImages,
        aspectRatio,
        imageStyle,
    }, 'image-background');
    return response.images;
};

// 이름이 포함된 캐릭터 이미지 타입
export interface NamedCharacterImage {
    name: string;
    image: ImageData;
}

export const generateImages = async (
    prompt: string,
    characterImages: ImageData[],
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    numberOfImages: number,
    aspectRatio: AspectRatio,
    imageStyle?: ImageStyle,
    namedCharacters?: NamedCharacterImage[]  // 씬별 캐릭터 이름+이미지 (일관성 향상)
): Promise<ImageData[]> => {
    const response = await post<GenerateImagesResponse>('/api/generate-images', {
        prompt,
        characterImages,
        namedCharacters,  // 이름이 포함된 캐릭터 전달
        propImages,
        backgroundImage,
        numberOfImages,
        aspectRatio,
        imageStyle,
    }, 'image-scene');
    return response.images;
};

// ============================================
// IMAGE EDITING
// ============================================

interface EditImageResponse {
    image: ImageData;
}

export const editImage = async (
    baseImage: ImageData,
    modificationPrompt: string
): Promise<ImageData> => {
    const response = await post<EditImageResponse>('/api/edit-image', {
        baseImage,
        modificationPrompt,
    }, 'image-edit');
    return response.image;
};

// ============================================
// SCENARIO GENERATION
// ============================================

interface GenerateScenarioResponse {
    scenario: Scenario;
}

export const generateScenario = async (config: ScenarioConfig): Promise<Scenario> => {
    const response = await post<GenerateScenarioResponse>('/api/generate-scenario', { config }, 'scenario');
    return response.scenario;
};

// 광고 시나리오 생성 (V1 - legacy AICPAC)
export const generateAdScenario = async (config: AdScenarioConfig): Promise<Scenario> => {
    const response = await post<GenerateScenarioResponse>('/api/generate-ad-scenario', { config }, 'scenario');
    return response.scenario;
};

// 광고 시나리오 생성 V2 (HDSER 프레임워크)
export const generateAdScenarioV2 = async (config: AdScenarioConfigV2): Promise<Scenario> => {
    const response = await post<GenerateScenarioResponse>('/api/generate-ad-scenario-v2', { config }, 'scenario');
    return response.scenario;
};

// 클립 시나리오 생성 (6초 단위, Hailuo AI 전용)
export const generateClipScenario = async (config: ClipScenarioConfig): Promise<Scenario> => {
    const response = await post<GenerateScenarioResponse>('/api/generate-clip-scenario', { config }, 'clip scenario');
    return response.scenario;
};

// ============================================
// AD SCENE IMAGE PIPELINE (FLUX 엔진)
// ============================================

// HDSER Beat별 변형 강도 (strength)
// 낮을수록 앵커 이미지에 가까움 (일관성 유지)
const HDSER_BEAT_STRENGTH: Record<string, number> = {
    'Hook': 0.75,        // 시선 끌기 → 앵커와 다른 분위기
    'Discovery': 0.25,   // 상품 소개 → 앵커와 유사 유지
    'Story': 0.45,       // 스토리 전개 → 적당한 변형
    'Experience': 0.55,  // 체험/감동 → 중간 이상 변형
    'Reason': 0.35,      // 구매 이유 → 상품 중심 유지
};

export function getStrengthForBeat(beat: StoryBeat): number {
    return HDSER_BEAT_STRENGTH[beat] ?? 0.5;
}

interface AdSceneImageResponse {
    image: ImageData;
}

export type AdPipelineStep = 'anchor' | 'variation';

export interface GenerateAdSceneImageParams {
    imagePrompt: string;
    mood?: string;
    cameraAngle?: string;
    pipelineStep: AdPipelineStep;
    referenceImages?: ImageData[];
    anchorImage?: ImageData;
    strength?: number;
    aspectRatio: AspectRatio;
    imageStyle?: ImageStyle;
}

/**
 * FLUX 파이프라인 전용: 광고 씬 이미지 생성
 * - anchor: flux-2-turbo-edit (최대 4장 참조)
 * - variation: flux-krea-i2i (앵커 기반 + strength 제어)
 */
export const generateAdSceneImage = async (
    params: GenerateAdSceneImageParams
): Promise<ImageData> => {
    const response = await post<AdSceneImageResponse>(
        '/api/generate-ad-scene-image',
        params,
        'image-ad-scene'
    );
    return response.image;
};

interface RegenerateSceneResponse {
    scene: Scene;
}

export const regenerateScene = async (
    scenario: Scenario,
    sceneId: string,
    customInstruction?: string
): Promise<Scene> => {
    const response = await post<RegenerateSceneResponse>('/api/regenerate-scene', {
        scenario,
        sceneId,
        customInstruction,
    }, 'scene');
    return response.scene;
};

// 이미지 데이터 압축 헬퍼 함수
const compressImageData = async (imageData: ImageData): Promise<ImageData> => {
    // 이미지 크기 확인 (300KB 초과 시 압축)
    const currentSize = getBase64Size(imageData.data);
    if (currentSize <= 300 * 1024) {
        return imageData;
    }

    try {
        const dataUrl = `data:${imageData.mimeType};base64,${imageData.data}`;
        const compressed = await compressImage(dataUrl);
        return { mimeType: compressed.mimeType, data: compressed.data };
    } catch (e) {
        console.warn('Image compression failed, using original:', e);
        return imageData;
    }
};

export const generateSceneImage = async (
    scene: Scene,
    characterImages: ImageData[],
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    aspectRatio: AspectRatio,
    imageStyle?: ImageStyle,
    namedCharacters?: NamedCharacterImage[]  // 씬에 등장하는 캐릭터들 (이름+이미지)
): Promise<ImageData> => {
    // 씬에 등장하는 캐릭터 이름을 프롬프트에 포함
    const charactersInScene = scene.characters && scene.characters.length > 0
        ? `**Characters in this scene:** ${scene.characters.join(', ')}`
        : '';

    // namedCharacters 이미지 압축 (페이로드 크기 초과 방지)
    let compressedNamedCharacters: NamedCharacterImage[] | undefined;
    if (namedCharacters && namedCharacters.length > 0) {
        compressedNamedCharacters = await Promise.all(
            namedCharacters.map(async (char) => ({
                name: char.name,
                image: await compressImageData(char.image),
            }))
        );
    }

    // characterImages 압축
    const compressedCharacterImages = await Promise.all(
        characterImages.map(compressImageData)
    );

    // propImages 압축
    const compressedPropImages = await Promise.all(
        propImages.map(compressImageData)
    );

    // backgroundImage 압축
    const compressedBackgroundImage = backgroundImage
        ? await compressImageData(backgroundImage)
        : null;

    // Use the generate-images endpoint with the scene's imagePrompt
    const enhancedPrompt = `
**Scene from a Korean short-form video:**
${scene.imagePrompt}

**Camera Angle:** ${scene.cameraAngle}
**Mood:** ${scene.mood}
${charactersInScene}

**Style Requirements:**
- Korean characters if people are depicted
- Emotional storytelling through visuals
- IMPORTANT: Each character must look EXACTLY like their reference photo
`;

    const response = await post<GenerateImagesResponse>('/api/generate-images', {
        prompt: enhancedPrompt,
        characterImages: compressedCharacterImages,
        namedCharacters: compressedNamedCharacters,  // 압축된 캐릭터 전달
        propImages: compressedPropImages,
        backgroundImage: compressedBackgroundImage,
        numberOfImages: 1,
        aspectRatio,
        imageStyle,
    }, 'image-scene');

    if (!response.images || response.images.length === 0) {
        throw new ImageGenerationError('Failed to generate scene image');
    }

    return response.images[0];
};

// ============================================
// VIDEO GENERATION
// ============================================

export interface VideoGenerationResult {
    videoUrl: string;
    thumbnailUrl: string;
    duration: number;
}

export const generateVideoFromImage = async (
    sourceImage: ImageData,
    motionPrompt: string,
    durationSeconds: number = 5
): Promise<VideoGenerationResult> => {
    return post<VideoGenerationResult>('/api/generate-video', {
        sourceImage,
        motionPrompt,
        durationSeconds,
    }, 'video');
};

export const checkVideoApiAvailability = async (): Promise<{ available: boolean; error?: string }> => {
    try {
        return { available: true };
    } catch (e) {
        return {
            available: false,
            error: e instanceof Error ? e.message : 'Unknown error',
        };
    }
};

/** @deprecated Use checkVideoApiAvailability */
export const checkVeoApiAvailability = checkVideoApiAvailability;

// ============================================
// FOOD VIDEO GENERATION (2-step)
// ============================================

// Step 1: 한국어 프롬프트 → 영어 프롬프트 변환
export interface TranslateFoodPromptResult {
    englishPrompt: string;
    koreanDescription: string;
}

export const translateFoodPrompt = async (
    prompt: string
): Promise<TranslateFoodPromptResult> => {
    return post<TranslateFoodPromptResult>('/api/translate-food-prompt', {
        prompt,
    }, 'food-translate');
};

// Step 2: 영어 프롬프트 + 이미지 → 영상 생성
export interface FoodVideoResult {
    videoUrl: string;
    duration: number;
}

export const generateFoodVideo = async (
    foodImage: ImageData,
    englishPrompt: string,
    durationSeconds: number = 6
): Promise<FoodVideoResult> => {
    return post<FoodVideoResult>('/api/generate-food-video', {
        foodImage,
        englishPrompt,
        durationSeconds,
    }, 'video');
};

// ============================================
// MUKBANG (먹방) IMAGE GENERATION
// ============================================

export type MukbangPersonType = 'young-woman' | 'young-man' | 'middle-woman' | 'middle-man';

export interface MukbangImageResult {
    compositeImage: ImageData;
    videoPrompt: string;
}

/**
 * FLUX 2 Turbo Edit로 먹방 합성 이미지 생성
 * 음식 사진 + 인물 사진(또는 생성)을 합성하여 먹방 장면 생성
 */
export const generateMukbangImage = async (
    foodImage: ImageData,
    foodName: string,
    options: {
        personImage?: ImageData;
        generatePerson?: boolean;
        personType?: MukbangPersonType;
        customPersonPrompt?: string;
        customScenePrompt?: string;
    }
): Promise<MukbangImageResult> => {
    return post<MukbangImageResult>('/api/generate-mukbang-image', {
        foodImage,
        foodName,
        personImage: options.personImage,
        generatePerson: options.generatePerson,
        personType: options.personType,
        customPersonPrompt: options.customPersonPrompt,
        customScenePrompt: options.customScenePrompt,
    }, 'mukbang-image');
};

// ============================================
// TTS NARRATION GENERATION
// ============================================

// TTS 음성 타입
export type TTSVoice = 'Kore' | 'Aoede' | 'Charon' | 'Fenrir' | 'Puck';

interface GenerateNarrationResponse {
    audioData: string;
    mimeType: string;
    durationMs?: number;
    sceneId?: string;
}

/**
 * Generate TTS audio for narration text
 */
export const generateNarration = async (
    text: string,
    voice: TTSVoice = 'Kore',
    sceneId?: string
): Promise<NarrationAudio> => {
    const response = await post<GenerateNarrationResponse>('/api/generate-narration', {
        text,
        voice,
        sceneId,
    }, 'tts');

    // Calculate duration using Mediabunny if not provided by API
    let durationMs = response.durationMs;
    if (!durationMs && response.audioData) {
        try {
            durationMs = await getAudioDurationFromBase64(response.audioData, response.mimeType);
        } catch (error) {
            console.warn('Failed to calculate audio duration with Mediabunny:', error);
            // Fallback: estimate duration from text length (approx 150ms per character for Korean)
            durationMs = text.length * 150;
        }
    }

    return {
        data: response.audioData,
        mimeType: response.mimeType,
        durationMs,
        voice,
    };
};

/**
 * Generate narration audio for all scenes in a scenario
 * Includes delay between calls to avoid rate limiting and retry on failure
 */
export const generateAllNarrations = async (
    scenes: Scene[],
    voice: TTSVoice = 'Kore',
    onProgress?: (sceneId: string, index: number, total: number) => void
): Promise<{ results: Map<string, NarrationAudio>; failedSceneIds: string[] }> => {
    const results = new Map<string, NarrationAudio>();
    const failedSceneIds: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        if (!scene.narration?.trim()) continue;

        // 첫 번째 씬 이후에는 1초 딜레이 (API 속도 제한 방지)
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        let success = false;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                onProgress?.(scene.id, i, scenes.length);
                const audio = await generateNarration(scene.narration, voice, scene.id);
                results.set(scene.id, audio);
                success = true;
                break;
            } catch (error) {
                console.error(`TTS attempt ${attempt + 1}/3 failed for scene ${scene.id}:`, error);
                if (attempt < 2) {
                    // 재시도 전 대기 (2초, 4초)
                    await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
                }
            }
        }

        if (!success) {
            failedSceneIds.push(scene.id);
        }
    }

    return { results, failedSceneIds };
};

// ============================================
// CLOUD PROJECT SAVE/LOAD
// ============================================

/**
 * 시나리오에서 바이너리 데이터(이미지, 오디오)를 제거한 경량 복사본 생성
 * MongoDB 저장용 (JSON 텍스트만 보관)
 */
function stripBinaryData(scenario: Scenario): Record<string, unknown> {
    const stripped = {
        ...scenario,
        productImage: undefined,
        scenes: scenario.scenes.map(scene => ({
            ...scene,
            generatedImage: undefined,
            customImage: undefined,
            imageHistory: undefined,
            narrationAudio: undefined,
        })),
    };
    return stripped as unknown as Record<string, unknown>;
}

/**
 * 클라우드에 프로젝트 저장 (신규 또는 업데이트)
 */
export const saveProjectToCloud = async (
    scenario: Scenario,
    projectId?: string
): Promise<string> => {
    const scenarioData = stripBinaryData(scenario);
    const response = await post<ProjectSaveResponse>('/api/projects', {
        projectId,
        type: scenario.scenarioType === 'ad' ? 'ad-scenario' : 'ad-scenario',
        title: scenario.title,
        synopsis: scenario.synopsis,
        productName: scenario.productName,
        scenarioData,
    }, 'project-save');
    return response.projectId;
};

/**
 * 내 프로젝트 목록 조회
 */
export const getMyProjects = async (): Promise<CloudProjectListItem[]> => {
    const response = await get<ProjectListResponse>('/api/projects', 'project-list');
    return response.projects;
};

/**
 * 프로젝트 상세 조회 (scenarioData 포함)
 */
export const loadProjectFromCloud = async (projectId: string): Promise<Scenario> => {
    const response = await get<ProjectDetailResponse>(`/api/projects?id=${projectId}`, 'project-load');
    return response.project.scenarioData as unknown as Scenario;
};

/**
 * 프로젝트 삭제
 */
export const deleteProjectFromCloud = async (projectId: string): Promise<void> => {
    await del<ProjectDeleteResponse>(`/api/projects?id=${projectId}`, 'project-delete');
};
