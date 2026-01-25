/**
 * Custom Error Classes for structured error handling
 */

// Base API Error class
export class ApiError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly statusCode: number = 500,
        public readonly retryable: boolean = false,
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// Specific error types
export class QuotaExceededError extends ApiError {
    constructor(message?: string, originalError?: Error) {
        super(
            message || 'API 할당량을 초과했습니다. 잠시 후 다시 시도하세요.',
            'QUOTA_EXCEEDED',
            429,
            true,
            originalError
        );
        this.name = 'QuotaExceededError';
    }
}

export class PermissionDeniedError extends ApiError {
    constructor(message?: string, originalError?: Error) {
        super(
            message || 'API 접근 권한이 없습니다. API 키를 확인하세요.',
            'PERMISSION_DENIED',
            403,
            false,
            originalError
        );
        this.name = 'PermissionDeniedError';
    }
}

export class ModelNotFoundError extends ApiError {
    constructor(modelName: string, originalError?: Error) {
        super(
            `모델(${modelName})을 찾을 수 없습니다. API 키가 해당 모델을 지원하는지 확인하세요.`,
            'MODEL_NOT_FOUND',
            404,
            false,
            originalError
        );
        this.name = 'ModelNotFoundError';
    }
}

export class ValidationError extends ApiError {
    constructor(message: string, originalError?: Error) {
        super(
            message,
            'VALIDATION_ERROR',
            400,
            false,
            originalError
        );
        this.name = 'ValidationError';
    }
}

export class GenerationTimeoutError extends ApiError {
    constructor(elapsedSeconds: number, originalError?: Error) {
        super(
            `생성 시간 초과 (${elapsedSeconds}초 경과). 나중에 다시 시도하세요.`,
            'TIMEOUT',
            408,
            true,
            originalError
        );
        this.name = 'GenerationTimeoutError';
    }
}

export class NetworkError extends ApiError {
    constructor(message?: string, originalError?: Error) {
        super(
            message || '네트워크 오류가 발생했습니다. 인터넷 연결을 확인하세요.',
            'NETWORK_ERROR',
            0,
            true,
            originalError
        );
        this.name = 'NetworkError';
    }
}

export class ImageGenerationError extends ApiError {
    constructor(message: string, originalError?: Error) {
        super(
            message,
            'IMAGE_GENERATION_FAILED',
            500,
            true,
            originalError
        );
        this.name = 'ImageGenerationError';
    }
}

export class VideoGenerationError extends ApiError {
    constructor(message: string, originalError?: Error) {
        super(
            message,
            'VIDEO_GENERATION_FAILED',
            500,
            true,
            originalError
        );
        this.name = 'VideoGenerationError';
    }
}

// Parse error from API response
export function parseApiError(error: unknown): ApiError {
    if (error instanceof ApiError) {
        return error;
    }

    if (error instanceof Error) {
        const msg = error.message.toLowerCase();

        if (msg.includes('quota') || msg.includes('429') || msg.includes('resource exhausted')) {
            return new QuotaExceededError(error.message, error);
        }

        if (msg.includes('permission') || msg.includes('403') || msg.includes('forbidden')) {
            return new PermissionDeniedError(error.message, error);
        }

        if (msg.includes('not found') || msg.includes('404')) {
            return new ModelNotFoundError('unknown', error);
        }

        if (msg.includes('timeout') || msg.includes('408')) {
            return new GenerationTimeoutError(0, error);
        }

        if (msg.includes('network') || msg.includes('fetch')) {
            return new NetworkError(error.message, error);
        }

        return new ApiError(error.message, 'UNKNOWN_ERROR', 500, false, error);
    }

    return new ApiError(
        String(error) || '알 수 없는 오류가 발생했습니다.',
        'UNKNOWN_ERROR',
        500,
        false
    );
}

// Retry logic with exponential backoff
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        initialDelay?: number;
        maxDelay?: number;
        backoffMultiplier?: number;
        shouldRetry?: (error: ApiError) => boolean;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        backoffMultiplier = 2,
        shouldRetry = (err) => err.retryable,
    } = options;

    let lastError: ApiError | undefined;
    let currentDelay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = parseApiError(error);

            if (attempt >= maxRetries || !shouldRetry(lastError)) {
                throw lastError;
            }

            // Add jitter to prevent thundering herd
            const jitter = Math.random() * 0.3 * currentDelay;
            const delay = Math.min(currentDelay + jitter, maxDelay);

            console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));

            currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
        }
    }

    throw lastError || new ApiError('All retry attempts failed', 'RETRY_EXHAUSTED', 500);
}

// User-friendly error message helper
export function getErrorMessage(error: unknown): string {
    const apiError = parseApiError(error);

    // Return user-friendly Korean messages
    switch (apiError.code) {
        case 'QUOTA_EXCEEDED':
            return '🚫 API 사용량을 초과했습니다. 잠시 후 다시 시도해주세요.';
        case 'PERMISSION_DENIED':
            return '🔐 API 접근 권한이 없습니다. 관리자에게 문의하세요.';
        case 'MODEL_NOT_FOUND':
            return '❌ 요청한 AI 모델을 사용할 수 없습니다.';
        case 'VALIDATION_ERROR':
            return `⚠️ 입력값 오류: ${apiError.message}`;
        case 'TIMEOUT':
            return '⏰ 처리 시간이 초과되었습니다. 다시 시도해주세요.';
        case 'NETWORK_ERROR':
            return '🌐 네트워크 오류가 발생했습니다. 인터넷 연결을 확인하세요.';
        case 'IMAGE_GENERATION_FAILED':
            return `🖼️ 이미지 생성 실패: ${apiError.message}`;
        case 'VIDEO_GENERATION_FAILED':
            return `🎬 비디오 생성 실패: ${apiError.message}`;
        default:
            return `❗ 오류가 발생했습니다: ${apiError.message}`;
    }
}
