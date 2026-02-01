import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth.js';
import { getAIClientForUser, getUserTextModel, getThinkingConfig, setCorsHeaders } from '../lib/gemini.js';
import { isOpenAIModel, getOpenAIKeyForUser, generateTextWithOpenAI } from '../lib/openai.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin as string);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = requireAuth(req);
  if (!auth.authenticated || !auth.userId) {
    return res.status(401).json({ error: auth.error || '로그인이 필요합니다.' });
  }

  try {
    const { narration, targetMin = 280, targetMax = 300, context } = req.body;

    if (!narration) {
      return res.status(400).json({ error: 'narration is required' });
    }

    const charCount = narration.length;

    // Already within range
    if (charCount >= targetMin && charCount <= targetMax) {
      return res.status(200).json({
        narration,
        charCount,
        adjusted: false,
      });
    }

    const textModel = await getUserTextModel(auth.userId);

    const direction = charCount < targetMin ? '늘려' : '줄여';
    const prompt = `다음 나레이션을 ${targetMin}~${targetMax}자로 ${direction}주세요.
의미와 톤을 최대한 유지하면서, 자연스러운 한국어로 수정해주세요.
${context ? `\n이전 맥락: ${context}` : ''}

원본 나레이션 (${charCount}자):
${narration}

수정된 나레이션만 출력하세요. 다른 설명 없이 나레이션 텍스트만 반환합니다.`;

    let adjusted: string;

    if (isOpenAIModel(textModel)) {
      const openaiKey = await getOpenAIKeyForUser(auth.userId);
      adjusted = await generateTextWithOpenAI(openaiKey, textModel, prompt, {
        jsonMode: false,
      });
    } else {
      const aiClient = await getAIClientForUser(auth.userId);
      const response = await aiClient.models.generateContent({
        model: textModel,
        contents: prompt,
        config: {
          ...getThinkingConfig(textModel),
        },
      });
      adjusted = response.text?.trim() || narration;
    }

    adjusted = adjusted.trim() || narration;

    return res.status(200).json({
      narration: adjusted,
      charCount: adjusted.length,
      adjusted: true,
    });
  } catch (e) {
    console.error('[longform/validate-narration] Error:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return res.status(500).json({ error: `Narration validation failed: ${errorMessage}` });
  }
}
