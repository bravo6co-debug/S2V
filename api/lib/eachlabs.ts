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

// QWEN 모델 ID (앱 내부 단일 식별자 → eachlabs slug 매핑은 generateQwenImage 내부)
const QWEN_IMAGE_MODEL_ID = 'qwen-image-2.0';
const QWEN_TEXT_TO_IMAGE_SLUG = 'alibaba-qwen-image-2-0-text-to-image';
const QWEN_IMAGE_EDIT_SLUG = 'alibaba-qwen-image-2-0-image-edit';

// QWEN 비율 → size 매핑 (WIDTH*HEIGHT, "*" 구분자)
const QWEN_SIZE_MAP: Record<'16:9' | '9:16' | '1:1', string> = {
    '1:1': '1024*1024',
    '16:9': '1280*720',
    '9:16': '720*1280',
};

// GPT Image v2 모델 ID (앱 내부 단일 식별자)
const GPT_IMAGE_V2_MODEL_ID = 'gpt-image-2.0';
const GPT_IMAGE_V2_TEXT_TO_IMAGE_SLUG = 'gpt-image-v2-text-to-image';
const GPT_IMAGE_V2_EDIT_SLUG = 'gpt-image-v2-edit';

// GPT Image v2 비율 → size 매핑 (WIDTHxHEIGHT, "x" 구분자)
const GPT_IMAGE_V2_SIZE_MAP: Record<'16:9' | '9:16' | '1:1', string> = {
    '1:1': '1024x1024',
    '16:9': '1792x1024',
    '9:16': '1024x1792',
};

/**
 * FLUX 모델인지 확인
 */
export function isFluxModel(model: string): boolean {
    return model.startsWith('flux-kontext-');
}

/**
 * QWEN Image 모델인지 확인
 */
export function isQwenImageModel(model: string): boolean {
    return model === QWEN_IMAGE_MODEL_ID;
}

/**
 * GPT Image v2 모델인지 확인
 */
export function isGptImageV2Model(model: string): boolean {
    return model === GPT_IMAGE_V2_MODEL_ID;
}

/**
 * Eachlabs 이미지 모델(FLUX / QWEN / GPT Image 등)인지 확인 — Eachlabs API 키로 처리되는 모델 전체
 */
export function isEachlabsImageModel(model: string): boolean {
    return isFluxModel(model) || isQwenImageModel(model) || isGptImageV2Model(model);
}

/**
 * 사용자별 EachLabs API 키 조회 (Hailuo와 동일한 키 사용)
 * - 일반 사용자: 본인 설정 키만 사용
 * - 관리자(isAdmin): 본인 키 없으면 환경변수(HAILUO_API_KEY) 폴백
 */
export async function getEachLabsApiKey(userId: string): Promise<string> {
    const user = await findUserById(userId);
    const personalKey = user?.settings?.hailuoApiKey;

    if (personalKey) {
        return personalKey;
    }

    // 환경변수 폴백은 admin만 허용 — 일반 사용자가 관리자 키로 자동 청구되는 비용 누수 차단
    if (user?.isAdmin && process.env.HAILUO_API_KEY) {
        return process.env.HAILUO_API_KEY;
    }

    throw new Error('EachLabs API 키가 설정되지 않았습니다. 설정에서 본인 EachLabs API 키를 입력해 주세요.');
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

// =============================================
// 공통 헬퍼 함수 (Common Helpers)
// =============================================

/**
 * EachLabs Prediction 생성 (공통)
 */
async function createPrediction(apiKey: string, modelName: string, input: Record<string, unknown>): Promise<string> {
    const createResponse = await fetch(`${EACHLABS_API_URL}/`, {
        method: 'POST',
        headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: modelName,
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
        throw new Error(`[${modelName}] 이미지 생성 요청 실패: ${errMsg}`);
    }

    return createResult.predictionID as string;
}

/**
 * EachLabs Prediction 결과 폴링 (공통)
 * 성공 시 출력 URL 반환 (이미지/영상 공용)
 * @param maxPollingTimeMs 기본 120초 (이미지), 영상은 300초 권장
 */
async function pollPrediction(apiKey: string, predictionId: string, modelName: string, maxPollingTimeMs: number = 120000): Promise<string> {
    const maxPollingTime = maxPollingTimeMs;
    const pollInterval = 3000;
    const startTime = Date.now();
    let pollCount = 0;
    let consecutiveErrors = 0;

    while (true) {
        pollCount++;
        const elapsed = Math.round((Date.now() - startTime) / 1000);

        if (Date.now() - startTime > maxPollingTime) {
            throw new Error(`[${modelName}] 이미지 생성 시간 초과 (${elapsed}초 경과). 다시 시도해 주세요.`);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));

        try {
            const pollResponse = await fetch(`${EACHLABS_API_URL}/${predictionId}`, {
                headers: { 'X-API-Key': apiKey },
            });
            const pollResult = await pollResponse.json() as Record<string, unknown>;

            if (pollResult.status === 'success' && pollResult.output) {
                return pollResult.output as string;
            }

            if (pollResult.status === 'error') {
                const errDetail = (pollResult.error as string) || (pollResult.message as string) || '알 수 없는 오류';
                throw new Error(`[${modelName}] 이미지 생성 실패: ${errDetail}`);
            }

            consecutiveErrors = 0;
        } catch (pollError) {
            if (pollError instanceof Error && pollError.message.includes(modelName)) {
                throw pollError;
            }
            consecutiveErrors++;
            if (consecutiveErrors >= 3) {
                throw new Error(`[${modelName}] 이미지 생성 상태 확인이 반복 실패했습니다.`);
            }
        }
    }
}

// =============================================
// FLUX Kontext 이미지 생성 (기존)
// =============================================

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
        const useMultiImage = referenceImages && referenceImages.length >= 2;
        const eachLabsModel = useMultiImage
            ? (FLUX_MULTI_MODELS[model] || FLUX_MULTI_MODELS['flux-kontext-pro'])
            : (FLUX_SINGLE_MODELS[model] || FLUX_SINGLE_MODELS['flux-kontext-pro']);

        const input: Record<string, unknown> = {
            prompt,
            output_format: 'png',
        };

        if (aspectRatio === '16:9') {
            input.aspect_ratio = '16:9';
        } else if (aspectRatio === '9:16') {
            input.aspect_ratio = '9:16';
        } else {
            input.aspect_ratio = '1:1';
        }

        if (useMultiImage) {
            input.safety_tolerance = 2;
            const url1 = await uploadImageToBlob(referenceImages[0]);
            blobUrls.push(url1);
            input.input_image_1 = url1;
            const url2 = await uploadImageToBlob(referenceImages[1]);
            blobUrls.push(url2);
            input.input_image_2 = url2;
        } else if (referenceImages && referenceImages.length === 1) {
            input.safety_tolerance = 6;
            const url = await uploadImageToBlob(referenceImages[0]);
            blobUrls.push(url);
            input.input_image = url;
        } else {
            input.safety_tolerance = 6;
        }

        const predictionId = await createPrediction(apiKey, eachLabsModel, input);
        const outputUrl = await pollPrediction(apiKey, predictionId, 'FLUX');
        return await downloadImageAsBase64(outputUrl);
    } finally {
        for (const url of blobUrls) {
            try { await del(url); } catch (e) { console.warn('[FLUX] Blob cleanup failed:', e); }
        }
    }
}

// =============================================
// QWEN Image 2.0 (Alibaba) — Text-to-Image + Image-Edit
// =============================================

/**
 * QWEN Image 2.0 모델로 이미지 생성
 * - 참조 이미지 0장: alibaba-qwen-image-2-0-text-to-image (text-to-image)
 * - 참조 이미지 1~3장: alibaba-qwen-image-2-0-image-edit (image-edit)
 */
export async function generateQwenImage(options: EachlabsImageOptions): Promise<ImageData> {
    const { apiKey, prompt, aspectRatio, referenceImages } = options;
    const blobUrls: string[] = [];

    try {
        const hasRefs = !!(referenceImages && referenceImages.length > 0);
        const eachLabsModel = hasRefs ? QWEN_IMAGE_EDIT_SLUG : QWEN_TEXT_TO_IMAGE_SLUG;
        const size = QWEN_SIZE_MAP[aspectRatio || '1:1'];

        const input: Record<string, unknown> = {
            prompt,
            n: 1,
            size,
            prompt_extend: true,
        };

        if (hasRefs) {
            // image-edit 모델은 image_urls 배열 (최대 3장)
            const urls: string[] = [];
            for (const img of referenceImages!.slice(0, 3)) {
                const url = await uploadImageToBlob(img);
                blobUrls.push(url);
                urls.push(url);
            }
            input.image_urls = urls;
        }

        const predictionId = await createPrediction(apiKey, eachLabsModel, input);
        const outputUrl = await pollPrediction(apiKey, predictionId, 'QWEN');
        return await downloadImageAsBase64(outputUrl);
    } finally {
        for (const url of blobUrls) {
            try { await del(url); } catch (e) { console.warn('[QWEN] Blob cleanup failed:', e); }
        }
    }
}

// =============================================
// GPT Image v2 (OpenAI) — Text-to-Image + Image-Edit
// =============================================

/**
 * GPT Image v2 모델로 이미지 생성
 * - 참조 이미지 0장: gpt-image-v2-text-to-image
 * - 참조 이미지 1~16장: gpt-image-v2-edit
 *
 * 가격: 토큰 기반 ($5/M text in, $10/M image in, $30/M image out — 장당 약 $0.05~$0.15)
 * 강점: 텍스트/로고/브랜드 정확도, 사실적 묘사
 * 단점: 평균 처리 시간 길음 (text-to-image ~40s, edit ~100s)
 */
export async function generateGptImageV2(options: EachlabsImageOptions): Promise<ImageData> {
    const { apiKey, prompt, aspectRatio, referenceImages } = options;
    const blobUrls: string[] = [];

    try {
        const hasRefs = !!(referenceImages && referenceImages.length > 0);
        const eachLabsModel = hasRefs ? GPT_IMAGE_V2_EDIT_SLUG : GPT_IMAGE_V2_TEXT_TO_IMAGE_SLUG;
        const size = GPT_IMAGE_V2_SIZE_MAP[aspectRatio || '1:1'];

        const input: Record<string, unknown> = {
            prompt,
            num_images: 1,
            quality: 'high',
            background: 'auto',
            moderation: 'low',
            output_format: 'png',
        };

        if (hasRefs) {
            // image-edit 모델은 image_urls 배열 + image_size 필드 사용
            const urls: string[] = [];
            for (const img of referenceImages!.slice(0, 16)) {
                const url = await uploadImageToBlob(img);
                blobUrls.push(url);
                urls.push(url);
            }
            input.image_urls = urls;
            input.image_size = size;
        } else {
            // text-to-image 모델은 size 필드 사용
            input.size = size;
        }

        const predictionId = await createPrediction(apiKey, eachLabsModel, input);
        const outputUrl = await pollPrediction(apiKey, predictionId, 'GPT-Image-v2');
        return await downloadImageAsBase64(outputUrl);
    } finally {
        for (const url of blobUrls) {
            try { await del(url); } catch (e) { console.warn('[GPT-Image-v2] Blob cleanup failed:', e); }
        }
    }
}

// =============================================
// Eachlabs 이미지 모델 통합 디스패처
// =============================================

export interface EachlabsImageOptions {
    apiKey: string;
    model: string;
    prompt: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    referenceImages?: ImageData[];
}

/**
 * Eachlabs 이미지 모델 통합 호출 엔트리.
 * 모델 ID를 보고 FLUX / QWEN / GPT Image v2 등 적절한 어댑터로 라우팅.
 * 호출부에서는 모델별 분기 없이 이 한 함수만 쓰면 됨.
 */
export async function generateEachlabsImage(options: EachlabsImageOptions): Promise<ImageData> {
    if (isFluxModel(options.model)) {
        return generateFluxImage(options);
    }
    if (isQwenImageModel(options.model)) {
        return generateQwenImage(options);
    }
    if (isGptImageV2Model(options.model)) {
        return generateGptImageV2(options);
    }
    throw new Error(`지원하지 않는 Eachlabs 이미지 모델입니다: ${options.model}`);
}

// =============================================
// FLUX 2 Turbo Edit (앵커 이미지 생성, 최대 4장 참조)
// =============================================

export interface Flux2EditOptions {
    apiKey: string;
    prompt: string;
    referenceImages: ImageData[];  // 1~4장 참조 이미지
    aspectRatio?: '16:9' | '9:16' | '1:1';
    guidanceScale?: number;
}

/**
 * FLUX 2 Turbo Edit로 앵커 이미지 생성
 * 최대 4장의 참조 이미지를 동시에 사용 가능
 */
export async function generateFlux2Edit(options: Flux2EditOptions): Promise<ImageData> {
    const { apiKey, prompt, referenceImages, aspectRatio, guidanceScale } = options;
    const blobUrls: string[] = [];

    try {
        // 참조 이미지 업로드 (최대 4장)
        const imageUrls: string[] = [];
        for (const img of referenceImages.slice(0, 4)) {
            const url = await uploadImageToBlob(img);
            blobUrls.push(url);
            imageUrls.push(url);
        }

        const input: Record<string, unknown> = {
            prompt,
            image_urls: imageUrls,
            guidance_scale: guidanceScale || 2.5,
            num_images: 1,
            output_format: 'png',
            enable_safety_checker: true,
        };

        // 종횡비 → image_size 매핑
        if (aspectRatio === '16:9') {
            input.image_size = 'landscape_16_9';
        } else if (aspectRatio === '9:16') {
            input.image_size = 'portrait_16_9';
        } else {
            input.image_size = 'square_hd';
        }

        const predictionId = await createPrediction(apiKey, 'flux-2-turbo-edit', input);
        const outputUrl = await pollPrediction(apiKey, predictionId, 'FLUX2-Edit');
        return await downloadImageAsBase64(outputUrl);
    } finally {
        for (const url of blobUrls) {
            try { await del(url); } catch (e) { console.warn('[FLUX2-Edit] Blob cleanup:', e); }
        }
    }
}

// =============================================
// FLUX Krea Image-to-Image (씬별 변형, Strength 제어)
// =============================================

export interface FluxI2IOptions {
    apiKey: string;
    prompt: string;
    sourceImage: ImageData;     // 앵커 이미지 (변형 기반)
    strength: number;           // 0~1 (0=원본 유지, 1=완전 재생성)
    numInferenceSteps?: number;
    guidanceScale?: number;
}

/**
 * FLUX Krea Image-to-Image로 앵커 기반 씬 변형
 * strength가 낮을수록 앵커 이미지에 가까운 결과
 */
export async function generateFluxI2I(options: FluxI2IOptions): Promise<ImageData> {
    const { apiKey, prompt, sourceImage, strength, numInferenceSteps, guidanceScale } = options;
    const blobUrls: string[] = [];

    try {
        const imageUrl = await uploadImageToBlob(sourceImage);
        blobUrls.push(imageUrl);

        const input: Record<string, unknown> = {
            prompt,
            image_url: imageUrl,
            strength: Math.max(0, Math.min(1, strength)),
            num_inference_steps: numInferenceSteps || 40,
            guidance_scale: guidanceScale || 4.5,
            num_images: 1,
            output_format: 'png',
            enable_safety_checker: true,
        };

        const predictionId = await createPrediction(apiKey, 'flux-krea-image-to-image', input);
        const outputUrl = await pollPrediction(apiKey, predictionId, 'FLUX-I2I');
        return await downloadImageAsBase64(outputUrl);
    } finally {
        for (const url of blobUrls) {
            try { await del(url); } catch (e) { console.warn('[FLUX-I2I] Blob cleanup:', e); }
        }
    }
}

// =============================================
// HappyHorse 1.0 — Text-to-Video / Image-to-Video (Alibaba)
// =============================================

const HAPPYHORSE_T2V_SLUG = 'alibaba-happyhorse-1-0-text-to-video';
const HAPPYHORSE_I2V_SLUG = 'alibaba-happyhorse-1-0-image-to-video';
// 영상 생성은 보통 200~220초 소요 — 폴링 한도를 5분으로
const HAPPYHORSE_POLL_TIMEOUT_MS = 300_000;

export type HappyhorseResolution = '720P' | '1080P';
export type HappyhorseRatio = '16:9' | '9:16' | '1:1';

export interface HappyhorseT2VOptions {
    apiKey: string;
    prompt: string;
    duration: number;            // 3~15 초
    resolution: HappyhorseResolution;
    ratio: HappyhorseRatio;
    seed?: number;               // 같은 seed로 재현 가능 (1080P 업그레이드용)
}

export interface HappyhorseI2VOptions {
    apiKey: string;
    prompt: string;
    firstFrame: ImageData;       // 첫 프레임 이미지 — Vercel Blob 업로드 후 URL로 전달
    duration: number;            // 3~15 초
    resolution: HappyhorseResolution;
    seed?: number;
    // 비고: i2v는 aspect ratio가 firstFrame 이미지에 자동 매칭 (API 파라미터 없음)
}

export interface HappyhorseVideoResult {
    videoUrl: string;            // 외부 CDN URL (다운로드 또는 클라이언트가 바로 사용)
}

/**
 * HappyHorse Text-to-Video — 15초 광고 단일 호출용
 * 사용자 multi-shot prompt를 그대로 전달
 */
export async function generateHappyhorseT2V(options: HappyhorseT2VOptions): Promise<HappyhorseVideoResult> {
    const { apiKey, prompt, duration, resolution, ratio, seed } = options;

    if (duration < 3 || duration > 15) {
        throw new Error(`HappyHorse duration은 3~15초여야 합니다 (입력: ${duration})`);
    }

    const input: Record<string, unknown> = {
        prompt,
        duration,
        resolution,
        ratio,
    };
    if (typeof seed === 'number') input.seed = seed;

    const predictionId = await createPrediction(apiKey, HAPPYHORSE_T2V_SLUG, input);
    const videoUrl = await pollPrediction(apiKey, predictionId, 'HappyHorse-T2V', HAPPYHORSE_POLL_TIMEOUT_MS);
    return { videoUrl };
}

/**
 * HappyHorse Image-to-Video — 30초+ 광고용. 씬 이미지를 첫 프레임으로 사용
 * aspectRatio는 firstFrame 이미지의 비율을 자동 매칭 (API 파라미터 미존재)
 */
export async function generateHappyhorseI2V(options: HappyhorseI2VOptions): Promise<HappyhorseVideoResult> {
    const { apiKey, prompt, firstFrame, duration, resolution, seed } = options;

    if (duration < 3 || duration > 15) {
        throw new Error(`HappyHorse duration은 3~15초여야 합니다 (입력: ${duration})`);
    }

    // first_frame 이미지를 Vercel Blob에 업로드해 공개 URL 확보
    const frameUrl = await uploadImageToBlob(firstFrame);

    try {
        const input: Record<string, unknown> = {
            prompt,
            duration,
            resolution,
            first_frame: frameUrl,
        };
        if (typeof seed === 'number') input.seed = seed;

        const predictionId = await createPrediction(apiKey, HAPPYHORSE_I2V_SLUG, input);
        const videoUrl = await pollPrediction(apiKey, predictionId, 'HappyHorse-I2V', HAPPYHORSE_POLL_TIMEOUT_MS);
        return { videoUrl };
    } finally {
        try { await del(frameUrl); } catch (e) { console.warn('[HappyHorse-I2V] Blob cleanup:', e); }
    }
}

// =============================================
// Seedance 2.0 — Text-to-Video / Image-to-Video Fast (ByteDance)
// 차별점: 네이티브 오디오 동기화 (HappyHorse는 무음)
// 가격(720p): t2v $0.3024/s, i2v-fast $0.2419/s — HappyHorse 대비 ~2~3배
// =============================================

const SEEDANCE_T2V_SLUG = 'bytedance-seedance-2-0-text-to-video';
const SEEDANCE_I2V_FAST_SLUG = 'bytedance-seedance-2-0-image-to-video-fast';
const SEEDANCE_POLL_TIMEOUT_MS = 360_000; // Avg run 150s, 여유 6분

// 사용자 노출 해상도는 HappyHorse와 동일한 대문자 형식을 유지하고,
// 어댑터 내부에서 Seedance가 요구하는 소문자로 변환 (호출부 단순화).
export type SeedanceResolution = '480P' | '720P' | '1080P';
export type SeedanceAspectRatio = 'auto' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '1:1';

export interface SeedanceT2VOptions {
    apiKey: string;
    prompt: string;
    duration: number;                  // 4~15 (어댑터에서 string 변환)
    resolution: SeedanceResolution;
    aspectRatio?: SeedanceAspectRatio; // 기본 'auto'
    generateAudio: boolean;            // 명시 필수 — 광고 톤 정책에 영향
    seed?: number;
}

export interface SeedanceI2VOptions {
    apiKey: string;
    prompt: string;
    firstFrame: ImageData;             // → image_url
    endFrame?: ImageData;              // → end_image_url (선택)
    duration: number | 'auto';         // 4~15 또는 'auto'
    resolution: SeedanceResolution;
    aspectRatio?: SeedanceAspectRatio;
    generateAudio: boolean;
    seed?: number;
}

export interface SeedanceVideoResult {
    videoUrl: string;
}

function toSeedanceResolution(res: SeedanceResolution): string {
    // Seedance는 소문자 ('720p') 요구
    return res.toLowerCase();
}

/**
 * Seedance 2.0 Text-to-Video — 광고/먹방/롱폼 훅에서 네이티브 오디오가 필요할 때 사용
 */
export async function generateSeedanceT2V(options: SeedanceT2VOptions): Promise<SeedanceVideoResult> {
    const { apiKey, prompt, duration, resolution, aspectRatio = 'auto', generateAudio, seed } = options;

    if (duration < 4 || duration > 15) {
        throw new Error(`Seedance duration은 4~15초여야 합니다 (입력: ${duration})`);
    }

    const input: Record<string, unknown> = {
        prompt,
        duration: String(duration),                  // Seedance는 문자열 요구
        resolution: toSeedanceResolution(resolution),
        aspect_ratio: aspectRatio,
        generate_audio: generateAudio,
        enable_safety_checker: true,
    };
    if (typeof seed === 'number') input.seed = String(seed);

    const predictionId = await createPrediction(apiKey, SEEDANCE_T2V_SLUG, input);
    const videoUrl = await pollPrediction(apiKey, predictionId, 'Seedance-T2V', SEEDANCE_POLL_TIMEOUT_MS);
    return { videoUrl };
}

/**
 * Seedance 2.0 Image-to-Video Fast — 30초+ 광고용 씬별 i2v
 * - image_url 단일 + end_image_url 선택 (HappyHorse i2v는 first_frame만 있음)
 * - duration 'auto'면 모델이 입력 이미지/프롬프트 기준으로 결정
 * - 해상도 지원: 480p ($0.1129/s), 720p ($0.2419/s) — 1080p 미지원
 */
export async function generateSeedanceI2V(options: SeedanceI2VOptions): Promise<SeedanceVideoResult> {
    const { apiKey, prompt, firstFrame, endFrame, duration, resolution, aspectRatio = 'auto', generateAudio, seed } = options;

    if (resolution === '1080P') {
        throw new Error('Seedance i2v-fast는 1080p를 지원하지 않습니다. 480P 또는 720P를 사용하세요. 1080p가 필요하면 t2v 모델을 사용하세요.');
    }

    if (typeof duration === 'number' && (duration < 4 || duration > 15)) {
        throw new Error(`Seedance duration은 4~15초여야 합니다 (입력: ${duration})`);
    }

    const blobUrls: string[] = [];

    try {
        const imageUrl = await uploadImageToBlob(firstFrame);
        blobUrls.push(imageUrl);

        const input: Record<string, unknown> = {
            prompt,
            image_url: imageUrl,
            duration: typeof duration === 'number' ? String(duration) : duration,
            resolution: toSeedanceResolution(resolution),
            aspect_ratio: aspectRatio,
            generate_audio: generateAudio,
            enable_safety_checker: true,
        };

        if (endFrame) {
            const endUrl = await uploadImageToBlob(endFrame);
            blobUrls.push(endUrl);
            input.end_image_url = endUrl;
        }

        if (typeof seed === 'number') input.seed = String(seed);

        const predictionId = await createPrediction(apiKey, SEEDANCE_I2V_FAST_SLUG, input);
        const videoUrl = await pollPrediction(apiKey, predictionId, 'Seedance-I2V-Fast', SEEDANCE_POLL_TIMEOUT_MS);
        return { videoUrl };
    } finally {
        for (const url of blobUrls) {
            try { await del(url); } catch (e) { console.warn('[Seedance-I2V] Blob cleanup:', e); }
        }
    }
}
