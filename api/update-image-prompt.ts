import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, Type, sanitizePrompt, setCorsHeaders, STYLE_PROMPTS, getThinkingConfig } from './lib/gemini.js';
import type { ApiErrorResponse, ImageStyle, ScenarioTone } from './lib/types.js';

interface UpdateImagePromptRequest {
    visualDescription: string;
    imageStyle?: ImageStyle;
    tone?: ScenarioTone;
}

/**
 * POST /api/update-image-prompt
 * Generates a new imagePrompt based on visualDescription
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' } as ApiErrorResponse);
    }

    try {
        const { visualDescription, imageStyle = 'photorealistic', tone = 'emotional' } = req.body as UpdateImagePromptRequest;

        if (!visualDescription || visualDescription.trim().length === 0) {
            return res.status(400).json({ error: 'visualDescription is required' } as ApiErrorResponse);
        }

        const sanitizedDescription = sanitizePrompt(visualDescription, 2000);
        const stylePromptText = STYLE_PROMPTS[imageStyle] || STYLE_PROMPTS.photorealistic;

        const prompt = `당신은 AI 이미지 생성(Stable Diffusion, Midjourney, DALL-E)을 위한 프롬프트 작성 전문가입니다.
한국어로 된 시각적 묘사를 **AI 이미지 생성에 최적화된 상세한 영어 프롬프트**로 변환하세요.

**중요: 단순 번역이 아니라, AI가 정확하고 아름다운 이미지를 생성할 수 있도록 시각적 세부사항을 풍부하게 추가해야 합니다!**

## 입력
- **시각적 묘사 (한국어)**: "${sanitizedDescription}"
- **이미지 스타일**: ${imageStyle}
- **톤/분위기**: ${tone}

## 프롬프트 필수 구성요소 (모두 포함해야 함)
1. **아트 스타일 프리픽스**: "${stylePromptText.substring(0, 100)}..."로 시작
2. **주체(Subject)**: 누가/무엇이 화면에 있는지 - "Korean man in his late 20s", "Korean woman with long black hair"
3. **행동/자세(Action/Pose)**: 무엇을 하고 있는지 - "holding a gift box", "gazing out the window"
4. **표정/감정(Expression)**: 얼굴 표정과 감정 - "warm smile showing relief", "tearful eyes filled with gratitude"
5. **카메라(Camera)**: 샷 타입과 앵글 - "close-up shot", "medium shot from below", "over-the-shoulder view"
6. **조명(Lighting)**: 빛의 종류와 방향 - "soft golden hour sunlight from left", "dramatic backlight"
7. **배경/환경(Environment)**: 장소와 세부사항 - "cozy Seoul apartment", "rainy night street with neon reflections"
8. **색감(Color Palette)**: 전체 색상 분위기 - "warm amber tones", "cool blue and gray palette"
9. **분위기(Atmosphere)**: 감정적 분위기 - "heartwarming family moment", "melancholic reflection"

## 나쁜 예시 vs 좋은 예시

**나쁜 예시 (단순 번역 - 절대 금지!):**
"Brother giving a gift to younger brother, stacks of cash on table, sunset glow, emotional bond"

**좋은 예시 (AI 이미지 생성에 최적화):**
"${stylePromptText.substring(0, 50)}... Korean young man in his late 20s with a warm relieved smile handing a beautifully wrapped gift box to his teenage younger brother, both sitting on a cozy beige living room sofa, medium shot with shallow depth of field focusing on their emotional exchange, soft afternoon golden sunlight streaming through sheer white curtains, warm amber and cream color palette, heartwarming family moment filled with gratitude and reconciliation, cinematic composition"

## 출력 규칙
- 반드시 영어로 작성
- 최소 50단어 이상의 상세한 프롬프트
- 한국인 인물은 반드시 "Korean" 명시
- 원본 한국어 묘사의 핵심 내용은 반드시 포함
- 원본에 없더라도 이미지 생성에 필요한 시각적 세부사항은 자연스럽게 추가`;

        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        imagePrompt: {
                            type: Type.STRING,
                            description: "Generated image prompt in English",
                        },
                    },
                    required: ["imagePrompt"],
                },
                ...getThinkingConfig(MODELS.TEXT),
            },
        });

        const parsed = JSON.parse(response.text);

        return res.status(200).json({ imagePrompt: parsed.imagePrompt });

    } catch (e) {
        console.error("Error updating image prompt:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `Image prompt update failed: ${errorMessage}`,
            code: 'GENERATION_FAILED'
        } as ApiErrorResponse);
    }
}
