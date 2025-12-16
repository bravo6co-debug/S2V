

export interface ImageData {
  mimeType: string;
  data: string;
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
  duration: 60 | 90 | 120;
  tone: ScenarioTone;
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