import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, sanitizePrompt, setCorsHeaders } from './lib/gemini.js';
import type { GenerateBackgroundsRequest, ImageData, ApiErrorResponse } from './lib/types.js';

/**
 * Generates a single background/environment image
 */
const generateOneBackgroundImage = async (
    prompt: string,
    locationType: string,
    timeOfDay: string,
    weather: string,
    aspectRatio: '16:9' | '9:16'
): Promise<ImageData> => {
    const finalPrompt = `
**TASK: Generate a photorealistic background/environment photograph for a reference library.**

**SCENE DESCRIPTION:** "${prompt}"
**Location Type:** ${locationType}
**Time of Day:** ${timeOfDay}
**Weather:** ${weather}

**CRITICAL RULES:**
1. Generate ONLY the environment/background - ABSOLUTELY NO PEOPLE, NO CHARACTERS, NO HUMAN FIGURES
2. This is a pure landscape/interior shot - empty of any human presence
3. The scene should look like a location scout photograph or empty film set

---
**COMPOSITION (VERY STRICT):**
-   **Shot Type:** Wide establishing shot or medium wide shot
-   **Perspective:** Eye-level or slightly elevated angle
-   **Depth:** Show depth and layers in the environment
-   **Focus:** Deep focus - everything should be relatively sharp

---
**MANDATORY PHOTOGRAPHIC STYLE (NON-NEGOTIABLE):**
-   **Style:** Cinematic location photography, film production quality
-   **Lighting:** Natural lighting appropriate for the time of day specified
-   **Atmosphere:** Capture the mood and atmosphere of the location
-   **Quality:** High resolution, professional grade

---
**ABSOLUTELY FORBIDDEN:**
-   NO humans, silhouettes, or any human figures (even distant ones)
-   NO animals unless specifically mentioned
-   NO text, watermarks, or typography
-   NO obvious CGI or artificial elements
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

    try {
        const { prompt, locationType, timeOfDay, weather, numberOfImages, aspectRatio } = req.body as GenerateBackgroundsRequest;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(prompt);
        const count = Math.min(Math.max(numberOfImages || 1, 1), 10);
        const ratio = aspectRatio === '9:16' ? '9:16' : '16:9';

        const generationPromises: Promise<ImageData>[] = [];
        for (let i = 0; i < count; i++) {
            generationPromises.push(generateOneBackgroundImage(
                sanitizedPrompt,
                locationType || 'exterior',
                timeOfDay || 'day',
                weather || 'clear',
                ratio
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
