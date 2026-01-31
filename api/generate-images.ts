import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";
import { Part, sanitizePrompt, setCorsHeaders, getStylePrompt, getAIClientForUser, getUserImageModel, MODELS } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { isFluxModel, getEachLabsApiKey, generateFluxImage } from './lib/eachlabs.js';
import type { GenerateImagesRequest, ImageData, ApiErrorResponse, ImageStyle, NamedCharacterImage } from './lib/types.js';

/**
 * Generates a single scene image with character/prop/background references
 */
const generateOneImage = async (
    aiClient: GoogleGenAI,
    imageModel: string,
    prompt: string,
    characterImages: ImageData[],
    namedCharacters: NamedCharacterImage[] | undefined,
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    addVariation: boolean,
    aspectRatio: '16:9' | '9:16',
    imageStyle?: ImageStyle
): Promise<ImageData> => {
    const parts: Part[] = [];
    const characterNames: string[] = [];
    const effectiveCharacterCount = namedCharacters?.length || characterImages.length;

    // 새로운 형식: 이름이 포함된 캐릭터 이미지 사용 (캐릭터 일관성을 위해 필수)
    if (namedCharacters && namedCharacters.length > 0) {
        namedCharacters.forEach(char => {
            characterNames.push(char.name);
            parts.push({
                inlineData: {
                    mimeType: char.image.mimeType,
                    data: char.image.data
                }
            });
        });
    } else {
        // 기존 형식: 이름 없는 캐릭터 이미지 (하위 호환성)
        characterImages.forEach(img => {
            parts.push({
                inlineData: {
                    mimeType: img.mimeType,
                    data: img.data
                }
            });
        });
    }

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
**Reference Images ${effectiveCharacterCount + 1} to ${effectiveCharacterCount + propImages.length} are PRODUCT PHOTOS**

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

    // 캐릭터 레퍼런스 섹션 생성 (이름이 있는 경우 각 캐릭터 명시)
    let characterReferenceSection = '';
    if (characterNames.length > 0) {
        // 이름이 포함된 캐릭터 레퍼런스 (캐릭터 일관성 향상)
        const characterDescriptions = characterNames.map((name, idx) =>
            `  - **Image ${idx + 1}**: Character "${name}" - This is the reference photo for the character named "${name}"`
        ).join('\n');

        characterReferenceSection = `
---
**1. CHARACTER REFERENCE - CRITICAL FOR CONSISTENCY**
**The following ${characterNames.length} image(s) are character reference photos:**
${characterDescriptions}

**ABSOLUTE REQUIREMENT:**
- Each character MUST appear EXACTLY as shown in their respective reference photo
- Match facial features, age, hair style, skin tone, and body type with EXTREME PRECISION
- When the user prompt mentions a character by name (e.g., "${characterNames[0]}"), use THAT specific character's reference image
- If multiple characters appear in the scene, ensure EACH character matches their own reference photo - DO NOT mix features between characters
- **CRITICAL ETHNICITY MANDATE:** All characters in the reference images are ethnically Korean. Your generated image MUST maintain Korean ethnicity for each character.
- The generated persons must be undeniably the SAME PERSONS as in their respective reference photos.`;
    } else if (effectiveCharacterCount > 0) {
        // 이름 없는 캐릭터 레퍼런스 (하위 호환성)
        characterReferenceSection = `
---
**1. CHARACTER REFERENCE (First ${effectiveCharacterCount} image${effectiveCharacterCount > 1 ? 's' : ''})**
**ACTION:** This is your highest priority. Analyze the provided reference image(s) to understand the character's exact appearance. You MUST replicate their facial features, age, hair style and color, and overall look with extreme precision.
**CRITICAL ETHNICITY MANDATE:** The character in the reference images is ethnically Korean. Your generated image MUST maintain this Korean ethnicity. This is a strict, non-negotiable rule. The generated person must be undeniably the SAME PERSON as in the reference photos.`;
    }

    const finalPrompt = `
**AI Model Instructions: Character, Prop & Scene Consistency**

Your primary, non-negotiable goals are:
1.  **Character Consistency:** Perfectly replicate EACH person from their corresponding character reference image. Each named character must look exactly like their reference.
2.  **Prop Consistency:** Props/objects in the scene MUST match the provided prop reference images EXACTLY.
3.  **Photorealism:** Generate an image that is indistinguishable from a real photograph.
4.  **Aspect Ratio:** The final image MUST have a ${aspectRatio === '16:9' ? 'wide, horizontal 16:9' : 'tall, vertical 9:16'} aspect ratio.
${characterReferenceSection}
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

    // Use generateContent with user's selected image model
    const response = await aiClient.models.generateContent({
        model: imageModel,
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

        console.log(`[generate-images] User: ${auth.userId}, Model: ${imageModel}`);

        const { prompt, characterImages, namedCharacters, propImages, backgroundImage, numberOfImages, aspectRatio, imageStyle } = req.body as GenerateImagesRequest;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(prompt);
        const count = Math.min(Math.max(numberOfImages || 1, 1), 10);
        const ratio = aspectRatio === '9:16' ? '9:16' : '16:9';

        // FLUX 모델인 경우 EachLabs API 사용
        if (isFluxModel(imageModel)) {
            const apiKey = await getEachLabsApiKey(auth.userId);
            console.log(`[generate-images] Using FLUX model: ${imageModel}`);

            // 참조 이미지 수집 (캐릭터 → 소품 → 배경 순서, 최대 2장)
            const refImages: ImageData[] = [];
            if (namedCharacters && namedCharacters.length > 0) {
                for (const char of namedCharacters) {
                    if (refImages.length < 2) refImages.push(char.image);
                }
            } else if (characterImages && characterImages.length > 0) {
                for (const img of characterImages) {
                    if (refImages.length < 2) refImages.push(img);
                }
            }
            if (refImages.length < 2 && propImages && propImages.length > 0) {
                for (const img of propImages) {
                    if (refImages.length < 2) refImages.push(img);
                }
            }
            if (refImages.length < 2 && backgroundImage) {
                refImages.push(backgroundImage);
            }

            // 캐릭터 이름 정보를 프롬프트에 포함
            const charNames = namedCharacters?.map(c => c.name).join(', ') || '';
            const charInfo = charNames ? `\nCharacters in scene: ${charNames}` : '';

            const fluxPrompt = `Generate a cinematic scene image.\n\nScene: ${sanitizedPrompt}${charInfo}\n\nRequirements:\n- Cinematic, photorealistic quality\n- Korean characters if people are depicted\n- Each character must look exactly like their reference photo\n- ${ratio === '9:16' ? 'Vertical 9:16' : 'Horizontal 16:9'} aspect ratio\n- No text, watermarks, or typography\n- Single full-bleed image, no borders or multi-panel layouts`;

            const generationPromises: Promise<ImageData>[] = [];
            for (let i = 0; i < count; i++) {
                generationPromises.push(generateFluxImage({
                    apiKey,
                    model: imageModel,
                    prompt: fluxPrompt,
                    aspectRatio: ratio,
                    referenceImages: refImages.length > 0 ? refImages : undefined,
                }));
            }

            const results = await Promise.all(generationPromises);
            return res.status(200).json({ images: results });
        }

        // Gemini/Imagen 모델 사용
        const generationPromises: Promise<ImageData>[] = [];
        for (let i = 0; i < count; i++) {
            generationPromises.push(generateOneImage(
                aiClient,
                imageModel,
                sanitizedPrompt,
                characterImages || [],
                namedCharacters,  // 이름이 포함된 캐릭터 이미지 전달
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
