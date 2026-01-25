/**
 * IndexedDB-based Image Storage Service
 *
 * Stores images as Blobs in IndexedDB instead of base64 strings in React state.
 * This significantly reduces memory usage and improves performance.
 *
 * Benefits:
 * - Images are stored persistently in the browser
 * - Large images don't bloat React state
 * - Object URLs are used for efficient display
 * - Automatic cleanup of unused images
 */

const DB_NAME = 'ImageGenDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';

interface StoredImage {
    id: string;
    blob: Blob;
    mimeType: string;
    createdAt: number;
    metadata?: Record<string, any>;
}

class ImageStorageService {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    /**
     * Initialize the IndexedDB database
     */
    async init(): Promise<void> {
        if (this.db) return;

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise<void>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(new Error('Failed to open IndexedDB'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create the images object store
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });

        return this.initPromise;
    }

    /**
     * Ensure the database is initialized before operations
     */
    private async ensureInit(): Promise<IDBDatabase> {
        if (!this.db) {
            await this.init();
        }
        if (!this.db) {
            throw new Error('IndexedDB not initialized');
        }
        return this.db;
    }

    /**
     * Convert base64 data to Blob
     */
    private base64ToBlob(base64: string, mimeType: string): Blob {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    /**
     * Convert Blob to base64 data
     */
    private async blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Save an image to IndexedDB
     * @param id Unique identifier for the image
     * @param data Base64 encoded image data (without data URL prefix)
     * @param mimeType MIME type of the image
     * @param metadata Optional metadata to store with the image
     */
    async saveImage(
        id: string,
        data: string,
        mimeType: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        const db = await this.ensureInit();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const blob = this.base64ToBlob(data, mimeType);

            const storedImage: StoredImage = {
                id,
                blob,
                mimeType,
                createdAt: Date.now(),
                metadata,
            };

            const request = store.put(storedImage);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('Failed to save image:', request.error);
                reject(new Error('Failed to save image to IndexedDB'));
            };
        });
    }

    /**
     * Get an image from IndexedDB
     * @param id Image ID
     * @returns The stored image or null if not found
     */
    async getImage(id: string): Promise<StoredImage | null> {
        const db = await this.ensureInit();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result || null);
            };
            request.onerror = () => {
                console.error('Failed to get image:', request.error);
                reject(new Error('Failed to get image from IndexedDB'));
            };
        });
    }

    /**
     * Get image as base64 string (for API compatibility)
     */
    async getImageAsBase64(id: string): Promise<{ data: string; mimeType: string } | null> {
        const image = await this.getImage(id);
        if (!image) return null;

        const base64 = await this.blobToBase64(image.blob);
        return {
            data: base64,
            mimeType: image.mimeType,
        };
    }

    /**
     * Get image as Object URL for efficient display
     * Note: Remember to revoke the URL when done using URL.revokeObjectURL()
     */
    async getImageUrl(id: string): Promise<string | null> {
        const image = await this.getImage(id);
        if (!image) return null;

        return URL.createObjectURL(image.blob);
    }

    /**
     * Delete an image from IndexedDB
     */
    async deleteImage(id: string): Promise<void> {
        const db = await this.ensureInit();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('Failed to delete image:', request.error);
                reject(new Error('Failed to delete image from IndexedDB'));
            };
        });
    }

    /**
     * Delete multiple images
     */
    async deleteImages(ids: string[]): Promise<void> {
        const db = await this.ensureInit();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            let completed = 0;
            let hasError = false;

            ids.forEach((id) => {
                const request = store.delete(id);
                request.onsuccess = () => {
                    completed++;
                    if (completed === ids.length && !hasError) {
                        resolve();
                    }
                };
                request.onerror = () => {
                    if (!hasError) {
                        hasError = true;
                        reject(new Error('Failed to delete images from IndexedDB'));
                    }
                };
            });

            if (ids.length === 0) {
                resolve();
            }
        });
    }

    /**
     * Get all image IDs
     */
    async getAllImageIds(): Promise<string[]> {
        const db = await this.ensureInit();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAllKeys();

            request.onsuccess = () => {
                resolve(request.result as string[]);
            };
            request.onerror = () => {
                console.error('Failed to get image IDs:', request.error);
                reject(new Error('Failed to get image IDs from IndexedDB'));
            };
        });
    }

    /**
     * Clear all images from IndexedDB
     */
    async clearAll(): Promise<void> {
        const db = await this.ensureInit();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('Failed to clear images:', request.error);
                reject(new Error('Failed to clear images from IndexedDB'));
            };
        });
    }

    /**
     * Get the total size of stored images (approximate)
     */
    async getTotalSize(): Promise<number> {
        const db = await this.ensureInit();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const images = request.result as StoredImage[];
                const totalSize = images.reduce((sum, img) => sum + img.blob.size, 0);
                resolve(totalSize);
            };
            request.onerror = () => {
                reject(new Error('Failed to calculate total size'));
            };
        });
    }

    /**
     * Clean up old images (older than specified days)
     */
    async cleanupOldImages(daysOld: number = 30): Promise<number> {
        const db = await this.ensureInit();
        const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('createdAt');
            const range = IDBKeyRange.upperBound(cutoffTime);

            const request = index.openCursor(range);
            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    console.log(`Cleaned up ${deletedCount} old images`);
                    resolve(deletedCount);
                }
            };

            request.onerror = () => {
                reject(new Error('Failed to cleanup old images'));
            };
        });
    }
}

// Export a singleton instance
export const imageStorage = new ImageStorageService();

// Export the class for testing or creating additional instances
export { ImageStorageService };
export type { StoredImage };
