import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, Type, sanitizePrompt, setCorsHeaders, STYLE_PROMPTS, getThinkingConfig, getAIClientForUser, getUserTextModel } from './lib/gemini.js';
import { getUserIdFromRequest } from './lib/auth.js';
import { isOpenAIModel, getOpenAIKeyForUser, generateTextWithOpenAI } from './lib/openai.js';
import type {
    GenerateClipScenarioRequest, Scenario, Scene, ScenarioTone, ScenarioMode, ImageStyle,
    StoryBeat, CameraAngle, ApiErrorResponse, ClipDuration
} from './lib/types.js';

// =============================================
// 톤 설명
// =============================================
const TONE_DESCRIPTIONS: Record<ScenarioTone, string> = {
    emotional: '따뜻하고 감성적이며 공감을 이끌어내는',
    dramatic: '긴장감 넘치고 극적인',
    inspirational: '도전과 성장, 희망적인 동기부여',
    romantic: '설렘과 사랑, 감미로운',
    comedic: '유쾌하고 밝은 에너지의 코믹',
    mysterious: '호기심을 자극하는 미스터리',
    nostalgic: '그리움과 추억, 향수 어린',
    educational: '지식과 인사이트를 제공하는 교육적',
    promotional: '구매 욕구를 자극하는 홍보/광고',
    luxurious: '고급스럽고 세련된 프리미엄',
    trendy: '힙하고 감각적인 MZ세대 타겟',
    trustworthy: '신뢰감과 전문성을 강조하는',
    energetic: '역동적이고 활력 넘치는',
};

// =============================================
// 모드 설명
// =============================================
const MODE_DESCRIPTIONS: Record<ScenarioMode, { name: string; focus: string; visualGuidelines: string }> = {
    character: {
        name: '캐릭터 중심',
        focus: '인물의 감정, 행동, 관계에 초점',
        visualGuidelines: '인물 표정, 자세, 감정 표현 핵심. 클로즈업과 미디엄샷 위주.',
    },
    environment: {
        name: '환경/풍경 중심',
        focus: '장소, 분위기, 자연의 아름다움에 초점',
        visualGuidelines: '와이드샷과 풍경 위주. 빛, 날씨, 시간 변화 강조.',
    },
    abstract: {
        name: '추상/개념 중심',
        focus: '개념, 아이디어, 상징적 이미지에 초점',
        visualGuidelines: '상징적 오브젝트, 색상, 형태, 텍스처 중심.',
    },
    narration: {
        name: '나레이션 중심',
        focus: '음성 해설이 중심, 비주얼은 보조',
        visualGuidelines: '나레이션을 시각화하는 이미지. 설명적 비주얼.',
    },
};

// =============================================
// 듀레이션별 씬 구성
// =============================================
interface ClipStructureConfig {
    sceneCount: number;
    description: string;
    beatGuide: string;
}

const CLIP_STRUCTURE_CONFIGS: Record<ClipDuration, ClipStructureConfig> = {
    30: {
        sceneCount: 5,
        description: '30초 클립 (5씬 × 6초)',
        beatGuide: `5씬 구성:
1. Hook — 강렬한 시작, 시선을 사로잡는 순간
2. Setup — 상황/배경 설정
3. Development — 핵심 전개
4. Climax — 절정/하이라이트
5. Resolution — 여운 있는 마무리`,
    },
    60: {
        sceneCount: 10,
        description: '60초 클립 (10씬 × 6초)',
        beatGuide: `10씬 구성:
1. Hook — 강렬한 시작
2. Setup — 상황 설정
3-5. Development — 점진적 전개 (3씬)
6. Climax — 전환점/절정
7-8. Development — 후속 전개 (2씬)
9. Climax — 2차 절정
10. Resolution — 최종 마무리/여운`,
    },
    90: {
        sceneCount: 15,
        description: '90초 클립 (15씬 × 6초)',
        beatGuide: `15씬 구성 (3구간):
[도입부 1-5]
1. Hook — 시작 / 2-3. Setup+Development — 설정과 전개 / 4-5. Development+Climax — 1차 절정

[전개부 6-10]
6. Hook — 전환점 / 7-8. Development — 심화 전개 / 9. Climax — 2차 절정 / 10. Resolution — 중간 해소

[마무리부 11-15]
11. Setup — 새 국면 / 12-13. Development — 마무리 전개 / 14. Climax — 최종 절정 / 15. Resolution — 여운`,
    },
    120: {
        sceneCount: 20,
        description: '120초 클립 (20씬 × 6초)',
        beatGuide: `20씬 구성 (4구간, 각 5씬):
[1구간] Hook → Setup → Development → Development → Climax
[2구간] Hook → Setup → Development → Development → Climax
[3구간] Hook → Development → Development → Climax → Resolution
[4구간] Setup → Development → Development → Climax → Resolution`,
    },
};

// =============================================
// Hailuo 모션 프롬프트 가이드
// =============================================
const HAILUO_MOTION_GUIDE = `
### Hailuo AI 영상 모션 프롬프트 (videoPrompt) 작성 규칙

videoPrompt는 정적 이미지를 6초 영상으로 변환하기 위한 모션/카메라 지시문입니다.
imagePrompt와는 완전히 다른 목적이므로 정적 비주얼 묘사를 반복하지 마세요.

**사용 가능한 카메라 동작:**
- dolly in/out (카메라 전진/후진)
- zoom in/out (줌인/줌아웃)
- pan left/right (좌우 패닝)
- tilt up/down (상하 틸트)
- rack focus (포커스 전환)
- static (고정, 피사체만 움직임)
- orbit/rotate (원형 이동)
- crane up/down (크레인 상하)

**모션 묘사 요소:**
- 인물 동작: "character turns head", "hand reaches out", "gentle smile appears"
- 자연 움직임: "leaves sway", "water ripples", "clouds drift"
- 빛 변화: "light shifts from warm to cool", "sun flare appears"
- 속도감: "slow motion", "time-lapse", "gentle pace"

**비트별 추천 모션:**
- Hook: 빠른 줌인 또는 다이내믹한 카메라 이동 (주의 집중)
- Setup/Development: 부드러운 돌리/패닝 (상황 전달)
- Climax: 극적 줌인 또는 빠른 카메라 전환 (임팩트)
- Resolution: 여유로운 줌아웃 또는 안정적 프레임 (여운)

**필수 규칙:**
- 반드시 영어로 작성
- 카메라 움직임 + 장면 내 동작 + 속도/분위기 포함
- 6초 내에 자연스러운 모션 (과도한 동작 금지)
- 텍스트/자막/로고 언급 금지
- imagePrompt 내용 반복 금지`;

/**
 * POST /api/generate-clip-scenario
 * 6초 단위 클립 시나리오 생성 (Hailuo AI 전용)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' } as ApiErrorResponse);
    }

    const userId = getUserIdFromRequest(req);

    try {
        const { config } = req.body as GenerateClipScenarioRequest;

        if (!config || !config.topic) {
            return res.status(400).json({ error: 'config.topic is required' } as ApiErrorResponse);
        }

        const {
            topic,
            duration = 60,
            tone = 'emotional',
            mode = 'character',
            imageStyle = 'photorealistic',
        } = config;

        const sanitizedTopic = sanitizePrompt(topic, 5000);
        const toneDescription = TONE_DESCRIPTIONS[tone] || TONE_DESCRIPTIONS.emotional;
        const modeInfo = MODE_DESCRIPTIONS[mode] || MODE_DESCRIPTIONS.character;
        const stylePromptText = STYLE_PROMPTS[imageStyle] || STYLE_PROMPTS.photorealistic;
        const structureConfig = CLIP_STRUCTURE_CONFIGS[duration as ClipDuration] || CLIP_STRUCTURE_CONFIGS[60];

        // 모드별 이미지 프롬프트 가이드
        const imagePromptGuidelines = mode === 'character'
            ? `- 한국인 인물 묘사 시 "Korean" 명시
- 인물의 표정, 자세, 시선 방향 구체적으로
- 배경, 조명, 시간대 명시`
            : mode === 'environment'
                ? `- 풍경, 배경, 환경만 묘사 (인물 제외)
- 빛, 날씨, 시간대, 계절 명시
- 공간의 깊이감과 레이어 표현`
                : mode === 'abstract'
                    ? `- 추상적 개념을 시각화
- 색상, 형태, 질감, 패턴 중심
- 상징적 오브젝트와 메타포 활용`
                    : `- 나레이션 내용을 보조하는 이미지
- 정보 전달에 적합한 구도
- 설명적이고 명확한 시각화`;

        // 캐릭터 가이드
        const characterGuide = mode === 'character'
            ? `### 등장인물 제안
- 시나리오에 필요한 주요 등장인물 제안 (1-3명)
- 각 인물의 이름, 역할, 외형 설명 포함
- 한국인 인물: "Korean" 명시`
            : `### 등장인물
- ${mode === 'environment' ? '환경 중심이므로 인물 최소화. suggestedCharacters는 빈 배열.' : mode === 'abstract' ? '추상 모드이므로 인물 없음. suggestedCharacters는 빈 배열.' : '나레이션 중심이므로 인물 선택적. 필요시만 제안.'}`;

        const prompt = `당신은 한국 숏폼 영상 시나리오 전문 작가입니다.
Hailuo AI 영상 생성에 최적화된 6초 단위 클립 시나리오를 작성합니다.

## 핵심 제약 조건 (반드시 준수!)

1. **모든 씬은 정확히 6초입니다.** (Hailuo AI 최대 길이)
2. **나레이션은 20~30자 사이로 작성!** (6초 × 약 4~5자/초)
   - 20자 미만 금지 (침묵 구간 발생)
   - 30자 초과 금지 (TTS가 씬 시간 초과)
3. **videoPrompt 필수!** 매 씬마다 Hailuo AI 모션 프롬프트를 영어로 작성
4. **imagePrompt 필수!** 매 씬마다 정적 이미지 생성용 영어 프롬프트 작성
5. **텍스트/로고/글자가 나타나는 묘사 절대 금지!**

---

## 입력 정보
- **주제**: "${sanitizedTopic}"
- **영상 길이**: ${duration}초 (${structureConfig.sceneCount}씬 × 6초)
- **톤/분위기**: ${tone} - ${toneDescription}
- **시나리오 모드**: ${modeInfo.name} - ${modeInfo.focus}
- **이미지 스타일**: ${imageStyle}

---

## 씬 구조

${structureConfig.beatGuide}

- 스토리비트: "Hook", "Setup", "Development", "Climax", "Resolution" 중 사용
- 총 ${structureConfig.sceneCount}개 씬, 각 6초

---

## 시나리오 모드: ${modeInfo.name}
- **포커스**: ${modeInfo.focus}
- **비주얼 가이드**: ${modeInfo.visualGuidelines}

---

## 나레이션 작성 규칙
- 한국어로 작성, 20~30자 사이 (절대 엄수!)
- 핵심 메시지만 간결하게
- 감정을 자극하는 구체적 디테일
- 불필요한 수식어/부사 제거
- 첫 씬(Hook)은 주의를 끄는 문장으로 시작
- 마지막 씬은 여운을 남기는 문장

---

## 이미지 프롬프트 (imagePrompt) 작성 규칙
- 반드시 영어로 작성
- 스타일 프리픽스: "${stylePromptText.substring(0, 100)}..."
${imagePromptGuidelines}
- 텍스트/로고/글자 묘사 절대 금지

---

${HAILUO_MOTION_GUIDE}

---

${characterGuide}

---

## 출력
- title: 시나리오 제목 (한국어)
- synopsis: 한 줄 요약 (한국어)
- suggestedCharacters: 등장인물 배열
- scenes: ${structureConfig.sceneCount}개 씬 배열`;

        // 사용자별 텍스트 모델 결정
        const textModel = userId ? await getUserTextModel(userId) : MODELS.TEXT;
        let parsed: any;

        if (isOpenAIModel(textModel) && userId) {
            const openaiKey = await getOpenAIKeyForUser(userId);
            const jsonPrompt = `${prompt}\n\nRespond in JSON format with this structure:\n{"title": "시나리오 제목", "synopsis": "한 줄 요약", "suggestedCharacters": [{"name": "이름", "role": "역할", "description": "설명"}], "scenes": [{"sceneNumber": 1, "duration": 6, "storyBeat": "Hook", "visualDescription": "화면 묘사(한국어)", "narration": "나레이션(한국어, 20-30자)", "cameraAngle": "카메라 앵글", "mood": "분위기", "characters": [], "imagePrompt": "영어 이미지 프롬프트", "videoPrompt": "영어 모션 프롬프트"}]}`;
            const resultText = await generateTextWithOpenAI(openaiKey, textModel, jsonPrompt, {
                systemPrompt: 'You are a professional video scenario writer for Korean short-form clips optimized for Hailuo AI video generation. Each scene is exactly 6 seconds. Always respond with valid JSON. Write narrations in Korean (20-30 characters), image prompts in English (no text/logo), and video prompts in English (camera movement and motion only).',
                jsonMode: true,
            });
            parsed = JSON.parse(resultText);
        } else {
            const aiClient = userId ? await getAIClientForUser(userId) : ai;
            const response = await aiClient!.models.generateContent({
                model: textModel,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: {
                                type: Type.STRING,
                                description: "시나리오 제목 (한국어)",
                            },
                            synopsis: {
                                type: Type.STRING,
                                description: "시나리오 한 줄 요약 (한국어)",
                            },
                            suggestedCharacters: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        name: { type: Type.STRING, description: "캐릭터 이름" },
                                        role: { type: Type.STRING, description: "역할" },
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
                                        sceneNumber: { type: Type.NUMBER, description: "씬 번호 (1부터)" },
                                        duration: { type: Type.NUMBER, description: "씬 길이 (6초 고정)" },
                                        storyBeat: { type: Type.STRING, description: "스토리 비트: Hook, Setup, Development, Climax, Resolution" },
                                        visualDescription: { type: Type.STRING, description: "화면 묘사 (한국어)" },
                                        narration: { type: Type.STRING, description: "나레이션 (한국어, 20-30자)" },
                                        cameraAngle: { type: Type.STRING, description: "카메라 앵글" },
                                        mood: { type: Type.STRING, description: "분위기 (한국어, 2-3단어)" },
                                        characters: {
                                            type: Type.ARRAY,
                                            items: { type: Type.STRING },
                                            description: "등장 캐릭터 이름 목록",
                                        },
                                        imagePrompt: { type: Type.STRING, description: "정적 이미지 생성용 영어 프롬프트" },
                                        videoPrompt: { type: Type.STRING, description: "Hailuo AI 모션 프롬프트 (영어, 카메라+동작)" },
                                    },
                                    required: ["sceneNumber", "duration", "storyBeat", "visualDescription", "narration", "cameraAngle", "mood", "characters", "imagePrompt", "videoPrompt"],
                                },
                            },
                        },
                        required: ["title", "synopsis", "suggestedCharacters", "scenes"],
                    },
                    ...getThinkingConfig(textModel),
                },
            });
            parsed = JSON.parse(response.text);
        }

        // Transform scenes with IDs
        const scenes: Scene[] = parsed.scenes.map((scene: any, index: number) => ({
            id: crypto.randomUUID(),
            sceneNumber: scene.sceneNumber || index + 1,
            duration: 6, // 6초 고정
            storyBeat: scene.storyBeat as StoryBeat,
            visualDescription: scene.visualDescription,
            narration: scene.narration,
            cameraAngle: scene.cameraAngle as CameraAngle,
            mood: scene.mood,
            characters: scene.characters || [],
            imagePrompt: scene.imagePrompt,
            videoPrompt: scene.videoPrompt,
        }));

        const scenario: Scenario = {
            id: crypto.randomUUID(),
            title: parsed.title,
            synopsis: parsed.synopsis,
            topic: topic,
            totalDuration: duration,
            tone: tone,
            mode: mode,
            imageStyle: imageStyle,
            suggestedCharacters: parsed.suggestedCharacters || [],
            scenes,
            scenarioType: 'clip',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        return res.status(200).json({ scenario });

    } catch (e) {
        console.error("Error during clip scenario generation:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `Clip scenario generation failed: ${errorMessage}`,
            code: 'GENERATION_FAILED'
        } as ApiErrorResponse);
    }
}
