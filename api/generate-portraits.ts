import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";
import { sanitizePrompt, setCorsHeaders, getStylePrompt, getAIClientForUser, getUserImageModel, MODELS, extractSafetyError } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { isEachlabsImageModel, getEachLabsApiKey, generateEachlabsImage } from './lib/eachlabs.js';
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

    // 스타일에 따른 기본 지시어 결정 (13가지 스타일 모두 지원)
    const getStyleDescription = (style?: ImageStyle): string => {
        switch (style) {
            case 'photorealistic':
            case 'cinematic':
                return "photorealistic character portrait";
            case 'animation':
                return "anime-style character illustration with clean linework and vibrant colors";
            case 'illustration':
                return "stylized character illustration with bold colors";
            case 'watercolor':
                return "watercolor character painting with soft washes";
            case '3d_render':
                return "Pixar-style 3D rendered character with smooth textures";
            case 'low_poly':
                return "low-poly geometric 3D character with faceted surfaces";
            case 'pixel_art':
                return "retro pixel art character with crisp pixels and limited color palette";
            case 'stop_motion':
                return "stop-motion claymation style character with tactile handcrafted textures";
            case 'sketch':
                return "hand-drawn sketch character with pencil strokes and artistic linework";
            case 'comic_book':
                return "bold comic book style character with strong outlines and dynamic coloring";
            case 'art_movement':
                return "classic art movement inspired character portrait with expressive brushwork";
            case 'motion_graphics':
                return "modern motion graphics style character with clean vector shapes";
            default:
                return "character portrait";
        }
    };
    const isPhotorealistic = !imageStyle || imageStyle === 'photorealistic' || imageStyle === 'cinematic';
    const styleDescription = getStyleDescription(imageStyle);

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
-   The image MUST NOT contain any visible text, letters, words, numbers, watermarks, or typography in ANY language (Chinese, Korean, Japanese, English, or any other). All surfaces, backgrounds, and objects must be free of any writing.

Generate only the image, no text response needed.
`;

    // Use generateContent with user's selected image model
    const response = await aiClient.models.generateContent({
        model: imageModel,
        contents: finalPrompt,
    });

    // 안전 정책 위반 확인
    const safetyError = extractSafetyError(response as any);
    if (safetyError) {
        throw new Error(safetyError.message);
    }

    // Extract image from response parts
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI가 응답을 반환하지 않았습니다.");
    }

    const parts = response.candidates[0].content?.parts;
    if (!parts || parts.length === 0) {
        throw new Error("AI가 이미지를 생성하지 못했습니다.");
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

    throw new Error("AI가 이미지를 생성하지 못했습니다. 프롬프트를 수정해 보세요.");
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

        // Eachlabs 모델인 경우 EachLabs API 사용
        if (isEachlabsImageModel(imageModel)) {
            const apiKey = await getEachLabsApiKey(auth.userId);
            console.log(`[generate-portraits] Using Eachlabs model: ${imageModel}, style: ${imageStyle || 'default'}`);

            // 스타일별 Eachlabs 프롬프트 생성
            const getEachlabsStylePrefix = (style?: ImageStyle): string => {
                switch (style) {
                    case 'animation':
                        return "High-quality Japanese anime style character illustration with clean linework and vibrant colors";
                    case 'illustration':
                        return "Professional digital illustration character with clean vector-like artwork and bold colors";
                    case 'watercolor':
                        return "Delicate watercolor character painting with soft washes and organic textures";
                    case '3d_render':
                        return "Pixar-style 3D rendered character with smooth textures and appealing design";
                    case 'low_poly':
                        return "Low-poly geometric 3D art style character with faceted surfaces and minimalist aesthetic";
                    case 'pixel_art':
                        return "Retro pixel art style character with crisp pixels and limited color palette";
                    case 'stop_motion':
                        return "Stop-motion claymation style character with tactile textures and handcrafted feel";
                    case 'sketch':
                        return "Hand-drawn sketch style character with pencil strokes and artistic linework";
                    case 'comic_book':
                        return "Bold comic book style character with strong outlines, halftone dots, and dynamic coloring";
                    case 'art_movement':
                        return "Classic art movement inspired character portrait with expressive brushwork";
                    case 'motion_graphics':
                        return "Modern motion graphics style character with clean shapes and vibrant gradients";
                    case 'cinematic':
                        return "Cinematic film-style character portrait with dramatic lighting and professional color grading";
                    case 'photorealistic':
                    default:
                        return "Ultra-realistic DSLR photograph character portrait with cinematic lighting";
                }
            };

            const eachlabsStylePrefix = getEachlabsStylePrefix(imageStyle);
            const eachlabsPrompt = `${eachlabsStylePrefix}.\n\nCharacter: ${sanitizedPrompt}\n\nRequirements:\n- Bust shot (chest up), facing forward, looking at camera\n- Ethnically Korean character\n- Clean, simple background (solid light gray or off-white)\n- Neutral or gentle facial expression\n- No hands visible in frame\n- Absolutely no visible text, letters, numbers, or writing in any language on any surface\n- No watermarks\n- ${ratio === '9:16' ? 'Vertical 9:16' : 'Horizontal 16:9'} aspect ratio`;

            const generationPromises: Promise<ImageData>[] = [];
            for (let i = 0; i < count; i++) {
                generationPromises.push(generateEachlabsImage({
                    apiKey,
                    model: imageModel,
                    prompt: eachlabsPrompt,
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
        const isSafety = errorMessage.includes('생성할 수 없습니다') || errorMessage.includes('차단') || errorMessage.includes('중단');
        return res.status(isSafety ? 400 : 500).json({
            error: isSafety ? errorMessage : `캐릭터 생성 실패: ${errorMessage}`,
            code: isSafety ? 'SAFETY_VIOLATION' : 'GENERATION_FAILED'
        } as ApiErrorResponse);
    }
}
