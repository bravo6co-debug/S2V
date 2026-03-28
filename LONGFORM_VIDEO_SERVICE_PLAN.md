# 롱폼 영상 생성 서비스 개발계획서

## 1. 서비스 개요

### 1.1 서비스 목적
10분~60분 길이의 롱폼 영상을 비용 효율적으로 제작하는 독립 서비스.
기존 S2V 숏폼 서비스와 **완전 분리된 별도 서비스**로 운영한다.

### 1.2 핵심 설계 원칙

| 항목 | 기존 숏폼 서비스 | 롱폼 서비스 (신규) |
|------|------------------|---------------------|
| 영상 길이 | 30초~3분 | 10분~60분 |
| 씬 단위 | 5~10초마다 1이미지 | **1분마다 1이미지** |
| 나레이션 단위 | 5~10초 | **1분 (280~300자)** |
| 초반 후킹 | 이미지 기반 | **10초 실제 동영상** |
| 출력물 | 1개 영상 | **3개 파일 (영상1 + 영상2 + 영상3)** |
| 시나리오 스타일 | 다수 선택 가능 | **애니메이션 1종 고정** |
| 비용 | 씬당 이미지+나레이션 | **1/6 비용 (60초 단위)** |

### 1.3 비용 절감 효과

```
[기존 방식] 30분 영상 = 180개 씬 (10초 단위) → 이미지 180장 + 나레이션 180개
[신규 방식] 30분 영상 =  30개 씬 (1분 단위) → 이미지  30장 + 나레이션  30개

→ API 호출 약 83% 절감
→ 이미지 생성 비용 약 83% 절감
→ TTS 나레이션 비용 동일 (총 분량 동일하나 호출 횟수 83% 절감)
```

---

## 2. 입출력 명세

### 2.1 입력

| 필드 | 타입 | 값 | 설명 |
|------|------|-----|------|
| `topic` | string | 자유 입력 | 영상 주제 (예: "한국 전통 음식의 역사") |
| `duration` | enum | `10 \| 20 \| 30 \| 40 \| 50 \| 60` | 총 영상 길이 (분) |
| `imageModel` | enum | 아래 모델 목록 참조 | 이미지 생성 모델 선택 |
| `ttsProvider` | enum | `openai \| gemini` | TTS 엔진 선택 |
| `ttsModel` | enum | 아래 TTS 모델 목록 참조 | TTS 모델 선택 |

#### 이미지 생성 모델 선택지

사용자의 설정(Settings)에 저장된 모델을 기본값으로 사용하되, STEP 1에서 변경 가능.
모든 모델은 API 키가 필요하며 사용량에 따라 비용이 발생한다.

| 모델 ID | 표시명 | 제공사 | 비용/장 | 비고 |
|---------|--------|--------|---------|------|
| `gemini-2.5-flash-image` | Gemini 2.5 Flash Image | Google | ~$0.039 (1K) | **기본값**, 빠른 생성 |
| `gemini-3-pro-image-preview` | Gemini 3 Pro Image | Google | ~$0.24 (4K) | 최고 품질 (4K) |
| `imagen-4.0-generate-001` | Imagen 4.0 | Google | ~$0.039 (1K) | 고품질 |
| `imagen-4.0-fast-generate-001` | Imagen 4.0 Fast | Google | ~$0.039 (1K) | 속도 우선 |
| `flux-kontext-pro` | FLUX Kontext Pro | EachLabs | $0.04 | 고품질 |
| `flux-kontext-max` | FLUX Kontext Max | EachLabs | $0.08 | 최고 품질 |

> **이미지 비용 예시 (30분 영상 = 30장 기준)**
>
> | 모델 | 30분 (30장) | 60분 (60장) |
> |------|------------|------------|
> | Gemini Flash/Imagen (1K) | ~$1.17 | ~$2.34 |
> | Gemini 3 Pro (4K) | ~$7.20 | ~$14.40 |
> | FLUX Kontext Pro | $1.20 | $2.40 |
> | FLUX Kontext Max | $2.40 | $4.80 |
>
> * Google AI Studio 무료 티어: 일 1,500장 한도 내 무료 (초과 시 유료)
> * FLUX: EachLabs API 키 필요, 항상 유료

#### TTS 모델 선택지

Gemini TTS는 일일 호출 제한이 있어 대량 생성 시 한계가 있으므로,
**OpenAI TTS를 기본 권장**하며 Gemini TTS도 선택 가능하게 한다.

| 모델 ID | 표시명 | 제공사 | 비용 | 비고 |
|---------|--------|--------|------|------|
| `tts-1` | OpenAI TTS Standard | OpenAI | $15/100만자 (~$0.0045/300자) | **기본 추천**, 가성비 최고 |
| `tts-1-hd` | OpenAI TTS HD | OpenAI | $30/100만자 (~$0.009/300자) | 고품질 음성 |
| `gemini-2.5-flash-preview-tts` | Gemini Flash TTS | Google | API 키 종량제 | 일일 호출 제한 있음 |
| `gemini-2.5-pro-preview-tts` | Gemini Pro TTS | Google | API 키 종량제 | 고품질, 일일 제한 |

**OpenAI TTS 음성 목록 (6종):**

| 음성 ID | 특징 |
|---------|------|
| `alloy` | 중성적, 균형 잡힌 톤 |
| `echo` | 남성적, 따뜻한 톤 |
| `fable` | 표현력 풍부, 내레이터 스타일 |
| `onyx` | 깊고 굵은 남성 음성 |
| `nova` | 밝고 활기찬 여성 음성 **(한국어 추천)** |
| `shimmer` | 부드럽고 차분한 여성 음성 |

**Gemini TTS 음성 목록 (5종, 기존 서비스와 동일):**
Kore, Aoede, Charon, Fenrir, Puck

> **TTS 비용 예시 (30분 영상 = 29개 나레이션 × 300자 기준)**
>
> | 모델 | 30분 (8,700자) | 60분 (17,700자) |
> |------|---------------|----------------|
> | OpenAI tts-1 | ~$0.13 (약 170원) | ~$0.27 (약 350원) |
> | OpenAI tts-1-hd | ~$0.26 (약 340원) | ~$0.53 (약 690원) |
> | Gemini TTS | API 키 종량제 | 일일 제한 주의 |
>
> * OpenAI TTS: 한 번 호출에 최대 4,096자 지원 (300자 대비 13배 여유)
> * OpenAI TTS: 스트리밍 지원, 지연시간 ~0.5초
> * Gemini TTS: 일일 호출 제한으로 60분 영상(59개) 생성 시 제한에 걸릴 수 있음

### 2.2 출력 (다운로드 가능한 3개 파일)

| 파일 | 내용 | 생성 방식 | 포맷 |
|------|------|-----------|------|
| **파일 1: 후킹 영상** | 10초 초반 후킹 동영상 | Hailuo AI (실제 동영상) | MP4 |
| **파일 2: 본편 전반부** | 전체 시나리오의 전반 절반 | Remotion (이미지+나레이션) | MP4/WebM |
| **파일 3: 본편 후반부** | 전체 시나리오의 후반 절반 | Remotion (이미지+나레이션) | MP4/WebM |

### 2.3 씬 수 계산 공식

```
총 씬 수 = duration (분) - 1  (10초 후킹 제외, 나머지를 1분 단위로 분배)

예시:
- 10분 선택 →  9개 씬 (전반부 5 + 후반부 4) + 후킹 1개
- 20분 선택 → 19개 씬 (전반부 10 + 후반부 9) + 후킹 1개
- 30분 선택 → 29개 씬 (전반부 15 + 후반부 14) + 후킹 1개
- 40분 선택 → 39개 씬 (전반부 20 + 후반부 19) + 후킹 1개
- 50분 선택 → 49개 씬 (전반부 25 + 후반부 24) + 후킹 1개
- 60분 선택 → 59개 씬 (전반부 30 + 후반부 29) + 후킹 1개

* 남는 50초는 마지막 씬에 합산하여 처리
* 전반부/후반부 분할 기준: Math.ceil(총씬수 / 2)
```

### 2.4 나레이션 제약 조건

| 항목 | 값 |
|------|-----|
| 1분당 나레이션 글자 수 | **280~300자** (반드시 준수) |
| 언어 | 한국어 |
| TTS 엔진 | **OpenAI TTS (추천)** 또는 Gemini TTS 선택 |
| OpenAI 음성 | 6종: Alloy, Echo, Fable, Onyx, Nova, Shimmer |
| Gemini 음성 | 5종: Kore, Aoede, Charon, Fenrir, Puck |
| 오디오 포맷 | OpenAI: MP3/WAV, Gemini: WAV (base64) |
| 호출 제한 | OpenAI: 제한 없음 (종량제), Gemini: **일일 호출 제한 있음** |

---

## 3. 워크플로우 설계

### 3.1 단일 연속 워크플로우

사용자는 **하나의 화면에서 모든 단계를 순차적으로 진행**한다.
탭 전환이나 별도 페이지 이동 없이 하나의 흐름으로 완료한다.

```
┌──────────────────────────────────────────────────────────────┐
│                    롱폼 영상 생성 서비스                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  STEP 1: 기본 설정                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  주제 입력: [_________________________________]        │  │
│  │  영상 길이: [10분 ▼] [20분] [30분] [40분] [50분] [60분]│  │
│  │  이미지 모델: [Gemini 2.5 Flash Image ▼]               │  │
│  │  TTS 엔진:   [● OpenAI TTS (추천)] [○ Gemini TTS]     │  │
│  │                                                        │  │
│  │  [시나리오 생성하기]                                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓ (자동 진행)                        │
│                                                              │
│  STEP 2: 시나리오 확인/편집                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ◆ 후킹 시나리오 (10초)                                 │  │
│  │    비주얼: "......"                                     │  │
│  │    모션 프롬프트: "......"                               │  │
│  │  ──────────────────────────────────────────────────     │  │
│  │  ◆ 본편 시나리오                                        │  │
│  │    씬 1 (0:10~1:10)  나레이션: "...(289자)"             │  │
│  │    씬 2 (1:10~2:10)  나레이션: "...(295자)"             │  │
│  │    씬 3 (2:10~3:10)  나레이션: "...(282자)"             │  │
│  │    ...                                                  │  │
│  │                                                        │  │
│  │  [다음 단계로]                                           │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓ (자동 진행)                        │
│                                                              │
│  STEP 3: 에셋 생성 (자동 일괄 처리)                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  진행 상태:                                              │
│  │  ■■■■■■■■■□□□□□□□□□□□  45%                             │  │
│  │                                                        │  │
│  │  [✓] 후킹 이미지 생성 완료                               │  │
│  │  [✓] 후킹 영상 생성 완료 (Hailuo AI)                     │  │
│  │  [✓] 씬 1~5 이미지 생성 완료                             │  │
│  │  [→] 씬 6~10 이미지 생성 중...                           │  │
│  │  [ ] 씬 11~29 이미지 대기                                │  │
│  │  [ ] 나레이션 일괄 생성 대기                              │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓ (자동 진행)                        │
│                                                              │
│  STEP 4: 미리보기 & 다운로드                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ◆ 후킹 영상 (10초)        [▶ 미리보기] [⬇ 다운로드]   │  │
│  │  ◆ 본편 전반부 (14분 30초)  [▶ 미리보기] [⬇ 다운로드]   │  │
│  │  ◆ 본편 후반부 (14분 30초)  [▶ 미리보기] [⬇ 다운로드]   │  │
│  │                                                        │  │
│  │  [전체 ZIP 다운로드]                                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 단계별 상세 설명

#### STEP 1: 기본 설정
- 주제 입력 (텍스트 필드, 최대 200자)
- 영상 길이 선택 (10/20/30/40/50/60분 라디오 버튼 또는 드롭다운)
- 이미지 모델 선택 (드롭다운, Gemini 4종 + FLUX 2종, 기본값: 사용자 Settings 설정)
  - 모든 모델에 예상 비용 안내 표시 (예: "30장 × ~$0.039 = ~$1.17")
  - EachLabs API 키 미설정 시 FLUX 모델 비활성화
- TTS 엔진 선택 (OpenAI TTS 기본 추천 / Gemini TTS 선택 가능)
  - OpenAI TTS 선택 시: 모델 (tts-1 / tts-1-hd) + 음성 (6종) 선택
  - Gemini TTS 선택 시: 음성 (5종) 선택 + 일일 제한 경고 표시
  - OpenAI API 키 미설정 시 OpenAI TTS 비활성화
- "시나리오 생성하기" 버튼 클릭 시 STEP 2로 자동 전환

#### STEP 2: 시나리오 확인/편집
- AI가 생성한 전체 시나리오를 리스트로 표시
- 후킹 시나리오: 10초짜리 후킹 영상의 비주얼/모션 설명
- 본편 시나리오: 각 씬별 이미지 프롬프트 + 나레이션 텍스트
- 각 나레이션 옆에 글자 수 카운터 표시 (280~300자 범위 확인)
- 나레이션/이미지 프롬프트 직접 편집 가능
- 편집 완료 후 "다음 단계로" 버튼

#### STEP 3: 에셋 생성 (자동 일괄 처리)
- 사용자 조작 없이 자동으로 모든 에셋을 순차/병렬 생성
- 생성 순서:
  1. 후킹 이미지 생성 (선택된 이미지 모델)
  2. 후킹 영상 생성 (Hailuo AI, 이미지 → 10초 동영상)
  3. 본편 씬 이미지 일괄 생성 (선택된 이미지 모델, 5개씩 병렬 처리)
  4. 나레이션 일괄 생성 (5개씩 병렬 처리)
- 프로그레스 바 + 체크리스트로 진행 상태 실시간 표시
- 개별 씬 실패 시 해당 씬만 자동 재시도 (최대 3회)
- 전체 완료 시 STEP 4로 자동 전환

#### STEP 4: 미리보기 & 다운로드
- 3개 파일 각각 미리보기 플레이어 + 개별 다운로드 버튼
- 전체 ZIP 다운로드 버튼
- 후킹 영상: Hailuo AI 생성 동영상 그대로 재생
- 본편 전반부/후반부: Remotion 프레임워크로 렌더링
  - 각 씬: 1분간 Ken Burns 애니메이션이 적용된 이미지
  - 각 씬: 1분짜리 TTS 나레이션 오디오 동기화
  - 씬 간 전환 효과 (fade 기본)
  - 자막 표시

---

## 4. 시나리오 생성 AI 프롬프트 설계

### 4.1 시나리오 생성 요청 구조

```
[시스템 프롬프트]
당신은 YouTube 롱폼 영상의 시나리오 작가입니다.
주어진 주제로 {duration}분 길이의 영상 시나리오를 작성합니다.

규칙:
1. 이미지 스타일은 "애니메이션" 고정
2. 후킹 시나리오는 본편 내용과 무관하게, 시청자의 관심을 끄는 충격적/호기심 유발 장면
3. 본편은 {총씬수}개의 씬으로 구성
4. 각 씬의 나레이션은 반드시 280~300자 (한국어 기준)
5. 스토리 구조: 도입 → 전개 → 심화 → 절정 → 마무리
6. 각 씬의 이미지 프롬프트는 애니메이션 스타일로 상세히 기술

[사용자 입력]
주제: {topic}
영상 길이: {duration}분
총 씬 수: {총씬수}개

[출력 형식 - JSON]
{
  "hookScene": {
    "visualDescription": "후킹 이미지 설명 (애니메이션)",
    "motionPrompt": "10초 동영상 모션 설명",
    "hookText": "후킹 자막 텍스트 (20자 이내)"
  },
  "scenes": [
    {
      "sceneNumber": 1,
      "timeRange": "0:10~1:10",
      "imagePrompt": "씬 이미지 프롬프트 (애니메이션 스타일)",
      "narration": "나레이션 텍스트 (280~300자)",
      "narrationCharCount": 289,
      "storyPhase": "도입",
      "mood": "호기심"
    },
    ...
  ],
  "metadata": {
    "title": "영상 제목",
    "synopsis": "3줄 요약",
    "totalScenes": 29,
    "estimatedDuration": "30분"
  }
}
```

### 4.2 나레이션 글자 수 보정 로직

AI가 280~300자를 정확히 지키지 않을 경우를 대비한 후처리:

```
function validateNarration(narration: string): { valid: boolean; text: string } {
  const charCount = narration.length;

  if (charCount >= 280 && charCount <= 300) {
    return { valid: true, text: narration };
  }

  if (charCount < 280) {
    // 280자 미만: AI에게 재생성 요청
    // "다음 나레이션을 280~300자로 늘려주세요: {narration}"
    return { valid: false, text: narration };
  }

  if (charCount > 300) {
    // 300자 초과: AI에게 재생성 요청
    // "다음 나레이션을 280~300자로 줄여주세요: {narration}"
    return { valid: false, text: narration };
  }
}
```

---

## 5. 기술 아키텍처

### 5.1 파일 구조 (신규 생성 파일)

```
/home/user/image-gen/
├── api/
│   ├── longform/                          # 롱폼 전용 API
│   │   ├── generate-scenario.ts           # 롱폼 시나리오 생성
│   │   ├── generate-hook-image.ts         # 후킹 이미지 생성
│   │   ├── generate-hook-video.ts         # 후킹 영상 생성 (Hailuo)
│   │   ├── generate-scene-images.ts       # 본편 씬 이미지 일괄 생성
│   │   ├── generate-narrations.ts         # 나레이션 일괄 생성 (OpenAI/Gemini 라우팅)
│   │   ├── generate-narration-openai.ts   # OpenAI TTS 나레이션 생성
│   │   └── validate-narration.ts          # 나레이션 글자 수 보정
│   │
├── components/
│   ├── longform/                          # 롱폼 전용 컴포넌트
│   │   ├── LongformTab.tsx                # 메인 진입점 (탭)
│   │   ├── StepIndicator.tsx              # 단계 표시기
│   │   ├── Step1BasicSetup.tsx            # STEP 1: 기본 설정
│   │   ├── Step2ScenarioEditor.tsx        # STEP 2: 시나리오 편집
│   │   ├── Step3AssetGeneration.tsx        # STEP 3: 에셋 생성
│   │   ├── Step4PreviewDownload.tsx        # STEP 4: 미리보기/다운로드
│   │   ├── SceneCard.tsx                  # 개별 씬 카드
│   │   ├── NarrationCounter.tsx           # 글자 수 카운터
│   │   ├── GenerationProgress.tsx         # 생성 진행률 표시
│   │   └── LongformPlayer.tsx             # 영상 미리보기 플레이어
│   │
├── hooks/
│   ├── useLongformScenario.ts             # 롱폼 시나리오 생성/관리
│   ├── useLongformGeneration.ts           # 에셋 일괄 생성 로직
│   └── useLongformExport.ts              # 영상 렌더링/내보내기
│   │
├── services/
│   ├── longformApiClient.ts               # 롱폼 전용 API 클라이언트
│   └── longformVideoService.ts            # 롱폼 영상 렌더링 서비스
│   │
├── remotion/
│   ├── LongformVideo.tsx                  # 롱폼 전용 Remotion 컴포지션
│   └── LongformRoot.tsx                   # 롱폼 Remotion 루트
│   │
├── types/
│   └── longform.ts                        # 롱폼 전용 타입 정의
```

### 5.2 기존 코드 재활용 vs 신규 개발

| 모듈 | 전략 | 설명 |
|------|------|------|
| Remotion 렌더링 | **재활용** | `remotion/components/` 하위 컴포넌트 재사용 (KenBurns, Transitions, Subtitles, NarrationAudio) |
| Canvas 비디오 렌더링 | **재활용** | `services/videoService.ts`의 `renderVideo()` 재사용 |
| TTS 나레이션 (Gemini) | **재활용** | `/api/generate-narration.ts` 기존 엔드포인트 호출 |
| TTS 나레이션 (OpenAI) | **신규** | OpenAI TTS API 연동 (`tts-1`, `tts-1-hd`) |
| Hailuo AI 영상 | **재활용** | `/api/generate-video.ts` 기존 엔드포인트 호출 |
| 이미지 생성 (Gemini) | **재활용** | `/api/generate-images.ts` 기존 엔드포인트 호출 |
| 이미지 생성 (FLUX) | **재활용** | `/api/lib/eachlabs.ts` 기존 FLUX 라우팅 로직 재사용 |
| 이미지 모델 라우팅 | **재활용** | `isFluxModel()` 판별 함수 + 모델별 API 분기 로직 재사용 |
| 시나리오 생성 | **신규** | 롱폼 전용 프롬프트/응답 구조 필요 |
| 워크플로우 UI | **신규** | 단계형 단일 페이지 UI 전체 신규 |
| 글자 수 보정 | **신규** | 280~300자 보정 로직 |
| 일괄 생성 관리 | **신규** | 병렬 처리 + 재시도 + 진행률 관리 |
| 영상 분할 다운로드 | **신규** | 전반부/후반부 분리 렌더링 |

### 5.3 핵심 타입 정의

```typescript
// types/longform.ts

// ─── 이미지 모델 ──────────────────────────────────
type LongformImageModel =
  | 'gemini-3-pro-image-preview'       // Gemini 3 Pro (~$0.24/장, 4K)
  | 'gemini-2.5-flash-image'           // Gemini 2.5 Flash (~$0.039/장, 기본값)
  | 'imagen-4.0-generate-001'          // Imagen 4.0 (~$0.039/장)
  | 'imagen-4.0-fast-generate-001'     // Imagen 4.0 Fast (~$0.039/장)
  | 'flux-kontext-pro'                 // FLUX Kontext Pro ($0.04/장)
  | 'flux-kontext-max';                // FLUX Kontext Max ($0.08/장)

// ─── TTS 모델 ────────────────────────────────────
type TtsProvider = 'openai' | 'gemini';

type OpenAiTtsModel = 'tts-1' | 'tts-1-hd';
type GeminiTtsModel = 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts';
type LongformTtsModel = OpenAiTtsModel | GeminiTtsModel;

type OpenAiVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
type GeminiVoice = 'Kore' | 'Aoede' | 'Charon' | 'Fenrir' | 'Puck';

interface TtsConfig {
  provider: TtsProvider;             // TTS 엔진 선택
  model: LongformTtsModel;           // TTS 모델
  voice: OpenAiVoice | GeminiVoice;  // 음성 선택
}

// ─── 기본 설정 ────────────────────────────────────
interface LongformConfig {
  topic: string;                    // 영상 주제
  duration: 10 | 20 | 30 | 40 | 50 | 60;  // 영상 길이 (분)
  imageModel: LongformImageModel;   // 이미지 생성 모델
  tts: TtsConfig;                   // TTS 설정
}

// ─── 후킹 씬 ─────────────────────────────────────
interface HookScene {
  visualDescription: string;        // 이미지 프롬프트
  motionPrompt: string;             // 동영상 모션 설명
  hookText: string;                 // 후킹 자막 (20자 이내)
  generatedImage?: ImageData;       // 생성된 이미지
  generatedVideo?: {                // 생성된 동영상 (Hailuo)
    url: string;
    thumbnailUrl: string;
  };
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

// ─── 본편 씬 ─────────────────────────────────────
interface LongformScene {
  id: string;
  sceneNumber: number;
  timeRange: string;                // "0:10~1:10"
  imagePrompt: string;              // 이미지 프롬프트 (애니메이션)
  narration: string;                // 나레이션 텍스트 (280~300자)
  narrationCharCount: number;       // 글자 수
  storyPhase: '도입' | '전개' | '심화' | '절정' | '마무리';
  mood: string;
  generatedImage?: ImageData;       // 생성된 이미지
  narrationAudio?: NarrationAudio;  // 생성된 TTS 오디오
  imageStatus: 'pending' | 'generating' | 'completed' | 'failed';
  narrationStatus: 'pending' | 'generating' | 'completed' | 'failed';
}

// ─── 전체 시나리오 ────────────────────────────────
interface LongformScenario {
  id: string;
  config: LongformConfig;
  hookScene: HookScene;
  scenes: LongformScene[];
  metadata: {
    title: string;
    synopsis: string;
    totalScenes: number;
    estimatedDuration: string;
  };
  createdAt: Date;
}

// ─── 생성 진행 상태 ───────────────────────────────
interface GenerationProgress {
  currentStep: 'hook-image' | 'hook-video' | 'scene-images' | 'narrations' | 'completed';
  hookImage: 'pending' | 'generating' | 'completed' | 'failed';
  hookVideo: 'pending' | 'generating' | 'completed' | 'failed';
  sceneImages: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
  };
  narrations: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
  };
  overallPercent: number;           // 0~100
}

// ─── 출력물 ──────────────────────────────────────
interface LongformOutput {
  hookVideo: {                      // 파일 1: 10초 후킹 영상
    url: string;
    duration: 10;                   // 초
    format: 'mp4';
  };
  partOne: {                        // 파일 2: 본편 전반부
    blob?: Blob;
    duration: number;               // 초
    sceneCount: number;
    format: 'mp4' | 'webm';
  };
  partTwo: {                        // 파일 3: 본편 후반부
    blob?: Blob;
    duration: number;               // 초
    sceneCount: number;
    format: 'mp4' | 'webm';
  };
}

// ─── 워크플로우 상태 ──────────────────────────────
type LongformStep = 1 | 2 | 3 | 4;

interface LongformState {
  currentStep: LongformStep;
  config: LongformConfig | null;
  scenario: LongformScenario | null;
  progress: GenerationProgress | null;
  output: LongformOutput | null;
  imageModel: LongformImageModel;   // 선택된 이미지 모델
  tts: TtsConfig;                   // 선택된 TTS 설정
}

// ─── 기본값 ──────────────────────────────────────
const DEFAULT_TTS_CONFIG: TtsConfig = {
  provider: 'openai',               // OpenAI TTS 기본 추천
  model: 'tts-1',                   // Standard 모델 (가성비)
  voice: 'nova',                    // 한국어에 적합한 음성
};
```

---

## 6. API 엔드포인트 설계

### 6.1 POST /api/longform/generate-scenario

롱폼 시나리오 전체를 한 번에 생성한다.

**Request:**
```json
{
  "topic": "한국 전통 음식의 역사",
  "duration": 30
}
```

**Response:**
```json
{
  "hookScene": {
    "visualDescription": "거대한 불꽃 위에서 끓어오르는 전통 가마솥...",
    "motionPrompt": "Camera slowly zooms into boiling pot with steam rising...",
    "hookText": "당신이 모르는 한식의 비밀"
  },
  "scenes": [
    {
      "sceneNumber": 1,
      "timeRange": "0:10~1:10",
      "imagePrompt": "Ancient Korean kitchen, anime style, warm lighting...",
      "narration": "한국의 음식 문화는 수천 년의 역사를 가지고 있습니다. 삼국시대부터 이어져 온 발효 기술은 세계 어디에서도 찾아볼 수 없는 독특한 맛의 비밀입니다. 고구려, 백제, 신라 세 나라는 각기 다른 기후와 지형에서 자신만의 고유한 음식 문화를 발전시켰습니다. 특히 발효 식품은 긴 겨울을 나기 위한 지혜에서 시작되었고, 이것이 오늘날 김치, 된장, 간장의 원형이 되었습니다.",
      "narrationCharCount": 289,
      "storyPhase": "도입",
      "mood": "경이로움"
    }
  ],
  "metadata": {
    "title": "한국 전통 음식의 역사",
    "synopsis": "...",
    "totalScenes": 29,
    "estimatedDuration": "30분"
  }
}
```

### 6.2 POST /api/longform/generate-hook-image

후킹 장면의 이미지를 생성한다. 사용자가 선택한 이미지 모델에 따라 Gemini 또는 FLUX로 라우팅.

**Request:**
```json
{
  "visualDescription": "거대한 불꽃 위에서 끓어오르는 전통 가마솥...",
  "style": "animation",
  "imageModel": "gemini-2.5-flash-image"
}
```

**Response:**
```json
{
  "image": {
    "mimeType": "image/png",
    "data": "base64..."
  }
}
```

### 6.3 POST /api/longform/generate-hook-video

후킹 이미지를 10초 동영상으로 변환한다. (Hailuo AI 활용)

**Request:**
```json
{
  "sourceImage": "base64...",
  "motionPrompt": "Camera slowly zooms into boiling pot with steam rising...",
  "durationSeconds": 10
}
```

**Response:**
```json
{
  "videoUrl": "https://...",
  "thumbnailUrl": "https://..."
}
```

### 6.4 POST /api/longform/generate-scene-images

본편 씬 이미지를 일괄 생성한다. 선택된 모델에 따라 Gemini 또는 FLUX API로 라우팅.
FLUX 모델의 경우 `isFluxModel()` 판별 후 EachLabs API 호출.

**Request:**
```json
{
  "scenes": [
    {
      "sceneNumber": 1,
      "imagePrompt": "Ancient Korean kitchen, anime style..."
    },
    {
      "sceneNumber": 2,
      "imagePrompt": "..."
    }
  ],
  "imageModel": "gemini-2.5-flash-image",
  "batchSize": 5
}
```

**Response:**
```json
{
  "results": [
    {
      "sceneNumber": 1,
      "success": true,
      "image": { "mimeType": "image/png", "data": "base64..." }
    },
    {
      "sceneNumber": 2,
      "success": false,
      "error": "Rate limit exceeded"
    }
  ]
}
```

### 6.5 POST /api/longform/generate-narrations

나레이션 TTS를 일괄 생성한다. `ttsProvider`에 따라 OpenAI 또는 Gemini TTS로 라우팅.
**OpenAI TTS를 기본 추천** (일일 호출 제한 없음, 가성비 우수).

**Request:**
```json
{
  "scenes": [
    {
      "sceneNumber": 1,
      "narration": "한국의 음식 문화는...(289자)"
    }
  ],
  "ttsProvider": "openai",
  "ttsModel": "tts-1",
  "voice": "nova",
  "batchSize": 5
}
```

**Response:**
```json
{
  "results": [
    {
      "sceneNumber": 1,
      "success": true,
      "audio": { "mimeType": "audio/mp3", "data": "base64..." },
      "durationSeconds": 62.3
    }
  ]
}
```

### 6.6 POST /api/longform/generate-narration-openai

OpenAI TTS 전용 나레이션 생성 엔드포인트 (신규).

**Request:**
```json
{
  "text": "한국의 음식 문화는...(289자)",
  "model": "tts-1",
  "voice": "nova",
  "response_format": "mp3",
  "speed": 1.0
}
```

**Response:**
```json
{
  "audio": { "mimeType": "audio/mp3", "data": "base64..." },
  "durationSeconds": 58.2,
  "charCount": 289,
  "cost": 0.004335
}
```

> **OpenAI TTS 기술 사양:**
> - 최대 입력: 4,096자/요청 (300자 대비 13배 여유)
> - 출력 포맷: MP3 (기본), WAV, FLAC, Opus, AAC, PCM
> - 스트리밍: 지원 (~0.5초 지연)
> - 가격: tts-1 $15/100만자, tts-1-hd $30/100만자
> - 스티어링: 프롬프트로 톤/감정 조절 가능 ("차분하고 따뜻한 톤으로")

### 6.7 POST /api/longform/validate-narration

나레이션 글자 수가 280~300자를 벗어날 경우 AI에게 보정을 요청한다.

**Request:**
```json
{
  "narration": "원본 나레이션 텍스트...(312자)",
  "targetMin": 280,
  "targetMax": 300,
  "context": "이전 씬 나레이션 내용 (맥락 유지용)"
}
```

**Response:**
```json
{
  "narration": "보정된 나레이션 텍스트...(295자)",
  "charCount": 295,
  "adjusted": true
}
```

---

## 7. 에셋 생성 파이프라인 상세

### 7.1 실행 순서 및 의존 관계

```
Phase 1: 후킹 에셋 (직렬)
  1-a. 후킹 이미지 생성 ────→ 1-b. 후킹 영상 생성 (이미지 필요)
                                        │
Phase 2: 본편 에셋 (병렬)                ↓ (Phase 1 완료 후 시작)
  2-a. 씬 이미지 일괄 생성 ──────┐
                                 ├──→ 전체 완료
  2-b. 나레이션 일괄 생성 ───────┘
       (2-a와 독립적으로 병렬 실행)
```

### 7.2 일괄 처리 전략

```
씬 이미지 생성 (예: 29개 씬)
  → Batch 1: 씬 1~5   (5개 동시)  ──→ 완료 후
  → Batch 2: 씬 6~10  (5개 동시)  ──→ 완료 후
  → Batch 3: 씬 11~15 (5개 동시)  ──→ 완료 후
  → Batch 4: 씬 16~20 (5개 동시)  ──→ 완료 후
  → Batch 5: 씬 21~25 (5개 동시)  ──→ 완료 후
  → Batch 6: 씬 26~29 (4개 동시)  ──→ 완료

나레이션 생성 (이미지와 동시에 실행)
  → 동일한 배치 크기로 병렬 처리
```

### 7.3 실패 처리

```
개별 씬 실패 시:
  1. 해당 씬만 자동 재시도 (최대 3회, 지수 백오프)
  2. 3회 실패 시 '실패' 상태로 표시
  3. 사용자에게 수동 재시도 버튼 제공
  4. 실패 씬이 있어도 나머지 씬은 계속 진행

전체 중단 조건:
  - 후킹 영상 생성 실패 (Hailuo API 불가) → 사용자에게 알림
  - API 키 만료/잔액 부족 → 전체 중단 + 부분 결과 보존
```

---

## 8. Remotion 렌더링 설계

### 8.1 본편 영상 구조

```
[본편 전반부 영상 - Part 1]
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│  씬 1   │  씬 2   │  씬 3   │  ...    │  씬 N/2 │
│  60초   │  60초   │  60초   │  60초   │  60초   │
│ 이미지  │ 이미지  │ 이미지  │ 이미지  │ 이미지  │
│+나레이션│+나레이션│+나레이션│+나레이션│+나레이션│
│+Ken Burns│+Ken Burns│+Ken Burns│+Ken Burns│+Ken Burns│
│+자막    │+자막    │+자막    │+자막    │+자막    │
└────┬────┴────┬────┴────┬────┴────┬────┴─────────┘
     fade      fade      fade      fade

[본편 후반부 영상 - Part 2]
┌──────────┬─────────┬─────────┬─────────┬──────────┐
│  씬 N/2+1│  ...    │  ...    │  ...    │  씬 N    │
│  60초    │  60초   │  60초   │  60초   │  60+α초  │
│  이미지  │ 이미지  │ 이미지  │ 이미지  │  이미지  │
│+나레이션 │+나레이션│+나레이션│+나레이션│+나레이션 │
│+Ken Burns│+Ken Burns│+Ken Burns│+Ken Burns│+Ken Burns│
│+자막     │+자막    │+자막    │+자막    │+자막     │
└─────┬────┴────┬────┴────┬────┴────┬────┴──────────┘
      fade      fade      fade      fade
```

### 8.2 각 씬 내부 타임라인

```
[1개 씬 = 60초]
0s                                                          60s
├────────────────────────────────────────────────────────────┤
│                                                            │
│  이미지: Ken Burns 애니메이션 (천천히 줌인 또는 패닝)         │
│  ████████████████████████████████████████████████████████  │
│                                                            │
│  나레이션 오디오: TTS 280~300자 읽기 (~55~60초)              │
│  ████████████████████████████████████████████████████████  │
│                                                            │
│  자막: 나레이션 텍스트 표시                                   │
│  ████████████████████████████████████████████████████████  │
│                                                            │
├─ fade 전환 (0.5초) ─┤
```

### 8.3 애니메이션 설정

스타일은 **애니메이션 1종 고정**이므로 모든 씬에 동일한 설정 적용:

```typescript
const LONGFORM_ANIMATION_CONFIG: AnimationConfig = {
  type: 'kenBurns',
  direction: 'in',      // 기본 줌인 (씬마다 in/out 교대 가능)
  intensity: 0.3,        // 부드러운 움직임 (1분 씬에서 과한 움직임 방지)
};

const LONGFORM_TRANSITION_CONFIG = {
  type: 'fade' as const,
  durationFrames: 15,    // 0.5초 (30fps 기준)
};
```

### 8.4 Remotion 컴포지션

```typescript
// remotion/LongformVideo.tsx
// 기존 ShortFormVideo.tsx를 베이스로 1분 단위 씬 처리

const LongformVideo: React.FC<LongformVideoProps> = ({
  scenes,               // LongformScene[]
  showSubtitles,
  playAudio,
  audioVolume,
}) => {
  const fps = 30;
  const sceneDurationFrames = 60 * fps;  // 1분 = 1800 프레임
  const transitionFrames = 15;           // 0.5초 전환

  return (
    <AbsoluteFill>
      {scenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={index * (sceneDurationFrames - transitionFrames)}
          durationInFrames={sceneDurationFrames}
        >
          <SceneSequence
            imageData={scene.generatedImage}
            narration={scene.narration}
            narrationAudio={scene.narrationAudio}
            animation={LONGFORM_ANIMATION_CONFIG}
            showSubtitles={showSubtitles}
            playAudio={playAudio}
            audioVolume={audioVolume}
          />
          {index < scenes.length - 1 && (
            <FadeTransition durationInFrames={transitionFrames} />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
```

---

## 9. 기존 서비스 연동 방법

### 9.1 App.tsx 수정 (최소 변경)

```typescript
// App.tsx에 AppMode 타입에 'longform' 추가
type AppMode = 'scenario' | 'video' | 'ad' | 'foodvideo' | 'longform';

// TabNavigation에 "롱폼" 탭 추가
// activeTab === 'longform' 일 때 <LongformTab /> 렌더링
```

### 9.2 독립성 보장

- 롱폼 서비스는 자체 상태 관리 (`useLongformScenario`, `useLongformGeneration`, `useLongformExport`)
- 기존 `ProjectContext`와 분리된 독자적 상태
- 기존 서비스의 컴포넌트/훅을 import하지 않음
- 공통 유틸리티 (`errors.ts`, `audioUtils.ts`, `imageCompression.ts`)만 공유
- Remotion 기본 컴포넌트 (`KenBurnsEffect`, `Transitions`, `Subtitles`, `NarrationAudio`)는 재활용

---

## 10. UI/UX 상세 설계

### 10.1 전체 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│  [시나리오] [영상] [광고] [먹방] [롱폼]  ← 탭 네비게이션      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──┐  ┌──┐  ┌──┐  ┌──┐                                    │
│  │①│──│②│──│③│──│④│  ← 단계 인디케이터                    │
│  └──┘  └──┘  └──┘  └──┘                                    │
│  설정   시나리오 생성   미리보기                                │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │              현재 단계의 콘텐츠 영역                     │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 10.2 STEP 1: 기본 설정 UI

```
┌────────────────────────────────────────────────────────────┐
│  📺 롱폼 영상 생성                                          │
│                                                            │
│  주제                                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  예: 한국 전통 음식의 역사와 현대 한식의 세계화          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  영상 길이                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ 10분 │ │ 20분 │ │ 30분 │ │ 40분 │ │ 50분 │ │ 60분 │  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │
│                        ↑ 선택됨                             │
│                                                            │
│  이미지 모델                                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ── Google Gemini ──                                   │  │
│  │  Gemini 2.5 Flash Image (~$0.039/장) ← 선택됨        │  │
│  │  Gemini 3 Pro Image (~$0.24/장, 4K)                   │  │
│  │  Imagen 4.0 (~$0.039/장)                               │  │
│  │  Imagen 4.0 Fast (~$0.039/장)                          │  │
│  │  ── EachLabs FLUX ──                                   │  │
│  │  FLUX Kontext Pro ($0.04/장)                           │  │
│  │  FLUX Kontext Max ($0.08/장)                           │  │
│  └──────────────────────────────────────────────────────┘  │
│  ⓘ 예상 이미지 비용: 30장 × ~$0.039 = ~$1.17              │
│                                                            │
│  TTS 엔진                                                  │
│  ┌────────────────────────┐ ┌────────────────────────┐    │
│  │ ● OpenAI TTS (추천)    │ │ ○ Gemini TTS           │    │
│  └────────────────────────┘ └────────────────────────┘    │
│                                                            │
│  TTS 모델                                                  │
│  ┌────────────────────────┐ ┌────────────────────────┐    │
│  │ ● tts-1 (가성비)       │ │ ○ tts-1-hd (고품질)    │    │
│  └────────────────────────┘ └────────────────────────┘    │
│                                                            │
│  음성 선택                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │Alloy │ │ Echo │ │Fable │ │ Onyx │ │ Nova │ │Shimmer│ │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │
│                                         ↑ 추천            │
│                                                            │
│  예상 정보                                                  │
│  · 총 씬 수: 29개                                          │
│  · 후킹 영상: 10초 (실사 동영상)                             │
│  · 본편: 29분 50초 (이미지 + 나레이션)                       │
│  · 예상 이미지 비용: ~$1.17 (Gemini Flash 30장)             │
│  · 예상 TTS 비용: ~$0.13 (OpenAI tts-1, 8,700자)           │
│  · 예상 총 비용: ~$1.30                                     │
│                                                            │
│                         [시나리오 생성하기]                   │
└────────────────────────────────────────────────────────────┘
```

### 10.3 STEP 2: 시나리오 편집 UI

```
┌────────────────────────────────────────────────────────────┐
│  시나리오: "한국 전통 음식의 역사"                             │
│  29개 씬 | 30분                                             │
│                                                            │
│  ── 후킹 씬 (10초 동영상) ──────────────────────────────    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  비주얼: [거대한 불꽃 위에서 끓어오르는 전통 가마솥... ]  │  │
│  │  모션:   [Camera slowly zooms into boiling pot...    ]  │  │
│  │  자막:   [당신이 모르는 한식의 비밀    ] (16/20자)       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ── 본편 씬 목록 ──────────────────────────────────────     │
│                                                            │
│  씬 1 (0:10~1:10) [도입]                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  이미지: [Ancient Korean kitchen, anime style...     ]  │  │
│  │  나레이션:                                              │  │
│  │  [한국의 음식 문화는 수천 년의 역사를 가지고 있습니다...  ]  │
│  │                                          289/300자 ✓   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  씬 2 (1:10~2:10) [도입]                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  이미지: [...                                        ]  │  │
│  │  나레이션:                                              │  │
│  │  [...                                                ]  │  │
│  │                                          312/300자 ✗   │  │
│  │                          [글자 수 자동 보정]             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ... (스크롤)                                               │
│                                                            │
│  [← 이전 단계]                    [다음 단계: 에셋 생성 →]   │
└────────────────────────────────────────────────────────────┘
```

### 10.4 STEP 3: 에셋 생성 UI

```
┌────────────────────────────────────────────────────────────┐
│  에셋 생성 중...                                             │
│                                                            │
│  전체 진행률                                                 │
│  ████████████████████████░░░░░░░░░░░░░░░░  62%             │
│                                                            │
│  Phase 1: 후킹 에셋                                         │
│  ✅ 후킹 이미지 생성 완료                                     │
│  ✅ 후킹 영상 생성 완료 (Hailuo AI, 10초)                     │
│                                                            │
│  Phase 2: 본편 에셋                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  씬 이미지 생성                                        │  │
│  │  ████████████████████████████░░░░░░░░  18/29 완료     │  │
│  │                                                        │  │
│  │  ✅ Batch 1 (씬 1~5) 완료                              │  │
│  │  ✅ Batch 2 (씬 6~10) 완료                             │  │
│  │  ✅ Batch 3 (씬 11~15) 완료                            │  │
│  │  🔄 Batch 4 (씬 16~20) 생성 중... 3/5                  │  │
│  │  ⏳ Batch 5 (씬 21~25) 대기                            │  │
│  │  ⏳ Batch 6 (씬 26~29) 대기                            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  나레이션 TTS 생성                                      │  │
│  │  ██████████████████████████████████░░░  25/29 완료     │  │
│  │                                                        │  │
│  │  ✅ Batch 1~5 완료                                     │  │
│  │  🔄 Batch 6 (씬 26~29) 생성 중... 1/4                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ⚠️ 씬 7 이미지 생성 실패 (재시도 2/3)                       │
│                                                            │
│  [중단하기]                                                  │
└────────────────────────────────────────────────────────────┘
```

### 10.5 STEP 4: 미리보기 & 다운로드 UI

```
┌────────────────────────────────────────────────────────────┐
│  영상 제작 완료!                                             │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  1. 후킹 영상 (10초)                   MP4 | 10초  │    │
│  │  ┌──────────────────────────────────┐              │    │
│  │  │                                  │              │    │
│  │  │         ▶ 동영상 미리보기          │              │    │
│  │  │                                  │              │    │
│  │  └──────────────────────────────────┘              │    │
│  │                    [▶ 재생]  [⬇ 다운로드]           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  2. 본편 전반부 (15분)        MP4 | 씬 1~15 | 15분 │    │
│  │  ┌──────────────────────────────────┐              │    │
│  │  │                                  │              │    │
│  │  │       ▶ Remotion 미리보기         │              │    │
│  │  │                                  │              │    │
│  │  └──────────────────────────────────┘              │    │
│  │                    [▶ 재생]  [⬇ 다운로드]           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  3. 본편 후반부 (14분 50초)   MP4 | 씬 16~29 | 14분│    │
│  │  ┌──────────────────────────────────┐              │    │
│  │  │                                  │              │    │
│  │  │       ▶ Remotion 미리보기         │              │    │
│  │  │                                  │              │    │
│  │  └──────────────────────────────────┘              │    │
│  │                    [▶ 재생]  [⬇ 다운로드]           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  [📦 전체 ZIP 다운로드]           [← 처음으로]               │
└────────────────────────────────────────────────────────────┘
```

---

## 11. 데이터 흐름 다이어그램

```
사용자 입력                     AI 처리                        출력
──────────                    ────────                       ──────

[주제 + 시간]
      │
      ▼
  ┌────────────┐
  │ STEP 1     │
  │ 기본 설정   │
  └────┬───────┘
       │
       ▼
  ┌────────────┐    ┌──────────────────────┐
  │ STEP 2     │───→│ Gemini API           │
  │ 시나리오    │    │ 롱폼 시나리오 생성    │
  │ 생성/편집   │←───│ (후킹 + 본편 씬)     │
  └────┬───────┘    └──────────────────────┘
       │
       │ [사용자 편집 가능]
       │ [글자수 보정 가능]
       ▼
  ┌────────────┐
  │ STEP 3     │
  │ 에셋 생성   │
  └────┬───────┘
       │
       ├──→ [후킹 이미지] ──→ 선택된 모델 (Gemini/FLUX) ──→ 이미지
       │         │
       │         ▼
       │    [후킹 영상] ──→ Hailuo AI ──→ 10초 MP4 ──→ [파일 1]
       │
       ├──→ [씬 이미지 ×N] ──→ 선택된 모델 (5개씩 병렬) ──→ 이미지 N장
       │
       └──→ [나레이션 ×N] ──→ OpenAI TTS 또는 Gemini TTS ──→ MP3/WAV N개
                                                              │
                                                              ▼
  ┌────────────┐    ┌──────────────────────┐
  │ STEP 4     │    │ Remotion 렌더링       │
  │ 미리보기    │←───│                      │
  │ 다운로드    │    │ 전반부 (씬 1~N/2)    │──→ [파일 2]
  └────────────┘    │ 후반부 (씬 N/2+1~N)  │──→ [파일 3]
                    └──────────────────────┘
```

---

## 12. 성능 고려사항

### 12.1 대용량 데이터 관리

| 항목 | 30분 영상 기준 | 60분 영상 기준 |
|------|---------------|---------------|
| 씬 이미지 | 29장 × ~500KB = ~14.5MB | 59장 × ~500KB = ~29.5MB |
| 나레이션 WAV | 29개 × ~1MB = ~29MB | 59개 × ~1MB = ~59MB |
| 후킹 영상 | ~5MB | ~5MB |
| 총 메모리 사용 | ~48.5MB | ~93.5MB |

### 12.2 메모리 최적화 전략

```
1. 이미지 압축: 생성 즉시 JPEG 80% 품질로 압축 (~200KB/장)
2. 오디오 스트리밍: 전체 로드 대신 씬 단위 로드
3. Remotion 렌더링: 전반부/후반부 분리하여 메모리 분산
4. Blob URL: base64 대신 Blob URL 사용으로 메모리 절약
5. 생성 완료된 배치 데이터는 IndexedDB에 캐싱
```

### 12.3 API Rate Limiting 대응

```
Gemini Imagen (gemini-*, imagen-*):
  - RPM (분당 요청): 10회
  - 배치 크기 5 + 대기 시간 7초 = 분당 ~8.5회
  - 30분 영상 (30장): 약 3.5분 소요 예상
  - 60분 영상 (60장): 약 7분 소요 예상

FLUX Kontext (flux-kontext-*):
  - EachLabs API 기반, 별도 Rate Limit
  - 배치 크기 5 + 대기 시간 3초 = 분당 ~15회
  - 30분 영상 (30장): 약 2분 소요 예상 (Gemini보다 빠름)
  - 60분 영상 (60장): 약 4분 소요 예상
  - 비용: Pro $0.04/장, Max $0.08/장

OpenAI TTS (tts-1, tts-1-hd) [추천]:
  - RPM: 50회 (Tier 1 기준, Tier에 따라 증가)
  - 배치 크기 5 + 대기 시간 2초 = 분당 ~25회
  - 30분 영상 (29개): 약 1.2분 소요 예상
  - 60분 영상 (59개): 약 2.4분 소요 예상
  - 일일 호출 제한: 없음 (종량제)
  - 비용: tts-1 $15/100만자, tts-1-hd $30/100만자

Gemini TTS (비추천 - 대량 생성 시):
  - RPM: 15회
  - 배치 크기 5 + 대기 시간 5초 = 분당 ~12회
  - 30분 영상 (29개): 약 2.5분 소요 예상
  - 60분 영상 (59개): 약 5분 소요 예상
  - ⚠️ 일일 호출 제한 있음 → 60분 영상 생성 시 제한에 걸릴 수 있음

Hailuo AI:
  - 1회 요청 (후킹 영상만): 30초~2분 소요
```

---

## 13. 에러 처리 및 복구

### 13.1 에러 시나리오별 대응

| 에러 | 대응 | 사용자 표시 |
|------|------|------------|
| 시나리오 생성 실패 | 자동 재시도 1회 → 수동 재시도 | "시나리오 생성에 실패했습니다. 다시 시도해주세요." |
| 개별 씬 이미지 실패 | 자동 재시도 3회 (지수 백오프) | 해당 씬에 실패 아이콘 + 재시도 버튼 |
| 나레이션 생성 실패 | 자동 재시도 3회 | 해당 씬에 실패 아이콘 + 재시도 버튼 |
| Gemini TTS 일일 제한 초과 | OpenAI TTS로 자동 전환 제안 | "Gemini TTS 일일 한도 초과. OpenAI TTS로 전환하시겠습니까?" |
| OpenAI API 키 미설정 | Gemini TTS 폴백 | "OpenAI API 키가 없습니다. Gemini TTS로 진행합니다." |
| 후킹 영상 생성 실패 | 자동 재시도 2회 → Fallback: 이미지+줌 효과 | "동영상 생성 실패. Ken Burns 효과로 대체합니다." |
| API 할당량 초과 | 대기 후 자동 재시도 | "API 할당량 초과. 잠시 후 자동으로 재시도합니다." |
| 나레이션 글자수 벗어남 | AI 자동 보정 (최대 2회) | 글자수 카운터 빨간색 표시 + 보정 버튼 |
| Remotion 렌더링 실패 | Canvas 폴백 렌더링 | "렌더링 방식을 변경하여 재시도합니다." |
| 네트워크 오류 | 자동 재시도 4회 (지수 백오프) | "네트워크 오류. 자동으로 재시도합니다." |

### 13.2 부분 완료 복구

```
진행 상태를 localStorage 또는 IndexedDB에 자동 저장:
- 시나리오 데이터
- 생성 완료된 이미지/나레이션
- 현재 진행 단계

브라우저 새로고침 또는 닫았다 열었을 때:
→ "이전 진행 상태가 있습니다. 이어서 진행하시겠습니까?"
→ [이어하기] / [새로 시작]
```

---

## 14. 개발 단계 및 우선순위

### Phase 1: 핵심 구조 (기초)
1. `types/longform.ts` - 타입 정의
2. `components/longform/LongformTab.tsx` - 메인 탭 컴포넌트
3. `components/longform/StepIndicator.tsx` - 단계 표시기
4. `components/longform/Step1BasicSetup.tsx` - 기본 설정 UI
5. `App.tsx` 수정 - 'longform' 탭 추가
6. `components/common/TabNavigation.tsx` 수정 - 탭 추가

### Phase 2: 시나리오 생성
7. `api/longform/generate-scenario.ts` - 시나리오 생성 API
8. `hooks/useLongformScenario.ts` - 시나리오 관리 훅
9. `services/longformApiClient.ts` - API 클라이언트
10. `components/longform/Step2ScenarioEditor.tsx` - 시나리오 편집 UI
11. `components/longform/SceneCard.tsx` - 씬 카드 컴포넌트
12. `components/longform/NarrationCounter.tsx` - 글자 수 카운터
13. `api/longform/validate-narration.ts` - 나레이션 보정 API

### Phase 3: 에셋 생성
14. `api/longform/generate-hook-image.ts` - 후킹 이미지 API
15. `api/longform/generate-hook-video.ts` - 후킹 영상 API
16. `api/longform/generate-scene-images.ts` - 씬 이미지 일괄 API
17. `api/longform/generate-narrations.ts` - 나레이션 일괄 API (OpenAI/Gemini 라우팅)
17-1. `api/longform/generate-narration-openai.ts` - OpenAI TTS 전용 API
18. `hooks/useLongformGeneration.ts` - 일괄 생성 관리 훅
19. `components/longform/Step3AssetGeneration.tsx` - 에셋 생성 UI
20. `components/longform/GenerationProgress.tsx` - 진행률 컴포넌트

### Phase 4: 렌더링 및 내보내기
21. `remotion/LongformVideo.tsx` - 롱폼 Remotion 컴포지션
22. `remotion/LongformRoot.tsx` - 롱폼 Remotion 루트
23. `services/longformVideoService.ts` - 렌더링 서비스
24. `hooks/useLongformExport.ts` - 내보내기 훅
25. `components/longform/Step4PreviewDownload.tsx` - 미리보기/다운로드 UI
26. `components/longform/LongformPlayer.tsx` - 미리보기 플레이어

### Phase 5: 안정화
27. 에러 처리 및 복구 로직
28. 부분 완료 상태 저장/복구
29. 성능 최적화 (메모리, 렌더링)
30. UI 테스트 및 폴리싱

---

## 15. 파일 생성 목록 총정리

| # | 파일 경로 | 분류 | 신규/수정 |
|---|-----------|------|-----------|
| 1 | `types/longform.ts` | 타입 | 신규 |
| 2 | `components/longform/LongformTab.tsx` | 컴포넌트 | 신규 |
| 3 | `components/longform/StepIndicator.tsx` | 컴포넌트 | 신규 |
| 4 | `components/longform/Step1BasicSetup.tsx` | 컴포넌트 | 신규 |
| 5 | `components/longform/Step2ScenarioEditor.tsx` | 컴포넌트 | 신규 |
| 6 | `components/longform/Step3AssetGeneration.tsx` | 컴포넌트 | 신규 |
| 7 | `components/longform/Step4PreviewDownload.tsx` | 컴포넌트 | 신규 |
| 8 | `components/longform/SceneCard.tsx` | 컴포넌트 | 신규 |
| 9 | `components/longform/NarrationCounter.tsx` | 컴포넌트 | 신규 |
| 10 | `components/longform/GenerationProgress.tsx` | 컴포넌트 | 신규 |
| 11 | `components/longform/LongformPlayer.tsx` | 컴포넌트 | 신규 |
| 12 | `hooks/useLongformScenario.ts` | 훅 | 신규 |
| 13 | `hooks/useLongformGeneration.ts` | 훅 | 신규 |
| 14 | `hooks/useLongformExport.ts` | 훅 | 신규 |
| 15 | `services/longformApiClient.ts` | 서비스 | 신규 |
| 16 | `services/longformVideoService.ts` | 서비스 | 신규 |
| 17 | `api/longform/generate-scenario.ts` | API | 신규 |
| 18 | `api/longform/generate-hook-image.ts` | API | 신규 |
| 19 | `api/longform/generate-hook-video.ts` | API | 신규 |
| 20 | `api/longform/generate-scene-images.ts` | API | 신규 |
| 21 | `api/longform/generate-narrations.ts` | API | 신규 |
| 22 | `api/longform/generate-narration-openai.ts` | API | 신규 |
| 23 | `api/longform/validate-narration.ts` | API | 신규 |
| 24 | `remotion/LongformVideo.tsx` | Remotion | 신규 |
| 25 | `remotion/LongformRoot.tsx` | Remotion | 신규 |
| 26 | `App.tsx` | 메인 | 수정 |
| 27 | `components/common/TabNavigation.tsx` | 컴포넌트 | 수정 |

**신규 파일: 25개 / 수정 파일: 2개 / 총 27개**

---

## 16. 요약

| 항목 | 내용 |
|------|------|
| **서비스명** | 롱폼 영상 생성 서비스 |
| **입력** | 주제 + 영상 길이 (10~60분) + 이미지 모델 + TTS 엔진/모델 |
| **이미지 모델** | Gemini 4종 (~$0.039~$0.24/장) + FLUX 2종 ($0.04~$0.08/장) |
| **TTS 엔진** | **OpenAI TTS 추천** (tts-1/tts-1-hd, 6음성) + Gemini TTS (5음성) |
| **출력** | 3개 파일: 후킹 MP4 (10초) + 본편 전반부 MP4 + 본편 후반부 MP4 |
| **씬 단위** | 1분 1이미지 + 1분 나레이션 (280~300자) |
| **스타일** | 애니메이션 고정 (설정 불필요) |
| **워크플로우** | 단일 연속 4단계 (설정→시나리오→생성→다운로드) |
| **기존 서비스** | 완전 독립 (공통 유틸리티만 공유) |
| **비용 절감** | 기존 대비 API 호출 83% 절감 |
| **예상 비용** | 30분 기준: 이미지 ~$1.17 + TTS ~$0.13 = **~$1.30** (Gemini Flash + OpenAI tts-1) |
| **핵심 기술** | Gemini AI + FLUX AI + OpenAI TTS + Hailuo AI + Remotion + Canvas |
