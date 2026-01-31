/**
 * EachLabs.ai API utility for FLUX Kontext image generation
 * Shared by all image generation endpoints
 */

import { put, del } from '@vercel/blob';
import { findUserById } from './mongodb.js';
import type { ImageData } from './types.js';

const EACHLABS_API_URL = 'https://api.eachlabs.ai/v1/prediction';
const EACHLABS_VERSION = '0.0.1';

// FLUX 모델 → EachLabs API 모델명 매핑 (단일 이미지)
const FLUX_SINGLE_MODELS: Record<string, string> = {
    'flux-kontext-pro': 'flux-kontext-pro',
    'flux-kontext-max': 'flux-kontext-max',
};

// FLUX 모델 → EachLabs API 모델명 매핑 (멀티 이미지)
const FLUX_MULTI_MODELS: Record<string, string> = {
    'flux-kontext-pro': 'multi-image-kontext-pro',
    'flux-kontext-max': 'multi-image-kontext-max',
};

/**
 * FLUX 모델인지 확인
 */
export function isFluxModel(model: string): boolean {
    return model.startsWith('flux-kontext-');
}

/**
 * 사용자별 EachLabs API 키 조회 (Hailuo와 동일한 키 사용)
 */
export async function getEachLabsApiKey(userId: string): Promise<string> {
    const user = await findUserById(userId);
    // 개인 설정 키 우선, 환경변수 폴백 (admin/일반 사용자 동일)
    const apiKey = user?.settings?.hailuoApiKey || process.env.HAILUO_API_KEY;

    if (!apiKey) {
        throw new Error('EachLabs API 키가 설정되지 않았습니다. 설정에서 EachLabs API 키를 입력해 주세요.');
    }

    return apiKey;
}

/**
 * 이미지를 Vercel Blob에 업로드하고 공개 URL 반환
 */
async function uploadImageToBlob(imageData: ImageData): Promise<string> {
    const buffer = Buffer.from(imageData.data, 'base64');
    const ext = imageData.mimeType === 'image/png' ? 'png' : imageData.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const blob = await put(`flux/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`, buffer, {
        access: 'public',
        contentType: imageData.mimeType,
    });
    return blob.url;
}

/**
 * URL에서 이미지를 다운로드하여 base64 ImageData로 변환
 */
async function downloadImageAsBase64(url: string): Promise<ImageData> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`이미지 다운로드 실패: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/png';
    return {
        mimeType: contentType,
        data: buffer.toString('base64'),
    };
}

export interface FluxGenerationOptions {
    apiKey: string;
    model: string;             // flux-kontext-pro 또는 flux-kontext-max
    prompt: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    referenceImages?: ImageData[];  // 참조 이미지 (0~2장)
}

/**
 * FLUX Kontext 모델로 이미지 생성
 * - 참조 이미지 0~1장: flux-kontext-pro/max (단일 이미지 모델)
 * - 참조 이미지 2장: multi-image-kontext-pro/max (멀티 이미지 모델)
 */
export async function generateFluxImage(options: FluxGenerationOptions): Promise<ImageData> {
    const { apiKey, model, prompt, aspectRatio, referenceImages } = options;
    const blobUrls: string[] = [];

    try {
        // 참조 이미지 수에 따라 적절한 EachLabs 모델 선택
        const useMultiImage = referenceImages && referenceImages.length >= 2;
        const eachLabsModel = useMultiImage
            ? (FLUX_MULTI_MODELS[model] || FLUX_MULTI_MODELS['flux-kontext-pro'])
            : (FLUX_SINGLE_MODELS[model] || FLUX_SINGLE_MODELS['flux-kontext-pro']);

        // 입력 파라미터 구성
        const input: Record<string, unknown> = {
            prompt,
            output_format: 'png',
        };

        // 종횡비 설정
        if (aspectRatio === '16:9') {
            input.aspect_ratio = '16:9';
        } else if (aspectRatio === '9:16') {
            input.aspect_ratio = '9:16';
        } else {
            input.aspect_ratio = '1:1';
        }

        // 참조 이미지 업로드 및 설정
        if (useMultiImage) {
            // 멀티 이미지 모델: safety_tolerance 범위 0-2
            input.safety_tolerance = 2;

            const url1 = await uploadImageToBlob(referenceImages[0]);
            blobUrls.push(url1);
            input.input_image_1 = url1;

            const url2 = await uploadImageToBlob(referenceImages[1]);
            blobUrls.push(url2);
            input.input_image_2 = url2;
        } else if (referenceImages && referenceImages.length === 1) {
            // 단일 이미지 모델 + 참조: safety_tolerance 범위 1-6
            input.safety_tolerance = 6;

            const url = await uploadImageToBlob(referenceImages[0]);
            blobUrls.push(url);
            input.input_image = url;
        } else {
            // 텍스트만 (text-to-image): safety_tolerance 범위 1-6
            input.safety_tolerance = 6;
        }

        // EachLabs Prediction 생성
        console.log(`[FLUX] Creating prediction (model: ${eachLabsModel})...`);
        const createResponse = await fetch(`${EACHLABS_API_URL}/`, {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: eachLabsModel,
                version: EACHLABS_VERSION,
                input,
                webhook_url: '',
            }),
        });

        const createResult = await createResponse.json() as Record<string, unknown>;

        if (createResult.status !== 'success' || !createResult.predictionID) {
            const errMsg = (createResult.error as string) || (createResult.message as string) || JSON.stringify(createResult);

            if (String(errMsg).includes('401') || String(errMsg).includes('Unauthorized')) {
                throw new Error('EachLabs API 키가 유효하지 않습니다. 키를 확인해 주세요.');
            }

            throw new Error(`FLUX 이미지 생성 요청 실패: ${errMsg}`);
        }

        const predictionId = createResult.predictionID as string;
        console.log(`[FLUX] Prediction created: ${predictionId}`);

        // 결과 폴링 (최대 2분)
        const maxPollingTime = 120000;
        const pollInterval = 3000;
        const startTime = Date.now();
        let pollCount = 0;
        let consecutiveErrors = 0;

        while (true) {
            pollCount++;
            const elapsed = Math.round((Date.now() - startTime) / 1000);

            if (Date.now() - startTime > maxPollingTime) {
                throw new Error(`FLUX 이미지 생성 시간 초과 (${elapsed}초 경과). 다시 시도해 주세요.`);
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
            console.log(`[FLUX] Polling #${pollCount} - ${elapsed}s elapsed...`);

            try {
                const pollResponse = await fetch(`${EACHLABS_API_URL}/${predictionId}`, {
                    headers: { 'X-API-Key': apiKey },
                });
                const pollResult = await pollResponse.json() as Record<string, unknown>;

                if (pollResult.status === 'success' && pollResult.output) {
                    const totalTime = Math.round((Date.now() - startTime) / 1000);
                    console.log(`[FLUX] Image generated in ${totalTime}s`);

                    // 생성된 이미지 다운로드
                    const imageData = await downloadImageAsBase64(pollResult.output as string);
                    return imageData;
                }

                if (pollResult.status === 'error') {
                    const errDetail = (pollResult.error as string) || (pollResult.message as string) || '알 수 없는 오류';
                    throw new Error(`FLUX 이미지 생성 실패: ${errDetail}`);
                }

                // 아직 처리 중 → 계속 폴링
                consecutiveErrors = 0;
            } catch (pollError) {
                // FLUX 관련 에러는 바로 throw
                if (pollError instanceof Error && pollError.message.includes('FLUX')) {
                    throw pollError;
                }
                consecutiveErrors++;
                console.error(`[FLUX] Poll #${pollCount} failed:`, pollError);
                if (consecutiveErrors >= 3) {
                    throw new Error('FLUX 이미지 생성 상태 확인이 반복 실패했습니다.');
                }
            }
        }
    } finally {
        // Blob URL 정리
        for (const url of blobUrls) {
            try { await del(url); } catch (e) { console.warn('[FLUX] Blob cleanup failed:', e); }
        }
    }
}
