/**
 * React Hook for managing images with IndexedDB storage
 *
 * This hook provides a convenient way to use IndexedDB-backed image storage
 * in React components, including automatic Object URL management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { imageStorage } from '../services/imageStorage';

/**
 * Hook to load and display an image from IndexedDB
 * Automatically manages Object URL lifecycle
 */
export function useImageUrl(imageId: string | null | undefined): {
    url: string | null;
    loading: boolean;
    error: Error | null;
} {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const urlRef = useRef<string | null>(null);

    useEffect(() => {
        // Cleanup previous URL
        if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
        }

        if (!imageId) {
            setUrl(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        imageStorage
            .getImageUrl(imageId)
            .then((newUrl) => {
                if (!cancelled) {
                    if (newUrl) {
                        urlRef.current = newUrl;
                        setUrl(newUrl);
                    } else {
                        setUrl(null);
                    }
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err);
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
        };
    }, [imageId]);

    return { url, loading, error };
}

/**
 * Hook to manage multiple images
 */
export function useImageUrls(imageIds: (string | null | undefined)[]): {
    urls: Map<string, string>;
    loading: boolean;
    error: Error | null;
} {
    const [urls, setUrls] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const urlsRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        // Cleanup previous URLs
        urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        urlsRef.current.clear();

        const validIds = imageIds.filter((id): id is string => !!id);

        if (validIds.length === 0) {
            setUrls(new Map());
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        Promise.all(
            validIds.map(async (id) => {
                const url = await imageStorage.getImageUrl(id);
                return { id, url };
            })
        )
            .then((results) => {
                if (!cancelled) {
                    const newUrls = new Map<string, string>();
                    results.forEach(({ id, url }) => {
                        if (url) {
                            newUrls.set(id, url);
                            urlsRef.current.set(id, url);
                        }
                    });
                    setUrls(newUrls);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err);
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
            urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            urlsRef.current.clear();
        };
    }, [JSON.stringify(imageIds)]); // Use JSON.stringify for array dependency

    return { urls, loading, error };
}

/**
 * Hook for image storage operations
 */
export function useImageStorage() {
    const [initialized, setInitialized] = useState(false);
    const [initError, setInitError] = useState<Error | null>(null);

    useEffect(() => {
        imageStorage
            .init()
            .then(() => setInitialized(true))
            .catch((err) => setInitError(err));
    }, []);

    const saveImage = useCallback(
        async (
            id: string,
            data: string,
            mimeType: string,
            metadata?: Record<string, any>
        ): Promise<void> => {
            await imageStorage.saveImage(id, data, mimeType, metadata);
        },
        []
    );

    const getImage = useCallback(async (id: string) => {
        return imageStorage.getImage(id);
    }, []);

    const getImageAsBase64 = useCallback(async (id: string) => {
        return imageStorage.getImageAsBase64(id);
    }, []);

    const deleteImage = useCallback(async (id: string): Promise<void> => {
        await imageStorage.deleteImage(id);
    }, []);

    const deleteImages = useCallback(async (ids: string[]): Promise<void> => {
        await imageStorage.deleteImages(ids);
    }, []);

    const clearAll = useCallback(async (): Promise<void> => {
        await imageStorage.clearAll();
    }, []);

    const getTotalSize = useCallback(async (): Promise<number> => {
        return imageStorage.getTotalSize();
    }, []);

    const cleanupOldImages = useCallback(async (daysOld?: number): Promise<number> => {
        return imageStorage.cleanupOldImages(daysOld);
    }, []);

    return {
        initialized,
        initError,
        saveImage,
        getImage,
        getImageAsBase64,
        deleteImage,
        deleteImages,
        clearAll,
        getTotalSize,
        cleanupOldImages,
    };
}

/**
 * Helper function to generate a unique image ID
 */
export function generateImageId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Helper to check if a string looks like an IndexedDB image ID
 */
export function isStoredImageId(value: string): boolean {
    return value.startsWith('img_');
}

/**
 * Helper to get display URL (either Object URL from IndexedDB or data URL for legacy)
 */
export async function getDisplayUrl(
    imageData: { data: string; mimeType: string } | string
): Promise<string> {
    if (typeof imageData === 'string') {
        // It's an image ID, get from IndexedDB
        if (isStoredImageId(imageData)) {
            const url = await imageStorage.getImageUrl(imageData);
            if (url) return url;
        }
        // It's already a URL
        return imageData;
    }

    // It's legacy base64 data, create data URL
    return `data:${imageData.mimeType};base64,${imageData.data}`;
}
