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
