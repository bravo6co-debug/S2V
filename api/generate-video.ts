import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sanitizePrompt, setCorsHeaders } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { findUserById } from './lib/mongodb.js';
import { generateHappyhorseI2V, type HappyhorseResolution } from './lib/eachlabs.js';
import { createLogger } from './lib/logger.js';
import type { GenerateVideoRequest, VideoGenerationResult, ApiErrorResponse } from './lib/types.js';

const log = createLogger('generate-video');

/**
 * POST /api/generate-video
 * Image-to-Video — HappyHorse 1.0 via Eachlabs
 *
 * 광고 시나리오의 30/45/60초 씬당 영상 생성에 사용 (15초/씬, t2v는 별도 엔드포인트).
 * 입력: sourceImage + motionPrompt → 출력: videoUrl
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' } as ApiErrorResponse);
    }

    // 인증
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.userId) {
        return res.status(401).json({
            success: false,
            error: auth.error || '로그인이 필요합니다.'
        });
    }

    try {
        const { sourceImage, motionPrompt, durationSeconds = 15, resolution = '720P', seed } = req.body as GenerateVideoRequest;

        if (!sourceImage || !sourceImage.data) {
            return res.status(400).json({ error: 'sourceImage is required' } as ApiErrorResponse);
        }

        if (!motionPrompt) {
            return res.status(400).json({ error: 'motionPrompt is required' } as ApiErrorResponse);
        }

        // 사용자별 Hailuo/EachLabs 키 조회 — 일반 사용자는 본인 키만, admin만 환경변수 폴백 허용 (비용 누수 차단)
        const user = await findUserById(auth.userId);
        const personalKey = user?.settings?.hailuoApiKey;
        const apiKey = personalKey || (user?.isAdmin ? process.env.HAILUO_API_KEY : undefined);

        if (!apiKey) {
            return res.status(400).json({
                error: 'EachLabs API 키가 설정되지 않았습니다. 설정에서 본인 EachLabs(Hailuo) API 키를 입력해 주세요.',
                code: 'API_KEY_MISSING'
            } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(motionPrompt, 1000);

        // HappyHorse i2v용 motion-specific prompt 강화 (vague prompt 회피)
        const enhancedPrompt = `${sanitizedPrompt}\n\nMotion: smooth, natural camera movement with realistic physics. Cinematic film-like aesthetics. Consistent lighting throughout. No sudden jumps or artifacts.`.trim();

        // duration 범위 검증 + 기본값 클램프 (HappyHorse 3~15초)
        const clampedDuration = Math.max(3, Math.min(15, Math.round(durationSeconds)));

        // 영상 비율은 firstFrame 이미지에 자동 매칭 — API 파라미터 없음
        log.info('HappyHorse i2v 호출', {
            duration: clampedDuration,
            resolution,
            promptChars: enhancedPrompt.length,
            seed: seed ?? '(none)',
        });

        const result = await generateHappyhorseI2V({
            apiKey,
            prompt: enhancedPrompt,
            firstFrame: sourceImage,
            duration: clampedDuration,
            resolution: resolution as HappyhorseResolution,
            ...(typeof seed === 'number' && { seed }),
        });

        const response: VideoGenerationResult = {
            videoUrl: result.videoUrl,
            thumbnailUrl: `data:${sourceImage.mimeType};base64,${sourceImage.data}`,
            duration: clampedDuration,
        };
        return res.status(200).json(response);

    } catch (e) {
        log.error('Video generation failed', { error: e instanceof Error ? e.message : String(e) });

        if (e instanceof Error) {
            const msg = e.message;

            if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
                return res.status(403).json({
                    error: 'EachLabs API 키가 유효하지 않거나 권한이 없습니다.',
                    code: 'PERMISSION_DENIED'
                } as ApiErrorResponse);
            }
            if (msg.includes('QUOTA_EXCEEDED') || msg.includes('429') || msg.includes('Resource exhausted') || msg.includes('rate limit')) {
                return res.status(429).json({
                    error: 'API 할당량을 초과했습니다. 잠시 후 다시 시도하세요.',
                    code: 'QUOTA_EXCEEDED'
                } as ApiErrorResponse);
            }

            return res.status(500).json({
                error: `비디오 생성 실패: ${msg}`,
                code: 'VIDEO_GENERATION_FAILED'
            } as ApiErrorResponse);
        }

        return res.status(500).json({
            error: '비디오 생성 중 알 수 없는 오류가 발생했습니다.',
            code: 'UNKNOWN_ERROR'
        } as ApiErrorResponse);
    }
}
