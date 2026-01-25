import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, Type, sanitizePrompt, setCorsHeaders } from './lib/gemini.js';
import type { GenerateScenarioRequest, Scenario, Scene, ScenarioTone, StoryBeat, CameraAngle, ApiErrorResponse } from './lib/types.js';

const TONE_DESCRIPTIONS: Record<ScenarioTone, string> = {
    emotional: '따뜻하고 감성적이며, 공감을 이끌어내는 여운 있는 스토리',
    dramatic: '긴장감 넘치고, 예상치 못한 반전이 있는 극적인 스토리',
    inspirational: '도전과 성장, 희망적인 메시지를 담은 동기부여 스토리',
    romantic: '설렘과 사랑, 달콤하고 감미로운 로맨틱 스토리',
    comedic: '유쾌하고 웃긴, 밝은 에너지의 코믹 스토리',
    mysterious: '호기심을 자극하고, 궁금증을 유발하는 미스터리 스토리',
    nostalgic: '그리움과 추억, 과거를 회상하는 향수 어린 스토리',
};

/**
 * POST /api/generate-scenario
 * Generates a complete video scenario
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
        const { config } = req.body as GenerateScenarioRequest;

        if (!config || !config.topic) {
            return res.status(400).json({ error: 'config.topic is required' } as ApiErrorResponse);
        }

        const { topic, duration, tone } = config;
        const sanitizedTopic = sanitizePrompt(topic, 500);
        const minScenes = Math.floor(duration / 12);
        const maxScenes = Math.ceil(duration / 8);
        const toneDescription = TONE_DESCRIPTIONS[tone] || TONE_DESCRIPTIONS.emotional;

        const prompt = `당신은 한국 숏폼 영상 시나리오 전문 작가입니다.
주어진 주제로 ${duration}초 분량의 영상 시나리오를 작성하세요.

## 입력 정보
- **주제**: "${sanitizedTopic}"
- **영상 길이**: ${duration}초
- **톤/분위기**: ${tone} - ${toneDescription}

## 시나리오 작성 규칙

### 1. 구조
- 총 ${minScenes}~${maxScenes}개의 씬으로 구성
- 각 씬은 7-12초 분량
- 반드시 다음 구조를 따를 것:
  - Scene 1: **Hook** - 강렬한 첫 장면으로 시선 끌기 (3초 내 관심 유도)
  - Scene 2-3: **Setup** - 상황과 인물 소개
  - 중간 씬들: **Development** - 이야기 전개
  - 마지막에서 두번째: **Climax** - 가장 강렬한 순간 또는 반전
  - 마지막 씬: **Resolution** - 여운 있는 마무리

### 2. 각 씬 작성 시 포함할 내용
- **sceneNumber**: 씬 번호 (1부터 시작)
- **duration**: 예상 길이(초, 7-12 사이)
- **storyBeat**: "Hook", "Setup", "Development", "Climax", "Resolution" 중 하나
- **visualDescription**: 화면에 보이는 것 (한국어, 구체적인 시각 묘사)
- **narration**: 내레이션 텍스트 (한국어, 자연스러운 구어체, 해당 씬 길이에 맞게)
- **cameraAngle**: "Close-up", "Extreme Close-up", "Medium shot", "Wide shot", "POV", "Over-the-shoulder", "Low angle", "High angle", "Bird's eye" 중 하나
- **mood**: 장면의 감정/분위기 (한국어, 2-3단어)
- **imagePrompt**: 이미지 생성용 영어 프롬프트 (매우 상세하고 시각적으로, 인물 표정/자세/시선/배경/조명/시간대 포함)

### 3. 숏폼 영상 특성 반영
- 첫 3초 안에 시청자의 관심을 끌 것 (Hook이 매우 중요)
- 빠른 전개, 불필요한 설명 최소화
- 감정적 공감을 이끌어내는 스토리텔링
- 마지막은 여운이 남거나 반전이 있게
- 내레이션은 자연스러운 한국어 구어체로

### 4. 이미지 프롬프트 작성 규칙 (imagePrompt)
- 반드시 영어로 작성
- 한국인 인물 묘사 시 "Korean" 명시
- 인물의 표정, 자세, 시선 방향 구체적으로
- 배경, 조명, 시간대 명시
- 감정과 분위기를 시각적으로 표현
- 영화적/시네마틱한 품질 강조

### 5. 등장인물 제안
- 시나리오에 필요한 주요 등장인물들을 제안
- 각 인물의 이름, 역할, 외형/성격 설명 포함`;

        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: {
                            type: Type.STRING,
                            description: "시나리오의 제목",
                        },
                        synopsis: {
                            type: Type.STRING,
                            description: "시나리오의 한 줄 요약",
                        },
                        suggestedCharacters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING, description: "캐릭터 이름" },
                                    role: { type: Type.STRING, description: "역할 (주인공, 조연 등)" },
                                    description: { type: Type.STRING, description: "외형과 성격 설명" },
                                },
                                required: ["name", "role", "description"],
                            },
                        },
                        scenes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    sceneNumber: { type: Type.NUMBER, description: "씬 번호" },
                                    duration: { type: Type.NUMBER, description: "씬 길이(초)" },
                                    storyBeat: { type: Type.STRING, description: "스토리 비트" },
                                    visualDescription: { type: Type.STRING, description: "시각적 묘사 (한국어)" },
                                    narration: { type: Type.STRING, description: "내레이션 (한국어)" },
                                    cameraAngle: { type: Type.STRING, description: "카메라 앵글" },
                                    mood: { type: Type.STRING, description: "분위기" },
                                    imagePrompt: { type: Type.STRING, description: "이미지 생성 프롬프트 (영어)" },
                                },
                                required: ["sceneNumber", "duration", "storyBeat", "visualDescription", "narration", "cameraAngle", "mood", "imagePrompt"],
                            },
                        },
                    },
                    required: ["title", "synopsis", "suggestedCharacters", "scenes"],
                },
            },
        });

        const parsed = JSON.parse(response.text);

        // Transform to full Scenario object with IDs
        const scenario: Scenario = {
            id: crypto.randomUUID(),
            title: parsed.title,
            synopsis: parsed.synopsis,
            topic: topic,
            totalDuration: duration,
            tone: tone,
            suggestedCharacters: parsed.suggestedCharacters,
            scenes: parsed.scenes.map((scene: any, index: number) => ({
                id: crypto.randomUUID(),
                sceneNumber: scene.sceneNumber || index + 1,
                duration: scene.duration,
                storyBeat: scene.storyBeat as StoryBeat,
                visualDescription: scene.visualDescription,
                narration: scene.narration,
                cameraAngle: scene.cameraAngle as CameraAngle,
                mood: scene.mood,
                imagePrompt: scene.imagePrompt,
            })),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        return res.status(200).json({ scenario });

    } catch (e) {
        console.error("Error during scenario generation:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `Scenario generation failed: ${errorMessage}`,
            code: 'GENERATION_FAILED'
        } as ApiErrorResponse);
    }
}
