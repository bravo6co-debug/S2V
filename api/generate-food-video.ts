import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sanitizePrompt, setCorsHeaders, getAIClientForUser } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { findUserById } from './lib/mongodb.js';
import type { ApiErrorResponse } from './lib/types.js';

// Hailuo V2.3 via eachlabs.ai
const HAILUO_API_URL = 'https://api.eachlabs.ai/v1/prediction';
const HAILUO_MODEL = 'minimax-hailuo-v2-3-fast-standard-image-to-video';
const HAILUO_VERSION = '0.0.1';

interface GenerateFoodVideoRequest {
    foodImage: {
        mimeType: string;
        data: string;
    };
    prompt: string;
    durationSeconds?: number;
}

interface FoodVideoResult {
    videoUrl: string;
    translatedPrompt: string;
    duration: number;
}

/**
 * POST /api/generate-food-video
 * Generates a cinematic food video from a food image and Korean description.
 * Step 1: Translates Korean food prompt to English cinematic video prompt via Gemini.
 * Step 2: Generates video using Hailuo V2.3 image-to-video (eachlabs.ai).
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

    try {
        const { foodImage, prompt, durationSeconds = 6 } = req.body as GenerateFoodVideoRequest;

        if (!foodImage || !foodImage.data || !foodImage.mimeType) {
            return res.status(400).json({ error: 'foodImage is required (mimeType and data)' } as ApiErrorResponse);
        }

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(prompt, 1000);

        // ============================================
        // Step 1: 한국어 음식 설명을 영어 영상 프롬프트로 변환
        // ============================================
        console.log('=== FOOD VIDEO GENERATION START ===');
        console.log('Step 1: Translating Korean food prompt to English video prompt...');

        const aiClient = await getAIClientForUser(auth.userId);

        const translationResponse = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: `You are a professional food cinematography director. Convert the following Korean food description into an English video motion prompt optimized for image-to-video generation.

The output must be a single cinematic English prompt that describes:
- Camera movements (slow zoom, pan, dolly, tracking shot, etc.)
- Food presentation details (steam rising, sauce drizzling, garnish falling, etc.)
- Lighting and atmosphere (warm lighting, soft bokeh, golden hour, etc.)
- Cinematic quality cues (shallow depth of field, slow motion, macro lens, etc.)

Only return the English prompt text. Do not include any explanation or Korean text.

Korean food description:
${sanitizedPrompt}`
                        }
                    ]
                }
            ]
        });

        const translatedPrompt = (translationResponse as any)?.candidates?.[0]?.content?.parts?.[0]?.text
            || (translationResponse as any)?.text
            || sanitizedPrompt;

        console.log('Translated prompt:', translatedPrompt);

        // ============================================
        // Step 2: Hailuo API로 음식 영상 생성
        // ============================================
        console.log('Step 2: Generating food video via Hailuo API...');

        // 사용자별 Hailuo API 키 조회 (어드민은 환경변수, 일반 사용자는 본인 키)
        let hailuoApiKey: string | undefined;
        const user = await findUserById(auth.userId);
        if (user?.isAdmin) {
            hailuoApiKey = process.env.HAILUO_API_KEY;
        } else {
            hailuoApiKey = user?.settings?.hailuoApiKey || process.env.HAILUO_API_KEY;
        }

        if (!hailuoApiKey) {
            return res.status(400).json({
                error: 'Hailuo API 키가 설정되지 않았습니다. 설정에서 Hailuo API 키를 입력해 주세요.',
                code: 'API_KEY_MISSING'
            } as ApiErrorResponse);
        }

        // 소스 이미지를 data URL로 변환
        const dataUrl = `data:${foodImage.mimeType};base64,${foodImage.data}`;

        // Hailuo API로 prediction 생성
        let predictionId: string;
        try {
            const createResponse = await fetch(`${HAILUO_API_URL}/`, {
                method: 'POST',
                headers: {
                    'X-API-Key': hailuoApiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: HAILUO_MODEL,
                    version: HAILUO_VERSION,
                    input: {
                        prompt_optimizer: true,
                        duration: '6',
                        image_url: dataUrl,
                        prompt: translatedPrompt,
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
            console.error('Failed to create food video prediction:', initError);
            const errorMsg = initError instanceof Error ? initError.message : String(initError);

            if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
                return res.status(403).json({
                    error: 'Hailuo API 키가 유효하지 않습니다. 키를 확인하세요.',
                    code: 'PERMISSION_DENIED'
                } as ApiErrorResponse);
            }

            throw new Error(`Hailuo API 호출 실패: ${errorMsg}`);
        }

        console.log('Food video generation started, polling for completion...');

        // Poll until video generation is complete (max 5 minutes timeout)
        const maxPollingTime = 300000; // 5 minutes
        const pollInterval = 5000; // 5초 간격
        const startTime = Date.now();
        let pollCount = 0;

        while (true) {
            pollCount++;
            const elapsed = Math.round((Date.now() - startTime) / 1000);

            if (Date.now() - startTime > maxPollingTime) {
                throw new Error(`음식 영상 생성 시간 초과 (${elapsed}초 경과). 나중에 다시 시도하세요.`);
            }

            console.log(`Polling #${pollCount} - ${elapsed}s elapsed...`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            try {
                const pollResponse = await fetch(`${HAILUO_API_URL}/${predictionId}`, {
                    headers: {
                        'X-API-Key': hailuoApiKey,
                    },
                });
                const pollResult = await pollResponse.json() as any;

                if (pollResult.status === 'success' && pollResult.output) {
                    const totalTime = Math.round((Date.now() - startTime) / 1000);
                    console.log(`Food video generation completed in ${totalTime} seconds!`);

                    const videoUrl = pollResult.output;
                    console.log('=== FOOD VIDEO GENERATION SUCCESS ===');
                    console.log('Output URL:', videoUrl);

                    const result: FoodVideoResult = {
                        videoUrl: videoUrl,
                        translatedPrompt: translatedPrompt,
                        duration: durationSeconds,
                    };
                    return res.status(200).json(result);
                }

                if (pollResult.status === 'error') {
                    const errDetail = pollResult.error || pollResult.message || '알 수 없는 오류';
                    throw new Error(`음식 영상 생성 실패: ${errDetail}`);
                }

                // 아직 처리 중 (processing/pending) -> 계속 폴링
            } catch (pollError) {
                // 음식 영상 생성 관련 에러는 바로 throw
                if (pollError instanceof Error && pollError.message.includes('음식')) {
                    throw pollError;
                }
                console.error(`Poll #${pollCount} failed:`, pollError);
                // 네트워크 에러 등은 재시도 허용 (최대 3회 연속 실패 시 중단)
                if (pollCount > 3) {
                    throw new Error('음식 영상 생성 상태 확인이 반복 실패했습니다.');
                }
            }
        }

    } catch (e) {
        console.error('=== FOOD VIDEO GENERATION ERROR ===');
        console.error('Error:', e);

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
            if (msg.includes('음식') || msg.includes('Hailuo')) {
                return res.status(500).json({
                    error: msg,
                    code: 'FOOD_VIDEO_GENERATION_FAILED'
                } as ApiErrorResponse);
            }

            return res.status(500).json({
                error: `음식 영상 생성 실패: ${msg}`,
                code: 'FOOD_VIDEO_GENERATION_FAILED'
            } as ApiErrorResponse);
        }

        return res.status(500).json({
            error: '음식 영상 생성 중 알 수 없는 오류가 발생했습니다.',
            code: 'UNKNOWN_ERROR'
        } as ApiErrorResponse);
    }
}
