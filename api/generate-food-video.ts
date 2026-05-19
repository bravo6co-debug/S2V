import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { findUserById } from './lib/mongodb.js';
import {
    generateHappyhorseI2V,
    generateSeedanceI2V,
    type HappyhorseResolution,
    type SeedanceResolution,
} from './lib/eachlabs.js';
import { createLogger } from './lib/logger.js';
import type { ApiErrorResponse, ImageData, VideoEngine } from './lib/types.js';

const log = createLogger('generate-food-video');

/**
 * Buffer에서 이미지 크기 추출 (JPEG/PNG 지원)
 */
function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
    try {
        // PNG
        if (buffer[0] === 0x89 && buffer[1] === 0x50) {
            return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
        }
        // JPEG
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            let offset = 2;
            while (offset < buffer.length - 1) {
                if (buffer[offset] !== 0xFF) { offset++; continue; }
                const marker = buffer[offset + 1];
                if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
                    return {
                        width: buffer.readUInt16BE(offset + 7),
                        height: buffer.readUInt16BE(offset + 5),
                    };
                }
                if (marker === 0xD8 || marker === 0xD9) {
                    offset += 2;
                } else {
                    offset += 2 + buffer.readUInt16BE(offset + 2);
                }
            }
        }
    } catch (e) {
        console.warn('Failed to extract image dimensions:', e);
    }
    return null;
}

interface GenerateFoodVideoRequest {
    foodImage: ImageData;
    englishPrompt: string;
    durationSeconds?: number;        // 4~15 (Seedance) / 3~15 (HappyHorse). 기본 6
    videoEngine?: VideoEngine;       // 기본 'seedance' — 먹방 ASMR 사운드가 핵심
    resolution?: '480P' | '720P' | '1080P';  // 기본 480P (Seedance) / 720P (HappyHorse)
    generateAudio?: boolean;         // Seedance 전용. 기본 true (먹방 핵심)
    seed?: number;
}

interface FoodVideoResult {
    videoUrl: string;
    duration: number;
    seed?: number;                                  // 동일 결과 보장용 (고해상도 재생성에 재사용)
    resolution?: '480P' | '720P' | '1080P';
    videoEngine?: VideoEngine;
}

/**
 * POST /api/generate-food-video
 * Image-to-Video — 먹방/푸드 영상 생성 (씹는 소리·지글거림 ASMR 핵심)
 *
 * 기본 엔진: Seedance 2.0 i2v-fast 480P + 오디오 ON (네이티브 ASMR)
 * 가격: ~$0.11/초 × 6초 = ~$0.67/회 (HappyHorse 720P보다 약간 저렴 + 사운드 포함)
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
            foodImage,
            englishPrompt,
            durationSeconds = 6,
            videoEngine = 'seedance',
            generateAudio = true,
            seed,
        } = req.body as GenerateFoodVideoRequest;
        let { resolution } = req.body as GenerateFoodVideoRequest;

        if (!foodImage || !foodImage.data || !foodImage.mimeType) {
            return res.status(400).json({ error: '음식 이미지가 필요합니다.' } as ApiErrorResponse);
        }

        if (!englishPrompt) {
            return res.status(400).json({ error: '영어 프롬프트가 필요합니다. 먼저 프롬프트 변환을 진행해 주세요.' } as ApiErrorResponse);
        }

        // 엔진별 기본 해상도 (Seedance 480P, HappyHorse 720P)
        if (!resolution) {
            resolution = videoEngine === 'seedance' ? '480P' : '720P';
        }

        // 엔진별 잘못된 조합 차단
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

        // 이미지 크기 검증 (최소 300x300)
        const buffer = Buffer.from(foodImage.data, 'base64');
        const dims = getImageDimensions(buffer);
        if (dims && (dims.width < 300 || dims.height < 300)) {
            return res.status(400).json({
                error: `이미지가 너무 작습니다 (${dims.width}x${dims.height}). 최소 300x300 이상의 이미지를 사용하세요.`,
                code: 'IMAGE_TOO_SMALL'
            } as ApiErrorResponse);
        }

        // EachLabs API 키 — 일반 사용자는 본인 키만, admin만 환경변수 폴백 (비용 누수 차단)
        const user = await findUserById(auth.userId);
        const personalKey = user?.settings?.hailuoApiKey;
        const apiKey = personalKey || (user?.isAdmin ? process.env.HAILUO_API_KEY : undefined);

        if (!apiKey) {
            return res.status(400).json({
                error: 'EachLabs API 키가 설정되지 않았습니다. 설정에서 본인 EachLabs API 키를 입력해 주세요.',
                code: 'API_KEY_MISSING'
            } as ApiErrorResponse);
        }

        // duration — 엔진별 최소값 (HappyHorse 3, Seedance 4)
        const minDur = videoEngine === 'seedance' ? 4 : 3;
        const clampedDuration = Math.max(minDur, Math.min(15, Math.round(durationSeconds)));

        // seed 미지정 시 자동 생성 — 응답에 포함해 클라이언트가 고해상도 재생성에 재사용
        const effectiveSeed = typeof seed === 'number' ? seed : Math.floor(Math.random() * 2_147_483_647);

        log.info(`${videoEngine} 먹방 영상 생성`, {
            engine: videoEngine,
            duration: clampedDuration,
            resolution,
            audio: videoEngine === 'seedance' ? generateAudio : false,
            promptChars: englishPrompt.length,
            seed: effectiveSeed,
        });

        let videoUrl: string;

        if (videoEngine === 'seedance') {
            const r = await generateSeedanceI2V({
                apiKey,
                prompt: englishPrompt,
                firstFrame: foodImage,
                duration: clampedDuration,
                resolution: resolution as SeedanceResolution,
                aspectRatio: 'auto',
                generateAudio,
                seed: effectiveSeed,
            });
            videoUrl = r.videoUrl;
        } else {
            const r = await generateHappyhorseI2V({
                apiKey,
                prompt: englishPrompt,
                firstFrame: foodImage,
                duration: clampedDuration,
                resolution: resolution as HappyhorseResolution,
                seed: effectiveSeed,
            });
            videoUrl = r.videoUrl;
        }

        const result: FoodVideoResult = {
            videoUrl,
            duration: clampedDuration,
            seed: effectiveSeed,
            resolution,
            videoEngine,
        };
        return res.status(200).json(result);

    } catch (e) {
        log.error('Food video generation failed', { error: e instanceof Error ? e.message : String(e) });

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
                error: `영상 생성 실패: ${msg}`,
                code: 'FOOD_VIDEO_GENERATION_FAILED'
            } as ApiErrorResponse);
        }

        return res.status(500).json({
            error: '영상 생성 중 알 수 없는 오류가 발생했습니다.',
            code: 'UNKNOWN_ERROR'
        } as ApiErrorResponse);
    }
}
