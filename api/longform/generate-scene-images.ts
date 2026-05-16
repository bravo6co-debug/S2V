import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth.js';
import { getAIClientForUser, setCorsHeaders, Modality, extractSafetyError } from '../lib/gemini.js';
import { isEachlabsImageModel, getEachLabsApiKey, generateEachlabsImage } from '../lib/eachlabs.js';
import { buildImagePrompt } from '../lib/imagePromptBuilder.js';

interface SceneInput {
  sceneNumber: number;
  imagePrompt: string;
  cameraAngle?: string;
  lightingMood?: string;
  mood?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    const { scenes, imageModel = 'gemini-2.5-flash-image', batchSize = 5 } = req.body;
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({ error: 'scenes array is required' });
    }

    const results: { sceneNumber: number; success: boolean; image?: any; error?: string }[] = [];

    // Process in batches
    for (let i = 0; i < scenes.length; i += batchSize) {
      const batch = scenes.slice(i, i + batchSize) as SceneInput[];

      const batchPromises = batch.map(async (scene) => {
        let lastError = '';

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            const prompt = buildImagePrompt(imageModel, 'scene', {
              imagePrompt: scene.imagePrompt,
              cameraAngle: scene.cameraAngle,
              lightingMood: scene.lightingMood,
              mood: scene.mood,
            });

            if (isEachlabsImageModel(imageModel)) {
              const apiKey = await getEachLabsApiKey(auth.userId!);
              const result = await generateEachlabsImage({ apiKey, model: imageModel, prompt, aspectRatio: '16:9' });
              return { sceneNumber: scene.sceneNumber, success: true, image: result };
            }

            const aiClient = await getAIClientForUser(auth.userId!);
            const response = await aiClient.models.generateContent({
              model: imageModel,
              contents: prompt,
              config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
            });

            // 안전 정책 위반 확인 — 재시도 불가 (즉시 실패)
            const safetyError = extractSafetyError(response as any);
            if (safetyError) {
              return { sceneNumber: scene.sceneNumber, success: false, error: `[안전정책] ${safetyError.message}` };
            }

            const parts = response.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.inlineData) {
                return {
                  sceneNumber: scene.sceneNumber,
                  success: true,
                  image: { mimeType: part.inlineData.mimeType, data: part.inlineData.data },
                };
              }
            }

            // 이미지 없음 — 재시도 가능
            lastError = 'AI가 이미지를 생성하지 못했습니다.';
          } catch (err) {
            lastError = err instanceof Error ? err.message : 'Generation failed';
          }

          // 마지막 시도가 아니면 대기 후 재시도
          if (attempt < MAX_RETRIES - 1) {
            console.log(`[Scene ${scene.sceneNumber}] Retry ${attempt + 1}/${MAX_RETRIES - 1} after ${RETRY_DELAYS[attempt]}ms`);
            await sleep(RETRY_DELAYS[attempt]);
          }
        }

        // 3회 모두 실패
        return { sceneNumber: scene.sceneNumber, success: false, error: lastError };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Rate limit delay between batches
      if (i + batchSize < scenes.length) {
        await new Promise(r => setTimeout(r, 7000));
      }
    }

    return res.status(200).json({ results });
  } catch (e) {
    console.error('[longform/generate-scene-images] Error:', e);
    return res.status(500).json({ error: `Scene images generation failed: ${e instanceof Error ? e.message : 'Unknown'}` });
  }
}
