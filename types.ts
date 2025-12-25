

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
  scenes: TimelineScene[];
  totalDuration: number;
  audioTracks: AudioTrack[];
  transitions: Transition[];
}

export interface TimelineScene {
  id: string;
  sceneId: string;           // Scene 참조
  startTime: number;         // 밀리초
  duration: number;          // 밀리초
  position: number;          // 순서
  animation?: AnimationConfig;
  videoClip?: VideoClip;     // AI 생성 영상 클립
}

export interface AudioTrack {
  id: string;
  type: 'narration' | 'bgm' | 'sfx';
  source: string;            // URL 또는 base64
  startTime: number;
  duration: number;
  volume: number;            // 0-1
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
  intensity: number;         // 0-100
}

// AI 생성 영상 클립
export interface VideoClip {
  id: string;
  sceneId: string;
  videoData?: Blob;           // 영상 데이터
  videoUrl?: string;          // 영상 URL (Blob URL)
  duration: number;          // 실제 생성된 영상 길이 (초)
  thumbnail?: ImageData;     // 썸네일
  createdAt: number;
  status: 'pending' | 'generating' | 'complete' | 'error';
  error?: string;
}

export type AspectRatio = '16:9' | '9:16';

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
  suggestedCharacters: SuggestedCharacter[];
  scenes: Scene[];
  createdAt: number;
  updatedAt: number;
}

export interface ScenarioConfig {
  topic: string;
  duration: number;              // 숫자로 변경 (자유 입력)
  durationPreset?: 30 | 60 | 90 | 120;  // 프리셋 선택 시
  tone: ScenarioTone | 'custom'; // custom 추가
  customTone?: string;           // 직접 입력한 톤/분위기
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