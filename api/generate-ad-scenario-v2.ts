import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, Type, sanitizePrompt, setCorsHeaders, STYLE_PROMPTS, getThinkingConfig } from './lib/gemini.js';
import type {
    GenerateAdScenarioV2Request, Scenario, Scene, ScenarioTone, ImageStyle,
    StoryBeat, CameraAngle, ApiErrorResponse, AdType, IndustryCategory, TargetAudience, AdDuration
} from './lib/types.js';

// =============================================
// 업종별 비주얼 프리셋
// =============================================
const INDUSTRY_VISUAL_PRESETS: Record<IndustryCategory, {
    keywords: string;
    essentials: string;
    avoid: string;
}> = {
    restaurant: {
        keywords: 'close-up, warm lighting, steam, appetizing, food styling, golden hour dining',
        essentials: '음식 디테일, 조리 과정, 먹는 순간, 식감 표현',
        avoid: '빈 접시, 어두운 조명, 인위적 연출',
    },
    cafe: {
        keywords: 'natural light, cozy, warm tones, lifestyle, latte art, cafe interior',
        essentials: '음료 클로즈업, 카페 인테리어, 여유로운 사람, 디저트',
        avoid: '빈 좌석, 어수선한 배경',
    },
    beauty: {
        keywords: 'soft focus, clean skin, dewy, before-after, bright studio, product texture',
        essentials: '피부 질감, 제품 텍스처, 사용 장면, 발색 표현',
        avoid: '과도한 보정, 비현실적 표현',
    },
    medical: {
        keywords: 'professional, clean, trustworthy, bright interior, medical equipment',
        essentials: '깔끔한 시설, 전문 장비, 상담 장면, 신뢰감 있는 인물',
        avoid: '시술 장면 직접 노출, 공포 유발',
    },
    education: {
        keywords: 'bright, organized, books, learning environment, confident students',
        essentials: '학습 환경, 교재/콘텐츠, 성장 모습, 강사/멘토',
        avoid: '지루한 분위기, 어두운 교실',
    },
    fitness: {
        keywords: 'dynamic, energetic, sweat, natural body, gym, outdoor exercise',
        essentials: '운동 장면, 시설 전경, 변화 과정, 활력 있는 표정',
        avoid: '과도한 근육 강조, 비현실적 체형',
    },
    fashion: {
        keywords: 'editorial, stylish, lookbook, urban backdrop, fabric texture',
        essentials: '착용 모습, 디테일 샷, 코디네이션, 분위기 있는 배경',
        avoid: '정적인 마네킹, 단조로운 배경',
    },
    tech: {
        keywords: 'sleek, modern, screen glow, minimal desk, product shot',
        essentials: '제품 디자인, UI 화면, 사용 장면, 라이프스타일 연동',
        avoid: '복잡한 배경, 기술 용어 텍스트',
    },
    interior: {
        keywords: 'wide angle, natural light, cozy space, texture detail, staged room',
        essentials: '공간 전체 뷰, 디테일 소품, 생활감 있는 연출, 조명 분위기',
        avoid: '어수선한 공간, 인위적 스테이징',
    },
    other: {
        keywords: 'professional, clean, well-lit, commercial quality',
        essentials: '상품/서비스 특성에 맞는 비주얼',
        avoid: '저해상도, 부적절한 연출',
    },
};

// =============================================
// 광고 유형별 HDSER 씬 구조
// =============================================
const HDSER_CONFIGS: Record<AdType, {
    label: string;
    scenes: {
        beat: string;
        role: string;
        visualGuide: string;
        weight: number;
    }[];
    reasonPattern: string;
}> = {
    'product-intro': {
        label: '제품 소개',
        scenes: [
            { beat: 'Hook', role: '완성된 결과물/효과를 먼저 보여줌 ("이거 뭐야?" 유발)', visualGuide: '상품 클로즈업, 사용 결과 하이라이트', weight: 15 },
            { beat: 'Discovery', role: '상품의 디테일, 특징, USP를 보여주는 탐색 시퀀스', visualGuide: '상품 디테일 숏, 소재/질감 강조, 회전 뷰', weight: 25 },
            { beat: 'Story', role: '이 상품이 만들어진 배경이나 고객의 기대감 연출', visualGuide: '제작 과정, 원재료, 장인/셰프 모습', weight: 20 },
            { beat: 'Experience', role: '실제 사용/소비 장면. 오감 자극', visualGuide: '사용 장면 POV, ASMR, 반응 숏', weight: 25 },
            { beat: 'Reason', role: '"이래서 꼭 한번 드셔보세요" 수준의 부드러운 마무리', visualGuide: '만족스러운 표정, 따뜻한 마무리 컷', weight: 15 },
        ],
        reasonPattern: '정보성 추천: 핵심 차별점을 한 문장으로. 예) "국내산 유기농 원두로 매일 아침을 시작해보세요"',
    },
    'problem-solution': {
        label: '문제 해결',
        scenes: [
            { beat: 'Hook', role: '공감되는 문제 상황을 직접적으로 제시 ("이런 적 있죠?")', visualGuide: '불편한 상황, 좌절하는 표정, 문제 시각화', weight: 15 },
            { beat: 'Discovery', role: '해결책으로서의 상품 등장. "이게 있었네" 느낌', visualGuide: '상품 등장 모먼트, 패키지/외관 첫 공개', weight: 20 },
            { beat: 'Story', role: '문제로 고민하던 일상 → 상품과 만난 전환점', visualGuide: '일상 속 고민 장면 → 밝아지는 전환', weight: 15 },
            { beat: 'Experience', role: 'Before → After 시연. 가장 시간 투자하는 핵심 씬', visualGuide: '분할 화면, 시간 경과, 수치/시각적 변화', weight: 35 },
            { beat: 'Reason', role: '"이런 분들께 추천드려요" + 핵심 차별점 1개', visualGuide: '밝은 표정, 변화된 일상', weight: 15 },
        ],
        reasonPattern: '공감 추천: 같은 고민이라면. 예) "저처럼 ○○로 고민이셨다면, 한번 경험해보시길 추천드려요"',
    },
    'lifestyle': {
        label: '라이프스타일',
        scenes: [
            { beat: 'Hook', role: '감성적 이미지/분위기로 시작. 말보다 비주얼로 끌어당김', visualGuide: '분위기 있는 와이드샷, 자연광, 감성 BGM', weight: 20 },
            { beat: 'Discovery', role: '이 라이프스타일의 일부로서 자연스럽게 상품 노출', visualGuide: '일상 속 자연스러운 사용 장면, 소품처럼 등장', weight: 15 },
            { beat: 'Story', role: '하루의 흐름 속에서 상품과 함께하는 시간 (핵심 씬)', visualGuide: '시간 흐름 몽타주, 여유/행복한 순간들', weight: 30 },
            { beat: 'Experience', role: '감각적 디테일. 향, 맛, 촉감을 시각적으로 전달', visualGuide: '클로즈업, 슬로모션, 텍스처 강조', weight: 20 },
            { beat: 'Reason', role: '여운을 남기는 한 문장. 브랜드 메시지 또는 감성 카피', visualGuide: '여운 있는 엔딩 컷, 로고', weight: 15 },
        ],
        reasonPattern: '감성 여운: 브랜드 한 줄 카피. 예) "당신의 하루에도 이런 여유가 있기를"',
    },
    'testimonial': {
        label: '후기/체험',
        scenes: [
            { beat: 'Hook', role: '놀라운 결과/변화를 먼저 보여줌 ("이게 진짜?")', visualGuide: 'After 결과 먼저, 감탄 표정', weight: 15 },
            { beat: 'Discovery', role: '어떤 계기로 이 상품을 알게 되었는지', visualGuide: '검색, 추천 받는 장면, SNS 발견', weight: 15 },
            { beat: 'Story', role: '사용 전 고민/상황과 사용을 결심한 계기', visualGuide: '사용 전 일상, 구매 결심 모먼트', weight: 20 },
            { beat: 'Experience', role: '실제 사용 과정과 변화. 시간 경과 표현', visualGuide: '사용 장면 타임랩스, 단계별 변화', weight: 35 },
            { beat: 'Reason', role: '"3개월째 쓰고 있는데, 이건 진짜 추천이에요"', visualGuide: '현재 만족하는 일상, 자연스러운 추천', weight: 15 },
        ],
        reasonPattern: '솔직 추천: 개인 경험 기반. 예) "3개월째 쓰고 있는데, 이건 진짜 추천이에요"',
    },
    'promotion': {
        label: '이벤트/혜택',
        scenes: [
            { beat: 'Hook', role: '시선을 사로잡는 혜택/숫자 임팩트 ("50% 할인?!")', visualGuide: '임팩트 있는 숫자/혜택, 놀라는 표정', weight: 20 },
            { beat: 'Discovery', role: '이벤트 내용과 혜택 구체적 소개', visualGuide: '혜택 아이템 나열, 비교 장면', weight: 20 },
            { beat: 'Story', role: '상품/서비스의 핵심 가치 빠르게 전달', visualGuide: '상품 하이라이트, 사용 장면', weight: 20 },
            { beat: 'Experience', role: '실제 혜택을 누리는 모습, 가성비 체험', visualGuide: '득템 표정, 합리적 소비 장면', weight: 25 },
            { beat: 'Reason', role: '"지금 이 가격이면 한번 시도해볼 만하지 않을까요?"', visualGuide: '기간 한정 정보, 마감 임박 느낌', weight: 15 },
        ],
        reasonPattern: '기회 안내: 혜택 정보 전달. 예) "지금 이 가격이면 한번 시도해볼 만하지 않을까요?"',
    },
    'brand-story': {
        label: '브랜드 스토리',
        scenes: [
            { beat: 'Hook', role: '의미 있는 질문 또는 화두 던지기 ("좋은 커피란 뭘까요?")', visualGuide: '시적인 이미지, 추상적 비주얼, 질문', weight: 15 },
            { beat: 'Discovery', role: '브랜드의 시작점, 창업 스토리, 동기', visualGuide: '과거 사진, 시작하는 모습, 초심', weight: 20 },
            { beat: 'Story', role: '성장 과정, 장인정신, 노력의 순간들 (핵심 씬)', visualGuide: '작업 과정, 디테일, 사람들, 시간의 흐름', weight: 30 },
            { beat: 'Experience', role: '지금의 브랜드가 만들어내는 경험과 가치', visualGuide: '현재 상품/서비스, 고객 경험, 공간', weight: 20 },
            { beat: 'Reason', role: '브랜드의 가치와 철학을 한 문장으로', visualGuide: '로고, 브랜드 메시지, 여운 있는 컷', weight: 15 },
        ],
        reasonPattern: '가치 전달: 브랜드 메시지로 마무리. 예) "좋은 재료로, 정직하게. [브랜드명]이 걸어온 길입니다"',
    },
};

// =============================================
// 타겟 오디언스 한국어 매핑
// =============================================
const TARGET_LABELS: Record<TargetAudience, string> = {
    '10s': '10대 청소년',
    '20s-female': '20대 여성',
    '20s-male': '20대 남성',
    '30s-female': '30대 여성',
    '30s-male': '30대 남성',
    '40s-parent': '40대 학부모/부모',
    '50s-plus': '50대 이상 시니어',
    'all': '전연령',
};

const INDUSTRY_LABELS: Record<IndustryCategory, string> = {
    restaurant: '음식점',
    cafe: '카페',
    beauty: '뷰티/화장품',
    medical: '병원/의원',
    education: '교육',
    fitness: '피트니스/헬스',
    fashion: '패션/의류',
    tech: 'IT/테크',
    interior: '인테리어/리빙',
    other: '기타',
};

const TONE_DESCRIPTIONS: Record<ScenarioTone, string> = {
    emotional: '감성적이고 공감을 이끌어내는',
    dramatic: '긴장감과 임팩트 있는',
    inspirational: '영감을 주고 동기부여하는',
    romantic: '따뜻하고 감미로운 분위기의',
    comedic: '유쾌하고 재미있는',
    mysterious: '호기심을 자극하는',
    nostalgic: '추억과 그리움을 자극하는',
    educational: '정보를 제공하고 신뢰감을 주는',
    promotional: '구매 욕구를 직접 자극하는 다이렉트 세일즈',
    luxurious: '고급스럽고 세련된 프리미엄 브랜드',
    trendy: '힙하고 감각적인 MZ세대 타겟',
    trustworthy: '신뢰감과 전문성을 강조하는',
    energetic: '역동적이고 활력 넘치는',
};

/**
 * POST /api/generate-ad-scenario-v2
 * HDSER 프레임워크 기반 광고 시나리오 생성
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
        const { config } = req.body as GenerateAdScenarioV2Request;

        if (!config || !config.productName || !config.adType || !config.industry) {
            return res.status(400).json({ error: 'adType, industry, productName are required' } as ApiErrorResponse);
        }

        const {
            adType,
            industry,
            productName,
            targetAudiences = ['all'],
            tone = 'inspirational',
            imageStyle = 'photorealistic',
            duration = 30,
            // 제품 소개
            usps = [],
            launchReason,
            priceInfo,
            // 문제 해결
            painPoint,
            solution,
            effectResult,
            // 라이프스타일
            brandMood,
            usageScene,
            stylingKeywords,
            // 후기/체험
            beforeState,
            afterChange,
            experienceHighlight,
            // 이벤트/혜택
            offerDetails,
            periodCondition,
            discountInfo,
            // 브랜드 스토리
            brandPhilosophy,
            originStory,
            coreMessage,
            // 타겟 상세
            customTarget,
        } = config;

        const sanitizedName = sanitizePrompt(productName, 200);
        const toneDescription = TONE_DESCRIPTIONS[tone] || TONE_DESCRIPTIONS.inspirational;
        const stylePromptText = STYLE_PROMPTS[imageStyle] || STYLE_PROMPTS.photorealistic;
        const hdserConfig = HDSER_CONFIGS[adType];
        const industryPreset = INDUSTRY_VISUAL_PRESETS[industry];
        const targetLabels = targetAudiences.map(t => TARGET_LABELS[t]).join(', ');
        const industryLabel = INDUSTRY_LABELS[industry];

        // 씬 수 결정 (duration 기반)
        const sceneCount = hdserConfig.scenes.length;
        const sceneDuration = Math.round(duration / sceneCount);

        // 씬 구조 텍스트 생성
        const sceneStructureText = hdserConfig.scenes.map((s, i) =>
            `씬 ${i + 1} - ${s.beat} (비중 ${s.weight}%):\n  역할: ${s.role}\n  비주얼 가이드: ${s.visualGuide}`
        ).join('\n\n');

        const prompt = `당신은 대한민국 최고의 숏폼 광고 크리에이터입니다.
틱톡, 유튜브 쇼츠, 인스타 릴스에서 수백만 조회수를 기록하는 광고 영상 시나리오를 작성합니다.

## HDSER 프레임워크 (Hook-Discovery-Story-Experience-Reason)

기존 AICPAC를 대체하는 새로운 5씬 광고 구조입니다.
마지막 씬은 강압적 CTA 대신 자연스러운 '추천 이유'로 마무리합니다.

### 광고 유형: ${hdserConfig.label} (${adType})
### Reason(마지막 씬) 톤: ${hdserConfig.reasonPattern}

---

## 씬 구조 (${sceneCount}씬 × ${sceneDuration}초 = ${duration}초)

${sceneStructureText}

---

## 입력 정보

- **업종**: ${industryLabel}
- **상품/서비스명**: "${sanitizedName}"
- **타겟 고객**: ${targetLabels}${customTarget ? `\n- **타겟 상세**: ${sanitizePrompt(customTarget, 500)}` : ''}
- **톤/분위기**: ${tone} - ${toneDescription}
- **이미지 스타일**: ${imageStyle}
${adType === 'product-intro' ? `- **핵심 특징 (USP)**: ${usps.length > 0 ? usps.map((u: string, i: number) => `${i + 1}. ${sanitizePrompt(u, 200)}`).join(' / ') : '(미입력)'}
${launchReason ? `- **출시 배경**: ${sanitizePrompt(launchReason, 300)}` : ''}
${priceInfo ? `- **가격대**: ${sanitizePrompt(priceInfo, 200)}` : ''}` : ''}${adType === 'problem-solution' ? `- **고객 문제점**: ${painPoint ? sanitizePrompt(painPoint, 300) : '(미입력)'}
- **해결 방법/원리**: ${solution ? sanitizePrompt(solution, 300) : '(미입력)'}
- **효과/결과**: ${effectResult ? sanitizePrompt(effectResult, 300) : '(미입력)'}` : ''}${adType === 'lifestyle' ? `- **브랜드 분위기/무드**: ${brandMood ? sanitizePrompt(brandMood, 300) : '(미입력)'}
- **사용 장면/상황**: ${usageScene ? sanitizePrompt(usageScene, 300) : '(미입력)'}
${stylingKeywords ? `- **연출 키워드**: ${sanitizePrompt(stylingKeywords, 300)}` : ''}` : ''}${adType === 'testimonial' ? `- **사용 전 고민/상태**: ${beforeState ? sanitizePrompt(beforeState, 300) : '(미입력)'}
- **사용 후 변화**: ${afterChange ? sanitizePrompt(afterChange, 300) : '(미입력)'}
${experienceHighlight ? `- **체험 포인트**: ${sanitizePrompt(experienceHighlight, 300)}` : ''}` : ''}${adType === 'promotion' ? `- **이벤트/혜택 내용**: ${offerDetails ? sanitizePrompt(offerDetails, 300) : '(미입력)'}
- **기간/조건**: ${periodCondition ? sanitizePrompt(periodCondition, 300) : '(미입력)'}
- **가격/할인 정보**: ${discountInfo ? sanitizePrompt(discountInfo, 300) : '(미입력)'}` : ''}${adType === 'brand-story' ? `- **브랜드 철학/가치**: ${brandPhilosophy ? sanitizePrompt(brandPhilosophy, 300) : '(미입력)'}
${originStory ? `- **브랜드 탄생 배경**: ${sanitizePrompt(originStory, 300)}` : ''}
- **핵심 메시지**: ${coreMessage ? sanitizePrompt(coreMessage, 300) : '(미입력)'}` : ''}

---

## 업종별 비주얼 가이드 (${industryLabel})

- **촬영 키워드**: ${industryPreset.keywords}
- **필수 비주얼 요소**: ${industryPreset.essentials}
- **피해야 할 요소**: ${industryPreset.avoid}

---

## 이미지 프롬프트 작성 규칙

### 스타일 프리픽스
모든 imagePrompt 앞에 이 스타일을 추가하세요:
"${stylePromptText.substring(0, 120)}..."

### 신규 프롬프트 공식 (반드시 준수)
[비주얼 스타일] + [업종 프리셋 키워드] + [씬별 역할 비주얼] + [USP 반영] + [타겟 페르소나] + [분위기]

예시) ${industryLabel} + ${hdserConfig.label} + ${tone} 톤의 Scene 3 (Story):
"${stylePromptText.substring(0, 60)}, ${industryPreset.keywords.split(',').slice(0, 3).join(',')}, [씬 역할에 맞는 구체적 장면 묘사], Korean ${targetAudiences[0] === 'all' ? 'adult' : targetAudiences[0]} character"

### 중요 규칙
- 상품이 자연스럽게 장면에 녹아들도록 묘사 (플레이스홀더 없이!)
- 사용자 참조 이미지가 있으면 그 상품의 외관/분위기를 반영
- 인물이 필요한 씬에는 "Korean [타겟 연령/성별] person/model" 포함
- 배경, 조명, 소품을 업종에 맞게 구체적으로 묘사
- imagePrompt는 반드시 영어로 작성

### 카메라 가이드
- Hook: 와이드샷 또는 임팩트 있는 클로즈업
- Discovery: 상품 중심 미디엄샷/클로즈업
- Story: 라이프스타일 와이드샷, 미디엄샷
- Experience: POV, 클로즈업, 디테일샷
- Reason: 미디엄샷 또는 여유로운 와이드샷

---

## 나레이션 규칙 (${sceneDuration}초 씬 최적화)
- 각 씬 나레이션은 한국어로 ${Math.floor(sceneDuration * 4)}~${sceneDuration * 5}자 사이로 작성
- ${sceneDuration * 5}자 초과 금지! ${sceneDuration}초 안에 읽어야 함
- 짧고 임팩트 있게, 광고 카피처럼 작성
- Reason 씬: 강압적 CTA("지금 구매!") 대신 부드러운 추천 톤`;

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
                            description: "광고 시나리오 제목",
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
                                    sceneNumber: { type: Type.NUMBER, description: "씬 번호 (1부터)" },
                                    duration: { type: Type.NUMBER, description: `씬 길이 (${sceneDuration}초)` },
                                    storyBeat: { type: Type.STRING, description: "HDSER 비트: Hook, Discovery, Story, Experience, Reason 중 하나" },
                                    visualDescription: { type: Type.STRING, description: "화면에 보이는 것 (한국어, 구체적 시각 묘사)" },
                                    narration: { type: Type.STRING, description: `나레이션 (한국어, ${Math.floor(sceneDuration * 4)}-${sceneDuration * 5}자, 광고 카피 스타일)` },
                                    cameraAngle: { type: Type.STRING, description: "카메라 앵글" },
                                    mood: { type: Type.STRING, description: "분위기 (한국어, 2-3단어)" },
                                    imagePrompt: { type: Type.STRING, description: "이미지 생성용 영어 프롬프트 (신규 공식 적용)" },
                                },
                                required: ["sceneNumber", "duration", "storyBeat", "visualDescription", "narration", "cameraAngle", "mood", "imagePrompt"],
                            },
                        },
                    },
                    required: ["title", "synopsis", "scenes"],
                },
                ...getThinkingConfig(MODELS.TEXT),
            },
        });

        const parsed = JSON.parse(response.text);

        // Transform scenes with IDs
        const scenes: Scene[] = parsed.scenes.map((scene: any, index: number) => ({
            id: crypto.randomUUID(),
            sceneNumber: scene.sceneNumber || index + 1,
            duration: sceneDuration,
            storyBeat: scene.storyBeat as StoryBeat,
            visualDescription: scene.visualDescription,
            narration: scene.narration,
            cameraAngle: scene.cameraAngle as CameraAngle,
            mood: scene.mood,
            characters: [],
            imagePrompt: scene.imagePrompt,
        }));

        // Build Scenario object (V2 필드 포함)
        const scenario: Scenario = {
            id: crypto.randomUUID(),
            title: parsed.title,
            synopsis: parsed.synopsis,
            topic: `[광고] ${productName}`,
            totalDuration: duration,
            tone: tone,
            mode: 'narration',
            imageStyle: imageStyle,
            suggestedCharacters: [],
            scenes,
            scenarioType: 'ad',
            productName: productName,
            productFeatures: sanitizedUsps.join(', '),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        return res.status(200).json({ scenario });

    } catch (e) {
        console.error("Error during ad scenario V2 generation:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `Ad scenario V2 generation failed: ${errorMessage}`,
            code: 'GENERATION_FAILED'
        } as ApiErrorResponse);
    }
}
