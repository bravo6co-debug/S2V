import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, sanitizePrompt, setCorsHeaders } from './lib/gemini.js';
import type { GeneratePropsRequest, ImageData, ApiErrorResponse } from './lib/types.js';

/**
 * Generates a single prop image
 */
const generateOnePropImage = async (prompt: string, aspectRatio: '16:9' | '9:16'): Promise<ImageData> => {
    const finalPrompt = `
**TASK: Generate a photorealistic product/prop photograph for a reference library.**

**PROP DESCRIPTION:** "${prompt}"

**CRITICAL RULES:**
1. Generate ONLY the described object/prop - NO PEOPLE, NO HANDS, NO HUMAN BODY PARTS
2. The prop must be the sole subject of the image
3. Clean, professional product photography style

---
**COMPOSITION & SETUP (VERY STRICT):**
-   **Shot Type:** Clean product shot, centered in frame
-   **Background:** Simple, non-distracting backdrop (solid white, light gray, or subtle gradient)
-   **Angle:** 3/4 view or front view to show the object clearly
-   **Scale:** The object should fill approximately 60-80% of the frame
-   **Focus:** Sharp focus on the entire object

---
**MANDATORY PHOTOGRAPHIC STYLE (NON-NEGOTIABLE):**
-   **Style:** Professional product photography, e-commerce quality
-   **Lighting:** Clean, soft studio lighting. Even illumination with subtle shadows for depth
-   **Quality:** Ultra high resolution, sharp details, accurate colors

---
**ABSOLUTELY FORBIDDEN:**
-   NO humans, hands, fingers, or any body parts
-   NO text, watermarks, labels, or typography
-   NO busy or distracting backgrounds
-   NO artistic filters or heavy post-processing
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
        throw new Error("AI did not return any images.");
    }

    const img = response.generatedImages[0];
    return {
        mimeType: 'image/jpeg',
        data: img.image.imageBytes,
    };
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

    try {
        const { prompt, numberOfImages, aspectRatio } = req.body as GeneratePropsRequest;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(prompt);
        const count = Math.min(Math.max(numberOfImages || 1, 1), 10);
        const ratio = aspectRatio === '9:16' ? '9:16' : '16:9';

        const generationPromises: Promise<ImageData>[] = [];
        for (let i = 0; i < count; i++) {
            generationPromises.push(generateOnePropImage(sanitizedPrompt, ratio));
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
