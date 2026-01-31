import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";
import { sanitizePrompt, setCorsHeaders, getStylePrompt, getAIClientForUser, getUserImageModel, MODELS } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { isFluxModel, getEachLabsApiKey, generateFluxImage } from './lib/eachlabs.js';
import type { GenerateBackgroundsRequest, ImageData, ApiErrorResponse, ImageStyle } from './lib/types.js';

/**
 * Generates a single background/environment image with specified style
 */
const generateOneBackgroundImage = async (
    aiClient: GoogleGenAI,
    imageModel: string,
    prompt: string,
    locationType: string,
    timeOfDay: string,
    weather: string,
    aspectRatio: '16:9' | '9:16',
    imageStyle?: ImageStyle
): Promise<ImageData> => {
    const stylePrompt = getStylePrompt(imageStyle);

    // 스타일에 따른 기본 지시어 결정
    const isPhotorealistic = !imageStyle || imageStyle === 'photorealistic' || imageStyle === 'cinematic';
    const styleDescription = isPhotorealistic
        ? "photorealistic background/environment photograph"
        : imageStyle === 'animation'
            ? "anime-style background illustration"
            : imageStyle === 'illustration'
                ? "stylized background illustration"
                : imageStyle === 'watercolor'
                    ? "watercolor landscape/scene painting"
                    : imageStyle === '3d_render'
                        ? "3D rendered environment"
                        : "background image";

    const finalPrompt = `
**TASK: Generate a ${styleDescription} for a reference library.**

**ART STYLE:** ${stylePrompt}

**SCENE DESCRIPTION:** "${prompt}"
**Location Type:** ${locationType}
**Time of Day:** ${timeOfDay}
**Weather:** ${weather}

**CRITICAL RULES:**
1. Generate ONLY the environment/background - ABSOLUTELY NO PEOPLE, NO CHARACTERS, NO HUMAN FIGURES
2. This is a pure landscape/interior shot - empty of any human presence
3. The scene should be rendered in the specified art style consistently

---
**COMPOSITION (VERY STRICT):**
-   **Shot Type:** Wide establishing shot or medium wide shot
-   **Perspective:** Eye-level or slightly elevated angle
-   **Depth:** Show depth and layers in the environment
-   **Focus:** Deep focus - all elements should be well-defined

---
**STYLE GUIDELINES:**
-   Follow the art style instructions precisely.
-   ${isPhotorealistic ? "Cinematic location photography, film production quality. Natural lighting appropriate for the time of day." : "Consistent artistic styling matching the specified art direction. Beautiful atmospheric effects."}
-   Capture the mood and atmosphere of the location

---
**ABSOLUTELY FORBIDDEN:**
-   NO humans, silhouettes, or any human figures (even distant ones)
-   NO animals unless specifically mentioned
-   NO visible text, letters, numbers, watermarks, or typography in ANY language (Chinese, Korean, Japanese, English, or any other). Signs, billboards, and screens must appear blank, blurred, or show abstract content only
`;

    // Use generateContent with user's selected image model
    const response = await aiClient.models.generateContent({
        model: imageModel,
        contents: finalPrompt,
    });

    // Extract image from response parts
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI did not return any response.");
    }

    const parts = response.candidates[0].content?.parts;
    if (!parts || parts.length === 0) {
        throw new Error("AI did not return any content parts.");
    }

    // Find the image part
    for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
            return {
                mimeType: part.inlineData.mimeType || 'image/png',
                data: part.inlineData.data,
            };
        }
    }

    throw new Error("AI did not return any images.");
};

/**
 * POST /api/generate-backgrounds
 * Generates background/environment images
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' } as ApiErrorResponse);
    }

    // 인증 체크
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.userId) {
        return res.status(401).json({
            error: auth.error || '로그인이 필요합니다.',
            code: 'UNAUTHORIZED'
        } as ApiErrorResponse);
    }

    try {
        // 사용자별 AI 클라이언트 및 모델 가져오기
        const aiClient = await getAIClientForUser(auth.userId);
        const imageModel = await getUserImageModel(auth.userId);

        console.log(`[generate-backgrounds] User: ${auth.userId}, Model: ${imageModel}`);

        const { prompt, locationType, timeOfDay, weather, numberOfImages, aspectRatio, imageStyle } = req.body as GenerateBackgroundsRequest;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(prompt);
        const count = Math.min(Math.max(numberOfImages || 1, 1), 10);
        const ratio = aspectRatio === '9:16' ? '9:16' : '16:9';

        // FLUX 모델인 경우 EachLabs API 사용
        if (isFluxModel(imageModel)) {
            const apiKey = await getEachLabsApiKey(auth.userId);
            console.log(`[generate-backgrounds] Using FLUX model: ${imageModel}`);

            const loc = locationType || 'exterior';
            const time = timeOfDay || 'day';
            const wthr = weather || 'clear';
            const fluxPrompt = `Generate a background/environment photograph.\n\nScene: ${sanitizedPrompt}\nLocation: ${loc}\nTime of day: ${time}\nWeather: ${wthr}\n\nRequirements:\n- Pure landscape/environment shot, NO people or human figures\n- Wide establishing shot with depth and layers\n- Cinematic quality, natural lighting for ${time}\n- Absolutely no visible text, letters, numbers, or writing in any language, signs and screens must be blank or blurred\n- No watermarks\n- ${ratio === '9:16' ? 'Vertical 9:16' : 'Horizontal 16:9'} aspect ratio`;

            const generationPromises: Promise<ImageData>[] = [];
            for (let i = 0; i < count; i++) {
                generationPromises.push(generateFluxImage({
                    apiKey,
                    model: imageModel,
                    prompt: fluxPrompt,
                    aspectRatio: ratio,
                }));
            }

            const results = await Promise.all(generationPromises);
            return res.status(200).json({ images: results });
        }

        // Gemini/Imagen 모델 사용
        const generationPromises: Promise<ImageData>[] = [];
        for (let i = 0; i < count; i++) {
            generationPromises.push(generateOneBackgroundImage(
                aiClient,
                imageModel,
                sanitizedPrompt,
                locationType || 'exterior',
                timeOfDay || 'day',
                weather || 'clear',
                ratio,
                imageStyle
            ));
        }

        const results = await Promise.all(generationPromises);
        const validResults = results.filter(Boolean);

        return res.status(200).json({ images: validResults });

    } catch (e) {
        console.error("Error during background generation:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `Background generation failed: ${errorMessage}`,
            code: 'GENERATION_FAILED'
        } as ApiErrorResponse);
    }
}
