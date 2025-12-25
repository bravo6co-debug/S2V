# 개발 계획서: 이미지 생성기 리팩토링

## 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [현재 구조 분석](#2-현재-구조-분석)
3. [목표 구조](#3-목표-구조)
4. [상세 개발 계획](#4-상세-개발-계획)
5. [기술적 고려사항](#5-기술적-고려사항)
6. [단계별 마일스톤](#6-단계별-마일스톤)

---

## 1. 프로젝트 개요

### 1.1 현재 상태
- React + TypeScript + Vite 기반 웹 애플리케이션
- Google Gemini AI를 활용한 이미지 생성
- 2개 탭 구조: 이미지 생성 / 시나리오 모드

### 1.2 목표 상태
3단계 워크플로우로 전환:
1. **등장인물 관리** - 캐릭터 생성/업로드 및 관리
2. **시나리오 제작** - 장면별 이미지 생성
3. **영상 제작** - 생성된 이미지를 영상으로 변환

### 1.3 핵심 변경사항
| 구분 | 현재 | 변경 후 |
|------|------|---------|
| 탭 구조 | 2개 (이미지 생성, 시나리오 모드) | 3개 (등장인물, 시나리오, 영상) |
| 캐릭터 관리 | 이미지 생성 탭 내 사이드바 | 독립 탭으로 분리 |
| 장면 이미지 | 시나리오 모드에서 생성 | 시나리오 탭으로 이동 |
| 영상 제작 | 없음 | 신규 기능 추가 |

---

## 2. 현재 구조 분석

### 2.1 파일 구조
```
/home/user/image-gen/
├── App.tsx                    # 메인 앱 (1,577줄) - 모든 상태 관리
├── types.ts                   # 타입 정의
├── index.tsx                  # React 엔트리
├── services/
│   └── geminiService.ts       # Gemini AI 서비스 (623줄)
└── components/
    ├── ResultDisplay.tsx      # 생성된 이미지 표시
    ├── ChapterDisplay.tsx     # 챕터 관리
    ├── ScenarioEditor.tsx     # 시나리오 편집
    ├── ScenarioGenerator.tsx  # 시나리오 생성 모달
    ├── Icons.tsx              # 아이콘 컴포넌트
    ├── ActionButton.tsx       # 버튼 컴포넌트
    ├── ManualModal.tsx        # 도움말 모달
    └── ImageEditor.tsx        # (빈 파일)
```

### 2.2 현재 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                     현재 구조                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [이미지 생성 탭]                                            │
│  ├── 캐릭터 라이브러리 (5슬롯)                               │
│  ├── 활성 캐릭터 (5슬롯)                                     │
│  ├── 장면 설명 입력                                          │
│  ├── 시네마틱 필터                                           │
│  ├── ResultDisplay (생성 결과)                               │
│  └── ChapterDisplay (챕터 정리)                              │
│                                                             │
│  [시나리오 모드 탭]                                          │
│  ├── 캐릭터 라이브러리                                       │
│  └── ScenarioEditor (시나리오 편집/이미지 생성)               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 주요 상태 (App.tsx)
```typescript
// 캐릭터 관리
characterLibrary: (Character | null)[]     // 5슬롯
activeCharacters: (Character | null)[]     // 5슬롯

// 이미지 생성
generatedItems: GeneratedItem[]
chapters: Chapter[]

// 시나리오
currentScenario: Scenario | null
appMode: 'image' | 'scenario'
```

---

## 3. 목표 구조

### 3.1 새로운 탭 구조

```
┌─────────────────────────────────────────────────────────────┐
│                     새로운 구조                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [1. 등장인물 탭]                                            │
│  ├── 캐릭터 생성 (AI 이미지 생성)                            │
│  ├── 캐릭터 업로드 (사용자 이미지)                           │
│  ├── 캐릭터 라이브러리 관리                                  │
│  └── 캐릭터 상세 정보 편집                                   │
│                                                             │
│  [2. 시나리오 탭]                                            │
│  ├── 시나리오 생성/불러오기                                  │
│  ├── 장면별 이미지 생성                                      │
│  ├── 활성 캐릭터 선택                                        │
│  └── 장면 순서/내용 편집                                     │
│                                                             │
│  [3. 영상 제작 탭]                                           │
│  ├── 타임라인 에디터                                         │
│  ├── 장면 배치                                               │
│  ├── 내레이션/BGM 추가                                       │
│  ├── 전환 효과                                               │
│  └── 영상 내보내기                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 새로운 데이터 흐름

```
등장인물 탭          시나리오 탭           영상 제작 탭
    │                    │                     │
    ▼                    ▼                     ▼
┌──────────┐        ┌──────────┐         ┌──────────┐
│Character │───────▶│  Scene   │────────▶│  Video   │
│ Library  │        │  Images  │         │ Timeline │
└──────────┘        └──────────┘         └──────────┘
    │                    │                     │
    └────────────────────┴─────────────────────┘
                         │
                    ┌────▼────┐
                    │ Project │
                    │  State  │
                    └─────────┘
```

### 3.3 새로운 타입 정의 (추가/수정)

```typescript
// 앱 모드 확장
type AppMode = 'character' | 'scenario' | 'video';

// 프로젝트 단위 상태 관리
interface Project {
  id: string;
  name: string;
  characters: Character[];
  scenario: Scenario | null;
  videoTimeline: VideoTimeline | null;
  createdAt: number;
  updatedAt: number;
}

// 영상 타임라인
interface VideoTimeline {
  id: string;
  scenes: TimelineScene[];
  totalDuration: number;
  audioTracks: AudioTrack[];
  transitions: Transition[];
}

interface TimelineScene {
  id: string;
  sceneId: string;           // Scene 참조
  startTime: number;         // 밀리초
  duration: number;          // 밀리초
  position: number;          // 순서
  animation?: AnimationConfig;
}

interface AudioTrack {
  id: string;
  type: 'narration' | 'bgm' | 'sfx';
  source: string;            // URL 또는 base64
  startTime: number;
  duration: number;
  volume: number;            // 0-1
}

interface Transition {
  id: string;
  type: 'fade' | 'dissolve' | 'slide' | 'zoom' | 'none';
  duration: number;
  fromSceneId: string;
  toSceneId: string;
}

interface AnimationConfig {
  type: 'kenBurns' | 'zoom' | 'pan' | 'none';
  direction?: 'in' | 'out' | 'left' | 'right';
  intensity: number;         // 0-100
}
```

---

## 4. 상세 개발 계획

### 4.1 Phase 1: 구조 리팩토링

#### Task 1.1: 컴포넌트 구조 재설계
**파일 구조 변경:**
```
/home/user/image-gen/
├── App.tsx                          # 라우팅/레이아웃만 담당
├── types.ts                         # 확장된 타입 정의
├── hooks/
│   ├── useCharacters.ts             # 캐릭터 관리 훅
│   ├── useScenario.ts               # 시나리오 관리 훅
│   ├── useVideo.ts                  # 영상 관리 훅
│   └── useProject.ts                # 프로젝트 전체 상태 훅
├── services/
│   ├── geminiService.ts             # 기존 AI 서비스
│   └── videoService.ts              # 영상 생성 서비스 (신규)
├── components/
│   ├── common/                      # 공통 컴포넌트
│   │   ├── Icons.tsx
│   │   ├── ActionButton.tsx
│   │   ├── Modal.tsx
│   │   └── TabNavigation.tsx        # 탭 네비게이션
│   ├── character/                   # 등장인물 탭
│   │   ├── CharacterTab.tsx         # 탭 메인 컴포넌트
│   │   ├── CharacterLibrary.tsx     # 캐릭터 목록
│   │   ├── CharacterCard.tsx        # 개별 캐릭터 카드
│   │   ├── CharacterCreator.tsx     # AI 캐릭터 생성
│   │   ├── CharacterUploader.tsx    # 이미지 업로드
│   │   └── CharacterEditor.tsx      # 캐릭터 정보 편집
│   ├── scenario/                    # 시나리오 탭
│   │   ├── ScenarioTab.tsx          # 탭 메인 컴포넌트
│   │   ├── ScenarioGenerator.tsx    # 시나리오 생성 (기존)
│   │   ├── ScenarioEditor.tsx       # 시나리오 편집 (기존)
│   │   ├── SceneCard.tsx            # 장면 카드
│   │   ├── SceneImageGenerator.tsx  # 장면 이미지 생성
│   │   └── ActiveCharacterPanel.tsx # 활성 캐릭터 선택
│   └── video/                       # 영상 제작 탭
│       ├── VideoTab.tsx             # 탭 메인 컴포넌트
│       ├── Timeline.tsx             # 타임라인 에디터
│       ├── TimelineScene.tsx        # 타임라인 장면
│       ├── AudioTrackEditor.tsx     # 오디오 트랙 편집
│       ├── TransitionPicker.tsx     # 전환 효과 선택
│       ├── PreviewPlayer.tsx        # 미리보기 플레이어
│       └── ExportPanel.tsx          # 내보내기 패널
└── contexts/
    └── ProjectContext.tsx           # 프로젝트 전역 상태
```

#### Task 1.2: 상태 관리 분리
- App.tsx에서 비즈니스 로직을 커스텀 훅으로 분리
- Context API로 전역 상태 관리
- 각 탭별 독립적인 상태 관리

**useCharacters.ts 예시:**
```typescript
export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);

  const addCharacter = async (character: Character) => {...};
  const removeCharacter = (id: string) => {...};
  const updateCharacter = (id: string, updates: Partial<Character>) => {...};
  const generateCharacter = async (description: string) => {...};

  return {
    characters,
    selectedCharacters,
    addCharacter,
    removeCharacter,
    updateCharacter,
    generateCharacter,
    selectCharacter,
    deselectCharacter,
  };
}
```

#### Task 1.3: 타입 시스템 확장
- types.ts에 새로운 타입 추가
- 기존 타입과의 호환성 유지
- 영상 관련 타입 정의

---

### 4.2 Phase 2: 등장인물 탭 개발

#### Task 2.1: CharacterTab 컴포넌트
**기능:**
- 전체 화면을 활용한 캐릭터 관리 UI
- 그리드 형태의 캐릭터 라이브러리
- 캐릭터 생성/업로드 버튼

**레이아웃:**
```
┌────────────────────────────────────────────────────────┐
│  [+ AI로 생성]  [+ 이미지 업로드]           [저장] [불러오기] │
├────────────────────────────────────────────────────────┤
│                                                        │
│   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐      │
│   │  캐릭터1 │  │  캐릭터2 │  │  캐릭터3 │  │   +    │      │
│   │  [img]  │  │  [img]  │  │  [img]  │  │  추가  │      │
│   │  이름    │  │  이름    │  │  이름    │  │        │      │
│   └────────┘  └────────┘  └────────┘  └────────┘      │
│                                                        │
│   캐릭터 상세 정보 패널 (선택시 표시)                      │
│   ┌──────────────────────────────────────────────────┐ │
│   │  이름: ______  나이: ______                       │ │
│   │  성격: ________________________                  │ │
│   │  의상: ________________________                  │ │
│   │  [편집] [삭제] [이미지 변경]                       │ │
│   └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

#### Task 2.2: CharacterCreator 컴포넌트
- 기존 캐릭터 생성 기능 이전
- 한글 설명 → 영어 변환 → 이미지 생성
- 생성된 이미지 중 선택하여 라이브러리에 추가

#### Task 2.3: CharacterUploader 컴포넌트
- 사용자 이미지 업로드
- 이미지에서 캐릭터 정보 추출 (선택적)
- 수동 정보 입력 지원

#### Task 2.4: 캐릭터 데이터 영속성
- localStorage를 활용한 데이터 저장
- 프로젝트 단위 내보내기/불러오기

---

### 4.3 Phase 3: 시나리오 탭 개선

#### Task 3.0: 시나리오 설정 개선
**30초 시나리오 옵션 추가:**
- 기존: 60초 / 90초 / 120초
- 변경: **30초** / 60초 / 90초 / 120초

**AI 영상 클립 기반 장면 구성:**
AI 영상 생성 서비스는 **5~7초** 클립을 생성하므로, 장면을 세분화해야 함.

| 총 길이 | 권장 장면 수 | 장면당 길이 |
|---------|-------------|------------|
| 30초 | 5~6개 | 5~6초 |
| 60초 | 10~12개 | 5~6초 |
| 90초 | 15~18개 | 5~6초 |
| 120초 | 20~24개 | 5~6초 |

**타입 변경:**
```typescript
// types.ts 수정
export interface ScenarioConfig {
  topic: string;
  duration: 30 | 60 | 90 | 120;  // 30초 추가
  tone: ScenarioTone;
}
```

**시나리오 생성 프롬프트 수정:**
- AI에게 장면을 5~6초 단위로 세분화하도록 지시
- 각 장면이 하나의 영상 클립으로 변환됨을 고려

#### Task 3.1: ScenarioTab 재구성
**변경사항:**
- 등장인물 라이브러리를 탭에서 제거 (등장인물 탭으로 이동)
- 활성 캐릭터 선택 UI 추가
- 시나리오 편집 영역 확장

**레이아웃:**
```
┌────────────────────────────────────────────────────────┐
│  시나리오: [제목]                    [저장] [새 시나리오] │
├────────────┬───────────────────────────────────────────┤
│  활성 캐릭터  │                                          │
│  ┌────┐     │   장면 1: Hook                            │
│  │ 👤 │     │   ┌─────────────────────────────────────┐ │
│  └────┘     │   │ 시각 묘사: ...                      │ │
│  ┌────┐     │   │ 내레이션: ...                       │ │
│  │ 👤 │     │   │ [이미지 생성] [편집] [삭제]          │ │
│  └────┘     │   └─────────────────────────────────────┘ │
│  ┌────┐     │                                          │
│  │ 👤 │     │   장면 2: Setup                          │
│  └────┘     │   ┌─────────────────────────────────────┐ │
│             │   │ ...                                 │ │
│  [캐릭터     │   └─────────────────────────────────────┘ │
│   선택]     │                                          │
├─────────────┼───────────────────────────────────────────┤
│ [모든 장면  │                                          │
│  이미지     │                                          │
│  생성]      │                                          │
└─────────────┴───────────────────────────────────────────┘
```

#### Task 3.2: ActiveCharacterPanel 컴포넌트
- 등장인물 탭에서 만든 캐릭터 불러오기
- 시나리오에 사용할 캐릭터 선택
- 드래그 앤 드롭 지원

#### Task 3.3: 장면-캐릭터 연결
- 각 장면에 등장하는 캐릭터 지정
- 캐릭터 참조 이미지로 일관된 이미지 생성

#### Task 3.4: 장면 이미지 수정 워크플로우
**목적:** 생성된 장면 이미지가 마음에 들지 않을 경우, 외부 툴로 수정 후 다시 적용

**워크플로우:**
```
┌─────────────────────────────────────────────────────────────┐
│  장면 이미지 수정 워크플로우                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 이미지 불만족 → [다운로드] 버튼 클릭                       │
│         ↓                                                   │
│  2. 외부 툴에서 이미지 수정 (Photoshop, Canva 등)              │
│         ↓                                                   │
│  3. [이미지 교체] 버튼 클릭 → 수정된 이미지 업로드              │
│         ↓                                                   │
│  4. 해당 장면에 새 이미지 저장                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**SceneCard 버튼 구성:**
```
┌─────────────────────────────────────────────────────────────┐
│  장면 3: Development                                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  [생성된 이미지]                                        │ │
│  │                                                        │ │
│  │  [AI 재생성] [다운로드] [이미지 교체] [삭제]              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**구현 사항:**
- `SceneImageActions` 컴포넌트: 이미지 관련 액션 버튼 그룹
- `handleDownloadSceneImage()`: 장면 이미지 다운로드 (파일명: scene_N_이미지.png)
- `handleReplaceSceneImage()`: 파일 업로드 → 해당 장면 이미지 교체
- 이미지 교체 시 이전 이미지 히스토리 저장 (선택적 되돌리기)

**타입 확장:**
```typescript
interface Scene {
  // 기존 필드...
  generatedImage?: ImageData;
  customImage?: ImageData;        // 사용자가 교체한 이미지
  imageSource: 'ai' | 'custom';   // 이미지 소스 구분
  imageHistory?: ImageData[];     // 이미지 변경 히스토리 (선택적)
}
```

#### Task 3.5: 시나리오 직접 수정 기능
**목적:** AI가 생성한 시나리오의 모든 필드를 사용자가 직접 편집 가능하도록 함

**편집 가능 필드:**
| 레벨 | 필드 | 편집 UI |
|------|------|---------|
| 시나리오 | 제목 (title) | 텍스트 입력 |
| 시나리오 | 시놉시스 (synopsis) | 텍스트영역 |
| 장면 | 시각 묘사 (visualDescription) | 텍스트영역 |
| 장면 | 내레이션 (narration) | 텍스트영역 |
| 장면 | 카메라 앵글 (cameraAngle) | 드롭다운 |
| 장면 | 분위기 (mood) | 텍스트 입력 |
| 장면 | 이미지 프롬프트 (imagePrompt) | 텍스트영역 |
| 장면 | 지속 시간 (duration) | 숫자 입력 |
| 장면 | 스토리 비트 (storyBeat) | 드롭다운 |

**편집 모드 UI:**
```
┌─────────────────────────────────────────────────────────────┐
│  장면 2: Setup                                    [편집 모드] │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  시각 묘사:                                             │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ (편집 가능한 텍스트영역)                           │  │ │
│  │  │ 주인공이 카페에 들어서며 창밖을 바라본다...         │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  내레이션:                                              │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ (편집 가능한 텍스트영역)                           │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  카메라 앵글: [Medium shot ▼]   분위기: [_________]     │ │
│  │  지속 시간: [5] 초              스토리 비트: [Setup ▼]  │ │
│  │                                                        │ │
│  │  이미지 프롬프트:                                       │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ (편집 가능한 텍스트영역 - AI 이미지 생성에 사용)    │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  [변경사항 저장] [취소] [기본값으로 복원]                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**구현 사항:**
- `SceneEditor` 컴포넌트: 장면 편집 전용 UI
- `useSceneEditor` 훅: 편집 상태 관리, 유효성 검증
- 인라인 편집 모드 (카드 내에서 직접 편집)
- 변경사항 자동 저장 또는 명시적 저장 버튼
- 변경 이력 추적 (Undo/Redo 지원, 선택적)

**장면 추가/삭제/순서 변경:**
- `[+ 장면 추가]` 버튼: 새 빈 장면 생성
- `[삭제]` 버튼: 장면 삭제 (확인 다이얼로그)
- 드래그 앤 드롭: 장면 순서 변경
- 장면 복제: 기존 장면을 복사하여 새 장면 생성

**타입 확장:**
```typescript
interface SceneEditState {
  sceneId: string;
  isEditing: boolean;
  hasChanges: boolean;
  originalData: Scene;
  editedData: Partial<Scene>;
}

interface ScenarioEditState {
  isEditing: boolean;
  hasChanges: boolean;
  originalTitle: string;
  originalSynopsis: string;
  editedTitle?: string;
  editedSynopsis?: string;
}
```

#### Task 3.6: 장면 관리 기능
**장면 순서 변경:**
- 드래그 앤 드롭으로 장면 순서 변경
- 장면 번호 자동 재정렬

**장면 추가/삭제:**
```typescript
// 새 장면 추가
const addNewScene = (afterSceneId?: string) => {
  const newScene: Scene = {
    id: generateId(),
    sceneNumber: calculateSceneNumber(afterSceneId),
    duration: 5,
    storyBeat: 'Development',
    visualDescription: '',
    narration: '',
    cameraAngle: 'Medium shot',
    mood: '',
    imagePrompt: '',
  };
  // 시나리오에 추가
};

// 장면 복제
const duplicateScene = (sceneId: string) => {
  const original = findScene(sceneId);
  const duplicated = { ...original, id: generateId() };
  // 시나리오에 추가
};
```

---

### 4.4 Phase 4: 영상 제작 탭 개발

#### Task 4.1: VideoTab 컴포넌트
**핵심 기능:**
- 타임라인 기반 영상 편집
- 장면 배치 및 순서 조정
- 미리보기 플레이어

**레이아웃:**
```
┌────────────────────────────────────────────────────────┐
│  [◀] [▶] [■]  00:00 / 01:30      [미리보기] [내보내기] │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌────────────────────────────────────────────────────┐│
│  │                                                    ││
│  │                  미리보기 영역                      ││
│  │                  (현재 장면 표시)                   ││
│  │                                                    ││
│  └────────────────────────────────────────────────────┘│
│                                                        │
├────────────────────────────────────────────────────────┤
│  타임라인                                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 0s        15s        30s        45s        60s   │  │
│  │ ├─────────┼─────────┼─────────┼─────────┼──────  │  │
│  │ │ 장면1   │ 장면2   │  장면3  │  장면4  │ 장면5  │  │
│  │ ├─────────┼─────────┼─────────┼─────────┼──────  │  │
│  │ │    ♪ 내레이션 트랙                             │  │
│  │ │    ♫ BGM 트랙                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  장면 목록 (드래그하여 타임라인에 추가)                   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                   │
│  │ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5  │                   │
│  └────┘ └────┘ └────┘ └────┘ └────┘                   │
└────────────────────────────────────────────────────────┘
```

#### Task 4.2: Timeline 컴포넌트
**기능:**
- 드래그 앤 드롭으로 장면 배치
- 장면 길이 조절 (드래그 핸들)
- 줌 인/아웃
- 스냅 기능

**구현 고려사항:**
```typescript
interface TimelineProps {
  scenes: TimelineScene[];
  audioTracks: AudioTrack[];
  currentTime: number;
  zoom: number;
  onSceneMove: (sceneId: string, newPosition: number) => void;
  onSceneResize: (sceneId: string, newDuration: number) => void;
  onSeek: (time: number) => void;
}
```

#### Task 4.3: PreviewPlayer 컴포넌트
**기능:**
- 타임라인 기반 장면 전환
- Ken Burns 효과 (이미지 애니메이션)
- 오디오 동기화

**구현 방식:**
```typescript
// CSS Animation + requestAnimationFrame 기반
interface PreviewPlayerProps {
  timeline: VideoTimeline;
  isPlaying: boolean;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
}
```

#### Task 4.4: TransitionPicker 컴포넌트
**전환 효과 옵션:**
- Fade (페이드)
- Dissolve (디졸브)
- Slide (슬라이드)
- Zoom (줌)
- None (없음)

#### Task 4.5: ExportPanel 컴포넌트
**내보내기 옵션:**
- 해상도 선택 (1080p, 720p)
- 형식 선택 (MP4, WebM)
- 품질 설정

**구현 방식:**
- Canvas API + MediaRecorder API 활용
- 또는 FFmpeg.wasm 라이브러리 사용

#### Task 4.6: AI 영상 클립 생성 기능
**목적:** 장면 이미지를 AI를 통해 5~7초 동영상 클립으로 변환

**워크플로우:**
```
┌─────────────────────────────────────────────────────────────┐
│  AI 영상 클립 생성 워크플로우                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 시나리오 탭에서 장면 이미지 생성 완료                     │
│         ↓                                                   │
│  2. 영상 제작 탭으로 이동                                     │
│         ↓                                                   │
│  3. 각 장면별 [영상 클립 생성] 버튼 클릭                      │
│         ↓                                                   │
│  4. AI가 이미지 → 5~7초 영상 클립 생성                       │
│         ↓                                                   │
│  5. 생성된 클립들을 타임라인에 배치                           │
│         ↓                                                   │
│  6. 전환 효과, 오디오 추가 후 최종 영상 내보내기               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**영상 클립 생성 UI:**
```
┌─────────────────────────────────────────────────────────────┐
│  장면 목록                                                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 장면 1: Hook                                            ││
│  │ ┌────────┐  ┌────────┐                                  ││
│  │ │ [이미지] │  │ [영상]  │  ← 생성된 클립 미리보기         ││
│  │ └────────┘  └────────┘                                  ││
│  │ [영상 클립 생성] [재생성] [다운로드]           5.2초 예상 ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 장면 2: Setup                                           ││
│  │ ┌────────┐  ┌────────┐                                  ││
│  │ │ [이미지] │  │ [생성중] │  ← 로딩 스피너                 ││
│  │ └────────┘  └────────┘                                  ││
│  │ [영상 클립 생성] 진행중... 45%                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [모든 장면 영상 생성]  (10개 장면 중 3개 완료)               │
└─────────────────────────────────────────────────────────────┘
```

**타입 정의:**
```typescript
interface VideoClip {
  id: string;
  sceneId: string;
  videoData: Blob;           // 영상 데이터
  duration: number;          // 실제 생성된 영상 길이 (초)
  thumbnail: ImageData;      // 썸네일
  createdAt: number;
  status: 'pending' | 'generating' | 'complete' | 'error';
  error?: string;
}

interface Scene {
  // 기존 필드...
  generatedImage?: ImageData;
  generatedClip?: VideoClip;  // AI 생성 영상 클립
}
```

**AI 영상 생성 서비스 연동:**
- Google Veo, Runway, Pika Labs 등 영상 생성 API 활용
- 또는 이미지 → 영상 변환 AI 서비스 연동
- 장면당 5~7초 클립 생성

---

### 4.5 Phase 5: 영상 생성 서비스 개발

#### Task 5.1: videoService.ts 구현
```typescript
// services/videoService.ts

export interface RenderConfig {
  width: number;
  height: number;
  fps: number;
  format: 'mp4' | 'webm';
  quality: 'high' | 'medium' | 'low';
}

export interface RenderProgress {
  phase: 'preparing' | 'rendering' | 'encoding' | 'complete';
  progress: number;  // 0-100
  currentFrame?: number;
  totalFrames?: number;
}

export async function renderVideo(
  timeline: VideoTimeline,
  scenes: Scene[],
  config: RenderConfig,
  onProgress: (progress: RenderProgress) => void
): Promise<Blob> {
  // 구현
}

export async function generatePreviewFrame(
  scene: Scene,
  animation: AnimationConfig,
  progress: number  // 0-1
): Promise<ImageData> {
  // Ken Burns 등 애니메이션 적용된 프레임 생성
}
```

#### Task 5.2: Ken Burns 효과 구현
```typescript
// 이미지 애니메이션 효과
interface KenBurnsConfig {
  startScale: number;
  endScale: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

function applyKenBurns(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  config: KenBurnsConfig,
  progress: number  // 0-1
): void {
  // 구현
}
```

#### Task 5.3: 오디오 처리
- Web Audio API 활용
- 내레이션 + BGM 믹싱
- 볼륨 조절

---

### 4.6 Phase 6: 통합 및 최적화

#### Task 6.1: 탭 간 데이터 연동
- Context API로 전역 상태 공유
- 탭 전환 시 데이터 유지

#### Task 6.2: 데이터 영속성
```typescript
// localStorage 저장 구조
interface SavedProject {
  version: string;
  project: Project;
  savedAt: number;
}

// 자동 저장 구현
function useAutoSave(project: Project) {
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('current_project', JSON.stringify({
        version: '1.0',
        project,
        savedAt: Date.now()
      }));
    }, 1000);  // 디바운스

    return () => clearTimeout(timer);
  }, [project]);
}
```

#### Task 6.3: 성능 최적화
- 이미지 압축 (큰 base64 데이터)
- React.memo 적용
- 가상화 (긴 목록)

#### Task 6.4: UX 개선
- 로딩 상태 표시
- 에러 처리 개선
- 진행 상황 표시

---

## 5. 기술적 고려사항

### 5.1 영상 생성 기술 스택

**옵션 1: Canvas + MediaRecorder (권장)**
- 장점: 순수 브라우저 API, 외부 의존성 없음
- 단점: 브라우저 호환성, 인코딩 품질 제한

**옵션 2: FFmpeg.wasm**
- 장점: 높은 품질, 다양한 형식 지원
- 단점: 큰 파일 크기 (~25MB), 초기 로딩 시간

**권장:** 옵션 1로 시작 후 필요시 FFmpeg.wasm으로 확장

### 5.2 이미지 저장 전략

**현재 문제:**
- base64로 저장 시 메모리 사용량 증가
- 많은 이미지 처리 시 성능 저하

**해결 방안:**
1. IndexedDB 활용 (대용량 데이터)
2. 이미지 압축 (quality 조절)
3. 썸네일 생성 (목록 표시용)

### 5.3 상태 관리 전략

```typescript
// contexts/ProjectContext.tsx
interface ProjectContextValue {
  // 프로젝트
  project: Project | null;
  loadProject: (id: string) => Promise<void>;
  saveProject: () => Promise<void>;

  // 캐릭터
  characters: Character[];
  addCharacter: (char: Character) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  removeCharacter: (id: string) => void;

  // 시나리오
  scenario: Scenario | null;
  setScenario: (scenario: Scenario) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;

  // 타임라인
  timeline: VideoTimeline | null;
  setTimeline: (timeline: VideoTimeline) => void;
  addSceneToTimeline: (scene: TimelineScene) => void;

  // UI 상태
  currentTab: AppMode;
  setCurrentTab: (tab: AppMode) => void;
}
```

---

## 6. 단계별 마일스톤

### Milestone 1: 구조 리팩토링
- [ ] 폴더 구조 재구성
- [ ] Context API 설정
- [ ] 커스텀 훅 분리
- [ ] 타입 확장

### Milestone 2: 등장인물 탭
- [ ] CharacterTab 컴포넌트
- [ ] CharacterLibrary 컴포넌트
- [ ] CharacterCreator 컴포넌트
- [ ] CharacterUploader 컴포넌트
- [ ] CharacterEditor 컴포넌트

### Milestone 3: 시나리오 탭 개선
- [ ] 30초 시나리오 옵션 추가
- [ ] 장면 세분화 (5~7초 단위)
- [ ] ScenarioTab 재구성
- [ ] ActiveCharacterPanel 컴포넌트
- [ ] 장면-캐릭터 연결 기능
- [ ] 장면 이미지 수정 워크플로우 (다운로드/교체)
- [ ] 시나리오 직접 수정 기능 (인라인 편집)
- [ ] 장면 관리 기능 (추가/삭제/복제/순서변경)

### Milestone 4: 영상 제작 탭
- [ ] VideoTab 컴포넌트
- [ ] Timeline 컴포넌트
- [ ] PreviewPlayer 컴포넌트
- [ ] TransitionPicker 컴포넌트
- [ ] AI 영상 클립 생성 기능 (5~7초 클립)
- [ ] 클립 미리보기/재생성/다운로드

### Milestone 5: 영상 생성 서비스
- [ ] videoService.ts 구현
- [ ] AI 영상 생성 API 연동 (Veo/Runway/Pika)
- [ ] Ken Burns 효과
- [ ] 오디오 처리
- [ ] ExportPanel 컴포넌트

### Milestone 6: 통합 및 완성
- [ ] 탭 간 데이터 연동
- [ ] 데이터 영속성 (localStorage/IndexedDB)
- [ ] 성능 최적화
- [ ] 버그 수정 및 QA

---

## 부록: 참고 자료

### A. 사용 라이브러리

**현재:**
- react@19.1.1
- @google/genai@1.15.0
- jszip@3.10.1
- vite@6.2.0
- tailwindcss (CDN)

**추가 예정:**
- @dnd-kit/core (드래그 앤 드롭)
- idb (IndexedDB wrapper, 선택적)
- @ffmpeg/ffmpeg (영상 인코딩, 선택적)

### B. API 사용량

**Gemini API 호출:**
- 캐릭터 생성: extractCharacterData + generateCharacterPortraits
- 장면 이미지: generateSceneImage
- 시나리오 생성: generateScenario

**최적화 필요:**
- API 호출 캐싱
- 배치 처리
- 에러 재시도 로직

### C. 브라우저 호환성

**지원 대상:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**필요 API:**
- Canvas API
- MediaRecorder API
- Web Audio API
- IndexedDB
