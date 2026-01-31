import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, del } from '@vercel/blob';
import { setCorsHeaders } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { findUserById } from './lib/mongodb.js';
import type { ApiErrorResponse } from './lib/types.js';

// Hailuo V2.3 via eachlabs.ai
const HAILUO_API_URL = 'https://api.eachlabs.ai/v1/prediction';
const HAILUO_MODEL = 'minimax-hailuo-v2-3-fast-standard-image-to-video';
const HAILUO_VERSION = '0.0.1';

/**
 * Extract image dimensions from a Buffer (supports JPEG and PNG)
 */
function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
    try {
        // PNG: starts with 0x89 0x50 0x4E 0x47
        if (buffer[0] === 0x89 && buffer[1] === 0x50) {
            const width = buffer.readUInt32BE(16);
            const height = buffer.readUInt32BE(20);
            return { width, height };
        }

        // JPEG: starts with 0xFF 0xD8
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            let offset = 2;
            while (offset < buffer.length - 1) {
                if (buffer[offset] !== 0xFF) { offset++; continue; }
                const marker = buffer[offset + 1];
                // SOF0, SOF1, SOF2 markers
                if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
                    const height = buffer.readUInt16BE(offset + 5);
                    const width = buffer.readUInt16BE(offset + 7);
                    return { width, height };
                }
                // Skip to next marker
                if (marker === 0xD8 || marker === 0xD9) {
                    offset += 2;
                } else {
                    const segLen = buffer.readUInt16BE(offset + 2);
                    offset += 2 + segLen;
                }
            }
        }
    } catch (e) {
        console.warn('Failed to extract image dimensions:', e);
    }
    return null;
}

interface GenerateFoodVideoRequest {
    foodImage: {
        mimeType: string;
        data: string;
    };
    englishPrompt: string;
    durationSeconds?: number;
}

interface FoodVideoResult {
    videoUrl: string;
    duration: number;
}

/**
 * POST /api/generate-food-video
 * Generates a cinematic food video from a food image and an English video prompt.
 * Uses Hailuo V2.3 image-to-video (eachlabs.ai).
 * Note: Prompt translation is handled separately by /api/translate-food-prompt.
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
        const { foodImage, englishPrompt, durationSeconds = 6 } = req.body as GenerateFoodVideoRequest;

        if (!foodImage || !foodImage.data || !foodImage.mimeType) {
            return res.status(400).json({ error: '음식 이미지가 필요합니다.' } as ApiErrorResponse);
        }

        if (!englishPrompt) {
            return res.status(400).json({ error: '영어 프롬프트가 필요합니다. 먼저 프롬프트 변환을 진행해 주세요.' } as ApiErrorResponse);
        }

        console.log('=== FOOD VIDEO GENERATION START ===');
        console.log('English prompt:', englishPrompt);

        // 사용자별 Hailuo API 키 조회 (개인 설정 키 우선, 환경변수 폴백)
        const user = await findUserById(auth.userId);
        const hailuoApiKey = user?.settings?.hailuoApiKey || process.env.HAILUO_API_KEY;

        if (!hailuoApiKey) {
            return res.status(400).json({
                error: 'Hailuo API 키가 설정되지 않았습니다. 설정에서 Hailuo API 키를 입력해 주세요.',
                code: 'HAILUO_API_KEY_MISSING'
            } as ApiErrorResponse);
        }

        // Step 1: 이미지를 Vercel Blob에 업로드 (eachlabs.ai는 HTTPS URL 필요)
        let imageUrl: string;
        try {
            console.log('Uploading image to Vercel Blob...');
            const buffer = Buffer.from(foodImage.data, 'base64');
            console.log(`Image buffer size: ${buffer.length} bytes (${(buffer.length / 1024).toFixed(1)} KB)`);

            // 이미지 크기 확인
            const dims = getImageDimensions(buffer);
            if (dims) {
                console.log(`Image dimensions: ${dims.width}x${dims.height}`);
                if (dims.width < 300 || dims.height < 300) {
                    return res.status(400).json({
                        error: `이미지가 너무 작습니다 (${dims.width}x${dims.height}). 최소 300x300 이상의 이미지를 사용하세요.`,
                        code: 'IMAGE_TOO_SMALL'
                    } as ApiErrorResponse);
                }
            } else {
                console.warn('Could not extract image dimensions from buffer');
            }

            const ext = foodImage.mimeType === 'image/png' ? 'png' : foodImage.mimeType === 'image/webp' ? 'webp' : 'jpg';
            const blob = await put(`food-video/${Date.now()}.${ext}`, buffer, {
                access: 'public',
                contentType: foodImage.mimeType,
            });
            imageUrl = blob.url;
            blobUrl = blob.url;
            console.log('Image uploaded to Vercel Blob:', imageUrl);

            // Blob URL 접근 가능 여부 검증
            try {
                const verifyResponse = await fetch(imageUrl, { method: 'HEAD' });
                console.log(`Blob verification: status=${verifyResponse.status}, content-type=${verifyResponse.headers.get('content-type')}, content-length=${verifyResponse.headers.get('content-length')}`);
                if (!verifyResponse.ok) {
                    console.error(`Blob URL not accessible: HTTP ${verifyResponse.status}`);
                }
            } catch (verifyErr) {
                console.error('Blob URL verification failed:', verifyErr);
            }
        } catch (uploadError) {
            console.error('Vercel Blob upload failed:', uploadError);
            const msg = uploadError instanceof Error ? uploadError.message : String(uploadError);
            return res.status(500).json({
                error: `이미지 업로드 실패: ${msg}`,
                code: 'IMAGE_UPLOAD_FAILED'
            } as ApiErrorResponse);
        }

        // Step 2: Hailuo API로 prediction 생성
        let predictionId: string;
        try {
            const requestBody = {
                model: HAILUO_MODEL,
                version: HAILUO_VERSION,
                input: {
                    prompt: englishPrompt,
                    prompt_optimizer: true,
                    image_url: imageUrl,
                    duration: '6',
                },
                webhook_url: '',
            };

            console.log('Request body:', JSON.stringify(requestBody));

            const createResponse = await fetch(`${HAILUO_API_URL}/`, {
                method: 'POST',
                headers: {
                    'X-API-Key': hailuoApiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            // 응답 텍스트를 먼저 읽어서 디버깅
            const responseText = await createResponse.text();
            console.log('Hailuo API response status:', createResponse.status);
            console.log('Hailuo API response:', responseText.substring(0, 500));

            let createResult: any;
            try {
                createResult = JSON.parse(responseText);
            } catch {
                throw new Error(`API 응답이 올바른 형식이 아닙니다 (HTTP ${createResponse.status}): ${responseText.substring(0, 200)}`);
            }

            if (!createResponse.ok) {
                const errMsg = createResult.error || createResult.message || createResult.detail || JSON.stringify(createResult);
                throw new Error(`HTTP ${createResponse.status}: ${errMsg}`);
            }

            if (createResult.status !== 'success' || !createResult.predictionID) {
                const errMsg = createResult.error || createResult.message || JSON.stringify(createResult);
                throw new Error(errMsg);
            }

            predictionId = createResult.predictionID;
            console.log(`Prediction created: ${predictionId}`);
        } catch (initError) {
            console.error('Failed to create food video prediction:', initError);
            const errorMsg = initError instanceof Error ? initError.message : String(initError);

            if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
                return res.status(403).json({
                    error: 'Hailuo API 키가 유효하지 않습니다. 설정에서 키를 확인하세요.',
                    code: 'HAILUO_PERMISSION_DENIED'
                } as ApiErrorResponse);
            }

            throw new Error(`Hailuo API 호출 실패: ${errorMsg}`);
        }

        // Step 3: 폴링으로 결과 확인 (최대 5분)
        console.log('Food video generation started, polling for completion...');

        const maxPollingTime = 300000; // 5 minutes
        const pollInterval = 5000; // 5초 간격
        const startTime = Date.now();
        let pollCount = 0;

        while (true) {
            pollCount++;
            const elapsed = Math.round((Date.now() - startTime) / 1000);

            if (Date.now() - startTime > maxPollingTime) {
                throw new Error(`영상 생성 시간 초과 (${elapsed}초 경과). 나중에 다시 시도하세요.`);
            }

            console.log(`Polling #${pollCount} - ${elapsed}s elapsed...`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            try {
                const pollResponse = await fetch(`${HAILUO_API_URL}/${predictionId}`, {
                    method: 'GET',
                    headers: {
                        'X-API-Key': hailuoApiKey,
                        'Content-Type': 'application/json',
                    },
                });
                const pollText = await pollResponse.text();
                let pollResult: any;
                try {
                    pollResult = JSON.parse(pollText);
                } catch {
                    console.error(`Poll response is not JSON: ${pollText.substring(0, 200)}`);
                    continue;
                }

                console.log(`Poll #${pollCount} result status: ${pollResult.status}`);

                if (pollResult.status === 'success' && pollResult.output) {
                    const totalTime = Math.round((Date.now() - startTime) / 1000);
                    console.log(`Food video generation completed in ${totalTime} seconds!`);

                    const videoUrl = pollResult.output;
                    console.log('=== FOOD VIDEO GENERATION SUCCESS ===');
                    console.log('Output URL:', videoUrl);

                    // Blob 정리
                    if (blobUrl) {
                        try { await del(blobUrl); } catch (delErr) { console.warn('Blob cleanup failed:', delErr); }
                    }

                    const result: FoodVideoResult = {
                        videoUrl: videoUrl,
                        duration: durationSeconds,
                    };
                    return res.status(200).json(result);
                }

                if (pollResult.status === 'error') {
                    const errDetail = pollResult.error || pollResult.message || '알 수 없는 오류';
                    throw new Error(`영상 생성 실패: ${errDetail}`);
                }

                // 아직 처리 중 (processing/pending) -> 계속 폴링
            } catch (pollError) {
                if (pollError instanceof Error && pollError.message.includes('영상 생성')) {
                    throw pollError;
                }
                console.error(`Poll #${pollCount} failed:`, pollError);
                if (pollCount > 3) {
                    throw new Error('영상 생성 상태 확인이 반복 실패했습니다.');
                }
            }
        }

    } catch (e) {
        console.error('=== FOOD VIDEO GENERATION ERROR ===');
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
                    code: 'HAILUO_PERMISSION_DENIED'
                } as ApiErrorResponse);
            }
            if (msg.includes('QUOTA_EXCEEDED') || msg.includes('429') || msg.includes('Resource exhausted') || msg.includes('rate limit')) {
                return res.status(429).json({
                    error: 'Hailuo API 할당량을 초과했습니다. 잠시 후 다시 시도하세요.',
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
