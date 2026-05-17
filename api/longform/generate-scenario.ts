import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth.js';
import { getAIClientForUser, getThinkingConfig, sanitizePrompt, setCorsHeaders, Type, callGeminiWithRetry, parseGeminiError, MODELS } from '../lib/gemini.js';
import { isOpenAIModel, getOpenAIKeyForUser, generateTextWithOpenAI } from '../lib/openai.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('longform-scenario');

// 토큰 예산 — Gemini 3 Pro 64K output 활용
const PASS1_MAX_TOKENS = 32768;
const PASS2_MAX_TOKENS = 32768;

// 적응형 배치 임계치 — perScene 별로 다름. 일관성을 위해 가능하면 단일 호출.
// Pro 64K / (1 prompt ≈ 600 tokens) ≈ 100 prompt 가능. 안전 마진으로 80.
const PASS2_MAX_PROMPTS_PER_CALL = 80;

type ImageFrequency = 'per-minute' | 'per-20-seconds';

interface GenerateLongformRequest {
  topic: string;
  duration: number;
  textModel?: string;        // 무시됨 — 시나리오는 항상 MODELS.TEXT (Gemini 3 Pro) 사용
  referenceText?: string;
  imageFrequency?: ImageFrequency; // 'per-minute' = 씬당 1장(기본), 'per-20-seconds' = 씬당 3장
}

// ─── Pass 결과 타입 (JSON.parse 결과 안전 캐스팅용) ──────
interface Pass1Character {
  name: string;
  gender: 'female' | 'male' | 'unspecified';
  ageGroup: string;
  appearance: string;
  outfit: string;
  role?: 'main' | 'supporting';
}

interface Pass1Scene {
  sceneNumber: number;
  timeRange: string;
  narration: string;
  narrationCharCount: number;
  narrationKeywords: string[];
  storyPhase: string;
  mood: string;
  cameraAngle?: string;
  lightingMood?: string;
}

interface Pass1Result {
  scenes: Pass1Scene[];
  metadata: {
    title: string;
    synopsis: string;
    totalScenes: number;
    estimatedDuration: string;
  };
  mainCharacters: Pass1Character[];
}

interface Pass2ScenePrompts {
  sceneNumber: number;
  imagePrompts: string[];
  imagePrompt?: string; // legacy 호환
}

interface Pass2Result {
  scenePrompts: Pass2ScenePrompts[];
}

function subImagesPerScene(freq?: ImageFrequency): number {
  return freq === 'per-20-seconds' ? 3 : 1;
}

/** 씬당 prompt 수와 총 씬 수로 적응형 배치 크기 계산. 가능하면 1배치(단일 호출) */
function computeBatchSize(totalScenes: number, perScene: number): number {
  const totalPrompts = totalScenes * perScene;
  if (totalPrompts <= PASS2_MAX_PROMPTS_PER_CALL) {
    return totalScenes; // 단일 호출
  }
  // 배치당 prompt 수 ≤ PASS2_MAX_PROMPTS_PER_CALL
  return Math.max(1, Math.floor(PASS2_MAX_PROMPTS_PER_CALL / perScene));
}

// ─── Pass 1: 나레이션 + 스토리 구조 생성 ────────────
function buildPass1Prompt(topic: string, duration: number, totalScenes: number, reference: string): string {
  return `당신은 YouTube 롱폼 영상의 시나리오 작가입니다.
주어진 주제로 ${duration}분 길이의 영상 시나리오를 작성합니다.

## [1단계] 나레이션 및 스토리 구조 생성

이 단계에서는 나레이션과 스토리 구조만 생성합니다. 이미지 프롬프트는 생성하지 않습니다.

## 규칙
1. 본편은 ${totalScenes}개의 씬으로 구성 (각 씬 = 1분)
2. ⚠️ [최우선 규칙 — 절대 어기지 마세요] 나레이션 글자수:
   - **각 씬의 나레이션은 반드시 432자 이상, 444자 이하** (띄어쓰기 포함)
   - 200자, 300자 같은 짧은 응답은 즉시 실패로 간주합니다
   - 내부 구성: 10초씩 6개 구간 × 72~74자/구간
   - **글자수 부족하면 다음을 추가하여 무조건 432자 이상으로 늘리세요**:
     • 구체적 예시 ("예를 들어 ~", "가령 ~")
     • 부연 설명 ("다시 말해 ~", "쉽게 말해 ~")
     • 감정·뉘앙스 형용사·부사 ("아주", "결국", "여전히", "분명히")
     • 자연스러운 접속어 ("그래서", "물론", "하지만", "결과적으로")
   - **나레이션 작성 후 직접 글자수를 세서 432~444 범위인지 검증하고, 부족하면 보완 후 다시 검증**하세요
3. 스토리 구조: 도입(~20%) → 전개(~25%) → 심화(~25%) → 절정(~20%) → 마무리(~10%)
4. 나레이션은 자연스러운 한국어, 다큐멘터리/설명 톤
5. 각 씬에서 나레이션의 핵심 시각화 키워드를 3~5개 추출하세요 (영어)
6. 각 씬의 분위기, 카메라 앵글, 조명/분위기를 지정하세요
7. ⚠️ [캐릭터 바이블] 시나리오에 반복 등장하는 메인 인물 1~3명을 통합 추출 — 모든 씬에서 동일 인물이 동일 외모/복장으로 등장하도록 보장:
   - 각 인물의 성별(남성/여성)과 나이대를 명확히 지정
   - 외모(머리 스타일, 체형, 인상)와 복장(상의/하의/소품)을 구체적으로 묘사
   - 일반 명사(예: "사장님")로 지칭되는 인물도 반드시 캐릭터로 등록
   - 이 바이블은 이미지 프롬프트 작성 시 모든 씬에 일관 적용됨

### 좋은 예시 (438자, 정확)
"매달 광고비 백만 원을 꾸준히 쓰는데도 매출이 그대로라면, 문제는 사장님 역량이 아닙니다. 대개 돈이 새는 곳은 '키워드'예요. 네이버는 모든 가게를 한 줄로 세우지 않습니다. 키워드마다 전혀 다른 경기장과 다른 룰, 또 다른 순위표가 따로 있어요. 오늘 10분 동안, 매출이 따라오는 키워드를 고르는 의사결정 프레임을 통째로 드릴게요. 검색량 큰 단어에 무작정 돈을 태우는 대신, 고객이 지금 당장 방문할 단어를 가려내는 방식입니다. 한 번의 설정으로 끝나는 게 아니라, 광고와 소개글과 메뉴까지 같은 방향으로 정렬하는 전략이에요. 영상 끝나면 우리 가게에 바로 적용할 체크리스트를 손에 쥐게 됩니다, 지금 바로 시작합니다."

### 나쁜 예시 (180자 — 절대 금지)
"매달 광고비를 쓰는데도 매출이 그대로라면 문제는 키워드입니다. 네이버는 키워드마다 다른 경기장이 있어요. 오늘 10분 동안 매출이 따라오는 키워드를 고르는 프레임을 드립니다. 지금 시작합니다."

## narrationKeywords 추출 규칙
- 나레이션에서 시각적으로 표현 가능한 핵심 요소를 영어로 추출
- 인물, 장소, 행동, 감정, 소품 중심으로 추출
- 예: 나레이션이 "퇴근길 강남역 앞, 지친 직장인이 네온사인 아래 서있다"면
  → ["exhausted salaryman", "Gangnam station", "neon signs", "night commute", "loneliness"]

## cameraAngle 옵션
- "wide establishing shot" (전경), "medium shot" (중간), "close-up" (클로즈업)
- "low angle" (올려보기), "high angle" (내려보기), "bird's eye view" (조감도)
- "over-the-shoulder" (어깨너머), "POV" (1인칭), "dutch angle" (기울어진 앵글)

## lightingMood 옵션 (영어로 작성)
- "warm golden hour sunlight", "cool blue moonlight", "dramatic rim lighting"
- "soft diffused overcast", "harsh neon glow", "candlelight warmth"
- "clinical fluorescent", "ethereal backlight", "stormy dark atmosphere"

## 주제
${topic}
${reference ? `\n## 참고 자료\n아래는 시나리오 작성에 참고할 자료입니다. 이 내용을 기반으로 주제에 맞게 각색하여 시나리오를 작성하세요. 참고 자료의 구조나 표현을 그대로 사용하지 말고, 영상 나레이션에 적합한 형태로 재구성하세요.\n\n${reference}` : ''}

## 출력 구조 (JSON)
{
  "scenes": [
    {
      "sceneNumber": 1,
      "timeRange": "0:00~1:00",
      "narration": "나레이션 텍스트 (한국어, 정확히 432~444자)",
      "narrationCharCount": 438,
      "narrationKeywords": ["keyword1", "keyword2", "keyword3"],
      "storyPhase": "도입",
      "mood": "분위기 (한국어, 2~3단어)",
      "cameraAngle": "medium shot",
      "lightingMood": "warm golden hour sunlight"
    }
  ],
  "metadata": {
    "title": "영상 제목",
    "synopsis": "3줄 요약",
    "totalScenes": ${totalScenes},
    "estimatedDuration": "${duration}분"
  },
  "mainCharacters": [
    {
      "name": "한국어 호칭 (예: '사장님', '재현')",
      "gender": "female | male | unspecified",
      "ageGroup": "예: '30대 후반'",
      "appearance": "외모 묘사 (한국어, 머리·체형·인상 등 구체적으로)",
      "outfit": "복장 묘사 (한국어, 상의·하의·소품 등)",
      "role": "main | supporting"
    }
  ]
}`;
}

// ─── Pass 2: 나레이션 기반 이미지 프롬프트 생성 ──────
function buildPass2Prompt(pass1Result: Pick<Pass1Result, 'scenes'>, perScene: number, mainCharacters?: Pass1Character[]): string {
  const sceneSummaries = pass1Result.scenes.map((s) =>
    `[씬 ${s.sceneNumber}]
- 나레이션 전문: ${s.narration}
- 키워드: ${(s.narrationKeywords || []).join(', ')}
- 스토리 단계: ${s.storyPhase}
- 분위기: ${s.mood}
- 카메라: ${s.cameraAngle || 'medium shot'}
- 조명: ${s.lightingMood || 'neutral'}`
  ).join('\n\n');

  // 캐릭터 바이블 — 배치 간 일관성 핵심 보강 장치
  const characterBible = (mainCharacters && mainCharacters.length > 0) ? `
## ⚠️ 캐릭터 바이블 — 절대 변경 금지
다음은 본 시나리오의 메인 인물입니다. 모든 씬의 모든 이미지 프롬프트에서 이 외모/복장이 **정확히 일치**해야 합니다.

${mainCharacters.map((c, i) => `[${i + 1}] ${c.name} (${c.gender === 'female' ? '여성' : c.gender === 'male' ? '남성' : '미지정'}, ${c.ageGroup})
- 외모: ${c.appearance}
- 복장: ${c.outfit}`).join('\n\n')}

[준수 규칙]
- 이미지 프롬프트의 인물 묘사는 위 바이블과 완전히 일치해야 함
- 성별·나이대를 임의로 변경하지 말 것 (예: "여성"으로 등록된 인물을 "남성"으로 묘사하면 즉시 실패)
- 일반 명사("사장님", "직장인" 등)로 나레이션이 지칭하는 인물도 위 바이블 인물 중 하나로 매핑하여 묘사
- 옷차림은 씬마다 동일 유지 (시간대/장소 바뀌어도 바이블 옷차림 우선)
` : '';

  const countInstruction = perScene === 1
    ? `각 씬마다 정확히 1개의 이미지 프롬프트를 생성하세요. 이 프롬프트는 씬 전체(60초)를 대표하는 시각적 핵심 순간을 담아야 합니다.`
    : `각 씬마다 정확히 ${perScene}개의 이미지 프롬프트를 생성하세요. 이 ${perScene}개는 씬의 60초 나레이션을 ${Math.round(60 / perScene)}초씩 균등하게 시간순으로 나눈 각 구간의 시각적 핵심 순간을 담아야 합니다.

⚠️ 중요 — ${perScene}개 프롬프트 작성 시 지킬 점:
1. 시간 흐름: 1번째는 도입(처음 ${Math.round(60 / perScene)}초), 2번째는 전환(중간 ${Math.round(60 / perScene)}초), ${perScene === 3 ? '3번째는 마무리(마지막 20초)' : `${perScene}번째는 마무리`} — 나레이션 시간 흐름과 일치하도록 배치
2. 시각적 연속성: 같은 씬의 ${perScene}장은 같은 환경/캐릭터/스타일을 유지하며, 카메라 위치·동작·표정·상황만 변화
3. 다양성: ${perScene}장이 거의 동일하지 않도록 카메라 앵글, 동작, 표정, 시선 등에 변화를 두기
4. 나레이션과 동기: 각 프롬프트는 해당 시간대의 나레이션 내용을 시각화해야 함`;

  return `당신은 AI 이미지 생성 전문가입니다.
아래 시나리오의 각 씬에 대해 고품질 이미지 프롬프트를 **한국어**로 생성하세요.
${characterBible}
## 생성 개수 규칙
${countInstruction}

## 이미지 프롬프트 작성 필수 규칙

### 언어
- **반드시 한국어로 작성하세요.** 영어 단어는 사용하지 마세요.
- 단, 카메라/조명 등 영문 기술용어가 자연스러운 경우 한국어 풀어쓰기로 대체 (예: "low angle" → "로우 앵글", "golden hour" → "황금빛 일몰녘")

### 구조 (반드시 이 순서를 따르세요)
1. **주체**: 누가/무엇이 화면 중심인지 (인물 외형, 표정, 자세 상세 묘사)
2. **행동/상태**: 무엇을 하고 있는지 (구체적 동작)
3. **배경/장소**: 어디에 있는지 (장소 + 주변 소품/환경 디테일)
4. **분위기/조명**: 빛, 색감, 날씨, 시간대
5. **카메라 앵글**: 촬영 각도와 거리
6. **아트 스타일**: 애니메이션 세부 스타일

### 금지사항 — ⚠️ 절대 지킬 것
- ❌ **키워드 콤마 나열 금지**: "강남역, 직장인, 네온사인, 야간 출근" 같은 짧은 단어 나열은 절대 안 됨
- ❌ **영어 단어 나열 금지**: "salaryman, gangnam station, neon signs" 같은 영어 나열은 절대 안 됨
- ❌ **80자 미만의 짧은 응답 절대 금지** — 200자 이상의 완성된 한국어 문장으로 작성
- ❌ 화면 안에 글자/문자/자막/워터마크/로고가 보이는 묘사 금지
- ❌ 프롬프트에 "글자", "문자", "자막", "텍스트", "로고", "워터마크" 같은 단어가 들어가지 않도록 작성

### 품질 규칙 (반드시 모두 지킬 것)
- **길이**: 한국어 기준 정확히 200~450자. 짧으면 즉시 실패로 간주
- **형식**: 완전한 문장으로 구성된 단락. 절대 콤마로 단어를 나열하지 말 것
- 구체적 형용사 사용 (좋음: "낡고 이끼가 낀 돌담" / 나쁨: "오래된 벽")
- 색상 팔레트 명시 (예: "차분한 흙빛 톤에 진홍색 포인트")
- 질감/재질 묘사 포함 (예: "윤기 나는 대리석 바닥에 비친 빛")
- 나레이션 키워드 3개 이상을 반드시 시각적으로 포함

### 잘못된 예시 vs 올바른 예시

❌ **나쁨 (절대 금지)**: "exhausted salaryman, Gangnam station, neon signs, night commute, loneliness"
❌ **나쁨 (절대 금지)**: "keyword pool, search results, Naver algorithm, local shop, ranking list"
✅ **좋음**: "20대 후반의 지친 직장인이 구겨진 짙은 네이비 정장에 풀어진 넥타이 차림으로, 비에 젖은 강남역 앞 횡단보도에 홀로 서 있다. 오른손에는 서류가방이 힘없이 늘어져 있고, 흐릿하게 보이는 수많은 사람들이 그의 옆을 빠르게 지나간다. 거대한 네온 광고판들이 젖은 아스팔트에 다채로운 색의 반사를 만들어내고, 차가운 파란빛과 보랏빛 환경광에 따뜻한 주황과 분홍 네온 강조색이 어우러진다. 살짝 위를 올려다보는 로우 앵글 미디엄 샷, 디테일한 애니메이션 스타일에 사실적인 음영, 분위기 있는 옅은 안개, 시네마틱 피사계심도, 톤다운된 색감에 선명한 네온 하이라이트."

${perScene > 1 ? `### 시간 구간별 차별화 예시 (${perScene}개 프롬프트 작성 시 필수 참고)

나레이션: "퇴근길 강남역 앞, 지친 직장인이 네온사인 아래에서 한숨을 쉰다. 잠시 멈춰 서서 하늘을 올려다본다. 다시 발걸음을 옮긴다."

✅ **1번째 (0~20초)**: "20대 후반의 지친 직장인이 구겨진 짙은 네이비 정장 차림으로 강남역 앞 인도에 서서 깊은 한숨을 내쉬고 있다. 어깨가 무겁게 처져 있고 시선은 발끝을 향한다. 머리 위로 거대한 네온 광고판이 보랏빛과 분홍빛으로 점멸하고, 비에 젖은 아스팔트가 그 빛을 반사한다. 차가운 파란 환경광과 따뜻한 네온이 대비를 이루며, 정면에서 약간 옆을 바라보는 미디엄 샷. 디테일한 애니메이션 스타일에 사실적인 음영, 옅은 안개."

✅ **2번째 (20~40초)**: "같은 직장인이 잠시 멈춰 서서 고개를 들어 밤하늘을 올려다본다. 표정에는 피로와 함께 잠깐의 멍한 감정이 어려 있다. 카메라는 그의 뒷모습 어깨 너머로 위를 향하며, 네온 광고판 사이로 흐릿한 별빛이 보이는 좁은 하늘을 잡는다. 같은 강남역 거리, 같은 옷차림, 같은 색감 팔레트(차가운 파랑과 따뜻한 네온)지만, 카메라 각도는 로우 앵글로 상승. 디테일한 애니메이션 스타일."

✅ **3번째 (40~60초)**: "같은 직장인이 어깨를 살짝 펴고 다시 한 걸음 내딛으며 인파 속으로 걸어 들어간다. 표정은 여전히 피곤하지만 결연함이 비친다. 흐릿한 행인들이 그의 양옆을 스쳐 지나가고, 네온 광고판은 뒤로 멀어진다. 카메라는 정면에서 그의 걷는 모습을 잡는 트래킹 미디엄 샷, 살짝 뒤로 빠지며. 같은 환경/캐릭터/색감 유지, 차가운 파란빛과 네온 강조색. 디테일한 애니메이션 스타일에 시네마틱 피사계심도."

→ 3장이 모두 **같은 캐릭터/옷차림/환경/스타일**이지만, **자세·표정·카메라 앵글·시선·동작이 다른** 것이 핵심입니다.` : ''}

## 씬 정보
${sceneSummaries}

## 출력 구조 (JSON)
{
  "scenePrompts": [
    {
      "sceneNumber": 1,
      "imagePrompts": [
        "${perScene === 1 ? '씬 전체를 대표하는 1개 프롬프트 (한국어, 200~450자)' : `1번째 (0~${Math.round(60 / perScene)}초) 프롬프트 (한국어, 200~450자)`}"${perScene > 1 ? `,
        "2번째 (${Math.round(60 / perScene)}~${Math.round(60 / perScene * 2)}초) 프롬프트 (한국어, 200~450자)"` : ''}${perScene > 2 ? `,
        "3번째 (${Math.round(60 / perScene * 2)}~60초) 프롬프트 (한국어, 200~450자)"` : ''}
      ]
    }
  ]
}`;
}

// ─── Pass 1 JSON Schema ──────────────────────────────
const pass1Schema = {
  type: Type.OBJECT,
  properties: {
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneNumber: { type: Type.NUMBER, description: '씬 번호 (1부터)' },
          timeRange: { type: Type.STRING, description: '시간 범위 (예: 0:00~1:00)' },
          narration: { type: Type.STRING, description: '나레이션 텍스트 (한국어, 432~444자, 6구간×72~74자)' },
          narrationCharCount: { type: Type.NUMBER, description: '나레이션 글자 수' },
          narrationKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: '시각화 핵심 키워드 (영어, 3~5개)' },
          storyPhase: { type: Type.STRING, description: '스토리 단계: 도입/전개/심화/절정/마무리' },
          mood: { type: Type.STRING, description: '분위기 (한국어, 2~3단어)' },
          cameraAngle: { type: Type.STRING, description: '카메라 앵글 (영어)' },
          lightingMood: { type: Type.STRING, description: '조명/분위기 (영어)' },
        },
        required: ['sceneNumber', 'timeRange', 'narration', 'narrationCharCount', 'narrationKeywords', 'storyPhase', 'mood', 'cameraAngle', 'lightingMood'],
      },
    },
    metadata: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: '영상 제목' },
        synopsis: { type: Type.STRING, description: '3줄 요약' },
        totalScenes: { type: Type.NUMBER, description: '총 씬 수' },
        estimatedDuration: { type: Type.STRING, description: '예상 길이' },
      },
      required: ['title', 'synopsis', 'totalScenes', 'estimatedDuration'],
    },
    mainCharacters: {
      type: Type.ARRAY,
      description: '시나리오에 반복 등장하는 메인 인물 1~3명 (캐릭터 바이블)',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: '한국어 호칭 (예: 사장님, 재현)' },
          gender: { type: Type.STRING, description: 'female | male | unspecified' },
          ageGroup: { type: Type.STRING, description: '나이대 (예: 30대 후반)' },
          appearance: { type: Type.STRING, description: '외모 묘사 (한국어)' },
          outfit: { type: Type.STRING, description: '복장 묘사 (한국어)' },
          role: { type: Type.STRING, description: 'main | supporting' },
        },
        required: ['name', 'gender', 'ageGroup', 'appearance', 'outfit'],
      },
    },
  },
  required: ['scenes', 'metadata', 'mainCharacters'],
};

// ─── Pass 2 JSON Schema ──────────────────────────────
const pass2Schema = {
  type: Type.OBJECT,
  properties: {
    scenePrompts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneNumber: { type: Type.NUMBER, description: '씬 번호' },
          imagePrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '씬당 1개 또는 3개의 상세 이미지 프롬프트 (영어, 각 80~150단어). 시간 흐름순으로 배열',
          },
        },
        required: ['sceneNumber', 'imagePrompts'],
      },
    },
  },
  required: ['scenePrompts'],
};

// ─── Pass 2 응답 검증 (잘린/부실한 응답 감지) ──────
function validatePass2Result(pass2Result: Pass2Result | null | undefined, expectedScenes: number[], perScene: number): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const scenePrompts = pass2Result?.scenePrompts || [];
  const returnedScenes = new Set(scenePrompts.map(sp => sp.sceneNumber));

  for (const sceneNum of expectedScenes) {
    if (!returnedScenes.has(sceneNum)) {
      issues.push(`scene ${sceneNum}: 누락`);
      continue;
    }
    const sp = scenePrompts.find(x => x.sceneNumber === sceneNum);
    const prompts = Array.isArray(sp?.imagePrompts) ? sp!.imagePrompts : [];
    if (prompts.length < perScene) {
      issues.push(`scene ${sceneNum}: ${prompts.length}/${perScene}개`);
    }
    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i];
      if (typeof p !== 'string' || p.length < 100) {
        issues.push(`scene ${sceneNum} prompt ${i}: ${typeof p === 'string' ? p.length : 0}자 (100자 미만)`);
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

// ─── Gemini 2-pass 실행 (Pass 2는 토큰 한도 회피 위해 배치 병렬) ──
async function generateWithGemini(aiClient: any, textModel: string, topic: string, duration: number, totalScenes: number, reference: string, perScene: number) {
  // Pass 1: 나레이션 + 스토리 구조 (전체 씬 한 번에)
  const pass1Prompt = buildPass1Prompt(topic, duration, totalScenes, reference);
  const pass1Response = await callGeminiWithRetry<any>(
    () => aiClient.models.generateContent({
      model: textModel,
      contents: pass1Prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: pass1Schema,
        maxOutputTokens: PASS1_MAX_TOKENS,
        ...getThinkingConfig(textModel),
      },
    }),
    { label: 'longform-scenario-pass1' },
  );
  const pass1Text = pass1Response.text!;
  log.info('Pass 1 응답 길이', { chars: pass1Text.length });
  const pass1Result = JSON.parse(pass1Text) as Pass1Result;

  // Pass 1 나레이션 길이 검증 (디버깅 로그)
  for (const s of (pass1Result.scenes || [])) {
    const narLen = (s.narration || '').length;
    if (narLen < 400) {
      log.warn(`Pass 1 씬 ${s.sceneNumber} 나레이션 짧음`, { length: narLen, target: '432~444' });
    }
  }

  // Pass 2: 적응형 배치 — 가능하면 단일 호출(일관성 최대), 한도 초과 시에만 배치
  const scenes: Pass1Scene[] = pass1Result.scenes || [];
  const batchSize = computeBatchSize(scenes.length, perScene);
  const batches: Pass1Scene[][] = [];
  for (let i = 0; i < scenes.length; i += batchSize) {
    batches.push(scenes.slice(i, i + batchSize));
  }
  log.info('Pass 2 배치 실행', { totalScenes: scenes.length, batchCount: batches.length, batchSize, perScene });

  const batchResults = await Promise.all(batches.map(async (batch, batchIdx): Promise<Pass2Result> => {
    const expectedScenes = batch.map(s => s.sceneNumber);
    const partialPass1 = { scenes: batch };
    // 모든 배치에 동일 캐릭터 바이블 주입 → 배치 간 인물 일관성 유지
    const pass2Prompt = buildPass2Prompt(partialPass1, perScene, pass1Result.mainCharacters);

    const pass2Response = await callGeminiWithRetry<any>(
      () => aiClient.models.generateContent({
        model: textModel,
        contents: pass2Prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: pass2Schema,
          maxOutputTokens: PASS2_MAX_TOKENS,
          ...getThinkingConfig(textModel),
        },
      }),
      { label: `longform-scenario-pass2-batch${batchIdx + 1}/${batches.length}` },
    );
    const text = pass2Response.text!;
    const parsed = JSON.parse(text) as Pass2Result;
    const validation = validatePass2Result(parsed, expectedScenes, perScene);
    log.info(`Pass 2 배치 ${batchIdx + 1}/${batches.length} 응답`, {
      chars: text.length,
      scenes: expectedScenes,
      returned: (parsed.scenePrompts || []).length,
      ok: validation.ok,
      ...(validation.ok ? {} : { issues: validation.issues }),
    });
    return parsed;
  }));

  // 모든 배치의 scenePrompts 병합
  const allScenePrompts = batchResults.flatMap(r => r.scenePrompts || []);
  return { pass1Result, pass2Result: { scenePrompts: allScenePrompts } as Pass2Result };
}

// ─── OpenAI 2-pass 실행 (Pass 2 배치 병렬) ─────────
async function generateWithOpenAI(openaiKey: string, textModel: string, topic: string, duration: number, totalScenes: number, reference: string, perScene: number) {
  const systemPrompt = 'You are a professional YouTube video scenario writer. Always respond with valid JSON matching the requested structure. Write narrations in Korean (각 씬 정확히 432~444자) and everything else in the specified language.';

  // Pass 1
  const pass1Prompt = buildPass1Prompt(topic, duration, totalScenes, reference);
  const pass1Text = await generateTextWithOpenAI(openaiKey, textModel, pass1Prompt, {
    systemPrompt,
    jsonMode: true,
  });
  log.info('Pass 1 응답 길이 (OpenAI)', { chars: pass1Text.length });
  const pass1Result = JSON.parse(pass1Text) as Pass1Result;

  for (const s of (pass1Result.scenes || [])) {
    const narLen = (s.narration || '').length;
    if (narLen < 400) {
      log.warn(`Pass 1 씬 ${s.sceneNumber} 나레이션 짧음`, { length: narLen, target: '432~444' });
    }
  }

  // Pass 2: 적응형 배치 (OpenAI도 동일 정책)
  const scenes: Pass1Scene[] = pass1Result.scenes || [];
  const batchSize = computeBatchSize(scenes.length, perScene);
  const batches: Pass1Scene[][] = [];
  for (let i = 0; i < scenes.length; i += batchSize) {
    batches.push(scenes.slice(i, i + batchSize));
  }
  log.info('Pass 2 배치 실행 (OpenAI)', { totalScenes: scenes.length, batchCount: batches.length, batchSize, perScene });

  const batchResults = await Promise.all(batches.map(async (batch, batchIdx): Promise<Pass2Result> => {
    const expectedScenes = batch.map(s => s.sceneNumber);
    const partialPass1 = { scenes: batch };
    const pass2Prompt = buildPass2Prompt(partialPass1, perScene, pass1Result.mainCharacters);
    const text = await generateTextWithOpenAI(openaiKey, textModel, pass2Prompt, {
      systemPrompt: 'You are an expert AI image prompt engineer. Always respond with valid JSON. Write all image prompts in **Korean (한국어)** as complete sentences (200-450 characters), NOT as comma-separated keyword lists. Follow the exact structure and quality rules specified in the user message.',
      jsonMode: true,
    });
    const parsed = JSON.parse(text) as Pass2Result;
    const validation = validatePass2Result(parsed, expectedScenes, perScene);
    log.info(`Pass 2 배치 ${batchIdx + 1}/${batches.length} 응답 (OpenAI)`, {
      chars: text.length,
      scenes: expectedScenes,
      returned: (parsed.scenePrompts || []).length,
      ok: validation.ok,
      ...(validation.ok ? {} : { issues: validation.issues }),
    });
    return parsed;
  }));

  const allScenePrompts = batchResults.flatMap(r => r.scenePrompts || []);
  return { pass1Result, pass2Result: { scenePrompts: allScenePrompts } as Pass2Result };
}

// ─── 결과 병합 ──────────────────────────────────────
function mergeResults(pass1: Pass1Result, pass2: Pass2Result, perScene: number) {
  // Pass2의 이미지 프롬프트 배열을 씬 번호로 매핑
  const promptMap = new Map<number, string[]>();
  for (const sp of (pass2.scenePrompts || [])) {
    // imagePrompts 배열 우선, 구버전 호환 위해 imagePrompt(단수) 단일 값도 흡수
    const prompts: string[] = Array.isArray(sp.imagePrompts)
      ? sp.imagePrompts
      : (typeof sp.imagePrompt === 'string' ? [sp.imagePrompt] : []);
    promptMap.set(sp.sceneNumber, prompts);
  }

  return {
    id: crypto.randomUUID(),
    scenes: pass1.scenes.map((scene, index) => {
      const sceneNum = scene.sceneNumber || index + 1;
      // 폴백: Pass 2가 실패해도 영어 키워드 나열이 아닌, 의미있는 한국어 나레이션 텍스트 사용
      const narrationFallback = (scene.narration || scene.narrationKeywords?.join(', ') || '').slice(0, 300);
      const rawPrompts = promptMap.get(sceneNum) || [];

      // 정확히 perScene 개 보장 — 부족하면 마지막을 복제, 넘치면 자르기
      const prompts: string[] = [];
      for (let i = 0; i < perScene; i++) {
        prompts.push(rawPrompts[i] || rawPrompts[rawPrompts.length - 1] || narrationFallback);
      }

      const subScenes = prompts.map(prompt => ({
        imagePrompt: prompt,
        imageStatus: 'pending' as const,
      }));

      return {
        id: crypto.randomUUID(),
        sceneNumber: sceneNum,
        timeRange: scene.timeRange || `${index}:00~${index + 1}:00`,
        narrationKeywords: scene.narrationKeywords || [],
        narration: scene.narration,
        narrationCharCount: scene.narration?.length || 0,
        storyPhase: scene.storyPhase || '전개',
        mood: scene.mood || '중립',
        cameraAngle: scene.cameraAngle || 'medium shot',
        lightingMood: scene.lightingMood || 'neutral ambient lighting',
        narrationStatus: 'pending',

        // 신규 모델
        subScenes,

        // Legacy 동기화 (subScenes[0]과 매칭)
        imagePrompt: subScenes[0].imagePrompt,
        imageStatus: 'pending',
      };
    }),
    metadata: pass1.metadata,
    // Pass 1이 추출한 메인 캐릭터를 scenario.characters로 자동 변환
    // Step 3 패스해도 캐릭터 정보가 다운스트림에 흘러감
    characters: (pass1.mainCharacters || []).map((c, idx) => {
      // 모든 씬에 등장한다고 가정 (메인 캐릭터)
      const allSceneNumbers = pass1.scenes.map((s, i) => s.sceneNumber || i + 1);
      return {
        id: crypto.randomUUID(),
        name: c.name || `인물 ${idx + 1}`,
        nameEn: (c.name || `Character${idx + 1}`).replace(/\s+/g, '_'),
        role: c.role === 'supporting' ? 'supporting' : 'main',
        // 영문 영역에 한국어를 그대로 넣음 — Pass3(buildImagePrompt)에서 그대로 사용
        appearanceDescription: c.appearance || '',
        outfit: c.outfit || '',
        personality: `${c.gender === 'female' ? '여성' : c.gender === 'male' ? '남성' : ''} ${c.ageGroup || ''}`.trim(),
        sceneNumbers: allSceneNumbers,
        imageStatus: 'pending',
      };
    }),
    createdAt: Date.now(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin as string);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = requireAuth(req);
  if (!auth.authenticated || !auth.userId) {
    return res.status(401).json({ error: auth.error || '로그인이 필요합니다.' });
  }

  try {
    const { topic, duration, referenceText, imageFrequency } = req.body as GenerateLongformRequest;

    if (!topic || !duration) {
      return res.status(400).json({ error: 'topic and duration are required' });
    }

    const sanitizedTopic = sanitizePrompt(topic, 200);
    const sanitizedReference = referenceText ? sanitizePrompt(referenceText, 5000) : '';
    const totalScenes = duration;
    // 시나리오는 항상 MODELS.TEXT (Gemini 3 Pro) 고정 — 사용자 textModel 무시
    const textModel = MODELS.TEXT;
    const perScene = subImagesPerScene(imageFrequency);

    let pass1Result: Pass1Result;
    let pass2Result: Pass2Result;

    if (isOpenAIModel(textModel)) {
      const openaiKey = await getOpenAIKeyForUser(auth.userId);
      ({ pass1Result, pass2Result } = await generateWithOpenAI(openaiKey, textModel, sanitizedTopic, duration, totalScenes, sanitizedReference, perScene));
    } else {
      const aiClient = await getAIClientForUser(auth.userId);
      ({ pass1Result, pass2Result } = await generateWithGemini(aiClient, textModel, sanitizedTopic, duration, totalScenes, sanitizedReference, perScene));
    }

    const result = mergeResults(pass1Result, pass2Result, perScene);

    return res.status(200).json({ scenario: result });
  } catch (e) {
    console.error('[longform/generate-scenario] Error:', e);
    const detail = parseGeminiError(e);
    const isTransient = detail.isRetryable;
    const rawMessage = e instanceof Error ? e.message : 'Unknown error';

    return res.status(isTransient ? 503 : 500).json({
      error: isTransient
        ? detail.userMessage
        : `Longform scenario generation failed: ${rawMessage}`,
      code: isTransient ? detail.code : 'GENERATION_FAILED',
      retryable: isTransient,
    });
  }
}
