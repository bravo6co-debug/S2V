

export interface ImageData {
  mimeType: string;
  data: string;
}

// =============================================
// 역할 정의 (Role Definitions)
// =============================================

// 에셋 역할 타입
export type AssetRole =
  | 'protagonist'    // 주인공
  | 'supporting'     // 조연
  | 'extra'          // 단역
  | 'keyProp'        // 핵심 소품
  | 'prop'           // 일반 소품
  | 'background';    // 배경

// 캐릭터 역할 타입
export type CharacterRole = 'protagonist' | 'supporting' | 'extra';

// 소품 역할 타입
export type PropRole = 'keyProp' | 'prop';

// 장면 내 역할 타입 (화면에서의 비중)
export type SceneRole = 'center' | 'background' | 'closeup';

// =============================================
// 에셋 인터페이스 (Asset Interfaces)
// =============================================

// 에셋 기본 인터페이스
export interface Asset {
  id: string;
  name: string;
  role: AssetRole;
  image: ImageData;
  description: string;
  maintainContext: boolean;  // 컨텍스트 유지 여부
  createdAt: number;
  updatedAt: number;
}

// 캐릭터 관계
export interface CharacterRelationship {
  characterId: string;
  relationship: string;  // 예: "친구", "연인", "라이벌"
}

// 소품 카테고리
export type PropCategory =
  | 'accessory'      // 액세서리 (반지, 목걸이)
  | 'document'       // 문서 (편지, 일기장)
  | 'device'         // 기기 (핸드폰, 카메라)
  | 'food'           // 음식/음료
  | 'clothing'       // 의류
  | 'vehicle'        // 탈것
  | 'nature'         // 자연물 (꽃, 나뭇잎)
  | 'other';         // 기타

// 장소 유형
export type LocationType =
  | 'indoor'         // 실내
  | 'outdoor'        // 실외
  | 'urban'          // 도시
  | 'nature'         // 자연
  | 'fantasy';       // 판타지

// 시간대
export type TimeOfDay = 'day' | 'night' | 'sunset' | 'dawn';

// 날씨
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'snowy';

// 캐릭터 (등장인물) - Asset 확장
export interface CharacterAsset extends Omit<Asset, 'role'> {
  role: CharacterRole;
  age: string;
  personality: string;
  outfit: string;
  relationships?: CharacterRelationship[];
}

// 소품 - Asset 확장
export interface PropAsset extends Omit<Asset, 'role'> {
  role: PropRole;
  category: PropCategory;
  significance?: string;   // 스토리에서의 의미 (핵심 소품일 경우)
  owner?: string;          // 소유자 캐릭터 ID
}

// 배경 - Asset 확장
export interface BackgroundAsset extends Omit<Asset, 'role'> {
  role: 'background';
  locationType: LocationType;
  timeOfDay?: TimeOfDay;
  weather?: Weather;
  mood?: string;
}

// =============================================
// 장면 에셋 (Scene Assets)
// =============================================

// 장면에 배치된 에셋
export interface SceneAssetPlacement {
  assetId: string;
  assetType: 'character' | 'prop' | 'background';
  sceneRole: SceneRole;  // 이 장면에서의 역할
}

// 장면에 사용되는 모든 에셋 정보
export interface SceneAssets {
  characters: (CharacterAsset & { sceneRole: SceneRole })[];
  props: (PropAsset & { sceneRole: SceneRole })[];
  background: BackgroundAsset | null;
}

// =============================================
// 앱 모드 (App Mode)
// =============================================

// 3탭 구조 앱 모드
export type AppMode = 'character' | 'scenario' | 'video';

// =============================================
// 프로젝트 상태 (Project State)
// =============================================

// 프로젝트 단위 상태 관리
export interface Project {
  id: string;
  name: string;
  characters: CharacterAsset[];
  props: PropAsset[];
  backgrounds: BackgroundAsset[];
  scenario: Scenario | null;
  videoTimeline: VideoTimeline | null;
  createdAt: number;
  updatedAt: number;
}

// =============================================
// 영상 타임라인 (Video Timeline)
// =============================================

export interface VideoTimeline {
  id: string;
  name?: string;
  clips: VideoClip[];
  totalDuration: number;
  createdAt?: number;
  updatedAt?: number;
}

// AI 생성 영상 클립
export interface VideoClip {
  id: string;
  sceneId?: string;
  order: number;
  duration: number;
  sourceImage?: ImageData;
  motionPrompt?: string;
  generatedVideo?: {
    url: string;
    thumbnailUrl?: string;
    duration: number;
  };
  createdAt: number;
  status: 'pending' | 'generating' | 'complete' | 'error';
  error?: string;
}

// Legacy 타임라인 씬 (호환성 유지)
export interface TimelineScene {
  id: string;
  sceneId: string;
  startTime: number;
  duration: number;
  position: number;
  animation?: AnimationConfig;
  videoClip?: VideoClip;
}

export interface AudioTrack {
  id: string;
  type: 'narration' | 'bgm' | 'sfx';
  source: string;
  startTime: number;
  duration: number;
  volume: number;
}

export interface Transition {
  id: string;
  type: 'fade' | 'dissolve' | 'slide' | 'zoom' | 'none';
  duration: number;
  fromSceneId: string;
  toSceneId: string;
}

export interface AnimationConfig {
  type: 'kenBurns' | 'zoom' | 'pan' | 'none';
  direction?: 'in' | 'out' | 'left' | 'right';
  intensity: number;
}

export type AspectRatio = '16:9' | '9:16';

// 이미지 스타일 타입
export type ImageStyle = 'photorealistic' | 'animation' | 'illustration' | 'cinematic' | 'watercolor' | '3d_render';

// 이미지 스타일 옵션
export const IMAGE_STYLE_OPTIONS: { value: ImageStyle; label: string; emoji: string }[] = [
  { value: 'photorealistic', label: '포토리얼리즘', emoji: '📷' },
  { value: 'animation', label: '애니메이션', emoji: '🎨' },
  { value: 'illustration', label: '일러스트', emoji: '✏️' },
  { value: 'cinematic', label: '시네마틱', emoji: '🎬' },
  { value: 'watercolor', label: '수채화', emoji: '💧' },
  { value: '3d_render', label: '3D 렌더링', emoji: '🎮' },
];

export type GeneratedItem = {
  id: string;
  prompt: string;
  type: 'image';
  image: ImageData;
  aspectRatio: AspectRatio;
  characterData?: Omit<Character, 'id' | 'image'>;
};


export interface Chapter {
  id:string;
  name: string;
  items: GeneratedItem[];
}

export interface DragItem {
  itemId: string;
  source: {
    type: 'results' | 'chapter';
    id: string; // 'results' or chapter.id
  };
}

export interface SynopsisCharacter {
  id: string;
  name: string;
  description: string;
}

export interface Character {
  id: string;
  image: ImageData;
  name: string;
  age: string;
  personality: string;
  outfit: string;
}

// Scenario Generation Types
export type ScenarioTone =
  | 'emotional'
  | 'dramatic'
  | 'inspirational'
  | 'romantic'
  | 'comedic'
  | 'mysterious'
  | 'nostalgic';

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
  | 'Bird\'s eye';

// 나레이션 오디오 데이터
export interface NarrationAudio {
  data: string;           // Base64 인코딩된 오디오 데이터
  mimeType: string;       // audio/wav, audio/mp3 등
  durationMs?: number;    // 오디오 길이 (밀리초)
  voice?: string;         // 사용된 음성 이름
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
  customImage?: ImageData;        // 사용자가 교체한 이미지
  imageSource?: 'ai' | 'custom';   // 이미지 소스 구분
  imageHistory?: ImageData[];     // 이미지 변경 히스토리
  assets?: SceneAssetPlacement[]; // 장면에 등장하는 에셋 목록
  narrationAudio?: NarrationAudio;  // 나레이션 TTS 오디오
}

export interface SuggestedCharacter {
  name: string;
  role: string;
  description: string;
}

export interface Scenario {
  id: string;
  title: string;
  synopsis: string;
  topic: string;
  totalDuration: number;
  tone: ScenarioTone;
  mode: ScenarioMode;             // 시나리오 모드
  imageStyle: ImageStyle;         // 이미지 스타일
  suggestedCharacters: SuggestedCharacter[];
  scenes: Scene[];
  chapters?: ScenarioChapter[];   // 장편용 챕터 구조 (3분+ 시나리오)
  createdAt: number;
  updatedAt: number;
}

// =============================================
// 시나리오 모드 (Scenario Mode)
// =============================================

// 시나리오 모드 타입
export type ScenarioMode =
  | 'character'    // 캐릭터 중심 (기존)
  | 'environment'  // 환경/풍경 중심
  | 'abstract'     // 추상적/개념적
  | 'narration';   // 나레이션 중심

// 시나리오 모드 옵션
export const SCENARIO_MODE_OPTIONS: { value: ScenarioMode; label: string; description: string; emoji: string }[] = [
  { value: 'character', label: '캐릭터 중심', description: '인물이 등장하는 이야기', emoji: '👤' },
  { value: 'environment', label: '환경/풍경', description: '장소와 분위기 중심', emoji: '🏞️' },
  { value: 'abstract', label: '추상/개념', description: '개념적인 시각화', emoji: '🎨' },
  { value: 'narration', label: '나레이션', description: '음성 해설 중심', emoji: '🎙️' },
];

// =============================================
// 시나리오 챕터 (Scenario Chapter) - 장편용
// =============================================

export interface ScenarioChapter {
  id: string;
  title: string;
  order: number;
  scenes: Scene[];
  duration: number;
}

// =============================================
// 프로젝트 설정 (Project Settings)
// =============================================

export interface ProjectSettings {
  imageStyle: ImageStyle;
  scenarioMode: ScenarioMode;
  aspectRatio: AspectRatio;
}

export interface ScenarioConfig {
  topic: string;
  duration: number;              // 숫자로 변경 (자유 입력)
  durationPreset?: 30 | 60 | 90 | 120 | 180 | 300 | 600;  // 프리셋 선택 시 (10분까지)
  tone: ScenarioTone | 'custom'; // custom 추가
  customTone?: string;           // 직접 입력한 톤/분위기
  mode: ScenarioMode;            // 시나리오 모드
  imageStyle: ImageStyle;        // 이미지 스타일
}

export const TONE_OPTIONS: { value: ScenarioTone; label: string; description: string }[] = [
  { value: 'emotional', label: '감성/힐링', description: '따뜻하고 여운 있는' },
  { value: 'dramatic', label: '드라마틱', description: '긴장감과 반전' },
  { value: 'inspirational', label: '동기부여', description: '도전과 성장' },
  { value: 'romantic', label: '로맨틱', description: '사랑과 설렘' },
  { value: 'comedic', label: '코믹', description: '유쾌하고 웃긴' },
  { value: 'mysterious', label: '미스터리', description: '호기심 자극' },
  { value: 'nostalgic', label: '향수/추억', description: '그리움과 회상' },
];