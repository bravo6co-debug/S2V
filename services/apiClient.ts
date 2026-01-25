/**
 * API Client for server-side Gemini API calls
 * All Gemini API calls are now routed through Vercel serverless functions
 * to keep API keys secure on the server side.
 */

import { Character, ImageData, AspectRatio, ScenarioConfig, Scenario, Scene, ImageStyle, NarrationAudio } from '../types';
import {
    ApiError,
    QuotaExceededError,
    PermissionDeniedError,
    NetworkError,
    ImageGenerationError,
    VideoGenerationError,
    withRetry,
} from './errors';

// API base URL - empty for same-origin requests
const API_BASE = '';

// Generic API response handler with structured error handling
async function handleResponse<T>(response: Response, context: string): Promise<T> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `API error: ${response.status}`;
        const errorCode = errorData.code || 'UNKNOWN_ERROR';

        // Map HTTP status codes to specific error types
        switch (response.status) {
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
                response = await fetch(`${API_BASE}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
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

export const generateImages = async (
    prompt: string,
    characterImages: ImageData[],
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    numberOfImages: number,
    aspectRatio: AspectRatio,
    imageStyle?: ImageStyle
): Promise<ImageData[]> => {
    const response = await post<GenerateImagesResponse>('/api/generate-images', {
        prompt,
        characterImages,
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

export const generateSceneImage = async (
    scene: Scene,
    characterImages: ImageData[],
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    aspectRatio: AspectRatio,
    imageStyle?: ImageStyle
): Promise<ImageData> => {
    // Use the generate-images endpoint with the scene's imagePrompt
    const enhancedPrompt = `
**Scene from a Korean short-form video:**
${scene.imagePrompt}

**Camera Angle:** ${scene.cameraAngle}
**Mood:** ${scene.mood}

**Style Requirements:**
- Cinematic, photorealistic quality
- Korean characters if people are depicted
- Emotional storytelling through visuals
`;

    const response = await post<GenerateImagesResponse>('/api/generate-images', {
        prompt: enhancedPrompt,
        characterImages,
        propImages,
        backgroundImage,
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

    return {
        data: response.audioData,
        mimeType: response.mimeType,
        durationMs: response.durationMs,
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
