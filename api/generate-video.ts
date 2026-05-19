import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sanitizePrompt, setCorsHeaders } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { findUserById } from './lib/mongodb.js';
import {
    generateHappyhorseI2V,
    generateSeedanceI2V,
    type HappyhorseResolution,
    type SeedanceResolution,
} from './lib/eachlabs.js';
import { createLogger } from './lib/logger.js';
import type { GenerateVideoRequest, VideoGenerationResult, ApiErrorResponse } from './lib/types.js';

const log = createLogger('generate-video');

/**
 * POST /api/generate-video
 * Image-to-Video — 광고 30/45/60초 씬당 영상 생성 (15초/씬)
 *
 * 엔진 선택:
 *   - 'happyhorse' (기본, 720P/1080P, 무음 — BGM/내레이션 별도 합성)
 *   - 'seedance'   (프리미엄, 480P/720P, 네이티브 오디오 동기화)
 *
 * 1080P가 필요하면 happyhorse만 가능 — Seedance i2v-fast는 1080P 미지원.
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
        const {
            sourceImage,
            motionPrompt,
            durationSeconds = 15,
            videoEngine = 'happyhorse',
            generateAudio = true,
            endFrame,
            seed,
        } = req.body as GenerateVideoRequest;
        let { resolution } = req.body as GenerateVideoRequest;

        if (!sourceImage || !sourceImage.data) {
            return res.status(400).json({ error: 'sourceImage is required' } as ApiErrorResponse);
        }

        if (!motionPrompt) {
            return res.status(400).json({ error: 'motionPrompt is required' } as ApiErrorResponse);
        }

        // 엔진별 해상도 기본값 — HappyHorse 720P, Seedance 480P (저비용 진입)
        if (!resolution) {
            resolution = videoEngine === 'seedance' ? '480P' : '720P';
        }

        // 엔진별 입력 검증
        if (videoEngine === 'happyhorse' && resolution === '480P') {
            return res.status(400).json({
                error: 'HappyHorse 엔진은 480P를 지원하지 않습니다. 720P 또는 1080P를 선택하세요.',
                code: 'INVALID_RESOLUTION',
            } as ApiErrorResponse);
        }
        if (videoEngine === 'seedance' && resolution === '1080P') {
            return res.status(400).json({
                error: 'Seedance i2v는 1080P를 지원하지 않습니다. 480P/720P 또는 HappyHorse 엔진을 선택하세요.',
                code: 'INVALID_RESOLUTION',
            } as ApiErrorResponse);
        }

        // 사용자별 EachLabs 키 조회 — 일반 사용자는 본인 키만, admin만 환경변수 폴백 (비용 누수 차단)
        const user = await findUserById(auth.userId);
        const personalKey = user?.settings?.hailuoApiKey;
        const apiKey = personalKey || (user?.isAdmin ? process.env.HAILUO_API_KEY : undefined);

        if (!apiKey) {
            return res.status(400).json({
                error: 'EachLabs API 키가 설정되지 않았습니다. 설정에서 본인 EachLabs API 키를 입력해 주세요.',
                code: 'API_KEY_MISSING'
            } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(motionPrompt, 1000);

        // i2v용 motion-specific prompt 강화 (vague prompt 회피)
        const enhancedPrompt = `${sanitizedPrompt}\n\nMotion: smooth, natural camera movement with realistic physics. Cinematic film-like aesthetics. Consistent lighting throughout. No sudden jumps or artifacts.`.trim();

        // 엔진별 duration 범위 (HappyHorse 3~15, Seedance 4~15)
        const minDur = videoEngine === 'seedance' ? 4 : 3;
        const clampedDuration = Math.max(minDur, Math.min(15, Math.round(durationSeconds)));

        // seed 미지정 시 자동 생성 — 응답에 포함해 클라이언트가 고해상도 재생성에 재사용
        const effectiveSeed = typeof seed === 'number' ? seed : Math.floor(Math.random() * 2_147_483_647);

        log.info(`${videoEngine} i2v 호출`, {
            engine: videoEngine,
            duration: clampedDuration,
            resolution,
            audio: videoEngine === 'seedance' ? generateAudio : false,
            promptChars: enhancedPrompt.length,
            seed: effectiveSeed,
            hasEndFrame: !!endFrame,
        });

        let videoUrl: string;

        if (videoEngine === 'seedance') {
            const result = await generateSeedanceI2V({
                apiKey,
                prompt: enhancedPrompt,
                firstFrame: sourceImage,
                ...(endFrame && { endFrame }),
                duration: clampedDuration,
                resolution: resolution as SeedanceResolution,
                aspectRatio: 'auto',
                generateAudio,
                seed: effectiveSeed,
            });
            videoUrl = result.videoUrl;
        } else {
            const result = await generateHappyhorseI2V({
                apiKey,
                prompt: enhancedPrompt,
                firstFrame: sourceImage,
                duration: clampedDuration,
                resolution: resolution as HappyhorseResolution,
                seed: effectiveSeed,
            });
            videoUrl = result.videoUrl;
        }

        const response: VideoGenerationResult = {
            videoUrl,
            seed: effectiveSeed,
            resolution,
            videoEngine,
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
