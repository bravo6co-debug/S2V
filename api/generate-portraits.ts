import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";
import { sanitizePrompt, setCorsHeaders, getStylePrompt, getAIClientForUser, getUserImageModel, MODELS } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { isFluxModel, getEachLabsApiKey, generateFluxImage } from './lib/eachlabs.js';
import type { GeneratePortraitsRequest, ImageData, ApiErrorResponse, ImageStyle } from './lib/types.js';

/**
 * Generates a single character portrait with specified style using Gemini's generateContent
 */
const generateOneCharacterPortrait = async (
    aiClient: GoogleGenAI,
    imageModel: string,
    prompt: string,
    aspectRatio: '16:9' | '9:16',
    imageStyle?: ImageStyle
): Promise<ImageData> => {
    const stylePrompt = getStylePrompt(imageStyle);

    // 스타일에 따른 기본 지시어 결정
    const isPhotorealistic = !imageStyle || imageStyle === 'photorealistic' || imageStyle === 'cinematic';
    const styleDescription = isPhotorealistic
        ? "photorealistic character portrait"
        : imageStyle === 'animation'
            ? "anime-style character illustration"
            : imageStyle === 'illustration'
                ? "stylized character illustration"
                : imageStyle === 'watercolor'
                    ? "watercolor character painting"
                    : imageStyle === '3d_render'
                        ? "3D rendered character"
                        : "character portrait";

    const finalPrompt = `
**TASK: Generate a ${styleDescription} for a reference library.**

**ART STYLE:** ${stylePrompt}

**CHARACTER DESCRIPTION:** "${prompt}"

**CRITICAL RULE: The character MUST be portrayed as ethnically Korean.** This is a non-negotiable, top-priority instruction.

---
**COMPOSITION & POSE (VERY STRICT):**
-   **Shot Type:** Bust shot (from the chest up), similar to a portrait or ID photo.
-   **Pose:** The character MUST be facing directly forward, looking at the camera. The pose must be completely neutral and static.
-   **Forbidden Poses:** No tilting of the head, no dynamic angles, and absolutely NO hands visible in the frame.
-   **Background:** Simple, non-distracting backdrop (solid light gray or off-white).
-   **Expression:** A neutral or gentle facial expression appropriate for the style.
-   **Focus:** The focus must be entirely on the character.
-   **Aspect Ratio:** Image should be ${aspectRatio} aspect ratio.

---
**STYLE GUIDELINES:**
-   Follow the art style instructions precisely.
-   Maintain consistency with the specified style throughout the image.
-   ${isPhotorealistic ? "The final image should look like a real photograph." : "The final image should have consistent artistic styling."}

---
**FORBIDDEN ELEMENTS:**
-   The image MUST NOT contain any text, letters, words, numbers, watermarks, or typography.

Generate only the image, no text response needed.
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

    throw new Error("AI did not return any images. This could be due to a safety policy violation or a temporary service issue.");
};

/**
 * POST /api/generate-portraits
 * Generates character portrait images
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

        console.log(`[generate-portraits] User: ${auth.userId}, Model: ${imageModel}`);

        const { prompt, numberOfImages, aspectRatio, imageStyle } = req.body as GeneratePortraitsRequest;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(prompt);
        const count = Math.min(Math.max(numberOfImages || 1, 1), 10); // 1-10 images
        const ratio = aspectRatio === '9:16' ? '9:16' : '16:9';

        // FLUX 모델인 경우 EachLabs API 사용
        if (isFluxModel(imageModel)) {
            const apiKey = await getEachLabsApiKey(auth.userId);
            console.log(`[generate-portraits] Using FLUX model: ${imageModel}`);

            const fluxPrompt = `Generate a character portrait photograph.\n\nCharacter: ${sanitizedPrompt}\n\nRequirements:\n- Bust shot (chest up), facing forward, looking at camera\n- Ethnically Korean character\n- Clean, simple background (solid light gray or off-white)\n- Neutral or gentle facial expression\n- No hands visible in frame\n- No text or watermarks\n- ${ratio === '9:16' ? 'Vertical 9:16' : 'Horizontal 16:9'} aspect ratio`;

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
            generationPromises.push(generateOneCharacterPortrait(aiClient, imageModel, sanitizedPrompt, ratio, imageStyle));
        }

        const results = await Promise.all(generationPromises);
        const validResults = results.filter(Boolean);

        return res.status(200).json({ images: validResults });

    } catch (e) {
        console.error("Error during character portrait generation:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `Character generation failed: ${errorMessage}`,
            code: 'GENERATION_FAILED'
        } as ApiErrorResponse);
    }
}
