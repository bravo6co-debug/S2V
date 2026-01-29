/**
 * Shared Gemini AI client and configuration for serverless functions
 * This file contains the API key and should ONLY be used server-side
 */

import { GoogleGenAI, Modality, Part, Type } from "@google/genai";
import { getSettings as getSettingsFromDB, findUserById, type UserSettings } from './mongodb.js';

// Default API key from environment
const defaultApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

// Export the default AI client instance (for backwards compatibility)
export const ai = defaultApiKey ? new GoogleGenAI({ apiKey: defaultApiKey }) : null;

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
 * - 일반 사용자: 본인의 API 키 사용
 */
export async function getAIClientForUser(userId: string): Promise<GoogleGenAI> {
    const user = await findUserById(userId);

    if (!user) {
        throw new Error('사용자를 찾을 수 없습니다.');
    }

    // 어드민은 환경변수 API 키 사용
    if (user.isAdmin) {
        if (!defaultApiKey) {
            throw new Error('서버 API 키가 설정되지 않았습니다.');
        }
        return new GoogleGenAI({ apiKey: defaultApiKey });
    }

    // 일반 사용자는 본인의 API 키 사용
    const userApiKey = user.settings?.geminiApiKey;
    if (!userApiKey) {
        throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해 주세요.');
    }

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

    // 일반 사용자는 본인 API 키 필요
    if (user.settings?.geminiApiKey) {
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

// ============================================
// MODEL CONFIGURATION
// ============================================
export const MODELS = {
    // Text/prompt generation model
    TEXT: 'gemini-2.5-flash',

    // Image generation models (Gemini native image generation)
    IMAGE_PORTRAIT: 'gemini-2.5-flash-image',  // Character/prop/background portraits
    IMAGE_SCENE: 'gemini-2.5-flash-image',     // Scene images (with references)

    // Video generation model
    VIDEO: 'veo-3.1-fast-generate-preview',

    // Text-to-Speech (TTS) model for narration
    TTS: 'gemini-2.5-flash-preview-tts',
} as const;

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
    '3d_render': "High-quality 3D rendered character. Pixar/Disney animation style with subsurface scattering on skin, detailed textures, professional studio lighting. Clean, polished CGI look with appealing stylization."
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
