/**
 * Shared types for API endpoints
 */

export interface ImageData {
    mimeType: string;
    data: string; // base64 encoded
}

export type AspectRatio = '16:9' | '9:16';

export type ImageStyle = 'photorealistic' | 'animation' | 'illustration' | 'cinematic' | 'watercolor' | '3d_render' | 'low_poly' | 'pixel_art' | 'stop_motion' | 'sketch' | 'comic_book' | 'art_movement' | 'motion_graphics';

export type ScenarioTone = 'emotional' | 'dramatic' | 'inspirational' | 'romantic' | 'comedic' | 'mysterious' | 'nostalgic' | 'educational' | 'promotional' | 'luxurious' | 'trendy' | 'trustworthy' | 'energetic';

export type ScenarioMode = 'character' | 'environment' | 'abstract' | 'narration';

export type StoryBeat = 'Hook' | 'Setup' | 'Development' | 'Climax' | 'Resolution' | 'Discovery' | 'Story' | 'Experience' | 'Reason';

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
    includeCharacters?: boolean;   // 환경/풍경 모드에서 캐릭터 포함 여부 (조연으로)
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
    characters?: string[];  // 이 씬에 등장하는 캐릭터 이름 목록
    imagePrompt: string;
    videoPrompt?: string;  // 영상 생성용 모션/카메라 프롬프트
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
    recommendedImageStyle?: ImageStyle;  // AI가 추천한 이미지 스타일
    recommendedImageStyleReason?: string;  // 추천 이유
    recommendedTone?: ScenarioTone;  // AI가 추천한 톤/분위기
    recommendedToneReason?: string;  // 톤 추천 이유
    suggestedCharacters: Array<{
        name: string;
        role: string;
        description: string;
    }>;
    scenes: Scene[];
    chapters?: ScenarioChapter[];
    // 광고 시나리오 전용 필드
    scenarioType?: 'standard' | 'ad';
    productName?: string;
    productFeatures?: string;
    productImage?: ImageData;
    createdAt: number;
    updatedAt: number;
}

// 광고 시나리오 설정
export interface AdScenarioConfig {
    productName: string;
    productFeatures: string;
    tone?: ScenarioTone;
    imageStyle?: ImageStyle;
}

// =============================================
// 광고 V2: HDSER 프레임워크
// =============================================

export type AdType = 'product-intro' | 'problem-solution' | 'lifestyle' | 'testimonial' | 'promotion' | 'brand-story';
export type IndustryCategory = 'restaurant' | 'cafe' | 'beauty' | 'medical' | 'education' | 'fitness' | 'fashion' | 'tech' | 'interior' | 'other';
export type TargetAudience = '10s' | '20s-female' | '20s-male' | '30s-female' | '30s-male' | '40s-parent' | '50s-plus' | 'all';
export type HDSERBeat = 'Hook' | 'Discovery' | 'Story' | 'Experience' | 'Reason';
export type AdDuration = 15 | 30 | 45 | 60;

export interface AdScenarioConfigV2 {
    adType: AdType;
    industry: IndustryCategory;
    productName: string;
    usps: string[];
    targetAudiences: TargetAudience[];
    tone: ScenarioTone;
    imageStyle: ImageStyle;
    duration: AdDuration;
    priceOrPromotion?: string;
    referenceImages?: ImageData[];
}

export interface GenerateAdScenarioV2Request {
    config: AdScenarioConfigV2;
}

// 광고 이미지 생성 엔진
export type AdEngine = 'gemini' | 'flux';

// 광고 씬 파이프라인 단계
export type AdPipelineStep = 'anchor' | 'variation';

// 광고 씬 이미지 생성 요청 (FLUX 파이프라인)
export interface GenerateAdSceneImageRequest {
    imagePrompt: string;           // 씬 이미지 프롬프트 (영어)
    mood?: string;                 // 분위기
    cameraAngle?: string;          // 카메라 앵글
    pipelineStep: AdPipelineStep;
    referenceImages?: ImageData[]; // 앵커 단계: 참조 이미지 (최대 4장)
    anchorImage?: ImageData;       // 변형 단계: 앵커 이미지
    strength?: number;             // 변형 단계: 변형 강도 (0-1)
    aspectRatio: AspectRatio;
    imageStyle?: ImageStyle;       // 이미지 스타일 (animation, photorealistic 등)
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

// 캐릭터 이미지와 이름을 함께 전달하기 위한 타입
export interface NamedCharacterImage {
    name: string;
    image: ImageData;
}

export interface GenerateImagesRequest {
    prompt: string;
    characterImages: ImageData[];
    namedCharacters?: NamedCharacterImage[];  // 이름이 포함된 캐릭터 이미지 (새로운 형식)
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

export interface GenerateAdScenarioRequest {
    config: AdScenarioConfig;
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
