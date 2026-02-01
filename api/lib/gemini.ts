/**
 * Shared Gemini AI client and configuration for serverless functions
 * This file contains the API key and should ONLY be used server-side
 */

import { GoogleGenAI, Modality, Part, Type } from "@google/genai";
import { getSettings as getSettingsFromDB, findUserById, getUserSettings, type UserSettings } from './mongodb.js';

// Default API key from environment
const defaultApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

// Export the default AI client instance (for backwards compatibility)
export const ai = defaultApiKey ? new GoogleGenAI({ apiKey: defaultApiKey }) : null;

// ============================================
// API KEY VALIDATION CACHE
// ============================================

// Cache for API key validation results: key prefix -> { valid, timestamp }
const keyValidationCache = new Map<string, { valid: boolean; timestamp: number }>();
const KEY_VALIDATION_TTL = 5 * 60 * 1000; // 5 minutes cache for validation results

/**
 * Validate a Gemini API key by making a lightweight models.list call.
 * Results are cached to avoid repeated validation overhead.
 */
async function validateApiKey(apiKey: string): Promise<boolean> {
    const cacheKey = apiKey.substring(0, 10);
    const now = Date.now();

    // Check cache first
    const cached = keyValidationCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < KEY_VALIDATION_TTL) {
        return cached.valid;
    }

    try {
        const testClient = new GoogleGenAI({ apiKey });
        // Minimal API call - list models with a page size of 1
        await testClient.models.list({ config: { pageSize: 1 } });
        keyValidationCache.set(cacheKey, { valid: true, timestamp: now });
        return true;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Only treat as invalid key if the error is specifically about the key
        if (errorMessage.includes('API key not valid') || errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('API_KEY_INVALID')) {
            console.warn(`[validateApiKey] Key starting with ${apiKey.substring(0, 6)}... is INVALID: ${errorMessage}`);
            keyValidationCache.set(cacheKey, { valid: false, timestamp: now });
            return false;
        }
        // For other errors (network, quota, etc.), assume the key is valid
        // to avoid false negatives from transient issues
        console.warn(`[validateApiKey] Non-key error during validation (treating key as valid): ${errorMessage}`);
        return true;
    }
}

// ============================================
// DYNAMIC SETTINGS FROM MONGODB
// ============================================

let cachedSettings: UserSettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1분 캐시

/**
 * MongoDB에서 설정을 가져옴 (캐싱 적용)
 */
export async function getAppSettings(): Promise<UserSettings> {
    const now = Date.now();

    // 캐시가 유효하면 캐시된 설정 반환
    if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
        return cachedSettings;
    }

    // MongoDB에서 설정 로드
    cachedSettings = await getSettingsFromDB();
    cacheTimestamp = now;

    return cachedSettings;
}

/**
 * 동적 API 키 가져오기 (MongoDB 설정 우선, 없으면 환경변수)
 */
export async function getApiKey(): Promise<string> {
    const settings = await getAppSettings();
    return settings.geminiApiKey || defaultApiKey || '';
}

/**
 * 동적 AI 클라이언트 생성
 */
export async function getAIClient(): Promise<GoogleGenAI> {
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured. Please set API key in settings or environment.');
    }
    return new GoogleGenAI({ apiKey });
}

/**
 * 사용자별 AI 클라이언트 생성
 * - 어드민: 환경변수 API 키 사용
 * - 일반 사용자: 본인의 API 키 사용 (유효하지 않으면 환경변수 키로 폴백)
 */
export async function getAIClientForUser(userId: string): Promise<GoogleGenAI> {
    const user = await findUserById(userId);

    if (!user) {
        throw new Error('사용자를 찾을 수 없습니다.');
    }

    console.log(`[getAIClientForUser] userId=${userId}, isAdmin=${user.isAdmin}, hasPersonalKey=${!!user.settings?.geminiApiKey}, hasEnvKey=${!!defaultApiKey}`);

    // 어드민은 환경변수 API 키 사용
    if (user.isAdmin) {
        if (!defaultApiKey) {
            throw new Error('서버 API 키가 설정되지 않았습니다.');
        }
        console.log(`[getAIClientForUser] Using env key (admin), keyPrefix=${defaultApiKey.substring(0, 6)}...`);
        return new GoogleGenAI({ apiKey: defaultApiKey });
    }

    // 일반 사용자는 본인의 API 키 사용
    const userApiKey = user.settings?.geminiApiKey;
    if (!userApiKey) {
        // 환경변수 키가 있으면 폴백으로 사용 (관리자 공유 키)
        if (defaultApiKey) {
            console.log(`[getAIClientForUser] No personal key, falling back to env key, keyPrefix=${defaultApiKey.substring(0, 6)}...`);
            return new GoogleGenAI({ apiKey: defaultApiKey });
        }
        throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해 주세요.');
    }

    // Validate the user's personal API key before using it
    const isValid = await validateApiKey(userApiKey);
    if (!isValid) {
        console.warn(`[getAIClientForUser] User ${userId} personal key is invalid (keyPrefix=${userApiKey.substring(0, 6)}...).`);
        if (defaultApiKey) {
            console.log(`[getAIClientForUser] Falling back to env key due to invalid personal key, keyPrefix=${defaultApiKey.substring(0, 6)}...`);
            return new GoogleGenAI({ apiKey: defaultApiKey });
        }
        // No fallback available - throw a descriptive error
        throw new Error('설정된 API 키가 유효하지 않습니다. 설정에서 올바른 Gemini API 키를 입력해 주세요.');
    }

    console.log(`[getAIClientForUser] Using personal key (validated), keyPrefix=${userApiKey.substring(0, 6)}...`);
    return new GoogleGenAI({ apiKey: userApiKey });
}

/**
 * 사용자가 API를 사용할 수 있는지 확인
 */
export async function canUserUseApi(userId: string): Promise<{ canUse: boolean; reason?: string }> {
    const user = await findUserById(userId);

    if (!user) {
        return { canUse: false, reason: '사용자를 찾을 수 없습니다.' };
    }

    // 어드민은 환경변수 API 키가 있으면 사용 가능
    if (user.isAdmin) {
        if (defaultApiKey) {
            return { canUse: true };
        }
        return { canUse: false, reason: '서버 API 키가 설정되지 않았습니다.' };
    }

    // 일반 사용자: 본인 키가 있으면 검증, 없으면 환경변수 키 폴백 확인
    if (user.settings?.geminiApiKey) {
        const isValid = await validateApiKey(user.settings.geminiApiKey);
        if (isValid) {
            return { canUse: true };
        }
        // Personal key is invalid, but env key is available as fallback
        if (defaultApiKey) {
            return { canUse: true };
        }
        return { canUse: false, reason: '설정된 API 키가 유효하지 않습니다. 설정에서 올바른 Gemini API 키를 입력해 주세요.' };
    }

    // No personal key - check env fallback
    if (defaultApiKey) {
        return { canUse: true };
    }

    return { canUse: false, reason: 'API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해 주세요.' };
}

/**
 * 동적 모델명 가져오기
 */
export async function getTextModel(): Promise<string> {
    const settings = await getAppSettings();
    return settings.textModel || MODELS.TEXT;
}

export async function getImageModel(): Promise<string> {
    const settings = await getAppSettings();
    return settings.imageModel || MODELS.IMAGE_PORTRAIT;
}

export async function getVideoModel(): Promise<string> {
    const settings = await getAppSettings();
    return settings.videoModel || MODELS.VIDEO;
}

export async function getTTSModel(): Promise<string> {
    const settings = await getAppSettings();
    return settings.ttsModel || MODELS.TTS;
}

export async function getTTSVoice(): Promise<string> {
    const settings = await getAppSettings();
    return settings.ttsVoice || TTS_VOICES.KORE;
}

/**
 * 사용자별 모델명 가져오기
 */
export async function getUserImageModel(userId: string): Promise<string> {
    const settings = await getUserSettings(userId);
    return settings.imageModel || MODELS.IMAGE_PORTRAIT;
}

export async function getUserTextModel(userId: string): Promise<string> {
    const settings = await getUserSettings(userId);
    return settings.textModel || MODELS.TEXT;
}

export async function getUserVideoModel(userId: string): Promise<string> {
    const settings = await getUserSettings(userId);
    return settings.videoModel || MODELS.VIDEO;
}

export async function getUserTTSModel(userId: string): Promise<string> {
    const settings = await getUserSettings(userId);
    return settings.ttsModel || MODELS.TTS;
}

export async function getUserTTSVoice(userId: string): Promise<string> {
    const settings = await getUserSettings(userId);
    return settings.ttsVoice || TTS_VOICES.KORE;
}

// ============================================
// MODEL CONFIGURATION
// ============================================
export const MODELS = {
    // Text/prompt generation model (Gemini 3 Flash - fast with Pro-grade reasoning)
    TEXT: 'gemini-3-flash-preview',

    // Image generation models (Gemini native image generation)
    IMAGE_PORTRAIT: 'gemini-2.5-flash-image',  // Character/prop/background portraits
    IMAGE_SCENE: 'gemini-2.5-flash-image',     // Scene images (with references)

    // Video generation model (Hailuo V2.3 via eachlabs.ai)
    VIDEO: 'minimax-hailuo-v2-3-fast-standard-image-to-video',

    // Text-to-Speech (TTS) model for narration
    TTS: 'gemini-2.5-flash-preview-tts',
} as const;

// ============================================
// GEMINI 3 THINKING CONFIGURATION
// ============================================
export function isGemini3Model(modelId: string): boolean {
    return modelId.startsWith('gemini-3-');
}

export function getThinkingConfig(modelId: string): Record<string, unknown> {
    if (isGemini3Model(modelId)) {
        return { thinkingConfig: { thinkingLevel: 'LOW' } };
    }
    return {};
}

// ============================================
// TTS VOICE CONFIGURATION
// ============================================
export const TTS_VOICES = {
    // Korean voices
    KORE: 'Kore',      // 한국어 여성 목소리
    AOEDE: 'Aoede',    // 여성 목소리 (다국어)
    CHARON: 'Charon',  // 남성 목소리
    FENRIR: 'Fenrir',  // 남성 목소리 (깊은)
    PUCK: 'Puck',      // 중성적 목소리
} as const;

export type TTSVoice = typeof TTS_VOICES[keyof typeof TTS_VOICES];

// Re-export runtime values and types
export { Modality, Type };
export type { Part };

// ============================================
// PHOTOREALISTIC STYLE PROMPTS
// ============================================
export const PHOTOREALISTIC_STYLES = [
    "Ultra-realistic DSLR photograph taken with an 85mm f/1.8 lens. The focus is tack-sharp on the subject's eyes, creating a creamy bokeh background. Lit with soft, natural light. A subtle, realistic film grain is visible.",
    "Cinematic film still from a modern Korean thriller. Shot with an anamorphic lens, creating subtle lens flare. The lighting is high-contrast and dramatic, with a slightly desaturated color palette, giving it an 8K hyper-detailed look.",
    "Authentic, candid street photography shot on Kodak Portra 400 film. Captures a genuine, unposed moment. The image has a distinct grainy texture and true-to-life colors characteristic of professional film stock.",
    "High-fashion editorial photograph. Lit with professional studio lighting, likely a large softbox, creating soft shadows and a clean look. Skin texture is perfect and natural. The color grading is sophisticated and deliberate.",
    "A raw, unposed documentary-style photo, captured with a 35mm lens using only available light. The focus is on capturing genuine emotion and telling a story through the environment. Appears unstaged and real.",
    "Hyper-detailed medium format photograph, as if taken with a Hasselblad camera. This results in incredible detail, texture, and tonal depth. The lighting is precisely controlled to sculpt the subject.",
    "Golden hour portrait. The lighting is warm, soft, and directional, creating long, gentle shadows and a beautiful glow on the subject. The depth of field is very shallow, isolating the character from the background.",
    "Atmospheric and moody photograph taken in a dimly lit interior setting. High ISO is used, resulting in noticeable but aesthetically pleasing film grain. Shallow depth of field isolates the subject from the surrounding darkness."
];

// ============================================
// IMAGE STYLE PROMPTS
// ============================================
import type { ImageStyle } from './types.js';

export const STYLE_PROMPTS: Record<ImageStyle, string> = {
    photorealistic: "Ultra-realistic DSLR photograph with cinematic lighting. Shot with professional camera, tack-sharp focus, natural skin texture, realistic shadows and highlights. 8K hyper-detailed, film grain texture.",
    animation: "High-quality Japanese anime style illustration. Clean linework, vibrant colors, expressive eyes, dynamic poses. Studio Ghibli or Makoto Shinkai inspired aesthetics with beautiful lighting and atmospheric effects.",
    illustration: "Professional digital illustration art style. Clean vector-like artwork with bold colors, stylized proportions, and artistic shading. Modern character design with appealing aesthetics.",
    cinematic: "Cinematic film still from a Hollywood blockbuster. Dramatic lighting with strong contrast, anamorphic lens flare, shallow depth of field. Color graded with teal and orange tones, epic composition.",
    watercolor: "Beautiful traditional watercolor painting style. Soft blended edges, transparent color washes, visible paper texture. Delicate brushstrokes with organic color bleeding and artistic imperfections.",
    '3d_render': "High-quality 3D rendered character. Pixar/Disney animation style with subsurface scattering on skin, detailed textures, professional studio lighting. Clean, polished CGI look with appealing stylization.",
    low_poly: "Low poly 3D art style with minimal geometric polygons and flat shading. Angular faceted surfaces with simplified color palette, retro minimalist 3D aesthetic. Clean geometric shapes with distinct polygon edges visible.",
    pixel_art: "Pixel art style with individually placed pixels, 16-bit retro game aesthetic. Limited color palette with crisp pixel-perfect details, sprite art style. Nostalgic 8-bit/16-bit video game look with clean pixel boundaries.",
    stop_motion: "Stop-motion animation style with handcrafted claymation texture. Visible fingerprints and imperfections on clay-like surfaces, puppet animation feel. Paper cut-out aesthetic with tangible physical material quality and warm lighting.",
    sketch: "Hand-drawn pencil sketch style with visible pencil strokes and cross-hatching. Raw charcoal drawing aesthetic with rough draft quality, ink illustration linework. Organic line art with artistic imperfections and paper texture.",
    comic_book: "Bold comic book art style with thick black outlines and vibrant pop art colors. Halftone dot shading, dramatic action poses, graphic novel aesthetic. Dynamic panel-style composition with strong contrast and expressive linework.",
    art_movement: "Impressionist painting style with visible brushstrokes and vibrant color mixing. Dreamlike surrealist aesthetic blended with post-impressionist techniques. Rich oil painting texture with artistic interpretation, reminiscent of fine art masterworks.",
    motion_graphics: "Clean modern motion graphics style with flat design elements and vector aesthetics. Material design inspired with geometric shapes, bold typography-friendly composition. Minimalist digital art with smooth gradients and contemporary graphic design feel."
};

export const getStylePrompt = (style?: ImageStyle): string => {
    if (!style || !STYLE_PROMPTS[style]) {
        // 기본값: photorealistic 스타일 중 랜덤 선택
        return PHOTOREALISTIC_STYLES[Math.floor(Math.random() * PHOTOREALISTIC_STYLES.length)];
    }
    return STYLE_PROMPTS[style];
};

// ============================================
// INPUT VALIDATION & SANITIZATION
// ============================================
export const sanitizePrompt = (prompt: string, maxLength: number = 2000): string => {
    if (!prompt || typeof prompt !== 'string') {
        throw new Error('Invalid prompt: must be a non-empty string');
    }

    // Trim and limit length
    let cleaned = prompt.trim();
    if (cleaned.length > maxLength) {
        throw new Error(`Prompt too long (max ${maxLength} characters)`);
    }

    // Remove potentially harmful patterns
    cleaned = cleaned
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');

    if (cleaned.length === 0) {
        throw new Error('Invalid prompt: empty after sanitization');
    }

    return cleaned;
};

// ============================================
// CORS CONFIGURATION
// ============================================
export const getAllowedOrigins = (): string[] => {
    const origins = process.env.ALLOWED_ORIGINS;
    if (origins) {
        return origins.split(',').map(o => o.trim());
    }
    // Default allowed origins (update for production)
    return [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://image-gen-coral.vercel.app',
        'https://image-gen-neon-mu.vercel.app',
    ];
};

export const setCorsHeaders = (res: any, origin?: string): void => {
    const allowedOrigins = getAllowedOrigins();

    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
        res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
};
