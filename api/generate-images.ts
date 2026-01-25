import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, Part, sanitizePrompt, setCorsHeaders, getStylePrompt } from './lib/gemini.js';
import type { GenerateImagesRequest, ImageData, ApiErrorResponse, ImageStyle } from './lib/types.js';

/**
 * Generates a single scene image with character/prop/background references
 */
const generateOneImage = async (
    prompt: string,
    characterImages: ImageData[],
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    addVariation: boolean,
    aspectRatio: '16:9' | '9:16',
    imageStyle?: ImageStyle
): Promise<ImageData> => {
    const parts: Part[] = [];

    // Add character images for the model to reference visually
    characterImages.forEach(img => {
        parts.push({
            inlineData: {
                mimeType: img.mimeType,
                data: img.data
            }
        });
    });

    // Add prop images for the model to reference
    propImages.forEach(img => {
        parts.push({
            inlineData: {
                mimeType: img.mimeType,
                data: img.data
            }
        });
    });

    // Add background image for the model to reference
    if (backgroundImage) {
        parts.push({
            inlineData: {
                mimeType: backgroundImage.mimeType,
                data: backgroundImage.data
            }
        });
    }

    // Get style prompt based on user selection
    const stylePrompt = getStylePrompt(imageStyle);
    const isPhotorealistic = !imageStyle || imageStyle === 'photorealistic' || imageStyle === 'cinematic';
    const styleReferencePromptPart = `
---
**2. ART STYLE (MANDATORY & STRICT)**
**ACTION:** You MUST generate the image in the following style. This is a critical instruction.
**STYLE:** ${stylePrompt}
${isPhotorealistic ? '**ABSOLUTE RESTRICTIONS:** Avoid any and all artistic stylization. No illustrated features, no airbrushed skin, no cartoonish proportions, no painterly textures. The image must appear as if it was captured by a high-end camera.' : '**STYLE CONSISTENCY:** Maintain this artistic style throughout the entire image while ensuring character consistency.'}
`;

    const variationPrompt = addVariation ? "\n**VARIATION:** Create a different composition, pose, or camera angle from previous generations for this prompt." : "";

    // Build prop reference section if props exist
    const propReferenceSection = propImages.length > 0 ? `
---
**2. PRODUCT/PROP REFERENCE - HIGH FIDELITY REQUIRED**
**Reference Images ${characterImages.length + 1} to ${characterImages.length + propImages.length} are PRODUCT PHOTOS**

**ABSOLUTE REQUIREMENT - THIS IS THE MOST CRITICAL INSTRUCTION FOR PROPS:**
You MUST include these EXACT products in the generated image with HIGH FIDELITY:

1. **EXACT CONTAINER/BOTTLE SHAPE** - The bottle, tube, or container must be IDENTICAL
2. **EXACT LABEL & BRANDING** - If the reference shows "ATOMU" or any brand name, it MUST appear exactly the same
3. **EXACT COLOR SCHEME** - Match the precise colors of the product packaging
4. **EXACT CAP/DISPENSER** - The top/cap must match the reference exactly
5. **EXACT PROPORTIONS** - The product size and proportions must be accurate

**PLACEMENT:** The character should be holding, using, or interacting with THIS EXACT product.
**WARNING:** Do NOT substitute with a generic, similar-looking, or different product. The product must be IMMEDIATELY RECOGNIZABLE as the same item from the reference photo.
**FIDELITY LEVEL:** Treat these as product placement shots - the brand must be clearly identifiable.
` : '';

    // Build background reference section if background exists
    const backgroundReferenceSection = backgroundImage ? `
---
**BACKGROUND REFERENCE (Last image)**
Use this background image as reference for the scene setting. Match the location, lighting atmosphere, and environmental details.
` : '';

    const finalPrompt = `
**AI Model Instructions: Character, Prop & Scene Consistency**

Your primary, non-negotiable goals are:
1.  **Character Consistency:** Perfectly replicate the person from the character reference images.
2.  **Prop Consistency:** Props/objects in the scene MUST match the provided prop reference images EXACTLY.
3.  **Photorealism:** Generate an image that is indistinguishable from a real photograph.
4.  **Aspect Ratio:** The final image MUST have a ${aspectRatio === '16:9' ? 'wide, horizontal 16:9' : 'tall, vertical 9:16'} aspect ratio.

---
**1. CHARACTER REFERENCE (First ${characterImages.length} image${characterImages.length > 1 ? 's' : ''})**
**ACTION:** This is your highest priority. Analyze the provided reference image(s) to understand the character's exact appearance. You MUST replicate their facial features, age, hair style and color, and overall look with extreme precision.
**CRITICAL ETHNICITY MANDATE:** The character in the reference images is ethnically Korean. Your generated image MUST maintain this Korean ethnicity. This is a strict, non-negotiable rule. The generated person must be undeniably the SAME PERSON as in the reference photos.
${propReferenceSection}${backgroundReferenceSection}${styleReferencePromptPart}
---
**3. SCENE DESCRIPTION (Source: User's Text Prompt)**
**ACTION:** Place the character from section 1, with props from section 2 if applicable, rendered in the photographic style, into the scene described by the user's prompt below.
**USER PROMPT:**
"${prompt}"
${variationPrompt}
---
**4. TECHNICAL SPECIFICATIONS (NON-NEGOTIABLE)**
**ACTION:** Adhere strictly to the following technical requirements. This is the most important section.
-   **CRITICAL ASPECT RATIO:** The final image's aspect ratio MUST BE a ${aspectRatio === '16:9' ? 'wide, horizontal 16:9' : 'tall, vertical 9:16'}.
    -   **Valid examples for 16:9:** 1920x1080 pixels, 1280x720 pixels.
    -   **Valid examples for 9:16:** 1080x1920 pixels, 720x1280 pixels.
    -   **STRICTLY FORBIDDEN:** Do NOT generate a square (1:1, 1024x1024), ${aspectRatio === '16:9' ? 'vertical' : 'horizontal'}, or any other aspect ratio. The output MUST be ${aspectRatio === '16:9' ? 'horizontal' : 'vertical'}. Failure to follow this rule will result in an incorrect output.
-   **OUTPUT:** Generate ONE SINGLE, full-bleed image.
-   **CRITICAL RESTRICTION:** The generated image MUST NOT contain any text, letters, words, numbers, watermarks, or any form of typography. This is a strict rule.
- DO NOT use white borders or create multi-panel layouts.
`;

    parts.push({ text: finalPrompt });

    // Use generateContent with Gemini native image generation model
    const response = await ai.models.generateContent({
        model: MODELS.IMAGE_SCENE,
        contents: parts,
    });

    // Extract image from response parts
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imagePart && imagePart.inlineData) {
        return {
            mimeType: imagePart.inlineData.mimeType || 'image/png',
            data: imagePart.inlineData.data,
        };
    }

    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    const errorMessage = textPart?.text || "AI failed to return an image for this scene.";
    throw new Error(`Image generation failed: ${errorMessage}`);
};

/**
 * POST /api/generate-images
 * Generates scene images with character/prop/background references
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
        const { prompt, characterImages, propImages, backgroundImage, numberOfImages, aspectRatio, imageStyle } = req.body as GenerateImagesRequest;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(prompt);
        const count = Math.min(Math.max(numberOfImages || 1, 1), 10);
        const ratio = aspectRatio === '9:16' ? '9:16' : '16:9';

        const generationPromises: Promise<ImageData>[] = [];
        for (let i = 0; i < count; i++) {
            generationPromises.push(generateOneImage(
                sanitizedPrompt,
                characterImages || [],
                propImages || [],
                backgroundImage || null,
                i > 0,
                ratio,
                imageStyle
            ));
        }

        const results = await Promise.all(generationPromises);
        const validResults = results.filter(Boolean);

        return res.status(200).json({ images: validResults });

    } catch (e) {
        console.error("Error during image generation:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `Image generation failed: ${errorMessage}`,
            code: 'GENERATION_FAILED'
        } as ApiErrorResponse);
    }
}
