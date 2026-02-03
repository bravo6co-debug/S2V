import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth.js';
import { getAIClientForUser, getUserTextModel, getThinkingConfig, sanitizePrompt, setCorsHeaders, Type } from '../lib/gemini.js';
import { isOpenAIModel, getOpenAIKeyForUser, generateTextWithOpenAI } from '../lib/openai.js';

interface GenerateLongformRequest {
  topic: string;
  duration: number;
  textModel?: string;
  referenceText?: string;
}

// ─── Pass 1: 나레이션 + 스토리 구조 생성 ────────────
function buildPass1Prompt(topic: string, duration: number, totalScenes: number, reference: string): string {
  return `당신은 YouTube 롱폼 영상의 시나리오 작가입니다.
주어진 주제로 ${duration}분 길이의 영상 시나리오를 작성합니다.

## [1단계] 나레이션 및 스토리 구조 생성

이 단계에서는 나레이션과 스토리 구조만 생성합니다. 이미지 프롬프트는 생성하지 않습니다.

## 규칙
1. 본편은 ${totalScenes}개의 씬으로 구성 (각 씬 = 1분)
2. ⚠️ [최우선 규칙] 나레이션 글자수 — 반드시 아래 규칙을 지켜야 합니다:
   - 각 씬의 나레이션은 정확히 6개 구간으로 구성됩니다 (10초 × 6 = 60초 = 1분)
   - 각 구간은 띄어쓰기 포함 72~74자입니다
   - 따라서 총 글자수는 432~444자 (6 × 72~74)
   - 글자수가 432자 미만이거나 444자를 초과하면 절대 안 됩니다
   - 글자수를 맞추기 위해 형용사, 부사, 접속사 등을 조절하세요
3. 스토리 구조: 도입(~20%) → 전개(~25%) → 심화(~25%) → 절정(~20%) → 마무리(~10%)
4. 나레이션은 자연스러운 한국어, 다큐멘터리/설명 톤
5. 나레이션 작성 후 반드시 글자수를 세서 432~444자 범위인지 검증하세요
6. 각 씬에서 나레이션의 핵심 시각화 키워드를 3~5개 추출하세요 (영어)
7. 각 씬의 분위기, 카메라 앵글, 조명/분위기를 지정하세요

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
  }
}`;
}

// ─── Pass 2: 나레이션 기반 이미지 프롬프트 생성 ──────
function buildPass2Prompt(pass1Result: any): string {
  const sceneSummaries = pass1Result.scenes.map((s: any) =>
    `[씬 ${s.sceneNumber}]
- 나레이션 요약: ${s.narration.substring(0, 100)}...
- 키워드: ${(s.narrationKeywords || []).join(', ')}
- 스토리 단계: ${s.storyPhase}
- 분위기: ${s.mood}
- 카메라: ${s.cameraAngle || 'medium shot'}
- 조명: ${s.lightingMood || 'neutral'}`
  ).join('\n\n');

  return `당신은 AI 이미지 생성 전문가입니다.
아래 시나리오의 각 씬에 대해 고품질 이미지 프롬프트를 생성하세요.

## 이미지 프롬프트 작성 필수 규칙

### 구조 (반드시 이 순서를 따르세요):
1. **주체 (Subject)**: 누가/무엇이 화면 중심인지 (인물 외형, 표정, 자세 상세 묘사)
2. **행동/상태 (Action)**: 무엇을 하고 있는지 (동사 + 구체적 동작)
3. **배경/장소 (Setting)**: 어디에 있는지 (장소 + 주변 소품/환경 디테일)
4. **분위기/조명 (Atmosphere)**: 빛, 색감, 날씨, 시간대
5. **카메라 앵글 (Camera)**: 촬영 각도와 거리
6. **아트 스타일 (Style)**: 애니메이션 세부 스타일 지정

### 금지사항:
- 텍스트, 글자, 자막, 워터마크, 로고 절대 포함 금지
- "text", "words", "letters", "subtitle", "watermark" 등의 단어 사용 금지

### 품질 규칙:
- 프롬프트 길이: 최소 80단어, 최대 150단어
- 구체적 형용사 사용 (좋음: "crumbling moss-covered stone wall" / 나쁨: "old wall")
- 색상 팔레트 명시 (예: "muted earth tones with pops of crimson")
- 질감/재질 묘사 포함 (예: "polished marble floor reflecting light")
- 나레이션 키워드 3개 이상을 반드시 시각적으로 포함

### 예시:
나레이션 키워드: ["exhausted salaryman", "Gangnam station", "neon signs", "night commute"]
→ "A young exhausted salaryman in a wrinkled dark navy suit with loosened tie, standing alone at a rain-soaked crosswalk near Gangnam station, briefcase hanging limply from his right hand, hundreds of blurred commuters rushing past him, towering neon advertising signs casting colorful reflections on the wet asphalt, cool blue and purple ambient lighting with warm orange and pink neon accents, low angle medium shot looking slightly upward, detailed anime style with realistic shading, atmospheric fog, and cinematic depth of field, muted desaturated color palette with vibrant neon highlights"

## 씬 정보
${sceneSummaries}

## 출력 구조 (JSON)
{
  "scenePrompts": [
    {
      "sceneNumber": 1,
      "imagePrompt": "상세한 이미지 프롬프트 (영어, 80~150단어, 위 구조 준수)"
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
  },
  required: ['scenes', 'metadata'],
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
          imagePrompt: { type: Type.STRING, description: '상세 이미지 프롬프트 (영어, 80~150단어)' },
        },
        required: ['sceneNumber', 'imagePrompt'],
      },
    },
  },
  required: ['scenePrompts'],
};

// ─── Gemini 2-pass 실행 ─────────────────────────────
async function generateWithGemini(aiClient: any, textModel: string, topic: string, duration: number, totalScenes: number, reference: string) {
  // Pass 1: 나레이션 + 스토리 구조
  const pass1Prompt = buildPass1Prompt(topic, duration, totalScenes, reference);
  const pass1Response = await aiClient.models.generateContent({
    model: textModel,
    contents: pass1Prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: pass1Schema,
      ...getThinkingConfig(textModel),
    },
  });
  const pass1Result = JSON.parse(pass1Response.text!);

  // Pass 2: 나레이션 기반 이미지 프롬프트 생성
  const pass2Prompt = buildPass2Prompt(pass1Result);
  const pass2Response = await aiClient.models.generateContent({
    model: textModel,
    contents: pass2Prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: pass2Schema,
      ...getThinkingConfig(textModel),
    },
  });
  const pass2Result = JSON.parse(pass2Response.text!);

  return { pass1Result, pass2Result };
}

// ─── OpenAI 2-pass 실행 ─────────────────────────────
async function generateWithOpenAI(openaiKey: string, textModel: string, topic: string, duration: number, totalScenes: number, reference: string) {
  const systemPrompt = 'You are a professional YouTube video scenario writer. Always respond with valid JSON matching the requested structure. Write narrations in Korean and everything else in the specified language.';

  // Pass 1: 나레이션 + 스토리 구조
  const pass1Prompt = buildPass1Prompt(topic, duration, totalScenes, reference);
  const pass1Text = await generateTextWithOpenAI(openaiKey, textModel, pass1Prompt, {
    systemPrompt,
    jsonMode: true,
  });
  const pass1Result = JSON.parse(pass1Text);

  // Pass 2: 나레이션 기반 이미지 프롬프트 생성
  const pass2Prompt = buildPass2Prompt(pass1Result);
  const pass2Text = await generateTextWithOpenAI(openaiKey, textModel, pass2Prompt, {
    systemPrompt: 'You are an expert AI image prompt engineer. Always respond with valid JSON. Write all image prompts in English, following the exact structure and quality rules specified.',
    jsonMode: true,
  });
  const pass2Result = JSON.parse(pass2Text);

  return { pass1Result, pass2Result };
}

// ─── 결과 병합 ──────────────────────────────────────
function mergeResults(pass1: any, pass2: any) {
  // Pass2의 이미지 프롬프트를 씬 번호로 매핑
  const promptMap = new Map<number, string>();
  for (const sp of (pass2.scenePrompts || [])) {
    promptMap.set(sp.sceneNumber, sp.imagePrompt);
  }

  return {
    id: crypto.randomUUID(),
    scenes: pass1.scenes.map((scene: any, index: number) => ({
      id: crypto.randomUUID(),
      sceneNumber: scene.sceneNumber || index + 1,
      timeRange: scene.timeRange || `${index}:00~${index + 1}:00`,
      imagePrompt: promptMap.get(scene.sceneNumber || index + 1) || scene.narrationKeywords?.join(', ') || '',
      narrationKeywords: scene.narrationKeywords || [],
      narration: scene.narration,
      narrationCharCount: scene.narration?.length || 0,
      storyPhase: scene.storyPhase || '전개',
      mood: scene.mood || '중립',
      cameraAngle: scene.cameraAngle || 'medium shot',
      lightingMood: scene.lightingMood || 'neutral ambient lighting',
      imageStatus: 'pending',
      narrationStatus: 'pending',
    })),
    metadata: pass1.metadata,
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
    const { topic, duration, textModel: requestTextModel, referenceText } = req.body as GenerateLongformRequest;

    if (!topic || !duration) {
      return res.status(400).json({ error: 'topic and duration are required' });
    }

    const sanitizedTopic = sanitizePrompt(topic, 200);
    const sanitizedReference = referenceText ? sanitizePrompt(referenceText, 5000) : '';
    const totalScenes = duration;
    const textModel = requestTextModel || await getUserTextModel(auth.userId);

    let pass1Result: any;
    let pass2Result: any;

    if (isOpenAIModel(textModel)) {
      const openaiKey = await getOpenAIKeyForUser(auth.userId);
      ({ pass1Result, pass2Result } = await generateWithOpenAI(openaiKey, textModel, sanitizedTopic, duration, totalScenes, sanitizedReference));
    } else {
      const aiClient = await getAIClientForUser(auth.userId);
      ({ pass1Result, pass2Result } = await generateWithGemini(aiClient, textModel, sanitizedTopic, duration, totalScenes, sanitizedReference));
    }

    const result = mergeResults(pass1Result, pass2Result);

    return res.status(200).json({ scenario: result });
  } catch (e) {
    console.error('[longform/generate-scenario] Error:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return res.status(500).json({
      error: `Longform scenario generation failed: ${errorMessage}`,
      code: 'GENERATION_FAILED',
    });
  }
}
