import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, Type, sanitizePrompt, setCorsHeaders } from './lib/gemini.js';
import type { RegenerateSceneRequest, Scene, CameraAngle, ApiErrorResponse } from './lib/types.js';

/**
 * POST /api/regenerate-scene
 * Regenerates a single scene within a scenario
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
        const { scenario, sceneId, customInstruction } = req.body as RegenerateSceneRequest;

        if (!scenario || !sceneId) {
            return res.status(400).json({ error: 'scenario and sceneId are required' } as ApiErrorResponse);
        }

        const sceneIndex = scenario.scenes.findIndex(s => s.id === sceneId);
        if (sceneIndex === -1) {
            return res.status(404).json({ error: 'Scene not found in scenario' } as ApiErrorResponse);
        }

        const currentScene = scenario.scenes[sceneIndex];
        const prevScene = sceneIndex > 0 ? scenario.scenes[sceneIndex - 1] : null;
        const nextScene = sceneIndex < scenario.scenes.length - 1 ? scenario.scenes[sceneIndex + 1] : null;

        const sanitizedInstruction = customInstruction ? sanitizePrompt(customInstruction, 500) : null;

        const contextPrompt = `당신은 한국 숏폼 영상 시나리오 전문 작가입니다.
기존 시나리오의 특정 씬을 다시 작성해야 합니다.

## 시나리오 정보
- **제목**: "${scenario.title}"
- **주제**: "${scenario.topic}"
- **톤**: ${scenario.tone}
- **총 길이**: ${scenario.totalDuration}초

## 문맥 (앞뒤 씬)
${prevScene ? `**이전 씬 (Scene ${prevScene.sceneNumber}):**
- 내용: ${prevScene.visualDescription}
- 내레이션: ${prevScene.narration}
` : '(첫 번째 씬입니다)'}

${nextScene ? `**다음 씬 (Scene ${nextScene.sceneNumber}):**
- 내용: ${nextScene.visualDescription}
- 내레이션: ${nextScene.narration}
` : '(마지막 씬입니다)'}

## 재생성할 씬 정보
- **씬 번호**: ${currentScene.sceneNumber}
- **스토리 비트**: ${currentScene.storyBeat}
- **현재 내용**: ${currentScene.visualDescription}

## 요청사항
${sanitizedInstruction ? `**사용자 지시**: ${sanitizedInstruction}` : '새로운 창의적인 버전으로 다시 작성해주세요.'}

앞뒤 씬과 자연스럽게 연결되면서도 새롭고 더 나은 버전을 만들어주세요.

## 이미지 프롬프트 작성 시 주의사항
- 반드시 영어로 작성
- **중요: 이미지 내에 텍스트, 글자, 문자, 간판, 자막 등을 절대 포함하지 마세요. "no text", "no letters", "no words", "no signs with text" 를 프롬프트에 명시하세요.**`;

        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: contextPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        duration: { type: Type.NUMBER, description: "씬 길이(초)" },
                        visualDescription: { type: Type.STRING, description: "시각적 묘사 (한국어)" },
                        narration: { type: Type.STRING, description: "내레이션 (한국어)" },
                        cameraAngle: { type: Type.STRING, description: "카메라 앵글" },
                        mood: { type: Type.STRING, description: "분위기" },
                        imagePrompt: { type: Type.STRING, description: "이미지 생성 프롬프트 (영어)" },
                    },
                    required: ["duration", "visualDescription", "narration", "cameraAngle", "mood", "imagePrompt"],
                },
            },
        });

        const parsed = JSON.parse(response.text);

        const regeneratedScene: Scene = {
            id: crypto.randomUUID(),
            sceneNumber: currentScene.sceneNumber,
            storyBeat: currentScene.storyBeat,
            duration: parsed.duration,
            visualDescription: parsed.visualDescription,
            narration: parsed.narration,
            cameraAngle: parsed.cameraAngle as CameraAngle,
            mood: parsed.mood,
            imagePrompt: parsed.imagePrompt,
        };

        return res.status(200).json({ scene: regeneratedScene });

    } catch (e) {
        console.error("Error during scene regeneration:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `Scene regeneration failed: ${errorMessage}`,
            code: 'REGENERATION_FAILED'
        } as ApiErrorResponse);
    }
}
