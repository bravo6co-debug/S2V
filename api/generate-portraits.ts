import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, sanitizePrompt, setCorsHeaders } from './lib/gemini.js';
import type { GeneratePortraitsRequest, ImageData, ApiErrorResponse } from './lib/types.js';

/**
 * Generates a single character portrait
 */
const generateOneCharacterPortrait = async (prompt: string, aspectRatio: '16:9' | '9:16'): Promise<ImageData> => {
    const finalPrompt = `
**TASK: Generate a photorealistic character portrait for a reference library.**

**CHARACTER DESCRIPTION:** "${prompt}"

**CRITICAL RULE: The character MUST be portrayed as ethnically Korean.** This is a non-negotiable, top-priority instruction.

---
**COMPOSITION & POSE (VERY STRICT):**
-   **Shot Type:** Bust shot (from the chest up), similar to a passport or ID photo.
-   **Pose:** The character MUST be facing directly forward, looking at the camera. The pose must be completely neutral and static.
-   **Forbidden Poses:** No tilting of the head, no dynamic angles, and absolutely NO hands visible in the frame.
-   **Background:** Simple, non-distracting studio backdrop (solid light gray or off-white).
-   **Expression:** A completely neutral facial expression. No smiling or other emotions.
-   **Focus:** The focus must be entirely on the character.

---
**MANDATORY PHOTOGRAPHIC STYLE (NON-NEGOTIABLE):**
-   **Style:** Ultra-realistic, clean studio portrait.
-   **Lighting:** Bright, soft, and even lighting that illuminates the face clearly without creating harsh shadows. Think professional headshot lighting.
-   **Crucial Rule:** The final image MUST look like a real photograph. It must be indistinguishable from a photo taken with a high-end camera.
-   **Forbidden Effects:** Absolutely NO cinematic effects, no dramatic lighting, no lens flares, no heavy film grain, no vignettes, no color filters. The image should be plain and unstylized.

---
**FORBIDDEN ELEMENTS:**
-   The image MUST NOT contain any text, letters, words, numbers, watermarks, or typography.
`;

    const response = await ai.models.generateImages({
        model: MODELS.IMAGE_PORTRAIT,
        prompt: finalPrompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: aspectRatio,
        },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("AI did not return any images. This could be due to a safety policy violation or a temporary service issue.");
    }

    const img = response.generatedImages[0];
    return {
        mimeType: 'image/jpeg',
        data: img.image.imageBytes,
    };
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

    try {
        const { prompt, numberOfImages, aspectRatio } = req.body as GeneratePortraitsRequest;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(prompt);
        const count = Math.min(Math.max(numberOfImages || 1, 1), 10); // 1-10 images
        const ratio = aspectRatio === '9:16' ? '9:16' : '16:9';

        // Generate images in parallel
        const generationPromises: Promise<ImageData>[] = [];
        for (let i = 0; i < count; i++) {
            generationPromises.push(generateOneCharacterPortrait(sanitizedPrompt, ratio));
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
