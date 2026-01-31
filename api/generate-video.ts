import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, del } from '@vercel/blob';
import { sanitizePrompt, setCorsHeaders } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { findUserById } from './lib/mongodb.js';
import type { GenerateVideoRequest, VideoGenerationResult, ApiErrorResponse } from './lib/types.js';

// Hailuo V2.3 via eachlabs.ai
const HAILUO_API_URL = 'https://api.eachlabs.ai/v1/prediction';
const HAILUO_MODEL = 'minimax-hailuo-v2-3-fast-standard-image-to-video';
const HAILUO_VERSION = '0.0.1';

/**
 * POST /api/generate-video
 * Generates a video from an image using Hailuo V2.3 (eachlabs.ai)
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
            success: false,
            error: auth.error || '로그인이 필요합니다.'
        });
    }

    let blobUrl: string | null = null;

    try {
        const { sourceImage, motionPrompt, durationSeconds = 5 } = req.body as GenerateVideoRequest;

        if (!sourceImage || !sourceImage.data) {
            return res.status(400).json({ error: 'sourceImage is required' } as ApiErrorResponse);
        }

        if (!motionPrompt) {
            return res.status(400).json({ error: 'motionPrompt is required' } as ApiErrorResponse);
        }

        // 사용자별 Hailuo API 키 조회 (개인 설정 키 우선, 환경변수 폴백)
        const user = await findUserById(auth.userId);
        const apiKey = user?.settings?.hailuoApiKey || process.env.HAILUO_API_KEY;

        if (!apiKey) {
            return res.status(400).json({
                error: 'Hailuo API 키가 설정되지 않았습니다. 설정에서 Hailuo API 키를 입력해 주세요.',
                code: 'API_KEY_MISSING'
            } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(motionPrompt, 1000);

        console.log('=== VIDEO GENERATION START (Hailuo V2.3) ===');
        console.log('Duration:', durationSeconds, 'seconds');

        // Prepare the enhanced prompt for video generation
        const enhancedPrompt = `
Cinematic video generation from reference image:
${sanitizedPrompt}

Motion & Camera Requirements:
- Smooth, natural camera movements
- Realistic motion physics
- Cinematic quality, film-like aesthetics

Technical Requirements:
- High quality video output
- Consistent lighting throughout
- No sudden jumps or artifacts
`.trim();

        // 이미지를 Vercel Blob에 업로드 (eachlabs.ai는 HTTPS URL 필요, data URL 불가)
        let imageUrl: string;
        try {
            console.log('Uploading image to Vercel Blob...');
            const buffer = Buffer.from(sourceImage.data, 'base64');
            const ext = sourceImage.mimeType === 'image/png' ? 'png' : sourceImage.mimeType === 'image/webp' ? 'webp' : 'jpg';
            const blob = await put(`video/${Date.now()}.${ext}`, buffer, {
                access: 'public',
                contentType: sourceImage.mimeType,
            });
            imageUrl = blob.url;
            blobUrl = blob.url;
            console.log('Image uploaded to Vercel Blob:', imageUrl);
        } catch (uploadError) {
            console.error('Vercel Blob upload failed:', uploadError);
            const msg = uploadError instanceof Error ? uploadError.message : String(uploadError);
            return res.status(500).json({
                error: `이미지 업로드 실패: ${msg}`,
                code: 'IMAGE_UPLOAD_FAILED'
            } as ApiErrorResponse);
        }

        // Hailuo API로 prediction 생성
        let predictionId: string;
        try {
            const createResponse = await fetch(`${HAILUO_API_URL}/`, {
                method: 'POST',
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: HAILUO_MODEL,
                    version: HAILUO_VERSION,
                    input: {
                        prompt: enhancedPrompt,
                        prompt_optimizer: true,
                        image_url: imageUrl,
                        duration: String(durationSeconds <= 6 ? 6 : 10),
                    },
                    webhook_url: '',
                }),
            });

            const createResult = await createResponse.json() as any;

            if (createResult.status !== 'success' || !createResult.predictionID) {
                const errMsg = createResult.error || createResult.message || JSON.stringify(createResult);
                throw new Error(errMsg);
            }

            predictionId = createResult.predictionID;
            console.log(`Prediction created: ${predictionId}`);
        } catch (initError) {
            console.error('Failed to create video generation prediction:', initError);
            const errorMsg = initError instanceof Error ? initError.message : String(initError);

            if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
                return res.status(403).json({
                    error: 'Hailuo API 키가 유효하지 않습니다. 키를 확인하세요.',
                    code: 'PERMISSION_DENIED'
                } as ApiErrorResponse);
            }

            throw new Error(`Hailuo API 호출 실패: ${errorMsg}`);
        }

        console.log('Video generation started, polling for completion...');

        // Poll until video generation is complete (max 5 minutes timeout)
        const maxPollingTime = 300000; // 5 minutes
        const pollInterval = 5000; // 5초 간격
        const startTime = Date.now();
        let pollCount = 0;

        while (true) {
            pollCount++;
            const elapsed = Math.round((Date.now() - startTime) / 1000);

            if (Date.now() - startTime > maxPollingTime) {
                throw new Error(`비디오 생성 시간 초과 (${elapsed}초 경과). 나중에 다시 시도하세요.`);
            }

            console.log(`Polling #${pollCount} - ${elapsed}s elapsed...`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            try {
                const pollResponse = await fetch(`${HAILUO_API_URL}/${predictionId}`, {
                    headers: {
                        'X-API-Key': apiKey,
                    },
                });
                const pollResult = await pollResponse.json() as any;

                if (pollResult.status === 'success' && pollResult.output) {
                    const totalTime = Math.round((Date.now() - startTime) / 1000);
                    console.log(`Video generation completed in ${totalTime} seconds!`);

                    const videoUrl = pollResult.output;
                    console.log('=== VIDEO GENERATION SUCCESS ===');
                    console.log('Output URL:', videoUrl);

                    // Blob 정리
                    if (blobUrl) {
                        try { await del(blobUrl); } catch (delErr) { console.warn('Blob cleanup failed:', delErr); }
                    }

                    const result: VideoGenerationResult = {
                        videoUrl: videoUrl,
                        thumbnailUrl: `data:${sourceImage.mimeType};base64,${sourceImage.data}`,
                        duration: durationSeconds,
                    };
                    return res.status(200).json(result);
                }

                if (pollResult.status === 'error') {
                    const errDetail = pollResult.error || pollResult.message || '알 수 없는 오류';
                    throw new Error(`비디오 생성 실패: ${errDetail}`);
                }

                // 아직 처리 중 (processing/pending) → 계속 폴링
            } catch (pollError) {
                // 비디오 생성 관련 에러는 바로 throw
                if (pollError instanceof Error && pollError.message.includes('비디오')) {
                    throw pollError;
                }
                console.error(`Poll #${pollCount} failed:`, pollError);
                // 네트워크 에러 등은 재시도 허용 (최대 3회 연속 실패 시 중단)
                if (pollCount > 3) {
                    throw new Error('비디오 생성 상태 확인이 반복 실패했습니다.');
                }
            }
        }

    } catch (e) {
        console.error('=== VIDEO GENERATION ERROR ===');
        console.error('Error:', e);

        // Blob 정리
        if (blobUrl) {
            try { await del(blobUrl); } catch (delErr) { console.warn('Blob cleanup failed:', delErr); }
        }

        if (e instanceof Error) {
            const msg = e.message;

            if (msg.includes('PERMISSION_DENIED') || msg.includes('403') || msg.includes('Forbidden') || msg.includes('Unauthorized')) {
                return res.status(403).json({
                    error: 'Hailuo API 접근 권한이 없습니다. API 키를 확인하세요.',
                    code: 'PERMISSION_DENIED'
                } as ApiErrorResponse);
            }
            if (msg.includes('QUOTA_EXCEEDED') || msg.includes('429') || msg.includes('Resource exhausted') || msg.includes('rate limit')) {
                return res.status(429).json({
                    error: 'API 할당량을 초과했습니다. 잠시 후 다시 시도하세요.',
                    code: 'QUOTA_EXCEEDED'
                } as ApiErrorResponse);
            }
            if (msg.includes('비디오') || msg.includes('Hailuo')) {
                return res.status(500).json({
                    error: msg,
                    code: 'VIDEO_GENERATION_FAILED'
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
