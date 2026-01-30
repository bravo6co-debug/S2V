/**
 * API Client for server-side Gemini API calls
 * All Gemini API calls are now routed through Vercel serverless functions
 * to keep API keys secure on the server side.
 */

import { Character, ImageData, AspectRatio, ScenarioConfig, AdScenarioConfig, Scenario, Scene, ImageStyle, NarrationAudio } from '../types';
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

// 광고 시나리오 생성
export const generateAdScenario = async (config: AdScenarioConfig): Promise<Scenario> => {
    const response = await post<GenerateScenarioResponse>('/api/generate-ad-scenario', { config }, 'scenario');
    return response.scenario;
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
- Cinematic, photorealistic quality
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

export const checkVeoApiAvailability = async (): Promise<{ available: boolean; error?: string }> => {
    // Since Veo availability depends on the server-side API key,
    // we'll make a simple test request and handle errors appropriately
    try {
        // This will be handled by the generate-video endpoint
        // For now, we assume availability and let errors propagate naturally
        return { available: true };
    } catch (e) {
        return {
            available: false,
            error: e instanceof Error ? e.message : 'Unknown error',
        };
    }
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
 */
export const generateAllNarrations = async (
    scenes: Scene[],
    voice: TTSVoice = 'Kore',
    onProgress?: (sceneId: string, index: number, total: number) => void
): Promise<Map<string, NarrationAudio>> => {
    const results = new Map<string, NarrationAudio>();

    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        if (!scene.narration?.trim()) continue;

        try {
            onProgress?.(scene.id, i, scenes.length);
            const audio = await generateNarration(scene.narration, voice, scene.id);
            results.set(scene.id, audio);
        } catch (error) {
            console.error(`Failed to generate narration for scene ${scene.id}:`, error);
            // Continue with other scenes even if one fails
        }
    }

    return results;
};
