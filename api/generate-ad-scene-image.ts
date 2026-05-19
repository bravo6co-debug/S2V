import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { getEachLabsApiKey, generateGptImageV2 } from './lib/eachlabs.js';
import type { GenerateAdSceneImageRequest, ImageData, ApiErrorResponse } from './lib/types.js';

/**
 * POST /api/generate-ad-scene-image
 * 광고 씬 이미지 생성 (GPT Image v2 — 롱폼 서비스와 동일 모델)
 *
 * pipelineStep (FLUX → GPT 전환으로 strength 제어는 사라지지만 의미상 2단계 유지):
 *   - 'anchor': GPT Image v2 edit. 최대 16장 참조 이미지로 앵커 이미지 생성
 *   - 'variation': GPT Image v2 edit. 앵커 이미지를 ref로 사용해 일관성 유지하며 변형
 *
 * FLUX 대비 차이:
 *   - strength 파라미터 미지원 (자연스러운 변형은 GPT의 prompt 해석 능력에 의존)
 *   - 텍스트/로고 정확도가 더 높음 (광고에 유리)
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
            // strength는 GPT Image v2에서 미지원 — 무시 (호환성 위해 수신만)
            aspectRatio,
            imageStyle,
        } = req.body as GenerateAdSceneImageRequest;

        if (!imagePrompt) {
            return res.status(400).json({ error: 'imagePrompt is required' } as ApiErrorResponse);
        }

        if (!pipelineStep || !['anchor', 'variation'].includes(pipelineStep)) {
            return res.status(400).json({ error: 'pipelineStep must be "anchor" or "variation"' } as ApiErrorResponse);
        }

        // EachLabs API 키 (GPT Image v2도 EachLabs 경유)
        const apiKey = await getEachLabsApiKey(auth.userId);
        const ratio = aspectRatio === '9:16' ? '9:16' : '16:9';

        // 스타일에 따른 프롬프트 접두사
        const STYLE_PREFIXES: Record<string, string> = {
            photorealistic: 'Photorealistic cinematic scene for advertisement',
            animation: 'High-quality anime style illustration for advertisement',
            illustration: 'Professional digital illustration for advertisement',
            cinematic: 'Cinematic film still for advertisement',
            watercolor: 'Watercolor painting style scene for advertisement',
            '3d_render': 'High-quality 3D rendered scene for advertisement',
        };
        const stylePrefix = STYLE_PREFIXES[imageStyle || 'photorealistic'] || STYLE_PREFIXES.photorealistic;

        const moodPart = mood ? `, ${mood} mood` : '';
        const cameraPart = cameraAngle ? `, ${cameraAngle.toLowerCase()} shot` : '';
        const prompt = `${stylePrefix}, absolutely no visible text, letters, numbers, or writing in any language including on screens, signs, labels, and packaging, no watermarks${moodPart}${cameraPart}. ${imagePrompt}`;

        // 참조 이미지 결정: anchor 단계는 referenceImages, variation 단계는 anchorImage 1장
        let refs: ImageData[];
        if (pipelineStep === 'anchor') {
            if (!referenceImages || referenceImages.length === 0) {
                return res.status(400).json({
                    error: 'anchor 단계에는 최소 1장의 참조 이미지가 필요합니다.'
                } as ApiErrorResponse);
            }
            refs = referenceImages.slice(0, 16); // GPT Image v2 한도
        } else {
            if (!anchorImage) {
                return res.status(400).json({
                    error: 'variation 단계에는 앵커 이미지가 필요합니다.'
                } as ApiErrorResponse);
            }
            refs = [anchorImage];
        }

        console.log(`[ad-scene-image] Step: ${pipelineStep}, refs: ${refs.length}, prompt (${prompt.length} chars): ${prompt.substring(0, 150)}...`);

        // GPT Image v2 단일 호출 — 롱폼 서비스와 동일한 패턴
        const resultImage = await generateGptImageV2({
            apiKey,
            model: 'gpt-image-2.0',
            prompt,
            aspectRatio: ratio,
            referenceImages: refs,
        });

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
