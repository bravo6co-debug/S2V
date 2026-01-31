import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";
import { sanitizePrompt, setCorsHeaders, getStylePrompt, getAIClientForUser, getUserImageModel, MODELS } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { isFluxModel, getEachLabsApiKey, generateFluxImage } from './lib/eachlabs.js';
import type { GeneratePropsRequest, ImageData, ApiErrorResponse, ImageStyle } from './lib/types.js';

/**
 * Generates a single prop image with specified style
 */
const generateOnePropImage = async (
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
        ? "photorealistic product/prop photograph"
        : imageStyle === 'animation'
            ? "anime-style prop illustration"
            : imageStyle === 'illustration'
                ? "stylized prop illustration"
                : imageStyle === 'watercolor'
                    ? "watercolor prop painting"
                    : imageStyle === '3d_render'
                        ? "3D rendered prop object"
                        : "prop image";

    const finalPrompt = `
**TASK: Generate a ${styleDescription} for a reference library.**

**ART STYLE:** ${stylePrompt}

**PROP DESCRIPTION:** "${prompt}"

**CRITICAL RULES:**
1. Generate ONLY the described object/prop - NO PEOPLE, NO HANDS, NO HUMAN BODY PARTS
2. The prop must be the sole subject of the image
3. Maintain consistent art style throughout

---
**COMPOSITION & SETUP (VERY STRICT):**
-   **Shot Type:** Clean product shot, centered in frame
-   **Background:** Simple, non-distracting backdrop appropriate for the style
-   **Angle:** 3/4 view or front view to show the object clearly
-   **Scale:** The object should fill approximately 60-80% of the frame
-   **Focus:** Sharp focus on the entire object

---
**STYLE GUIDELINES:**
-   Follow the art style instructions precisely.
-   ${isPhotorealistic ? "Professional product photography, e-commerce quality. Clean, soft studio lighting with subtle shadows for depth." : "Consistent artistic styling matching the specified art direction."}
-   High quality, detailed rendering with accurate proportions

---
**ABSOLUTELY FORBIDDEN:**
-   NO humans, hands, fingers, or any body parts
-   NO visible text, letters, numbers, watermarks, labels, or typography in ANY language (Chinese, Korean, Japanese, English, or any other). Product labels and packaging must appear blank or with abstract patterns only
-   NO busy or distracting backgrounds
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
 * POST /api/generate-props
 * Generates prop/product images
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

        console.log(`[generate-props] User: ${auth.userId}, Model: ${imageModel}`);

        const { prompt, numberOfImages, aspectRatio, imageStyle } = req.body as GeneratePropsRequest;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(prompt);
        const count = Math.min(Math.max(numberOfImages || 1, 1), 10);
        const ratio = aspectRatio === '9:16' ? '9:16' : '16:9';

        // FLUX 모델인 경우 EachLabs API 사용
        if (isFluxModel(imageModel)) {
            const apiKey = await getEachLabsApiKey(auth.userId);
            console.log(`[generate-props] Using FLUX model: ${imageModel}`);

            const fluxPrompt = `Generate a product/prop photograph.\n\nObject: ${sanitizedPrompt}\n\nRequirements:\n- Clean product shot, object centered in frame\n- Simple, non-distracting background\n- 3/4 view or front view\n- Object fills 60-80% of frame\n- Sharp focus, professional quality\n- No people, hands, or body parts\n- Absolutely no visible text, letters, numbers, or writing in any language on any surface including labels and packaging\n- No watermarks\n- ${ratio === '9:16' ? 'Vertical 9:16' : 'Horizontal 16:9'} aspect ratio`;

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
            generationPromises.push(generateOnePropImage(aiClient, imageModel, sanitizedPrompt, ratio, imageStyle));
        }

        const results = await Promise.all(generationPromises);
        const validResults = results.filter(Boolean);

        return res.status(200).json({ images: validResults });

    } catch (e) {
        console.error("Error during prop generation:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `Prop generation failed: ${errorMessage}`,
            code: 'GENERATION_FAILED'
        } as ApiErrorResponse);
    }
}
