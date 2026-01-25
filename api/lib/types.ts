/**
 * Shared types for API endpoints
 */

export interface ImageData {
    mimeType: string;
    data: string; // base64 encoded
}

export type AspectRatio = '16:9' | '9:16';

export type ImageStyle = 'photorealistic' | 'animation' | 'illustration' | 'cinematic' | 'watercolor' | '3d_render';

export type ScenarioTone = 'emotional' | 'dramatic' | 'inspirational' | 'romantic' | 'comedic' | 'mysterious' | 'nostalgic';

export type ScenarioMode = 'character' | 'environment' | 'abstract' | 'narration';

export type StoryBeat = 'Hook' | 'Setup' | 'Development' | 'Climax' | 'Resolution';

export type CameraAngle =
    | 'Close-up'
    | 'Extreme Close-up'
    | 'Medium shot'
    | 'Wide shot'
    | 'POV'
    | 'Over-the-shoulder'
    | 'Low angle'
    | 'High angle'
    | "Bird's eye";

export interface ScenarioConfig {
    topic: string;
    duration: number;
    tone: ScenarioTone | 'custom';
    customTone?: string;
    mode: ScenarioMode;
    imageStyle: ImageStyle;
}

export interface Scene {
    id: string;
    sceneNumber: number;
    duration: number;
    storyBeat: StoryBeat;
    visualDescription: string;
    narration: string;
    cameraAngle: CameraAngle;
    mood: string;
    imagePrompt: string;
    generatedImage?: ImageData;
}

export interface ScenarioChapter {
    id: string;
    title: string;
    order: number;
    scenes: Scene[];
    duration: number;
}

export interface Scenario {
    id: string;
    title: string;
    synopsis: string;
    topic: string;
    totalDuration: number;
    tone: ScenarioTone;
    mode: ScenarioMode;
    imageStyle: ImageStyle;
    suggestedCharacters: Array<{
        name: string;
        role: string;
        description: string;
    }>;
    scenes: Scene[];
    chapters?: ScenarioChapter[];
    createdAt: number;
    updatedAt: number;
}

export interface VideoGenerationResult {
    videoUrl: string;
    thumbnailUrl: string;
    duration: number;
}

// API Request/Response types
export interface ExtractCharacterRequest {
    description: string;
}

export interface ExtractCharacterResponse {
    name: string;
    age: string;
    personality: string;
    outfit: string;
    englishDescription: string;
}

export interface GeneratePortraitsRequest {
    prompt: string;
    numberOfImages: number;
    aspectRatio: AspectRatio;
    imageStyle?: ImageStyle;
}

export interface GeneratePropsRequest {
    prompt: string;
    numberOfImages: number;
    aspectRatio: AspectRatio;
    imageStyle?: ImageStyle;
}

export interface GenerateBackgroundsRequest {
    prompt: string;
    locationType: string;
    timeOfDay: string;
    weather: string;
    numberOfImages: number;
    aspectRatio: AspectRatio;
    imageStyle?: ImageStyle;
}

export interface GenerateImagesRequest {
    prompt: string;
    characterImages: ImageData[];
    propImages: ImageData[];
    backgroundImage: ImageData | null;
    numberOfImages: number;
    aspectRatio: AspectRatio;
    imageStyle?: ImageStyle;
}

export interface EditImageRequest {
    baseImage: ImageData;
    modificationPrompt: string;
}

export interface GenerateScenarioRequest {
    config: ScenarioConfig;
}

export interface RegenerateSceneRequest {
    scenario: Scenario;
    sceneId: string;
    customInstruction?: string;
}

export interface GenerateSceneImageRequest {
    scene: Scene;
    characterImages: ImageData[];
    propImages: ImageData[];
    backgroundImage: ImageData | null;
    aspectRatio: AspectRatio;
    imageStyle?: ImageStyle;
}

export interface GenerateVideoRequest {
    sourceImage: ImageData;
    motionPrompt: string;
    durationSeconds?: number;
}

export interface ApiErrorResponse {
    error: string;
    code?: string;
    details?: string;
}
