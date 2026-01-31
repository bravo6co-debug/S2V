import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Part, sanitizePrompt, setCorsHeaders, getAIClientForUser, getUserImageModel } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import type { EditImageRequest, ImageData, ApiErrorResponse } from './lib/types.js';

/**
 * POST /api/edit-image
 * Edits an existing image based on text prompt
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

        console.log(`[edit-image] User: ${auth.userId}, Model: ${imageModel}`);

        const { baseImage, modificationPrompt } = req.body as EditImageRequest;

        if (!baseImage || !baseImage.data) {
            return res.status(400).json({ error: 'baseImage is required' } as ApiErrorResponse);
        }

        if (!modificationPrompt) {
            return res.status(400).json({ error: 'modificationPrompt is required' } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(modificationPrompt);

        const parts: Part[] = [];

        // Add the base image to be edited
        parts.push({
            inlineData: {
                mimeType: baseImage.mimeType,
                data: baseImage.data
            }
        });

        const finalPrompt = `
**AI Model Instructions: Intelligent Image Modification**

Your primary task is to intelligently modify the provided base image according to the user's request. You MUST produce a new, visibly changed image. Returning the original image is not an acceptable outcome.

---
**1. ANALYSIS OF BASE IMAGE**
-   **Analyze:** Scrutinize the provided input image to understand its subject, style, and composition.

---
**2. USER'S MODIFICATION REQUEST**
-   **Request:** "${sanitizedPrompt}"
-   **Action:** Execute this request on the base image. The change should be noticeable and directly address the user's prompt.

---
**3. GUIDELINES FOR MODIFICATION (Apply with care)**
-   **Character Identity:** Unless the prompt *specifically* requests a change to the character's face or core identity, you must preserve it with high fidelity. The character should still be recognizable as the same person.
-   **Style Consistency:** Maintain the original image's photorealistic style, lighting, and overall aesthetic. The edited image should blend seamlessly with the original.
-   **Avoid Unnecessary Alterations:** Focus only on the requested changes. Do not alter other parts of the image unless it's necessary to make the requested change look natural.

---
**4. CRITICAL OUTPUT REQUIREMENTS**
-   **Output:** A single, edited image that is clearly different from the original.
-   **Restriction:** The image MUST NOT contain any visible text, letters, words, numbers, watermarks, or typography in ANY language (Chinese, Korean, Japanese, English, or any other). This includes text on screens, signs, labels, packaging, or any surface. If screens or signs appear, they must show blank, blurred, or abstract content only.
`;

        parts.push({ text: finalPrompt });

        // Use generateContent with user's selected image model
        const response = await aiClient.models.generateContent({
            model: imageModel,
            contents: parts,
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart && imagePart.inlineData) {
            const result: ImageData = {
                mimeType: imagePart.inlineData.mimeType || 'image/png',
                data: imagePart.inlineData.data,
            };
            return res.status(200).json({ image: result });
        }

        const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
        const errorMessage = textPart?.text || "AI failed to return an edited image.";
        throw new Error(`Image editing failed: ${errorMessage}`);

    } catch (e) {
        console.error("Error during image editing:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `Image editing failed: ${errorMessage}`,
            code: 'EDIT_FAILED'
        } as ApiErrorResponse);
    }
}
