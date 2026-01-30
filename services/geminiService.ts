/**
 * Gemini Service - Client-side API wrapper
 *
 * This module re-exports all API functions from apiClient.ts
 * All actual Gemini API calls are now handled server-side through
 * Vercel serverless functions to keep API keys secure.
 *
 * SECURITY: API keys are NEVER exposed to the client.
 */

// Re-export all functions from apiClient
export {
    // Character extraction
    extractCharacterData,

    // Image generation
    generateCharacterPortraits,
    generatePropImages,
    generateBackgroundImages,
    generateImages,

    // Image editing
    editImage,

    // Scenario generation
    generateScenario,
    generateAdScenario,
    regenerateScene,
    generateSceneImage,

    // Video generation
    generateVideoFromImage,
    checkVeoApiAvailability,

    // Types
    type VideoGenerationResult,
} from './apiClient';

// Re-export error utilities for use in components
export {
    ApiError,
    QuotaExceededError,
    PermissionDeniedError,
    NetworkError,
    ImageGenerationError,
    VideoGenerationError,
    ValidationError,
    GenerationTimeoutError,
    getErrorMessage,
    parseApiError,
} from './errors';
