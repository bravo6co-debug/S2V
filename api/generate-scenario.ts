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
    educational: '지식과 정보 전달, 학습과 인사이트를 제공하는 교육적 스토리. 역사, 과학, 경영, 심리학 등 다양한 학문적 주제 포함.',
    promotional: '구매 욕구와 관심을 자극하는 홍보/광고 스토리. 상품이나 서비스의 매력을 극대화하고, CTA(행동유도)가 자연스럽게 녹아든 상업 콘텐츠.',
    luxurious: '고급스럽고 세련된 프리미엄 브랜드 감성의 스토리. 정제된 비주얼, 절제된 톤, 하이엔드 라이프스타일을 보여주는 럭셔리 콘텐츠.',
    trendy: '힙하고 감각적인 MZ세대 타겟 콘텐츠. SNS 트렌드, 밈 감성, 빠른 컷 전환, 신선하고 위트 있는 연출.',
    trustworthy: '신뢰감과 전문성을 전달하는 콘텐츠. 데이터, 전문가 의견, 인증, 리뷰 등을 활용한 권위 있는 스토리.',
    energetic: '역동적이고 활력 넘치는 에너지틱한 콘텐츠. 스포츠, 아웃도어, 액티브 라이프스타일, 빠른 템포의 활기찬 분위기.',
};

// 톤별 Hook 예시 (바이럴 콘텐츠 참고용)
const HOOK_EXAMPLES: Record<ScenarioTone, string[]> = {
    emotional: [
        '"엄마가 마지막으로 해준 도시락을 열었을 때..."',
        '"10년 만에 고향에 돌아온 날, 그 골목은 그대로였다"',
        '"아버지의 낡은 지갑에서 발견한 사진 한 장"',
    ],
    dramatic: [
        '"그 문자를 본 순간, 모든 게 달라졌습니다"',
        '"CCTV에 찍힌 그 장면을 보고 소름이 돋았다"',
        '"아무도 몰랐던 진실이 밝혀지는 순간"',
    ],
    inspirational: [
        '"모두가 불가능하다고 했던 그 일을 해냈습니다"',
        '"포기하려던 그 순간, 한 통의 전화가 왔다"',
        '"실패를 100번 겪은 후에야 알게 된 것"',
    ],
    romantic: [
        '"우연히 마주친 그 사람이 운명이었을까"',
        '"7년 동안 짝사랑했던 그에게 고백한 날"',
        '"헤어지자는 말 대신 그가 건넨 것"',
    ],
    comedic: [
        '"한국 직장인의 월요일 아침 (현실버전)"',
        '"엄마가 내 방에 갑자기 들어왔을 때 나의 반응"',
        '"처음 자취할 때 vs 자취 3년차"',
    ],
    mysterious: [
        '"이 영상의 마지막 3초를 보면 소름이 돋습니다"',
        '"아무도 설명하지 못하는 이 현상"',
        '"밤 12시에 절대 하면 안 되는 것"',
    ],
    nostalgic: [
        '"2000년대 초등학생이라면 공감할 기억들"',
        '"그때는 몰랐는데, 그게 마지막이었다"',
        '"어릴 때 할머니 집 가면 꼭 있던 것들"',
    ],
    educational: [
        '"한국인의 90%가 모르는 경제 상식"',
        '"역사가 숨긴 충격적인 진실"',
        '"심리학자들이 밝힌 성공하는 사람들의 공통점"',
        '"이 한 가지만 알면 인생이 달라집니다"',
    ],
    promotional: [
        '"이거 하나로 피부가 달라졌습니다 (실화)"',
        '"100만 개 팔린 이유가 있었다"',
        '"쓰자마자 바로 체감되는 차이"',
        '"아직도 이걸 안 쓰고 계세요?"',
    ],
    luxurious: [
        '"당신이 이것을 가질 자격이 있는 이유"',
        '"모든 디테일에 장인의 손길이 닿았습니다"',
        '"진짜 프리미엄은 다르다는 걸 느끼는 순간"',
    ],
    trendy: [
        '"요즘 인스타에서 난리 난 그 제품"',
        '"MZ세대가 열광하는 이유 3가지"',
        '"이거 모르면 트렌드에 뒤처진 겁니다"',
        '"틱톡에서 1000만뷰 찍은 그 아이템"',
    ],
    trustworthy: [
        '"전문가 10명 중 9명이 추천한 이유"',
        '"3년간의 연구 끝에 나온 결과물"',
        '"실제 사용자 5000명의 후기를 분석해봤습니다"',
        '"인증 받은 제품만이 가능한 것들"',
    ],
    energetic: [
        '"당장 밖으로 뛰어나가고 싶게 만드는 영상"',
        '"이 에너지, 느껴지시나요?"',
        '"아침 6시, 그는 이미 달리고 있었다"',
        '"한계를 깨는 순간의 쾌감"',
    ],
};

// 스토리비트별 감정 목표
const STORYBEAT_EMOTIONS: Record<string, string> = {
    Hook: '호기심, 충격, 또는 공감 중 하나를 강하게 자극. "뭐지?" 또는 "나도 그래!" 반응 유도. 시청자가 스크롤을 멈추게 만드는 강력한 첫 인상.',
    Setup: '캐릭터/상황에 감정 이입 유도. 시청자가 주인공의 편이 되게 만들기. "이 사람이 어떻게 될까?" 궁금증 형성.',
    Development: '긴장감 상승. 장애물과 도전 제시. "어떻게 될까?" 기대감 극대화. 다음 씬을 보지 않으면 안 될 것 같은 느낌.',
    Climax: '가장 강렬한 감정의 정점. 모든 것이 터지는 순간. 눈물, 웃음, 놀라움 등 최고조의 감정 경험.',
    Resolution: '만족스러운 해소 또는 여운 있는 마무리. 공유하고 싶은 마지막 인상. "이거 친구한테 보여줘야겠다" 충동 유발.',
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
    // 씬 개수 계산: 총 길이 / 10초 (씬당 고정 10초)
    const sceneCount = Math.max(2, Math.round(duration / 10));

    if (duration <= 30) {
        return {
            minScenes: 2,
            maxScenes: 3,
            perSceneMin: 10,
            perSceneMax: 10,
            chapters: 1,
            storyStructure: 'Hook → Resolution (간소화된 구조, 임팩트 있는 시작과 끝)',
            narrationMaxLength: 50,  // 10초 씬 → 최대 50자
        };
    }
    if (duration <= 90) {
        return {
            minScenes: Math.max(4, sceneCount - 1),
            maxScenes: sceneCount + 1,
            perSceneMin: 10,
            perSceneMax: 10,
            chapters: 1,
            storyStructure: 'Hook → Setup → Development → Climax → Resolution (표준 5단계 구조)',
            narrationMaxLength: 50,  // 10초 씬 → 최대 50자
        };
    }
    if (duration <= 180) {
        return {
            minScenes: Math.max(10, sceneCount - 2),
            maxScenes: sceneCount + 2,
            perSceneMin: 10,
            perSceneMax: 10,
            chapters: 2,
            storyStructure: '2개 챕터로 구성. 각 챕터별로 미니 기승전결 구조.',
            narrationMaxLength: 50,  // 10초 씬 → 최대 50자
        };
    }
    if (duration <= 300) {
        return {
            minScenes: Math.max(20, sceneCount - 3),
            maxScenes: sceneCount + 3,
            perSceneMin: 10,
            perSceneMax: 10,
            chapters: 3,
            storyStructure: '3개 챕터로 구성. 시작-발전-결말의 대단락 구조.',
            narrationMaxLength: 50,  // 10초 씬 → 최대 50자
        };
    }
    // 5분 이상 (최대 10분)
    return {
        minScenes: Math.max(30, sceneCount - 5),
        maxScenes: sceneCount + 5,
        perSceneMin: 10,
        perSceneMax: 10,
        chapters: 6,
        storyStructure: '4-6개 챕터로 구성. 에피소드형 구조로 각 챕터가 독립적인 미니 스토리.',
        narrationMaxLength: 50,  // 10초 씬 → 최대 50자
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

        const { topic, duration, tone, mode = 'character', imageStyle = 'photorealistic', customTone, includeCharacters = false } = config;
        const sanitizedTopic = sanitizePrompt(topic, 5000);
        const durationConfig = getDurationConfig(duration);
        const toneDescription = tone === 'custom' && customTone ? customTone : (TONE_DESCRIPTIONS[tone as ScenarioTone] || TONE_DESCRIPTIONS.emotional);
        const modeInfo = MODE_DESCRIPTIONS[mode] || MODE_DESCRIPTIONS.character;
        const styleDescription = STYLE_DESCRIPTIONS[imageStyle] || STYLE_DESCRIPTIONS.photorealistic;
        const stylePromptText = STYLE_PROMPTS[imageStyle] || STYLE_PROMPTS.photorealistic;

        // 환경 모드 + 캐릭터 포함 (하이브리드 모드)
        const isHybridMode = mode === 'environment' && includeCharacters;

        // 모드에 따른 캐릭터 관련 지시문
        const characterGuidelines = mode === 'character'
            ? `### 5. 등장인물 제안
- 시나리오에 필요한 주요 등장인물들을 제안
- 각 인물의 이름, 역할, 외형/성격 설명 포함
- 한국인 인물 묘사 시 "Korean" 명시`
            : isHybridMode
                ? `### 5. 등장인물 (하이브리드 모드 - 환경 중심 + 조연 캐릭터)
- **풍경/환경이 주인공, 캐릭터는 조연 역할**
- 전체 씬의 약 30~40%에만 캐릭터 등장 (나머지는 풍경만)
- 캐릭터 등장 시 특징:
  * 화면 구석이나 작게 배치 (Wide shot에서 작은 인물)
  * 뒷모습, 실루엣, 부분(손, 발 등)으로 표현
  * 풍경을 바라보거나 걷는 모습
  * 환경의 스케일을 강조하는 대비 효과
- suggestedCharacters에 1~2명의 가이드 캐릭터 제안
- 캐릭터가 등장하는 씬의 characters 배열에 이름 포함
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
            : isHybridMode
                ? `- **풍경이 메인, 캐릭터는 보조적으로만 등장**
- 캐릭터가 등장하는 씬에서:
  * "a small figure in the distance" 또는 "silhouette of a person"
  * "person from behind looking at the scenery"
  * 인물은 화면의 1/5 이하 크기로
  * Wide shot으로 환경의 스케일 강조
- 캐릭터가 없는 씬: 순수 풍경/환경만 묘사
- 빛, 날씨, 시간대, 계절 명시
- 장소의 분위기와 질감 상세히
- 한국인 인물 묘사 시 "Korean" 명시`
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

        // 톤에 맞는 Hook 예시 가져오기
        const toneKey = (tone === 'custom' ? 'emotional' : tone) as ScenarioTone;
        const hookExamples = HOOK_EXAMPLES[toneKey] || HOOK_EXAMPLES.emotional;

        const prompt = `당신은 한국 숏폼/미드폼 영상 시나리오 전문 작가이자 바이럴 콘텐츠 전략가입니다.
수백만 조회수를 기록하는 숏폼 영상의 패턴을 완벽히 이해하고 있으며, 시청자의 심리를 꿰뚫는 스토리텔링 전문가입니다.
당신의 시나리오는 시청자가 첫 3초 안에 사로잡히고, 끝까지 시청하며, 공유하고 싶어집니다.

## 바이럴 콘텐츠의 핵심 원칙 (반드시 적용)

### 1. 3초 룰 - Hook의 중요성
첫 번째 씬(Hook)에서 반드시 시청자를 사로잡아야 합니다. 스크롤을 멈추게 만드는 강력한 오프닝이 필수입니다.

**효과적인 Hook 유형:**
- **질문형**: "왜 한국인들은 ~할까요?" → 답을 알고 싶게 만듦
- **충격형**: 예상치 못한 상황이나 이미지로 시작 → 호기심 유발
- **공감형**: "이런 경험 있으시죠?" → 즉각적인 정서적 연결
- **미스터리형**: "마지막에 반전이 있습니다" → 끝까지 보게 만듦
- **대비형**: Before/After, 기대 vs 현실 → 변화에 대한 궁금증

**이 톤(${tone})에 맞는 Hook 예시:**
${hookExamples.map(ex => `- ${ex}`).join('\n')}

### 2. 감정 곡선 설계
시청자의 감정을 의도적으로 조절해야 합니다. 평탄한 전개는 이탈을 유발합니다.

**스토리비트별 감정 목표:**
- **Hook**: ${STORYBEAT_EMOTIONS.Hook}
- **Setup**: ${STORYBEAT_EMOTIONS.Setup}
- **Development**: ${STORYBEAT_EMOTIONS.Development}
- **Climax**: ${STORYBEAT_EMOTIONS.Climax}
- **Resolution**: ${STORYBEAT_EMOTIONS.Resolution}

### 3. Open Loop 기법
시청자가 끝까지 보게 만드는 장치를 설계하세요:
- 초반에 던진 질문/상황을 마지막에 해결
- 매 씬 끝에서 "그런데...", "하지만..." 등으로 다음 씬 암시
- 결말을 알기 전에는 이탈할 수 없게 만드는 구조

### 4. 공유 트리거
시청자가 다른 사람에게 보여주고 싶게 만드는 요소를 포함하세요:
- 강렬한 감정 (감동, 놀라움, 웃음, 공분)
- 정체성 표현 ("이게 바로 나야", "우리 세대 공감")
- 유용한 정보나 새로운 인사이트
- 논쟁거리 (의견을 말하고 싶게 만드는 요소)

### 5. 바이럴 트렌드 자동 분석 및 적용
주제 "${sanitizedTopic}"와 톤 "${tone}"에 맞는 최신 바이럴 트렌드를 분석하고 적용하세요:

1. **플랫폼 트렌드**: 틱톡, 유튜브 쇼츠, 인스타 릴스에서 해당 주제로 인기 있는 포맷과 구성 방식
2. **성공 패턴**: 높은 조회수를 기록한 유사 주제 콘텐츠의 공통점 (Hook 유형, 전개 방식, 마무리)
3. **최신 밈/레퍼런스**: 현재 MZ세대가 자주 사용하는 표현, 유행어, 챌린지 형식
4. **공유 심리**: 시청자가 "이거 친구한테 보내야겠다"고 느끼게 만드는 구체적 요소

위 트렌드 분석을 시나리오 전체에 자연스럽게 녹여내세요. 특히 Hook과 Resolution에 트렌드 요소가 반영되어야 합니다.

---

## 입력 정보
- **주제**: "${sanitizedTopic}"
- **영상 길이**: ${duration}초
- **톤/분위기**: ${tone === 'custom' ? '커스텀' : tone} - ${toneDescription}
- **시나리오 모드**: ${isHybridMode ? '하이브리드 (환경 중심 + 조연 캐릭터)' : modeInfo.name} - ${isHybridMode ? '풍경이 주인공, 캐릭터는 조연으로 가끔 등장' : modeInfo.focus}
- **이미지 스타일**: ${imageStyle} - ${styleDescription}

---

## 시나리오 작성 규칙

### 1. 구조
- 총 ${durationConfig.minScenes}~${durationConfig.maxScenes}개의 씬으로 구성
- 각 씬은 ${durationConfig.perSceneMin}-${durationConfig.perSceneMax}초 분량
- 스토리 구조: ${durationConfig.storyStructure}
- 스토리비트: "Hook", "Setup", "Development", "Climax", "Resolution"

### 2. 시나리오 모드 지침: ${isHybridMode ? '하이브리드 (환경 중심 + 조연 캐릭터)' : modeInfo.name}
- **포커스**: ${isHybridMode ? '풍경/환경이 주인공, 캐릭터는 조연으로 30-40% 씬에만 등장' : modeInfo.focus}
- **비주얼 가이드**: ${isHybridMode ? '와이드샷 풍경 위주. 캐릭터 등장 시 작게/뒷모습/실루엣으로. 환경의 스케일 강조.' : modeInfo.visualGuidelines}

### 3. 나레이션 작성 핵심 (매우 중요!)
- **첫 문장은 반드시 주의를 끌어야 함** (질문, 반전, 공감 유도로 시작)
- 정보를 한 번에 다 주지 말고 **조금씩 공개** (궁금증 유지)
- 시청자에게 직접 말하는 듯한 **2인칭 톤** ("당신도 이런 적 있죠?", "여러분")
- **감정을 자극하는 구체적 디테일** 포함 (추상적 표현 금지)
- 마지막 문장은 **여운을 남기거나 행동을 유도**

### 3-1. TTS 최적화 규칙 (필수! 반드시 준수!)
- **[핵심] 나레이션은 반드시 40~50자 사이로 작성!** (10초 씬 기준)
- **[절대 금지] 50자 초과 절대 금지!** 초과 시 TTS가 씬 시간을 넘어감
- **[절대 금지] 55자 이상 작성하면 영상이 망가짐!**
- **[계산법]** 한국어 기준 1초 = 약 5글자, 10초 씬 = 최대 50자
- 40자 미만도 금지 (너무 짧으면 침묵 구간 발생)
- 핵심 메시지만 간결하게, 불필요한 수식어/부사 제거
- 예시 (50자): "회장님, 아니 아가씨. 경영 수업은 이제 끝났습니다. 새로운 시작을 축하드립니다."

### 4. 각 씬 작성 시 포함할 내용
- **sceneNumber**: 씬 번호 (1부터 시작)
- **duration**: 예상 길이(초, ${durationConfig.perSceneMin}-${durationConfig.perSceneMax} 사이)
- **storyBeat**: "Hook", "Setup", "Development", "Climax", "Resolution" 중 하나
- **visualDescription**: 화면에 보이는 것 (한국어, 구체적인 시각 묘사)
- **narration**: 내레이션 텍스트 (위 나레이션 작성 핵심 참고)
- **cameraAngle**: "Close-up", "Extreme Close-up", "Medium shot", "Wide shot", "POV", "Over-the-shoulder", "Low angle", "High angle", "Bird's eye" 중 하나
- **mood**: 장면의 감정/분위기 (한국어, 2-3단어)
- **characters**: 이 씬에 등장하는 캐릭터 이름 목록 (suggestedCharacters의 name과 일치해야 함)
- **imagePrompt**: 이미지 생성용 영어 프롬프트${durationConfig.chapters > 1 ? '\n- **chapterIndex**: 소속 챕터 번호 (0부터 시작)\n- **chapterTitle**: 챕터 제목' : ''}

### 5. 이미지 프롬프트 작성 규칙 (imagePrompt)
- 반드시 영어로 작성
- 아트 스타일 프리픽스 추가: "${stylePromptText.substring(0, 100)}..."
${imagePromptGuidelines}

${characterGuidelines}
${chapterGuidelines}

### 7. 톤/분위기 추천 (필수!)
주제를 분석하여 가장 적합한 톤/분위기를 추천하세요.

**각 톤의 특징과 적합한 주제:**

스토리 톤:
- **emotional**: 감성/힐링. 따뜻한 이야기, 가족, 우정, 일상의 소소한 감동에 적합.
- **dramatic**: 드라마틱. 긴장감, 반전, 갈등이 있는 이야기에 적합.
- **inspirational**: 동기부여. 도전, 성장, 성공 스토리에 적합.
- **romantic**: 로맨틱. 사랑, 설렘, 연애 이야기에 적합.
- **comedic**: 코믹. 유머, 재미, 밝은 분위기의 이야기에 적합.
- **mysterious**: 미스터리. 호기심, 궁금증, 스릴러 요소가 있는 이야기에 적합.
- **nostalgic**: 향수/추억. 과거 회상, 그리움, 추억 이야기에 적합.
- **educational**: 정보/지식. 학습, 역사, 과학, 인사이트 전달에 적합.

광고/홍보 톤:
- **promotional**: 홍보/광고. 상품/서비스 홍보, 구매 유도, 다이렉트 세일즈 콘텐츠에 적합. 이미지는 상품 중심 구도, 밝고 깨끗한 조명, CTA 강조.
- **luxurious**: 프리미엄/럭셔리. 하이엔드 브랜드, 고급 제품, 럭셔리 라이프스타일에 적합. 이미지는 미니멀 구도, 어두운 배경에 포인트 조명, 골드/블랙 톤, 고급 질감 강조.
- **trendy**: 트렌디/MZ. SNS 바이럴, MZ세대 타겟, 패션/뷰티/라이프스타일에 적합. 이미지는 네온 컬러, 그래피티, 스트릿 감성, 팝아트적 구도.
- **trustworthy**: 신뢰/전문가. 기업 홍보, 전문 서비스, 의료/금융/교육에 적합. 이미지는 깔끔한 구도, 블루/화이트 톤, 인포그래픽 스타일, 전문가 인터뷰 구도.
- **energetic**: 활기/에너지. 스포츠, 피트니스, 아웃도어, 에너지 드링크, 활동적 라이프스타일에 적합. 이미지는 모션블러, 역동적 구도, 비비드 컬러, 액션 포즈.

추천 시 고려사항:
1. 주제의 핵심 감정과 메시지
2. 타겟 시청자가 기대하는 감정
3. 바이럴 가능성 (공유 욕구를 자극하는 톤)
4. 상업적 목적 여부 (상품/서비스 홍보 시 광고/홍보 톤 우선 추천)

### 8. 이미지 스타일 추천 (필수!)
주제, 톤, 시나리오 내용을 분석하여 가장 적합한 이미지 스타일을 추천하세요.

**각 스타일 특징과 적합한 상황:**
- **photorealistic**: 실사 사진 스타일. 다큐멘터리, 실제 이야기, 현실 기반 콘텐츠에 적합.
- **animation**: 일본 애니메이션 스타일. 감성적, 로맨틱, 청춘 스토리에 적합.
- **illustration**: 디지털 일러스트. 교육, 설명 콘텐츠, 밝고 깔끔한 분위기에 적합.
- **cinematic**: 영화적 스타일. 드라마틱, 미스터리, 긴장감 있는 스토리에 적합.
- **watercolor**: 수채화 스타일. 향수, 감성, 동화적 분위기에 적합.
- **3d_render**: 픽사/디즈니 3D 스타일. 코미디, 밝은 분위기, 캐릭터 중심 스토리에 적합.

추천 시 고려사항:
1. 톤과의 조화 (emotional → animation/watercolor, dramatic → cinematic 등)
2. 타겟 시청자층의 취향
3. 주제의 특성 (역사 → photorealistic, 판타지 → animation)
4. 바이럴 가능성 (시각적 임팩트)`;

        // 장편일 경우 챕터 필드 추가
        const sceneProperties: Record<string, any> = {
            sceneNumber: { type: Type.NUMBER, description: "씬 번호" },
            duration: { type: Type.NUMBER, description: "씬 길이(초)" },
            storyBeat: { type: Type.STRING, description: "스토리 비트" },
            visualDescription: { type: Type.STRING, description: "시각적 묘사 (한국어)" },
            narration: { type: Type.STRING, description: "내레이션 (한국어)" },
            cameraAngle: { type: Type.STRING, description: "카메라 앵글" },
            mood: { type: Type.STRING, description: "분위기" },
            characters: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "이 씬에 등장하는 캐릭터 이름 목록"
            },
            imagePrompt: { type: Type.STRING, description: "이미지 생성 프롬프트 (영어)" },
        };
        const sceneRequired = ["sceneNumber", "duration", "storyBeat", "visualDescription", "narration", "cameraAngle", "mood", "characters", "imagePrompt"];

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
                        recommendedImageStyle: {
                            type: Type.STRING,
                            description: "AI가 추천하는 이미지 스타일 (photorealistic, animation, illustration, cinematic, watercolor, 3d_render 중 하나)",
                        },
                        recommendedImageStyleReason: {
                            type: Type.STRING,
                            description: "이미지 스타일 추천 이유 (한국어, 1-2문장)",
                        },
                        recommendedTone: {
                            type: Type.STRING,
                            description: "AI가 추천하는 톤/분위기 (emotional, dramatic, inspirational, romantic, comedic, mysterious, nostalgic, educational 중 하나)",
                        },
                        recommendedToneReason: {
                            type: Type.STRING,
                            description: "톤/분위기 추천 이유 (한국어, 1-2문장)",
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
                    required: ["title", "synopsis", "recommendedImageStyle", "recommendedImageStyleReason", "recommendedTone", "recommendedToneReason", "suggestedCharacters", "scenes"],
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
            characters: scene.characters || [],
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

        // Validate recommended style
        const validStyles: ImageStyle[] = ['photorealistic', 'animation', 'illustration', 'cinematic', 'watercolor', '3d_render'];
        const recommendedStyle = validStyles.includes(parsed.recommendedImageStyle)
            ? parsed.recommendedImageStyle as ImageStyle
            : imageStyle;

        // Validate recommended tone
        const validTones: ScenarioTone[] = ['emotional', 'dramatic', 'inspirational', 'romantic', 'comedic', 'mysterious', 'nostalgic', 'educational'];
        const recommendedTone = validTones.includes(parsed.recommendedTone)
            ? parsed.recommendedTone as ScenarioTone
            : (tone === 'custom' ? 'emotional' : tone as ScenarioTone);

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
            recommendedImageStyle: recommendedStyle,
            recommendedImageStyleReason: parsed.recommendedImageStyleReason || '',
            recommendedTone: recommendedTone,
            recommendedToneReason: parsed.recommendedToneReason || '',
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
