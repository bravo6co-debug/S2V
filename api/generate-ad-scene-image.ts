import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { getEachLabsApiKey, generateFlux2Edit, generateFluxI2I } from './lib/eachlabs.js';
import type { GenerateAdSceneImageRequest, ImageData, ApiErrorResponse } from './lib/types.js';

/**
 * POST /api/generate-ad-scene-image
 * 광고 씬 이미지 생성 (FLUX 파이프라인 전용)
 *
 * pipelineStep:
 *   - 'anchor': flux-2-turbo-edit로 앵커 이미지 생성 (최대 4장 참조)
 *   - 'variation': flux-krea-image-to-image로 앵커 기반 변형 (strength 제어)
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
        const {
            imagePrompt,
            mood,
            cameraAngle,
            pipelineStep,
            referenceImages,
            anchorImage,
            strength,
            aspectRatio,
        } = req.body as GenerateAdSceneImageRequest;

        if (!imagePrompt) {
            return res.status(400).json({ error: 'imagePrompt is required' } as ApiErrorResponse);
        }

        if (!pipelineStep || !['anchor', 'variation'].includes(pipelineStep)) {
            return res.status(400).json({ error: 'pipelineStep must be "anchor" or "variation"' } as ApiErrorResponse);
        }

        // EachLabs API 키 확인
        const apiKey = await getEachLabsApiKey(auth.userId);
        const ratio = aspectRatio === '9:16' ? '9:16' : '16:9';

        // FLUX용 프롬프트 구성 (간결하고 명확하게)
        const moodPart = mood ? `, ${mood} mood` : '';
        const cameraPart = cameraAngle ? `, ${cameraAngle.toLowerCase()} shot` : '';
        const fluxPrompt = `Photorealistic cinematic scene for advertisement, absolutely no visible text, letters, numbers, or writing in any language including on screens, signs, labels, and packaging, no watermarks${moodPart}${cameraPart}. ${imagePrompt}`;

        console.log(`[ad-scene-image] Step: ${pipelineStep}, Prompt (${fluxPrompt.length} chars): ${fluxPrompt.substring(0, 150)}...`);

        let resultImage: ImageData;

        if (pipelineStep === 'anchor') {
            // =============================================
            // 앵커 단계: flux-2-turbo-edit (최대 4장 참조)
            // =============================================
            if (!referenceImages || referenceImages.length === 0) {
                return res.status(400).json({
                    error: 'anchor 단계에는 최소 1장의 참조 이미지가 필요합니다.'
                } as ApiErrorResponse);
            }

            console.log(`[ad-scene-image] Generating anchor with ${referenceImages.length} reference images`);

            resultImage = await generateFlux2Edit({
                apiKey,
                prompt: fluxPrompt,
                referenceImages,
                aspectRatio: ratio,
                guidanceScale: 2.5,
            });

        } else {
            // =============================================
            // 변형 단계: flux-krea-image-to-image (앵커 기반)
            // =============================================
            if (!anchorImage) {
                return res.status(400).json({
                    error: 'variation 단계에는 앵커 이미지가 필요합니다.'
                } as ApiErrorResponse);
            }

            const variationStrength = typeof strength === 'number'
                ? Math.max(0, Math.min(1, strength))
                : 0.5;

            console.log(`[ad-scene-image] Generating variation with strength ${variationStrength}`);

            resultImage = await generateFluxI2I({
                apiKey,
                prompt: fluxPrompt,
                sourceImage: anchorImage,
                strength: variationStrength,
                numInferenceSteps: 40,
                guidanceScale: 4.5,
            });
        }

        return res.status(200).json({ image: resultImage });

    } catch (e) {
        console.error('[ad-scene-image] Error:', e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `광고 씬 이미지 생성 실패: ${errorMessage}`,
            code: 'GENERATION_FAILED'
        } as ApiErrorResponse);
    }
}
