

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

// 앱 모드 (시나리오, 광고, 영상 제작, 음식 영상)
export type AppMode = 'scenario' | 'video' | 'ad' | 'foodvideo' | 'longform' | 'clip';

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
  adScenario: Scenario | null;
  clipScenario: Scenario | null;
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
  type: 'kenBurns' | 'zoom' | 'pan' | 'slideCycle' | 'none';
  direction?: 'in' | 'out' | 'left' | 'right';
  intensity: number;
}

export type AspectRatio = '16:9' | '9:16';

// 이미지 스타일 타입
export type ImageStyle = 'photorealistic' | 'animation' | 'illustration' | 'cinematic' | 'watercolor' | '3d_render' | 'low_poly' | 'pixel_art' | 'stop_motion' | 'sketch' | 'comic_book' | 'art_movement' | 'motion_graphics';

// 이미지 스타일 옵션
export const IMAGE_STYLE_OPTIONS: { value: ImageStyle; label: string; emoji: string }[] = [
  { value: 'photorealistic', label: '포토리얼리즘', emoji: '📷' },
  { value: 'animation', label: '애니메이션', emoji: '🎨' },
  { value: 'illustration', label: '일러스트', emoji: '✏️' },
  { value: 'cinematic', label: '시네마틱', emoji: '🎬' },
  { value: 'watercolor', label: '수채화', emoji: '💧' },
  { value: '3d_render', label: '3D 렌더링', emoji: '🎮' },
  { value: 'low_poly', label: '로우 폴리', emoji: '🔷' },
  { value: 'pixel_art', label: '픽셀 아트', emoji: '👾' },
  { value: 'stop_motion', label: '스톱모션', emoji: '🧸' },
  { value: 'sketch', label: '스케치/드로잉', emoji: '✏️' },
  { value: 'comic_book', label: '만화책/코믹스', emoji: '💥' },
  { value: 'art_movement', label: '예술 사조', emoji: '🖼️' },
  { value: 'motion_graphics', label: '모션 그래픽', emoji: '⚡' },
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
  | 'nostalgic'
  | 'educational'
  | 'promotional'
  | 'luxurious'
  | 'trendy'
  | 'trustworthy'
  | 'energetic';

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
  videoPrompt?: string;           // 영상 생성용 모션/카메라 프롬프트
  characters?: string[];          // 이 씬에 등장하는 캐릭터 이름 목록
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
  recommendedImageStyle?: ImageStyle;     // AI 추천 이미지 스타일
  recommendedImageStyleReason?: string;   // 추천 이유
  recommendedTone?: ScenarioTone;         // AI 추천 톤/분위기
  recommendedToneReason?: string;         // 톤 추천 이유
  suggestedCharacters: SuggestedCharacter[];
  scenes: Scene[];
  chapters?: ScenarioChapter[];   // 장편용 챕터 구조 (3분+ 시나리오)
  // 광고 시나리오 전용 필드
  scenarioType?: 'standard' | 'ad' | 'clip';  // 시나리오 유형
  productName?: string;                   // 상품명
  productFeatures?: string;               // 상품 특징
  productImage?: ImageData;               // 상품 이미지 (참조용)
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
// 클립 시나리오 설정 (Hailuo AI 전용 6초 클립)
// =============================================

export type ClipDuration = 30 | 60 | 90 | 120;

export interface ClipScenarioConfig {
  topic: string;
  duration: ClipDuration;
  tone: ScenarioTone;
  mode: ScenarioMode;
  imageStyle: ImageStyle;
}

// =============================================
// 광고 V2: HDSER 프레임워크 (Ad Scenario V2)
// =============================================

// 광고 유형
export type AdType =
  | 'product-intro'       // 제품 소개
  | 'problem-solution'    // 문제 해결
  | 'lifestyle'           // 라이프스타일
  | 'testimonial'         // 후기/체험
  | 'promotion'           // 이벤트/혜택
  | 'brand-story';        // 브랜드 스토리

export const AD_TYPE_OPTIONS: {
  value: AdType;
  label: string;
  description: string;
  example: string;
}[] = [
  { value: 'product-intro', label: '제품 소개', description: '신제품/서비스를 처음 알리는 광고', example: '신메뉴 출시, 서비스 런칭' },
  { value: 'problem-solution', label: '문제 해결', description: '고객의 Pain Point를 해결하는 광고', example: '기능성 제품, 전문 서비스' },
  { value: 'lifestyle', label: '라이프스타일', description: '브랜드/제품과 어울리는 삶을 보여주는 광고', example: '카페, 패션, 인테리어' },
  { value: 'testimonial', label: '후기/체험', description: '실제 사용 경험을 공유하는 광고', example: '뷰티, 건강, F&B' },
  { value: 'promotion', label: '이벤트/혜택', description: '할인, 이벤트, 기간 한정 혜택 광고', example: '시즌 세일, 오픈 이벤트' },
  { value: 'brand-story', label: '브랜드 스토리', description: '브랜드의 가치와 철학을 전달하는 광고', example: '리브랜딩, 브랜드 인지도' },
];

// 업종 카테고리
export type IndustryCategory =
  | 'restaurant'     // 음식점
  | 'cafe'           // 카페
  | 'beauty'         // 뷰티
  | 'medical'        // 병원/의원
  | 'education'      // 교육
  | 'fitness'        // 피트니스
  | 'fashion'        // 패션
  | 'tech'           // IT/테크
  | 'interior'       // 인테리어
  | 'other';         // 기타

export const INDUSTRY_OPTIONS: {
  value: IndustryCategory;
  label: string;
}[] = [
  { value: 'restaurant', label: '음식점' },
  { value: 'cafe', label: '카페' },
  { value: 'beauty', label: '뷰티/화장품' },
  { value: 'medical', label: '병원/의원' },
  { value: 'education', label: '교육' },
  { value: 'fitness', label: '피트니스/헬스' },
  { value: 'fashion', label: '패션/의류' },
  { value: 'tech', label: 'IT/테크' },
  { value: 'interior', label: '인테리어/리빙' },
  { value: 'other', label: '기타' },
];

// 타겟 고객
export type TargetAudience =
  | '10s'            // 10대
  | '20s-female'     // 20대 여성
  | '20s-male'       // 20대 남성
  | '30s-female'     // 30대 여성
  | '30s-male'       // 30대 남성
  | '40s-parent'     // 40대 부모
  | '50s-plus'       // 50대 이상
  | 'all';           // 전연령

export const TARGET_AUDIENCE_OPTIONS: {
  value: TargetAudience;
  label: string;
}[] = [
  { value: '10s', label: '10대' },
  { value: '20s-female', label: '20대 여성' },
  { value: '20s-male', label: '20대 남성' },
  { value: '30s-female', label: '30대 여성' },
  { value: '30s-male', label: '30대 남성' },
  { value: '40s-parent', label: '40대 부모' },
  { value: '50s-plus', label: '50대 이상' },
  { value: 'all', label: '전연령' },
];

// HDSER 스토리 비트
export type HDSERBeat = 'Hook' | 'Discovery' | 'Story' | 'Experience' | 'Reason';

// 광고 영상 길이
export type AdDuration = 15 | 30 | 45 | 60;

export const AD_DURATION_OPTIONS: {
  value: AdDuration;
  label: string;
  scenes: number;
}[] = [
  { value: 15, label: '15초', scenes: 3 },
  { value: 30, label: '30초', scenes: 5 },
  { value: 45, label: '45초', scenes: 5 },
  { value: 60, label: '60초', scenes: 6 },
];

// 광고 이미지 생성 엔진
export type AdEngine = 'gemini' | 'flux';

export const AD_ENGINE_OPTIONS: {
  value: AdEngine;
  label: string;
  description: string;
  cost: string;
}[] = [
  { value: 'gemini', label: 'Gemini 엔진', description: '안정적, 참조 이미지 무제한', cost: '유료 (API 키)' },
  { value: 'flux', label: 'FLUX 엔진', description: '고품질, 씬간 일관성 강화', cost: '~$0.12 / 5씬' },
];

// V2 광고 시나리오 설정
export interface AdScenarioConfigV2 {
  adType: AdType;
  industry: IndustryCategory;
  productName: string;
  targetAudiences: TargetAudience[];
  customTarget?: string;           // 타겟 고객 상세 설명 (수동 입력)
  tone: ScenarioTone;
  imageStyle: ImageStyle;
  duration: AdDuration;
  referenceImages?: ImageData[]; // 참고 이미지 (최대 3장)

  // 제품 소개 (product-intro)
  usps?: string[];               // 핵심 특징/차별점 (1~2개)
  launchReason?: string;         // 출시 배경/이유
  priceInfo?: string;            // 가격대

  // 문제 해결 (problem-solution)
  painPoint?: string;            // 고객의 문제/불편점
  solution?: string;             // 해결 방법/원리
  effectResult?: string;         // 효과/결과

  // 라이프스타일 (lifestyle)
  brandMood?: string;            // 브랜드 분위기/무드
  usageScene?: string;           // 사용 장면/상황
  stylingKeywords?: string;      // 연출 키워드

  // 후기/체험 (testimonial)
  beforeState?: string;          // 사용 전 고민/상태
  afterChange?: string;          // 사용 후 변화
  experienceHighlight?: string;  // 체험 포인트

  // 이벤트/혜택 (promotion)
  offerDetails?: string;         // 이벤트/혜택 내용
  periodCondition?: string;      // 기간/조건
  discountInfo?: string;         // 가격/할인 정보

  // 브랜드 스토리 (brand-story)
  brandPhilosophy?: string;      // 브랜드 철학/가치
  originStory?: string;          // 브랜드 탄생 배경
  coreMessage?: string;          // 핵심 메시지
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
  includeCharacters?: boolean;   // 환경/풍경 모드에서 캐릭터 포함 여부 (조연으로)
}

export const TONE_OPTIONS: { value: ScenarioTone; label: string; description: string; category?: 'story' | 'commercial' }[] = [
  // 스토리 톤
  { value: 'emotional', label: '감성/힐링', description: '따뜻하고 여운 있는', category: 'story' },
  { value: 'dramatic', label: '드라마틱', description: '긴장감과 반전', category: 'story' },
  { value: 'inspirational', label: '동기부여', description: '도전과 성장', category: 'story' },
  { value: 'romantic', label: '로맨틱', description: '사랑과 설렘', category: 'story' },
  { value: 'comedic', label: '코믹', description: '유쾌하고 웃긴', category: 'story' },
  { value: 'mysterious', label: '미스터리', description: '호기심 자극', category: 'story' },
  { value: 'nostalgic', label: '향수/추억', description: '그리움과 회상', category: 'story' },
  { value: 'educational', label: '정보/지식', description: '학습과 인사이트', category: 'story' },
  // 광고/홍보 톤
  { value: 'promotional', label: '홍보/광고', description: '구매 욕구를 자극하는', category: 'commercial' },
  { value: 'luxurious', label: '프리미엄/럭셔리', description: '고급스럽고 세련된', category: 'commercial' },
  { value: 'trendy', label: '트렌디/MZ', description: '힙하고 감각적인', category: 'commercial' },
  { value: 'trustworthy', label: '신뢰/전문가', description: '믿음직하고 권위 있는', category: 'commercial' },
  { value: 'energetic', label: '활기/에너지', description: '역동적이고 활력 넘치는', category: 'commercial' },
];

// =============================================
// Gemini 모델 설정 (Gemini Model Settings)
// =============================================

export interface GeminiModelConfig {
  textModel: string;
  imageModel: string;
  videoModel: string;
  ttsModel: string;
  ttsVoice: string;
}

// 사용 가능한 텍스트 모델
export const AVAILABLE_TEXT_MODELS: { value: string; label: string; provider?: string }[] = [
  // Google Gemini 모델
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (최고 추론 품질)', provider: 'gemini' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (빠르고 저렴)', provider: 'gemini' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (안정)', provider: 'gemini' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (고품질)', provider: 'gemini' },
  // OpenAI 모델
  { value: 'gpt-5.2', label: 'GPT-5.2 (최고 품질)', provider: 'openai' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini (빠르고 저렴)', provider: 'openai' },
  { value: 'o3-mini', label: 'o3-mini (추론 특화)', provider: 'openai' },
];

// 사용 가능한 이미지 모델
export const AVAILABLE_IMAGE_MODELS: { value: string; label: string; price?: string; provider?: string }[] = [
  // Google Gemini / Imagen 모델 (Gemini API 키 사용)
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (최고품질, 4K)', provider: 'gemini' },
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (기본)', provider: 'gemini' },
  { value: 'imagen-4.0-generate-001', label: 'Imagen 4.0 (고품질)', provider: 'gemini' },
  { value: 'imagen-4.0-fast-generate-001', label: 'Imagen 4.0 Fast (빠름)', provider: 'gemini' },
  // FLUX Kontext 모델 (EachLabs API 키 사용)
  { value: 'flux-kontext-pro', label: 'FLUX Kontext Pro', price: '$0.04/장', provider: 'eachlabs' },
  { value: 'flux-kontext-max', label: 'FLUX Kontext Max (최고품질)', price: '$0.08/장', provider: 'eachlabs' },
];

// 사용 가능한 비디오 모델
export const AVAILABLE_VIDEO_MODELS: { value: string; label: string }[] = [
  { value: 'minimax-hailuo-v2-3-fast-standard-image-to-video', label: 'Hailuo V2.3 Fast (기본)' },
];

// 사용 가능한 TTS 모델
export const AVAILABLE_TTS_MODELS: { value: string; label: string }[] = [
  { value: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS (빠름)' },
  { value: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS (고품질)' },
];

// 사용 가능한 TTS 음성
export const AVAILABLE_TTS_VOICES: { value: string; label: string }[] = [
  { value: 'Kore', label: 'Kore (한국어 여성)' },
  { value: 'Aoede', label: 'Aoede (여성)' },
  { value: 'Charon', label: 'Charon (남성)' },
  { value: 'Fenrir', label: 'Fenrir (남성, 깊은)' },
  { value: 'Puck', label: 'Puck (중성)' },
];

// 기본 모델 설정
export const DEFAULT_MODEL_CONFIG: GeminiModelConfig = {
  textModel: 'gemini-3-flash-preview',
  imageModel: 'gemini-2.5-flash-image',
  videoModel: 'minimax-hailuo-v2-3-fast-standard-image-to-video',
  ttsModel: 'gemini-2.5-flash-preview-tts',
  ttsVoice: 'Kore',
};