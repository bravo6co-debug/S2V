/**
 * Image compression utility for reducing payload size before API calls.
 * Uses canvas-based compression to resize and reduce quality of images.
 */

// Maximum dimensions for compressed images (preserves aspect ratio)
// Reduced to 768px to keep file sizes manageable for API payloads
const MAX_WIDTH = 768;
const MAX_HEIGHT = 768;

// JPEG quality (0.0 to 1.0)
const COMPRESSION_QUALITY = 0.75;

// Target max size in bytes (aim for ~300KB per image to stay well under Vercel's 4.5MB limit)
// With up to 11 images (5 chars + 5 props + 1 bg), total would be ~3.3MB
const TARGET_MAX_SIZE = 300 * 1024;

interface CompressedImage {
    data: string;  // base64 without data URL prefix
    mimeType: string;
}

/**
 * Load an image from a data URL
 */
const loadImage = (dataUrl: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
};

/**
 * Calculate new dimensions maintaining aspect ratio
 */
const calculateDimensions = (
    width: number,
    height: number,
    maxWidth: number,
    maxHeight: number
): { width: number; height: number } => {
    if (width <= maxWidth && height <= maxHeight) {
        return { width, height };
    }

    const aspectRatio = width / height;

    if (width > height) {
        return {
            width: maxWidth,
            height: Math.round(maxWidth / aspectRatio),
        };
    } else {
        return {
            width: Math.round(maxHeight * aspectRatio),
            height: maxHeight,
        };
    }
};

/**
 * Compress an image using canvas
 */
const compressWithCanvas = async (
    img: HTMLImageElement,
    maxWidth: number,
    maxHeight: number,
    quality: number,
    outputType: string = 'image/jpeg'
): Promise<string> => {
    const { width, height } = calculateDimensions(img.width, img.height, maxWidth, maxHeight);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }

    // Use better image smoothing for quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw the image
    ctx.drawImage(img, 0, 0, width, height);

    // Return as data URL
    return canvas.toDataURL(outputType, quality);
};

/**
 * Compress an image with progressive quality reduction to meet size target
 */
const compressToTargetSize = async (
    img: HTMLImageElement,
    targetSize: number,
    initialQuality: number = 0.85
): Promise<{ dataUrl: string; quality: number }> => {
    let quality = initialQuality;
    let maxDimension = MAX_WIDTH;
    let dataUrl: string;

    // Try progressively lower quality/size until we meet the target
    while (quality >= 0.3) {
        dataUrl = await compressWithCanvas(img, maxDimension, maxDimension, quality, 'image/jpeg');

        // Calculate approximate size (data URL to base64 size)
        const base64Size = dataUrl.split(',')[1].length * 0.75; // Approximate decoded size

        if (base64Size <= targetSize) {
            return { dataUrl, quality };
        }

        // Reduce quality
        quality -= 0.1;

        // If still too large at low quality, reduce dimensions
        if (quality < 0.5 && maxDimension > 512) {
            maxDimension = 512;
            quality = 0.8; // Reset quality when reducing dimensions
        }
    }

    // Return the last attempt if we couldn't meet the target
    return { dataUrl: dataUrl!, quality };
};

/**
 * Convert a File to compressed ImageData
 */
export const compressImageFile = async (file: File): Promise<CompressedImage> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const dataUrl = reader.result as string;
                const result = await compressImage(dataUrl);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Compress an image from a data URL
 */
export const compressImage = async (dataUrl: string): Promise<CompressedImage> => {
    try {
        const img = await loadImage(dataUrl);

        // Check if compression is needed
        const originalSize = dataUrl.split(',')[1].length * 0.75;
        const needsCompression = originalSize > TARGET_MAX_SIZE ||
                                  img.width > MAX_WIDTH ||
                                  img.height > MAX_HEIGHT;

        if (!needsCompression) {
            // Extract base64 and mimeType from original
            const [header, base64Data] = dataUrl.split(',');
            const mimeMatch = header.match(/data:([^;]+)/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            return {
                data: base64Data,
                mimeType,
            };
        }

        // Compress the image
        const { dataUrl: compressedDataUrl } = await compressToTargetSize(
            img,
            TARGET_MAX_SIZE,
            COMPRESSION_QUALITY
        );

        // Extract base64 data (remove the data:image/jpeg;base64, prefix)
        const base64Data = compressedDataUrl.split(',')[1];

        return {
            data: base64Data,
            mimeType: 'image/jpeg',
        };
    } catch (error) {
        console.error('Image compression failed:', error);
        throw error;
    }
};

/**
 * Upscale a small image using canvas (for video generation minimum size requirements)
 */
const upscaleImage = async (
    img: HTMLImageElement,
    minLongSide: number
): Promise<string> => {
    const longSide = Math.max(img.width, img.height);
    if (longSide >= minLongSide) {
        // 이미 충분히 큼 - 원본 그대로 JPEG 변환
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.92);
    }

    const scale = minLongSide / longSide;
    const newWidth = Math.round(img.width * scale);
    const newHeight = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    return canvas.toDataURL('image/jpeg', 0.92);
};

/**
 * Compress an image for video generation (higher quality, larger dimensions).
 * Video APIs (HappyHorse / Seedance i2v) require minimum 300x300 pixels.
 * Small images (< 720px) are automatically upscaled.
 * Uses 1280px max dimension and 1MB target size.
 */
export const compressImageForVideo = async (dataUrl: string): Promise<CompressedImage & { upscaled?: boolean; dimensions?: { width: number; height: number } }> => {
    try {
        const img = await loadImage(dataUrl);

        const VIDEO_MIN = 720;
        const VIDEO_MAX = 1280;
        const VIDEO_TARGET_SIZE = 1024 * 1024; // 1MB

        const longSide = Math.max(img.width, img.height);

        // 작은 이미지는 업스케일 (최소 720px)
        if (longSide < VIDEO_MIN) {
            console.log(`Image too small (${img.width}x${img.height}), upscaling to min ${VIDEO_MIN}px...`);
            const upscaled = await upscaleImage(img, VIDEO_MIN);
            const base64Data = upscaled.split(',')[1];
            const upscaledImg = await loadImage(upscaled);
            return {
                data: base64Data,
                mimeType: 'image/jpeg',
                upscaled: true,
                dimensions: { width: upscaledImg.width, height: upscaledImg.height },
            };
        }

        // 원본이 적정 크기이고 가벼우면 그대로 사용
        const originalSize = dataUrl.split(',')[1].length * 0.75;
        const needsCompression = originalSize > VIDEO_TARGET_SIZE ||
                                  img.width > VIDEO_MAX ||
                                  img.height > VIDEO_MAX;

        if (!needsCompression) {
            const [header, base64Data] = dataUrl.split(',');
            const mimeMatch = header.match(/data:([^;]+)/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            return { data: base64Data, mimeType, dimensions: { width: img.width, height: img.height } };
        }

        // 큰 이미지만 리사이즈 (최소 720px 보장)
        let quality = 0.85;
        let maxDim = VIDEO_MAX;
        let result: string;

        while (quality >= 0.5) {
            result = await compressWithCanvas(img, maxDim, maxDim, quality, 'image/jpeg');
            const size = result.split(',')[1].length * 0.75;
            if (size <= VIDEO_TARGET_SIZE) {
                return { data: result.split(',')[1], mimeType: 'image/jpeg' };
            }
            quality -= 0.1;
            if (quality < 0.6 && maxDim > 720) {
                maxDim = 720;
                quality = 0.85;
            }
        }

        return { data: result!.split(',')[1], mimeType: 'image/jpeg' };
    } catch (error) {
        console.error('Video image compression failed:', error);
        throw error;
    }
};

/**
 * Get the size of a base64 string in bytes
 */
export const getBase64Size = (base64: string): number => {
    // Remove any data URL prefix if present
    const data = base64.includes(',') ? base64.split(',')[1] : base64;
    // Calculate actual byte size from base64
    return Math.ceil(data.length * 0.75);
};

/**
 * Format bytes to human-readable string
 */
export const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
