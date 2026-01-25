import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, Type, sanitizePrompt, setCorsHeaders, STYLE_PROMPTS } from './lib/gemini.js';
import type { GenerateScenarioRequest, Scenario, Scene, ScenarioTone, ScenarioMode, ImageStyle, StoryBeat, CameraAngle, ApiErrorResponse, ScenarioChapter } from './lib/types.js';

const TONE_DESCRIPTIONS: Record<ScenarioTone, string> = {
    emotional: '따뜻하고 감성적이며, 공감을 이끌어내는 여운 있는 스토리',
    dramatic: '긴장감 넘치고, 예상치 못한 반전이 있는 극적인 스토리',
    inspirational: '도전과 성장, 희망적인 메시지를 담은 동기부여 스토리',
    romantic: '설렘과 사랑, 달콤하고 감미로운 로맨틱 스토리',
    comedic: '유쾌하고 웃긴, 밝은 에너지의 코믹 스토리',
    mysterious: '호기심을 자극하고, 궁금증을 유발하는 미스터리 스토리',
    nostalgic: '그리움과 추억, 과거를 회상하는 향수 어린 스토리',
};

const MODE_DESCRIPTIONS: Record<ScenarioMode, { name: string; focus: string; visualGuidelines: string }> = {
    character: {
        name: '캐릭터 중심',
        focus: '인물의 감정, 행동, 관계에 초점을 맞춘 스토리',
        visualGuidelines: '인물의 표정, 자세, 감정 표현이 핵심. 클로즈업과 미디엄샷 위주.',
    },
    environment: {
        name: '환경/풍경 중심',
        focus: '장소, 분위기, 자연의 아름다움에 초점을 맞춘 스토리. 인물 없이 진행 가능.',
        visualGuidelines: '와이드샷과 풍경 위주. 빛, 날씨, 시간의 변화를 강조. 인물 없는 환경 묘사.',
    },
    abstract: {
        name: '추상/개념 중심',
        focus: '개념, 아이디어, 상징적 이미지에 초점을 맞춘 스토리. 직접적인 인물 묘사 없음.',
        visualGuidelines: '상징적인 오브젝트, 색상, 형태, 텍스처 중심. 추상적이고 예술적인 비주얼.',
    },
    narration: {
        name: '나레이션 중심',
        focus: '음성 해설이 중심이 되는 스토리. 비주얼은 해설을 보조.',
        visualGuidelines: '내레이션을 시각화하는 이미지. 텍스트나 타이포그래피 효과 가능. 설명적인 이미지.',
    },
};

const STYLE_DESCRIPTIONS: Record<ImageStyle, string> = {
    photorealistic: '실사 사진 스타일. 고해상도 DSLR 카메라로 촬영한 듯한 이미지.',
    animation: '일본 애니메이션 스타일. 지브리, 신카이 마코토 풍의 아름다운 작화.',
    illustration: '디지털 일러스트레이션 스타일. 깔끔한 벡터 아트와 세련된 디자인.',
    cinematic: '시네마틱 영화 스타일. 할리우드 블록버스터 급의 드라마틱한 비주얼.',
    watercolor: '수채화 스타일. 부드러운 색감과 붓터치가 느껴지는 전통 회화풍.',
    '3d_render': '3D 렌더링 스타일. 픽사/디즈니 애니메이션 급의 CGI 비주얼.',
};

interface DurationConfig {
    minScenes: number;
    maxScenes: number;
    perSceneMin: number;
    perSceneMax: number;
    chapters: number;
    storyStructure: string;
    narrationMaxLength: number;  // 씬당 나레이션 최대 글자 수
}

const getDurationConfig = (duration: number): DurationConfig => {
    if (duration <= 30) {
        return {
            minScenes: 2,
            maxScenes: 4,
            perSceneMin: 5,
            perSceneMax: 10,
            chapters: 1,
            storyStructure: 'Hook → Resolution (간소화된 구조, 임팩트 있는 시작과 끝)',
            narrationMaxLength: 40,  // 5-10초 씬 → 최대 40자
        };
    }
    if (duration <= 90) {
        return {
            minScenes: 4,
            maxScenes: 10,
            perSceneMin: 7,
            perSceneMax: 12,
            chapters: 1,
            storyStructure: 'Hook → Setup → Development → Climax → Resolution (표준 5단계 구조)',
            narrationMaxLength: 50,  // 7-12초 씬 → 최대 50자
        };
    }
    if (duration <= 180) {
        return {
            minScenes: 10,
            maxScenes: 20,
            perSceneMin: 7,
            perSceneMax: 12,
            chapters: 2,
            storyStructure: '2개 챕터로 구성. 각 챕터별로 미니 기승전결 구조.',
            narrationMaxLength: 50,  // 7-12초 씬 → 최대 50자
        };
    }
    if (duration <= 300) {
        return {
            minScenes: 20,
            maxScenes: 40,
            perSceneMin: 8,
            perSceneMax: 12,
            chapters: 3,
            storyStructure: '3개 챕터로 구성. 시작-발전-결말의 대단락 구조.',
            narrationMaxLength: 55,  // 8-12초 씬 → 최대 55자
        };
    }
    // 5분 이상 (최대 10분)
    return {
        minScenes: 40,
        maxScenes: 80,
        perSceneMin: 8,
        perSceneMax: 15,
        chapters: 6,
        storyStructure: '4-6개 챕터로 구성. 에피소드형 구조로 각 챕터가 독립적인 미니 스토리.',
        narrationMaxLength: 60,  // 8-15초 씬 → 최대 60자
    };
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

        const { topic, duration, tone, mode = 'character', imageStyle = 'photorealistic', customTone } = config;
        const sanitizedTopic = sanitizePrompt(topic, 500);
        const durationConfig = getDurationConfig(duration);
        const toneDescription = tone === 'custom' && customTone ? customTone : (TONE_DESCRIPTIONS[tone as ScenarioTone] || TONE_DESCRIPTIONS.emotional);
        const modeInfo = MODE_DESCRIPTIONS[mode] || MODE_DESCRIPTIONS.character;
        const styleDescription = STYLE_DESCRIPTIONS[imageStyle] || STYLE_DESCRIPTIONS.photorealistic;
        const stylePromptText = STYLE_PROMPTS[imageStyle] || STYLE_PROMPTS.photorealistic;

        // 모드에 따른 캐릭터 관련 지시문
        const characterGuidelines = mode === 'character'
            ? `### 5. 등장인물 제안
- 시나리오에 필요한 주요 등장인물들을 제안
- 각 인물의 이름, 역할, 외형/성격 설명 포함
- 한국인 인물 묘사 시 "Korean" 명시`
            : mode === 'environment'
                ? `### 5. 등장인물 (환경 중심 모드)
- 인물이 필요하지 않은 환경 중심 시나리오
- suggestedCharacters는 빈 배열로 반환
- 모든 이미지 프롬프트에서 인물/사람 제외`
                : mode === 'abstract'
                    ? `### 5. 등장인물 (추상 모드)
- 추상적/개념적 시각화에 집중
- suggestedCharacters는 빈 배열로 반환
- 인물 대신 상징적 이미지와 오브젝트 활용`
                    : `### 5. 등장인물 (나레이션 모드)
- 해설 중심이므로 인물이 최소화됨
- suggestedCharacters는 선택적 (필요시 제안)
- 비주얼보다 내레이션이 우선`;

        // 모드에 따른 이미지 프롬프트 지시문
        const imagePromptGuidelines = mode === 'character'
            ? `- 한국인 인물 묘사 시 "Korean" 명시
- 인물의 표정, 자세, 시선 방향 구체적으로
- 배경, 조명, 시간대 명시
- 감정과 분위기를 시각적으로 표현`
            : mode === 'environment'
                ? `- 풍경, 배경, 환경만 묘사 (인물 제외)
- 빛, 날씨, 시간대, 계절 명시
- 장소의 분위기와 질감 상세히
- 공간의 깊이감과 레이어 표현`
                : mode === 'abstract'
                    ? `- 추상적 개념을 시각화
- 색상, 형태, 질감, 패턴 중심
- 상징적 오브젝트와 메타포 활용
- 감정을 색과 형태로 표현`
                    : `- 내레이션 내용을 보조하는 이미지
- 정보 전달에 적합한 구도
- 필요시 텍스트/타이포그래피 포함 가능
- 설명적이고 명확한 시각화`;

        // 챕터 구조 지시문 (장편용)
        const chapterGuidelines = durationConfig.chapters > 1
            ? `
### 6. 챕터 구조 (장편 영상)
- 총 ${durationConfig.chapters}개의 챕터로 구성
- 각 챕터는 독립적인 미니 스토리 구조를 가짐
- chapterIndex 필드로 각 씬이 속한 챕터 표시 (0부터 시작)
- chapterTitle 필드로 챕터 제목 지정
- 챕터 간 자연스러운 연결과 전체 스토리 아크 유지`
            : '';

        const prompt = `당신은 한국 숏폼/미드폼 영상 시나리오 전문 작가입니다.
주어진 주제로 ${duration}초 분량의 영상 시나리오를 작성하세요.

## 입력 정보
- **주제**: "${sanitizedTopic}"
- **영상 길이**: ${duration}초
- **톤/분위기**: ${tone === 'custom' ? '커스텀' : tone} - ${toneDescription}
- **시나리오 모드**: ${modeInfo.name} - ${modeInfo.focus}
- **이미지 스타일**: ${imageStyle} - ${styleDescription}

## 시나리오 작성 규칙

### 1. 구조
- 총 ${durationConfig.minScenes}~${durationConfig.maxScenes}개의 씬으로 구성
- 각 씬은 ${durationConfig.perSceneMin}-${durationConfig.perSceneMax}초 분량
- 스토리 구조: ${durationConfig.storyStructure}
- 스토리비트: "Hook", "Setup", "Development", "Climax", "Resolution"

### 2. 시나리오 모드 지침: ${modeInfo.name}
- **포커스**: ${modeInfo.focus}
- **비주얼 가이드**: ${modeInfo.visualGuidelines}

### 3. 각 씬 작성 시 포함할 내용
- **sceneNumber**: 씬 번호 (1부터 시작)
- **duration**: 예상 길이(초, ${durationConfig.perSceneMin}-${durationConfig.perSceneMax} 사이)
- **storyBeat**: "Hook", "Setup", "Development", "Climax", "Resolution" 중 하나
- **visualDescription**: 화면에 보이는 것 (한국어, 구체적인 시각 묘사)
- **narration**: 내레이션 텍스트 (한국어, 자연스러운 구어체, **최대 ${durationConfig.narrationMaxLength}자 이내**, 씬 길이에 맞게 간결하게)
- **cameraAngle**: "Close-up", "Extreme Close-up", "Medium shot", "Wide shot", "POV", "Over-the-shoulder", "Low angle", "High angle", "Bird's eye" 중 하나
- **mood**: 장면의 감정/분위기 (한국어, 2-3단어)
- **imagePrompt**: 이미지 생성용 영어 프롬프트${durationConfig.chapters > 1 ? '\n- **chapterIndex**: 소속 챕터 번호 (0부터 시작)\n- **chapterTitle**: 챕터 제목' : ''}

### 4. 이미지 프롬프트 작성 규칙 (imagePrompt)
- 반드시 영어로 작성
- 아트 스타일 프리픽스 추가: "${stylePromptText.substring(0, 100)}..."
${imagePromptGuidelines}

${characterGuidelines}
${chapterGuidelines}`;

        // 장편일 경우 챕터 필드 추가
        const sceneProperties: Record<string, any> = {
            sceneNumber: { type: Type.NUMBER, description: "씬 번호" },
            duration: { type: Type.NUMBER, description: "씬 길이(초)" },
            storyBeat: { type: Type.STRING, description: "스토리 비트" },
            visualDescription: { type: Type.STRING, description: "시각적 묘사 (한국어)" },
            narration: { type: Type.STRING, description: "내레이션 (한국어)" },
            cameraAngle: { type: Type.STRING, description: "카메라 앵글" },
            mood: { type: Type.STRING, description: "분위기" },
            imagePrompt: { type: Type.STRING, description: "이미지 생성 프롬프트 (영어)" },
        };
        const sceneRequired = ["sceneNumber", "duration", "storyBeat", "visualDescription", "narration", "cameraAngle", "mood", "imagePrompt"];

        if (durationConfig.chapters > 1) {
            sceneProperties.chapterIndex = { type: Type.NUMBER, description: "소속 챕터 번호 (0부터 시작)" };
            sceneProperties.chapterTitle = { type: Type.STRING, description: "챕터 제목" };
            sceneRequired.push("chapterIndex", "chapterTitle");
        }

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
                                properties: sceneProperties,
                                required: sceneRequired,
                            },
                        },
                    },
                    required: ["title", "synopsis", "suggestedCharacters", "scenes"],
                },
            },
        });

        const parsed = JSON.parse(response.text);

        // Transform scenes with IDs
        const scenes: Scene[] = parsed.scenes.map((scene: any, index: number) => ({
            id: crypto.randomUUID(),
            sceneNumber: scene.sceneNumber || index + 1,
            duration: scene.duration,
            storyBeat: scene.storyBeat as StoryBeat,
            visualDescription: scene.visualDescription,
            narration: scene.narration,
            cameraAngle: scene.cameraAngle as CameraAngle,
            mood: scene.mood,
            imagePrompt: scene.imagePrompt,
        }));

        // Build chapters for long-form content
        let chapters: ScenarioChapter[] | undefined;
        if (durationConfig.chapters > 1) {
            const chapterMap = new Map<number, { title: string; scenes: Scene[] }>();

            parsed.scenes.forEach((scene: any, index: number) => {
                const chapterIndex = scene.chapterIndex ?? 0;
                const chapterTitle = scene.chapterTitle ?? `챕터 ${chapterIndex + 1}`;

                if (!chapterMap.has(chapterIndex)) {
                    chapterMap.set(chapterIndex, { title: chapterTitle, scenes: [] });
                }
                chapterMap.get(chapterIndex)!.scenes.push(scenes[index]);
            });

            chapters = Array.from(chapterMap.entries())
                .sort(([a], [b]) => a - b)
                .map(([index, data]) => ({
                    id: crypto.randomUUID(),
                    title: data.title,
                    order: index,
                    scenes: data.scenes,
                    duration: data.scenes.reduce((sum, s) => sum + s.duration, 0),
                }));
        }

        // Transform to full Scenario object with IDs
        const scenario: Scenario = {
            id: crypto.randomUUID(),
            title: parsed.title,
            synopsis: parsed.synopsis,
            topic: topic,
            totalDuration: duration,
            tone: tone as ScenarioTone,
            mode: mode,
            imageStyle: imageStyle,
            suggestedCharacters: parsed.suggestedCharacters || [],
            scenes,
            chapters,
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
