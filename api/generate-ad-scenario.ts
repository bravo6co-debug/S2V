import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, Type, sanitizePrompt, setCorsHeaders, STYLE_PROMPTS } from './lib/gemini.js';
import type { GenerateAdScenarioRequest, Scenario, Scene, ScenarioTone, ImageStyle, StoryBeat, CameraAngle, ApiErrorResponse } from './lib/types.js';

const TONE_DESCRIPTIONS: Record<ScenarioTone, string> = {
    emotional: '감성적이고 공감을 이끌어내는 광고',
    dramatic: '긴장감과 임팩트 있는 광고',
    inspirational: '영감을 주고 동기부여하는 광고',
    romantic: '따뜻하고 감미로운 분위기의 광고',
    comedic: '유쾌하고 재미있는 광고',
    mysterious: '호기심을 자극하는 광고',
    nostalgic: '추억과 그리움을 자극하는 광고',
    educational: '정보를 제공하고 신뢰감을 주는 광고',
    promotional: '구매 욕구를 직접 자극하는 다이렉트 세일즈 광고. 상품 장점, 할인, 한정 특가 등 CTA 중심의 공격적 마케팅',
    luxurious: '고급스럽고 세련된 프리미엄 브랜드 광고. 미니멀하고 정제된 비주얼, 슬로우 모션, 고급 소재 질감 강조',
    trendy: '힙하고 감각적인 MZ세대 타겟 광고. SNS 바이럴 감성, 빠른 컷, 밈 요소, 신선하고 위트 있는 연출',
    trustworthy: '신뢰감과 전문성을 강조하는 광고. 전문가 추천, 인증 마크, 사용자 리뷰, 데이터 기반의 설득력 있는 구성',
    energetic: '역동적이고 활력 넘치는 에너지 광고. 스포츠, 아웃도어, 액티브 라이프스타일, 빠른 템포와 강렬한 비주얼',
};

/**
 * POST /api/generate-ad-scenario
 * 30초 광고 숏폼 시나리오 생성 (6씬 × 5초)
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
        const { config } = req.body as GenerateAdScenarioRequest;

        if (!config || !config.productName) {
            return res.status(400).json({ error: 'config.productName is required' } as ApiErrorResponse);
        }

        const { productName, productFeatures, tone = 'inspirational', imageStyle = 'photorealistic' } = config;
        const sanitizedName = sanitizePrompt(productName, 200);
        const sanitizedFeatures = sanitizePrompt(productFeatures, 2000);
        const toneDescription = TONE_DESCRIPTIONS[tone] || TONE_DESCRIPTIONS.inspirational;
        const stylePromptText = STYLE_PROMPTS[imageStyle] || STYLE_PROMPTS.photorealistic;

        const prompt = `당신은 대한민국 최고의 숏폼 광고 크리에이터입니다.
틱톡, 유튜브 쇼츠, 인스타 릴스에서 수백만 조회수를 기록하는 30초 광고 영상 시나리오를 작성합니다.
상품을 돋보이게 하면서도 시청자가 끝까지 보고 구매 욕구를 느끼게 만드는 전문가입니다.

## 30초 광고 숏폼 핵심 원칙

### 1. 5초 단위 빠른 전환
- 총 6개 씬, 각 5초씩 = 30초
- 5초마다 화면이 바뀌며 시청자의 주의력을 잡아둠
- 빠른 컷 전환으로 현대적이고 역동적인 느낌

### 2. 광고 6씬 구조 (AICPAC)
1. **씬 1 - Attention (주목)**: 강렬한 Hook. 상품의 핵심 문제/니즈를 즉시 제시. "이거 몰랐죠?", "아직도 이렇게 하세요?" 등
2. **씬 2 - Interest (관심)**: 문제 상황 공감. 타겟 소비자가 겪는 불편/고민을 구체적으로 보여줌
3. **씬 3 - Credibility (신뢰)**: 상품 등장. 상품이 해결책임을 보여줌. 제품 클로즈업, 핵심 스펙/특징
4. **씬 4 - Proof (증명)**: 상품 사용 장면/효과. Before-After, 사용 모습, 기능 시연
5. **씬 5 - Appeal (어필)**: 감성적 호소 + 추가 장점. 사용자 만족 표현, 라이프스타일 연출
6. **씬 6 - CTA (행동유도)**: 구매 유도. "지금 바로", "링크 클릭", 프로모션 정보. 상품 + 로고 정리샷

### 3. 상품 이미지 컨텍스트 유지 (매우 중요!)
- 사용자가 나중에 상품 실물 이미지를 업로드합니다
- **imagePrompt에는 상품을 직접 상세 묘사하지 마세요**
- 대신 상품이 놓일 **배경, 환경, 분위기, 조명, 구도**를 구체적으로 묘사
- 상품은 "[PRODUCT]" 플레이스홀더로 표시
- 예시: "Clean white studio background with soft rim lighting, [PRODUCT] centered on a marble surface, shallow depth of field, premium product photography"
- 이렇게 하면 사용자가 업로드한 실제 상품 이미지와 자연스럽게 합성됩니다

### 4. 나레이션 규칙 (5초 씬 최적화)
- **[필수] 각 씬 나레이션은 20~25자 사이로 작성!**
- **[절대 금지] 25자 초과 금지!** 5초 안에 읽어야 함
- **[계산법]** 한국어 기준 1초 = 약 5글자, 5초 씬 = 최대 25자
- 20자 미만도 금지 (너무 짧으면 어색함)
- 짧고 임팩트 있게. 광고 카피처럼 작성
- 각 나레이션이 독립적으로 읽혀야 함 (5초 단위로 끊어짐)

---

## 입력 정보
- **상품명**: "${sanitizedName}"
- **상품 특징**: "${sanitizedFeatures}"
- **톤/분위기**: ${tone} - ${toneDescription}
- **이미지 스타일**: ${imageStyle}

---

## 이미지 프롬프트 작성 규칙

### 스타일 프리픽스
모든 imagePrompt 앞에 이 스타일을 추가하세요:
"${stylePromptText.substring(0, 120)}..."

### 상품 촬영 환경 묘사 가이드
- 씬 1 (Hook): 문제 상황을 보여주는 환경 (예: 지저분한 주방, 건조한 피부 클로즈업)
- 씬 2 (관심): 공감할 수 있는 일상 장면 (예: 고민하는 표정, 불편한 상황)
- 씬 3 (상품 등장): **프리미엄 상품 촬영 환경** - 스튜디오 조명, 깔끔한 배경, [PRODUCT] 중앙 배치
- 씬 4 (증명): 상품 사용 장면의 환경 (예: 깨끗해진 주방 with [PRODUCT], 촉촉한 피부 with [PRODUCT])
- 씬 5 (어필): 라이프스타일 장면 (예: 만족스러운 표정의 사용자 with [PRODUCT])
- 씬 6 (CTA): 상품 정리샷 (예: 그라데이션 배경, [PRODUCT] 중앙, 프로모션 텍스트 공간)

### 카메라 가이드
- 상품 클로즈업과 와이드샷 번갈아 사용
- 씬 3, 6은 상품 중심 구도
- 한국인 모델 묘사 시 "Korean" 명시`;

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
                            description: "광고 시나리오 제목 (예: '[상품명] 30초 광고')",
                        },
                        synopsis: {
                            type: Type.STRING,
                            description: "광고 콘셉트 한 줄 요약",
                        },
                        scenes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    sceneNumber: { type: Type.NUMBER, description: "씬 번호 (1-6)" },
                                    duration: { type: Type.NUMBER, description: "씬 길이 (항상 5초)" },
                                    storyBeat: { type: Type.STRING, description: "스토리 비트: Hook, Setup, Development, Climax, Resolution 중 하나" },
                                    adPhase: { type: Type.STRING, description: "광고 단계: Attention, Interest, Credibility, Proof, Appeal, CTA 중 하나" },
                                    visualDescription: { type: Type.STRING, description: "화면에 보이는 것 (한국어, 구체적 시각 묘사)" },
                                    narration: { type: Type.STRING, description: "나레이션 (한국어, 20-25자, 광고 카피 스타일)" },
                                    cameraAngle: { type: Type.STRING, description: "카메라 앵글" },
                                    mood: { type: Type.STRING, description: "분위기 (한국어, 2-3단어)" },
                                    imagePrompt: { type: Type.STRING, description: "이미지 생성용 영어 프롬프트 (상품은 [PRODUCT]로 표시)" },
                                },
                                required: ["sceneNumber", "duration", "storyBeat", "adPhase", "visualDescription", "narration", "cameraAngle", "mood", "imagePrompt"],
                            },
                        },
                    },
                    required: ["title", "synopsis", "scenes"],
                },
            },
        });

        const parsed = JSON.parse(response.text);

        // Transform scenes with IDs
        const scenes: Scene[] = parsed.scenes.map((scene: any, index: number) => ({
            id: crypto.randomUUID(),
            sceneNumber: scene.sceneNumber || index + 1,
            duration: 5, // 항상 5초
            storyBeat: scene.storyBeat as StoryBeat,
            visualDescription: scene.visualDescription,
            narration: scene.narration,
            cameraAngle: scene.cameraAngle as CameraAngle,
            mood: scene.mood,
            characters: [],
            imagePrompt: scene.imagePrompt,
        }));

        // Build Scenario object
        const scenario: Scenario = {
            id: crypto.randomUUID(),
            title: parsed.title,
            synopsis: parsed.synopsis,
            topic: `[광고] ${productName}`,
            totalDuration: 30,
            tone: tone,
            mode: 'narration', // 광고는 나레이션 중심
            imageStyle: imageStyle,
            suggestedCharacters: [],
            scenes,
            scenarioType: 'ad',
            productName: productName,
            productFeatures: productFeatures,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        return res.status(200).json({ scenario });

    } catch (e) {
        console.error("Error during ad scenario generation:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `Ad scenario generation failed: ${errorMessage}`,
            code: 'GENERATION_FAILED'
        } as ApiErrorResponse);
    }
}
