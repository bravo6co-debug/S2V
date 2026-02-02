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
    const totalScenes = duration - 1;
    // 요청 모델 우선, 없으면 설정 모델 폴백
    const textModel = requestTextModel || await getUserTextModel(auth.userId);

    const prompt = `당신은 YouTube 롱폼 영상의 시나리오 작가입니다.
주어진 주제로 ${duration}분 길이의 영상 시나리오를 작성합니다.

## 규칙
1. 이미지 스타일은 "애니메이션" 고정
2. 후킹 시나리오: 본편과 관련되지만 시청자의 호기심을 극도로 자극하는 충격적/궁금증 유발 장면 (10초)
3. 본편은 ${totalScenes}개의 씬으로 구성
4. ⚠️ [최우선 규칙] 나레이션 글자수 — 반드시 아래 규칙을 지켜야 합니다:
   - 각 씬의 나레이션은 정확히 6개 구간으로 구성됩니다 (10초 × 6 = 60초 = 1분)
   - 각 구간은 띄어쓰기 포함 72~74자입니다
   - 따라서 총 글자수는 432~444자 (6 × 72~74)
   - 글자수가 432자 미만이거나 444자를 초과하면 절대 안 됩니다
   - 글자수를 맞추기 위해 형용사, 부사, 접속사 등을 조절하세요
5. 스토리 구조: 도입(~20%) → 전개(~25%) → 심화(~25%) → 절정(~20%) → 마무리(~10%)
6. 각 씬의 이미지 프롬프트는 영어로, 애니메이션 스타일로 상세히 기술
7. 이미지 프롬프트에 텍스트/글자/워터마크 포함 금지
8. 나레이션은 자연스러운 한국어, 다큐멘터리/설명 톤
9. 나레이션 작성 후 반드시 글자수를 세서 432~444자 범위인지 검증하세요

## 주제
${sanitizedTopic}
${sanitizedReference ? `\n## 참고 자료\n아래는 시나리오 작성에 참고할 자료입니다. 이 내용을 기반으로 주제에 맞게 각색하여 시나리오를 작성하세요. 참고 자료의 구조나 표현을 그대로 사용하지 말고, 영상 나레이션에 적합한 형태로 재구성하세요.\n\n${sanitizedReference}` : ''}

## 출력 구조 (JSON)
{
  "hookScene": {
    "visualDescription": "후킹 이미지 프롬프트 (영어, 애니메이션 스타일)",
    "motionPrompt": "10초 동영상 모션 설명 (영어)",
    "hookText": "후킹 자막 텍스트 (한국어, 20자 이내)"
  },
  "scenes": [
    {
      "sceneNumber": 1,
      "timeRange": "0:10~1:00",
      "imagePrompt": "이미지 프롬프트 (영어, 애니메이션 스타일, 텍스트 없이)",
      "narration": "나레이션 텍스트 (한국어, 정확히 432~444자, 6구간×72~74자)",
      "narrationCharCount": 438,
      "storyPhase": "도입/전개/심화/절정/마무리",
      "mood": "분위기 (한국어, 2~3단어)"
    }
  ],
  "metadata": {
    "title": "영상 제목",
    "synopsis": "3줄 요약",
    "totalScenes": ${totalScenes},
    "estimatedDuration": "${duration}분"
  }
}`;

    let parsed: any;

    if (isOpenAIModel(textModel)) {
      // OpenAI 모델 사용
      const openaiKey = await getOpenAIKeyForUser(auth.userId);
      const resultText = await generateTextWithOpenAI(openaiKey, textModel, prompt, {
        systemPrompt: 'You are a professional YouTube video scenario writer. Always respond with valid JSON matching the requested structure. Write narrations in Korean and image prompts in English.',
        jsonMode: true,
      });
      parsed = JSON.parse(resultText);
    } else {
      // Gemini 모델 사용
      const aiClient = await getAIClientForUser(auth.userId);
      const response = await aiClient.models.generateContent({
        model: textModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hookScene: {
                type: Type.OBJECT,
                properties: {
                  visualDescription: { type: Type.STRING, description: '후킹 이미지 프롬프트 (영어, 애니메이션 스타일)' },
                  motionPrompt: { type: Type.STRING, description: '10초 동영상 모션 설명 (영어)' },
                  hookText: { type: Type.STRING, description: '후킹 자막 텍스트 (한국어, 20자 이내)' },
                },
                required: ['visualDescription', 'motionPrompt', 'hookText'],
              },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.NUMBER, description: '씬 번호 (1부터)' },
                    timeRange: { type: Type.STRING, description: '시간 범위 (예: 0:10~1:10)' },
                    imagePrompt: { type: Type.STRING, description: '이미지 프롬프트 (영어, 애니메이션 스타일, 텍스트 없이)' },
                    narration: { type: Type.STRING, description: '나레이션 텍스트 (한국어, 432~444자, 6구간×72~74자)' },
                    narrationCharCount: { type: Type.NUMBER, description: '나레이션 글자 수' },
                    storyPhase: { type: Type.STRING, description: '스토리 단계: 도입/전개/심화/절정/마무리' },
                    mood: { type: Type.STRING, description: '분위기 (한국어, 2~3단어)' },
                  },
                  required: ['sceneNumber', 'timeRange', 'imagePrompt', 'narration', 'narrationCharCount', 'storyPhase', 'mood'],
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
            required: ['hookScene', 'scenes', 'metadata'],
          },
          ...getThinkingConfig(textModel),
        },
      });
      parsed = JSON.parse(response.text!);
    }

    // Build structured response
    const result = {
      id: crypto.randomUUID(),
      hookScene: {
        visualDescription: parsed.hookScene.visualDescription,
        motionPrompt: parsed.hookScene.motionPrompt,
        hookText: parsed.hookScene.hookText,
        imageStatus: 'pending',
        videoStatus: 'pending',
      },
      scenes: parsed.scenes.map((scene: any, index: number) => ({
        id: crypto.randomUUID(),
        sceneNumber: scene.sceneNumber || index + 1,
        timeRange: scene.timeRange || `${Math.floor((index * 60 + 10) / 60)}:${String((index * 60 + 10) % 60).padStart(2, '0')}~${Math.floor(((index + 1) * 60 + 10) / 60)}:${String(((index + 1) * 60 + 10) % 60).padStart(2, '0')}`,
        imagePrompt: scene.imagePrompt,
        narration: scene.narration,
        narrationCharCount: scene.narration?.length || 0,
        storyPhase: scene.storyPhase || '전개',
        mood: scene.mood || '중립',
        imageStatus: 'pending',
        narrationStatus: 'pending',
      })),
      metadata: parsed.metadata,
      createdAt: Date.now(),
    };

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
