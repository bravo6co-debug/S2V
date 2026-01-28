# S2V (Scenario to Video)

Google Gemini AI와 Veo를 활용한 시나리오 기반 이미지 및 영상 생성 서비스입니다. AI가 자동으로 시나리오를 생성하고, 캐릭터/소품/배경의 일관성을 유지하면서 씬 이미지, TTS 나레이션, AI 영상을 생성합니다.

## 주요 기능

### 1. AI 시나리오 자동 생성
- **톤/분위기 선택**: emotional, dramatic, inspirational, humorous, mysterious
- **시나리오 모드**: character(캐릭터 중심), environment(환경 중심), abstract(추상적), narration(나레이션 중심)
- **이미지 스타일**: photorealistic, animation, illustration, cinematic, watercolor, 3d_render
- **영상 길이**: 30초 ~ 10분 (자동 챕터 구조화)
- **바이럴 콘텐츠 최적화**: Hook → Setup → Development → Climax → Resolution 구조

### 2. 캐릭터 & 에셋 관리
- **캐릭터 라이브러리**: 참조 이미지 기반, 메타데이터 관리 (이름, 나이, 성격, 의상)
- **소품 라이브러리**: 핵심 소품/일반 소품 분류, 카테고리별 관리
- **배경 라이브러리**: 장소 유형, 시간대, 날씨 설정
- **활성화 시스템**: 최대 5개 캐릭터 + 5개 소품 + 1개 배경 동시 활성화

### 3. 씬 이미지 생성
- 활성화된 에셋을 참조하여 일관된 스타일 유지
- 다양한 화면 비율 지원 (1:1, 16:9, 9:16, 4:3, 3:4)
- 씬별 개별 생성 또는 전체 일괄 생성
- 이미지 편집 (텍스트 프롬프트 기반 수정)

### 4. TTS 나레이션 생성
- Gemini TTS 모델 기반 음성 생성
- 다양한 음성 선택: Kore(한국어 여성), Charon(남성), Fenrir(깊은 남성), Puck(중성)
- TTS 최적화: 씬 길이의 80% 이상 나레이션이 채우도록 자동 조절

### 5. AI 영상 생성 (Veo 3.1)
- 생성된 이미지 기반 AI 영상 클립 생성
- Veo 3.1 Fast 모델 (빠른 속도, 비용 최적화)
- 클립별 모션 프롬프트 설정

### 6. Remotion 비디오 플레이어
- 실시간 프리뷰 플레이어
- Ken Burns 효과 (이미지 줌/팬)
- 씬 전환 효과 (페이드, 슬라이드 등)
- 자막 오버레이
- TTS 오디오 싱크

## 기술 스택

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Video**: Remotion 4.0
- **Deployment**: Vercel (Serverless Functions)
- **AI Models**:
  - `gemini-2.5-flash` - 시나리오/텍스트 생성
  - `gemini-2.5-flash-image` - 이미지 생성 (캐릭터, 소품, 배경, 씬)
  - `gemini-2.5-flash-preview-tts` - TTS 나레이션 생성
  - `veo-3.1-fast-generate-preview` - AI 영상 생성

## 설치 및 실행

### 필수 요구사항
- Node.js 20.x
- Google Gemini API Key (Veo, TTS API 접근 권한 포함)

### 로컬 실행

```bash
# 의존성 설치
npm install

# 환경 변수 설정
# .env.local 파일 생성 후 아래 내용 추가
GEMINI_API_KEY=your_gemini_api_key_here

# 개발 서버 실행
npm run dev

# Remotion 프리뷰 (옵션)
npm run remotion:preview
```

### Vercel 배포

```bash
# 프로덕션 빌드
npm run build

# Vercel CLI로 배포
vercel --prod
```

**Vercel 환경변수 설정:**
1. Vercel Dashboard → 프로젝트 선택
2. Settings → Environment Variables
3. `GEMINI_API_KEY` 추가

## 프로젝트 구조

```
├── api/                          # Vercel Serverless Functions
│   ├── lib/
│   │   ├── gemini.ts            # Gemini AI 클라이언트 & 모델 설정
│   │   └── types.ts             # API 타입 정의
│   ├── generate-scenario.ts     # 시나리오 자동 생성 API
│   ├── regenerate-scene.ts      # 씬 재생성 API
│   ├── generate-images.ts       # 씬 이미지 생성 API
│   ├── generate-portraits.ts    # 캐릭터 초상화 생성 API
│   ├── generate-props.ts        # 소품 이미지 생성 API
│   ├── generate-backgrounds.ts  # 배경 이미지 생성 API
│   ├── generate-narration.ts    # TTS 나레이션 생성 API
│   ├── generate-video.ts        # AI 영상 생성 API
│   ├── download-video.ts        # 영상 다운로드 프록시
│   ├── edit-image.ts            # 이미지 편집 API
│   └── extract-character.ts     # 캐릭터 정보 추출 API
│
├── components/
│   ├── character/               # 캐릭터, 소품, 배경 관리
│   ├── scenario/                # 시나리오/씬 관리
│   ├── video/                   # 영상 제작 & Remotion 플레이어
│   └── common/                  # 공통 컴포넌트
│
├── remotion/                    # Remotion 비디오 컴포지션
│   ├── Root.tsx                 # Remotion 루트
│   ├── ShortFormVideo.tsx       # 메인 비디오 컴포지션
│   └── components/
│       ├── KenBurnsEffect.tsx   # 이미지 줌/팬 효과
│       ├── Transitions.tsx      # 씬 전환 효과
│       ├── SceneSequence.tsx    # 씬 시퀀스 렌더러
│       ├── Subtitles.tsx        # 자막 오버레이
│       └── NarrationAudio.tsx   # TTS 오디오 컴포넌트
│
├── hooks/
│   ├── useScenario.ts           # 시나리오 관련 훅
│   └── useVideo.ts              # 영상 제작 관련 훅
│
├── services/
│   └── apiClient.ts             # API 클라이언트
│
├── types.ts                     # TypeScript 타입 정의
├── App.tsx                      # 메인 애플리케이션
└── vercel.json                  # Vercel 배포 설정
```

## 사용 방법

1. **시나리오 생성**: 주제, 영상 길이, 톤, 스타일 설정 후 AI 시나리오 자동 생성
2. **캐릭터 등록** (옵션): 참조 이미지와 정보 등록하여 일관성 유지
3. **에셋 활성화**: 씬에서 사용할 캐릭터, 소품, 배경 활성화
4. **이미지 생성**: 개별 씬 또는 전체 씬의 이미지 생성
5. **나레이션 생성**: TTS로 씬별 나레이션 음성 생성
6. **프리뷰**: Remotion 플레이어로 실시간 영상 프리뷰
7. **영상 생성**: Veo로 AI 영상 클립 생성 및 다운로드

## API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/generate-scenario` | POST | AI 시나리오 자동 생성 |
| `/api/regenerate-scene` | POST | 특정 씬 재생성 |
| `/api/generate-images` | POST | 씬 이미지 생성 |
| `/api/generate-portraits` | POST | 캐릭터 초상화 생성 |
| `/api/generate-props` | POST | 소품 이미지 생성 |
| `/api/generate-backgrounds` | POST | 배경 이미지 생성 |
| `/api/generate-narration` | POST | TTS 나레이션 생성 |
| `/api/generate-video` | POST | AI 영상 생성 |
| `/api/download-video` | GET | 영상 다운로드 프록시 |
| `/api/edit-image` | POST | 이미지 편집 |
| `/api/extract-character` | POST | 캐릭터 정보 추출 |

## 라이선스

MIT License
