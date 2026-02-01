import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sanitizePrompt, setCorsHeaders, getAIClientForUser, getUserTextModel, getThinkingConfig } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { isOpenAIModel, getOpenAIKeyForUser, generateTextWithOpenAI } from './lib/openai.js';
import type { ApiErrorResponse } from './lib/types.js';

interface TranslateFoodPromptRequest {
    prompt: string;
}

interface TranslateFoodPromptResult {
    englishPrompt: string;
    koreanDescription: string;
}

/**
 * POST /api/translate-food-prompt
 * Translates a Korean food description into an English cinematic video prompt via Gemini.
 * Also returns a Korean description of what the video will look like.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' } as ApiErrorResponse);
    }

    // 인증 체크
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.userId) {
        return res.status(401).json({
            success: false,
            error: auth.error || '로그인이 필요합니다.'
        });
    }

    try {
        const { prompt } = req.body as TranslateFoodPromptRequest;

        if (!prompt) {
            return res.status(400).json({ error: '프롬프트를 입력해 주세요.' } as ApiErrorResponse);
        }

        const sanitizedPrompt = sanitizePrompt(prompt, 1000);

        console.log('=== FOOD PROMPT TRANSLATION START ===');
        console.log('Korean prompt:', sanitizedPrompt);

        const textModel = await getUserTextModel(auth.userId);

        const foodPromptText = `You are a professional food cinematography director. I need TWO outputs from you.

**Input:** A Korean food description.
**Output:** A JSON object with exactly two fields:

1. "englishPrompt": An English cinematic video motion prompt optimized for image-to-video generation. It must describe:
   - Camera movements (slow zoom in, gentle pan, dolly shot, tracking, etc.)
   - Food motion details (steam rising, sauce drizzling, cheese pulling, garnish falling, etc.)
   - Lighting and atmosphere (warm golden lighting, soft bokeh background, etc.)
   - Cinematic quality (shallow depth of field, slow motion, macro lens, 4K, etc.)

2. "koreanDescription": A Korean explanation (2-3 sentences) describing what kind of video the English prompt will create. This helps the user understand the video before generating it.

**IMPORTANT:** Return ONLY the JSON object. No markdown, no code blocks, no explanation.

**Korean food description:**
${sanitizedPrompt}`;

        let responseText: string;

        if (isOpenAIModel(textModel)) {
            const openaiKey = await getOpenAIKeyForUser(auth.userId);
            responseText = await generateTextWithOpenAI(openaiKey, textModel, foodPromptText, {
                systemPrompt: 'You are a professional food cinematography director. Always respond with valid JSON.',
                jsonMode: true,
            });
        } else {
            const aiClient = await getAIClientForUser(auth.userId);
            const translationResponse = await aiClient.models.generateContent({
                model: textModel,
                config: {
                    ...getThinkingConfig(textModel),
                },
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: foodPromptText }]
                    }
                ]
            });
            responseText = (translationResponse as any)?.candidates?.[0]?.content?.parts?.[0]?.text
                || (translationResponse as any)?.text
                || '';
        }

        console.log('Gemini raw response:', responseText);

        // JSON 파싱 시도
        let englishPrompt: string;
        let koreanDescription: string;

        try {
            // 코드 블록 제거 (```json ... ``` 등)
            const cleaned = responseText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);
            englishPrompt = parsed.englishPrompt || '';
            koreanDescription = parsed.koreanDescription || '';
        } catch {
            // JSON 파싱 실패 시 전체를 영어 프롬프트로 사용
            console.warn('Failed to parse JSON response, using raw text as English prompt');
            englishPrompt = responseText.trim();
            koreanDescription = '영상 프롬프트가 생성되었습니다. 내용을 확인하고 필요하면 수정한 후 영상을 생성하세요.';
        }

        if (!englishPrompt) {
            throw new Error('프롬프트 변환 결과가 비어있습니다.');
        }

        console.log('English prompt:', englishPrompt);
        console.log('Korean description:', koreanDescription);
        console.log('=== FOOD PROMPT TRANSLATION SUCCESS ===');

        const result: TranslateFoodPromptResult = {
            englishPrompt,
            koreanDescription,
        };

        return res.status(200).json(result);

    } catch (e) {
        console.error('=== FOOD PROMPT TRANSLATION ERROR ===');
        console.error('Error:', e);

        if (e instanceof Error) {
            const msg = e.message;

            if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || msg.includes('INVALID_ARGUMENT')) {
                return res.status(403).json({
                    error: 'Gemini API 키가 유효하지 않습니다. 설정에서 올바른 Gemini API 키를 입력해 주세요.',
                    code: 'GEMINI_API_KEY_INVALID'
                } as ApiErrorResponse);
            }
            if (msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
                return res.status(403).json({
                    error: 'Gemini API 접근 권한이 없습니다. API 키를 확인하세요.',
                    code: 'GEMINI_PERMISSION_DENIED'
                } as ApiErrorResponse);
            }
            if (msg.includes('QUOTA_EXCEEDED') || msg.includes('429') || msg.includes('Resource exhausted')) {
                return res.status(429).json({
                    error: 'Gemini API 할당량을 초과했습니다. 잠시 후 다시 시도하세요.',
                    code: 'QUOTA_EXCEEDED'
                } as ApiErrorResponse);
            }
            if (msg.includes('API 키가 설정되지 않았습니다') || msg.includes('서버 API 키')) {
                return res.status(400).json({
                    error: 'Gemini API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해 주세요.',
                    code: 'GEMINI_API_KEY_MISSING'
                } as ApiErrorResponse);
            }

            return res.status(500).json({
                error: `프롬프트 변환 실패: ${msg}`,
                code: 'TRANSLATION_FAILED'
            } as ApiErrorResponse);
        }

        return res.status(500).json({
            error: '프롬프트 변환 중 알 수 없는 오류가 발생했습니다.',
            code: 'UNKNOWN_ERROR'
        } as ApiErrorResponse);
    }
}
