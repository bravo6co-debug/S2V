import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth.js';
import { getAIClientForUser, setCorsHeaders, Modality, callGeminiWithRetry } from '../lib/gemini.js';
import { isEachlabsImageModel, getEachLabsApiKey, generateEachlabsImage } from '../lib/eachlabs.js';
import { buildImagePrompt } from '../lib/imagePromptBuilder.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin as string);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = requireAuth(req);
  if (!auth.authenticated || !auth.userId) {
    return res.status(401).json({ error: auth.error || '로그인이 필요합니다.' });
  }

  try {
    const { visualDescription, imageModel = 'gemini-2.5-flash-image', imageStyle, aspectRatio = '16:9' } = req.body;
    if (!visualDescription) return res.status(400).json({ error: 'visualDescription is required' });

    const prompt = buildImagePrompt(imageModel, 'hook', { visualDescription, imageStyle });

    if (isEachlabsImageModel(imageModel)) {
      const apiKey = await getEachLabsApiKey(auth.userId);
      const result = await generateEachlabsImage({
        apiKey,
        model: imageModel,
        prompt,
        aspectRatio: aspectRatio === '1:1' ? '1:1' : aspectRatio,
      });
      return res.status(200).json({ image: result });
    }

    const aiClient = await getAIClientForUser(auth.userId);
    const response = await callGeminiWithRetry<any>(
      () => aiClient.models.generateContent({
        model: imageModel,
        contents: prompt,
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      }),
      { label: 'longform-hook-image' },
    );

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return res.status(200).json({
          image: { mimeType: part.inlineData.mimeType, data: part.inlineData.data },
        });
      }
    }

    return res.status(500).json({ error: 'No image generated' });
  } catch (e) {
    console.error('[longform/generate-hook-image] Error:', e);
    return res.status(500).json({ error: `Hook image generation failed: ${e instanceof Error ? e.message : 'Unknown'}` });
  }
}
