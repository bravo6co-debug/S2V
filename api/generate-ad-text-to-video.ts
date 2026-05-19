import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sanitizePrompt, setCorsHeaders } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { findUserById } from './lib/mongodb.js';
import {
    generateHappyhorseT2V,
    generateSeedanceT2V,
    type HappyhorseResolution,
    type HappyhorseRatio,
    type SeedanceResolution,
    type SeedanceAspectRatio,
} from './lib/eachlabs.js';
import { createLogger } from './lib/logger.js';
import type { GenerateAdTextToVideoRequest, VideoGenerationResult, ApiErrorResponse } from './lib/types.js';

const log = createLogger('generate-ad-text-to-video');

/**
 * POST /api/generate-ad-text-to-video
 * Text-to-Video — 15초 광고 단일 호출 전용
 *
 * 시나리오를 multi-shot prompt 1개로 통합하고 t2v 1콜로 영상 생성.
 * (30/45/60초 광고는 씬당 i2v 호출이라 별도 엔드포인트 `/api/generate-video` 사용)
 *
 * 엔진:
 *   - 'happyhorse' (기본, 무음)
 *   - 'seedance'   (네이티브 오디오 동기화)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' } as ApiErrorResponse);
    }

    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.userId) {
        return res.status(401).json({
            success: false,
            error: auth.error || '로그인이 필요합니다.'
        });
    }

    try {
        const {
            prompt,
            durationSeconds = 15,
            aspectRatio,
            videoEngine = 'happyhorse',
            generateAudio = true,
            seed,
        } = req.body as GenerateAdTextToVideoRequest;
        let { resolution } = req.body as GenerateAdTextToVideoRequest;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' } as ApiErrorResponse);
        }
        if (!aspectRatio || (aspectRatio !== '16:9' && aspectRatio !== '9:16')) {
            return res.status(400).json({ error: 'aspectRatio must be "16:9" or "9:16"' } as ApiErrorResponse);
        }

        // 엔진별 기본 해상도 — HappyHorse 720P, Seedance 480P
        if (!resolution) {
            resolution = videoEngine === 'seedance' ? '480P' : '720P';
        }

        // t2v는 두 엔진 모두 1080P 지원 — i2v와 달리 480P/720P/1080P 모두 허용
        if (videoEngine === 'happyhorse' && resolution === '480P') {
            return res.status(400).json({
                error: 'HappyHorse 엔진은 480P를 지원하지 않습니다. 720P 또는 1080P를 선택하세요.',
                code: 'INVALID_RESOLUTION',
            } as ApiErrorResponse);
        }

        // 사용자별 EachLabs 키 조회 (비용 누수 차단: admin만 환경변수 폴백)
        const user = await findUserById(auth.userId);
        const personalKey = user?.settings?.hailuoApiKey;
        const apiKey = personalKey || (user?.isAdmin ? process.env.HAILUO_API_KEY : undefined);

        if (!apiKey) {
            return res.status(400).json({
                error: 'EachLabs API 키가 설정되지 않았습니다. 설정에서 본인 EachLabs API 키를 입력해 주세요.',
                code: 'API_KEY_MISSING'
            } as ApiErrorResponse);
        }

        // multi-shot prompt는 길어질 수 있어 한도 넉넉히 (광고 1~5컷, 각 컷 timing 포함)
        const sanitizedPrompt = sanitizePrompt(prompt, 3000);

        // duration — HappyHorse 3~15, Seedance 4~15
        const minDur = videoEngine === 'seedance' ? 4 : 3;
        const clampedDuration = Math.max(minDur, Math.min(15, Math.round(durationSeconds)));

        // seed 미지정 시 자동 생성 — 응답에 포함해 클라이언트가 고해상도 재생성에 재사용
        const effectiveSeed = typeof seed === 'number' ? seed : Math.floor(Math.random() * 2_147_483_647);

        log.info(`${videoEngine} t2v 호출`, {
            engine: videoEngine,
            duration: clampedDuration,
            resolution,
            aspectRatio,
            audio: videoEngine === 'seedance' ? generateAudio : false,
            promptChars: sanitizedPrompt.length,
            seed: effectiveSeed,
        });

        let videoUrl: string;

        if (videoEngine === 'seedance') {
            const result = await generateSeedanceT2V({
                apiKey,
                prompt: sanitizedPrompt,
                duration: clampedDuration,
                resolution: resolution as SeedanceResolution,
                aspectRatio: aspectRatio as SeedanceAspectRatio,
                generateAudio,
                seed: effectiveSeed,
            });
            videoUrl = result.videoUrl;
        } else {
            const result = await generateHappyhorseT2V({
                apiKey,
                prompt: sanitizedPrompt,
                duration: clampedDuration,
                resolution: resolution as HappyhorseResolution,
                ratio: aspectRatio as HappyhorseRatio,
                seed: effectiveSeed,
            });
            videoUrl = result.videoUrl;
        }

        // t2v는 firstFrame 없음 → 썸네일도 비어둠 (클라이언트가 영상에서 추출 또는 미표시)
        const response: VideoGenerationResult = {
            videoUrl,
            seed: effectiveSeed,
            resolution,
            videoEngine,
            thumbnailUrl: '',
            duration: clampedDuration,
        };
        return res.status(200).json(response);

    } catch (e) {
        log.error('t2v Video generation failed', { error: e instanceof Error ? e.message : String(e) });

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
