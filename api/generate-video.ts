import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, sanitizePrompt, setCorsHeaders } from './lib/gemini.js';
import type { GenerateVideoRequest, VideoGenerationResult, ApiErrorResponse } from './lib/types.js';

/**
 * POST /api/generate-video
 * Generates a video from an image using Veo API
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' } as ApiErrorResponse);
    }

    try {
        const { sourceImage, motionPrompt, durationSeconds = 5 } = req.body as GenerateVideoRequest;

        if (!sourceImage || !sourceImage.data) {
            return res.status(400).json({ error: 'sourceImage is required' } as ApiErrorResponse);
        }

        if (!motionPrompt) {
            return res.status(400).json({ error: 'motionPrompt is required' } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(motionPrompt, 1000);

        console.log('=== VIDEO GENERATION START ===');
        console.log(`Model: ${MODELS.VIDEO}`);
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

        // Generate video using Veo model
        let operation;
        try {
            operation = await ai.models.generateVideos({
                model: MODELS.VIDEO,
                prompt: enhancedPrompt,
                image: {
                    imageBytes: sourceImage.data,
                    mimeType: sourceImage.mimeType as 'image/jpeg' | 'image/png',
                },
                config: {
                    numberOfVideos: 1,
                    durationSeconds: Math.min(durationSeconds, 8),
                    aspectRatio: '16:9',
                },
            });
            console.log('Operation created successfully');
        } catch (initError) {
            console.error('Failed to create video generation operation:', initError);
            const errorMsg = initError instanceof Error ? initError.message : String(initError);

            if (errorMsg.includes('not found') || errorMsg.includes('404')) {
                return res.status(400).json({
                    error: `Veo 모델(${MODELS.VIDEO})을 찾을 수 없습니다. API 키가 Veo API를 지원하는지 확인하세요.`,
                    code: 'MODEL_NOT_FOUND'
                } as ApiErrorResponse);
            }

            throw new Error(`Veo API 호출 실패: ${errorMsg}`);
        }

        console.log('Video generation started, polling for completion...');

        // Poll until video generation is complete (max 5 minutes timeout)
        const maxPollingTime = 300000; // 5 minutes
        const pollInterval = 10000; // 10 seconds
        const startTime = Date.now();
        let pollCount = 0;

        while (!operation.done) {
            pollCount++;
            const elapsed = Math.round((Date.now() - startTime) / 1000);

            if (Date.now() - startTime > maxPollingTime) {
                throw new Error(`비디오 생성 시간 초과 (${elapsed}초 경과). 나중에 다시 시도하세요.`);
            }

            console.log(`Polling #${pollCount} - ${elapsed}s elapsed...`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            try {
                operation = await ai.operations.getVideosOperation({
                    operation: operation,
                });
            } catch (pollError) {
                console.error(`Poll #${pollCount} failed:`, pollError);
                throw new Error(`비디오 생성 상태 확인 실패`);
            }
        }

        const totalTime = Math.round((Date.now() - startTime) / 1000);
        console.log(`Video generation completed in ${totalTime} seconds!`);

        // Extract video data from response
        const response = operation.response as any;

        let videoData: string | undefined;
        let videoUrl: string | undefined;
        let videoMimeType = 'video/mp4';

        const videoSources = [
            response?.generateVideoResponse?.generatedSamples?.[0]?.video,
            response?.generatedVideos?.[0]?.video,
            response?.generatedSamples?.[0]?.video,
        ];

        for (const video of videoSources) {
            if (video) {
                if (video.videoBytes) {
                    videoData = video.videoBytes;
                    videoMimeType = video.mimeType || 'video/mp4';
                    break;
                }
                if (video.uri) {
                    videoUrl = video.uri;
                }
            }
        }

        // videoBytes가 있으면 data URL로 변환
        if (videoData) {
            const videoDataUrl = `data:${videoMimeType};base64,${videoData}`;
            console.log('=== VIDEO GENERATION SUCCESS (with bytes) ===');
            const result: VideoGenerationResult = {
                videoUrl: videoDataUrl,
                thumbnailUrl: `data:${sourceImage.mimeType};base64,${sourceImage.data}`,
                duration: durationSeconds,
            };
            return res.status(200).json(result);
        }

        // URI만 있는 경우 - Vercel API 프록시를 통해 다운로드
        if (videoUrl) {
            const fileMatch = videoUrl.match(/files\/([^:/?]+)/);
            if (fileMatch) {
                const fileId = fileMatch[1];
                console.log('=== VIDEO GENERATION SUCCESS ===');
                const proxyUrl = `/api/download-video?fileId=${fileId}`;
                const result: VideoGenerationResult = {
                    videoUrl: proxyUrl,
                    thumbnailUrl: `data:${sourceImage.mimeType};base64,${sourceImage.data}`,
                    duration: durationSeconds,
                };
                return res.status(200).json(result);
            }

            // fileId를 추출할 수 없는 경우
            const result: VideoGenerationResult = {
                videoUrl: videoUrl,
                thumbnailUrl: `data:${sourceImage.mimeType};base64,${sourceImage.data}`,
                duration: durationSeconds,
            };
            return res.status(200).json(result);
        }

        throw new Error('비디오 생성이 완료되었지만 비디오 데이터를 찾을 수 없습니다.');

    } catch (e) {
        console.error('=== VIDEO GENERATION ERROR ===');
        console.error('Error:', e);

        if (e instanceof Error) {
            const msg = e.message;

            if (msg.includes('PERMISSION_DENIED') || msg.includes('403') || msg.includes('Forbidden')) {
                return res.status(403).json({
                    error: 'Veo API 접근 권한이 없습니다. API 키가 Veo를 지원하는지 확인하세요.',
                    code: 'PERMISSION_DENIED'
                } as ApiErrorResponse);
            }
            if (msg.includes('QUOTA_EXCEEDED') || msg.includes('429') || msg.includes('Resource exhausted')) {
                return res.status(429).json({
                    error: 'Veo API 할당량을 초과했습니다. 잠시 후 다시 시도하세요.',
                    code: 'QUOTA_EXCEEDED'
                } as ApiErrorResponse);
            }
            if (msg.includes('비디오') || msg.includes('Veo')) {
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
