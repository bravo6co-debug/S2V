/**
 * Shared Gemini AI client and configuration for serverless functions
 * This file contains the API key and should ONLY be used server-side
 */

import { GoogleGenAI, Modality, Part, Type } from "@google/genai";

// Validate API key exists
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable not set");
}

// Export the AI client instance
export const ai = new GoogleGenAI({ apiKey });

// ============================================
// MODEL CONFIGURATION
// ============================================
export const MODELS = {
    // Text/prompt generation model
    TEXT: 'gemini-2.5-flash',

    // Image generation models
    IMAGE_PORTRAIT: 'imagen-4.0-generate-001',  // Character/prop/background portraits
    IMAGE_SCENE: 'gemini-2.5-flash-preview-image-generation',  // Scene images (with references)

    // Video generation model
    VIDEO: 'veo-3.1-fast-generate-preview',
} as const;

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
