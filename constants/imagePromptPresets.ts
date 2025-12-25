/**
 * Image Prompt Presets for High-Quality Image Generation
 *
 * 9-Block System:
 * [SUBJECT] + [SETTING] + [COMPOSITION] + [CAMERA/LENS] + [LIGHTING] +
 * [MATERIAL/DETAIL] + [STYLE] + [QUALITY] + [NEGATIVE]
 */

// =============================================
// Shot Type (Composition)
// =============================================

export type ShotTypeKey =
  | 'extreme-close-up'
  | 'close-up'
  | 'medium-close-up'
  | 'medium'
  | 'medium-wide'
  | 'wide'
  | 'extreme-wide';

export interface ShotTypePreset {
  label: string;
  labelKo: string;
  prompt: string;
  description: string;
  bestFor: string[];
}

export const SHOT_TYPES: Record<ShotTypeKey, ShotTypePreset> = {
  'extreme-close-up': {
    label: 'Extreme Close-up',
    labelKo: '익스트림 클로즈업',
    prompt: 'extreme close-up shot',
    description: '눈, 입술, 손 등 특정 부위만',
    bestFor: ['감정', '디테일', '텍스처']
  },
  'close-up': {
    label: 'Close-up',
    labelKo: '클로즈업',
    prompt: 'close-up shot',
    description: '얼굴 전체, 감정 전달',
    bestFor: ['표정', '감정', '초상화']
  },
  'medium-close-up': {
    label: 'Medium Close-up',
    labelKo: '미디엄 클로즈업',
    prompt: 'medium close-up shot',
    description: '어깨 위, 대화 장면',
    bestFor: ['대화', '인터뷰', '리액션']
  },
  'medium': {
    label: 'Medium Shot',
    labelKo: '미디엄샷',
    prompt: 'medium shot',
    description: '허리 위, 행동과 표정',
    bestFor: ['일상', '대화', '동작']
  },
  'medium-wide': {
    label: 'Medium Wide',
    labelKo: '미디엄 와이드',
    prompt: 'medium wide shot',
    description: '무릎 위, 환경과 인물',
    bestFor: ['동작', '상호작용', '환경']
  },
  'wide': {
    label: 'Wide Shot',
    labelKo: '와이드샷',
    prompt: 'wide shot',
    description: '전신 + 환경',
    bestFor: ['장소소개', '액션', '스케일']
  },
  'extreme-wide': {
    label: 'Extreme Wide',
    labelKo: '익스트림 와이드',
    prompt: 'extreme wide establishing shot',
    description: '전체 환경, 스케일 강조',
    bestFor: ['풍경', '스케일', '설정샷']
  }
};

// =============================================
// Camera Angle (Viewpoint)
// =============================================

export type CameraAngleKey =
  | 'eye-level'
  | 'low-angle'
  | 'high-angle'
  | 'birds-eye'
  | 'worms-eye'
  | 'dutch'
  | 'over-shoulder';

export interface CameraAnglePreset {
  label: string;
  labelKo: string;
  prompt: string;
  description: string;
  mood: string;
}

export const CAMERA_ANGLES: Record<CameraAngleKey, CameraAnglePreset> = {
  'eye-level': {
    label: 'Eye Level',
    labelKo: '아이레벨',
    prompt: 'eye-level angle',
    description: '눈높이, 자연스러운 시점',
    mood: '중립, 친근'
  },
  'low-angle': {
    label: 'Low Angle',
    labelKo: '로우앵글',
    prompt: 'low-angle shot looking up',
    description: '아래에서 위로',
    mood: '위엄, 힘, 영웅적'
  },
  'high-angle': {
    label: 'High Angle',
    labelKo: '하이앵글',
    prompt: 'high-angle shot looking down',
    description: '위에서 아래로',
    mood: '취약함, 연약함'
  },
  'birds-eye': {
    label: "Bird's Eye",
    labelKo: '버즈아이',
    prompt: "bird's eye view from directly above",
    description: '수직으로 위에서',
    mood: '전지적, 객관적'
  },
  'worms-eye': {
    label: "Worm's Eye",
    labelKo: '웜즈아이',
    prompt: "worm's eye view from ground level",
    description: '바닥에서 위로',
    mood: '극적, 압도적'
  },
  'dutch': {
    label: 'Dutch Angle',
    labelKo: '더치앵글',
    prompt: 'dutch angle tilted frame',
    description: '기울어진 프레임',
    mood: '불안, 긴장, 혼란'
  },
  'over-shoulder': {
    label: 'Over Shoulder',
    labelKo: '오버숄더',
    prompt: 'over-the-shoulder shot',
    description: '어깨 너머로',
    mood: '대화, 관계'
  }
};

// =============================================
// Lens / Camera Settings
// =============================================

export type LensKey =
  | '24mm-wide'
  | '35mm-standard'
  | '50mm-normal'
  | '85mm-portrait'
  | '135mm-telephoto'
  | '200mm-compressed';

export interface LensPreset {
  label: string;
  labelKo: string;
  prompt: string;
  description: string;
  aperture: string;
  dof: string;
}

export const LENSES: Record<LensKey, LensPreset> = {
  '24mm-wide': {
    label: '24mm Wide',
    labelKo: '24mm 광각',
    prompt: '24mm wide-angle lens, f/2.8',
    description: '넓은 화각, 환경 강조',
    aperture: 'f/2.8',
    dof: '깊은 심도'
  },
  '35mm-standard': {
    label: '35mm Standard',
    labelKo: '35mm 표준광각',
    prompt: '35mm lens, f/1.8, shallow depth of field',
    description: '현장감, 다큐멘터리',
    aperture: 'f/1.8',
    dof: '얕은 심도'
  },
  '50mm-normal': {
    label: '50mm Normal',
    labelKo: '50mm 표준',
    prompt: '50mm lens, f/1.4, natural perspective',
    description: '인간 시야와 유사',
    aperture: 'f/1.4',
    dof: '자연스러운 심도'
  },
  '85mm-portrait': {
    label: '85mm Portrait',
    labelKo: '85mm 인물',
    prompt: '85mm portrait lens, f/1.8, creamy bokeh background',
    description: '인물 사진 최적',
    aperture: 'f/1.8',
    dof: '크리미한 보케'
  },
  '135mm-telephoto': {
    label: '135mm Telephoto',
    labelKo: '135mm 망원',
    prompt: '135mm telephoto lens, f/2, compressed perspective',
    description: '압축된 원근감',
    aperture: 'f/2',
    dof: '강한 배경 분리'
  },
  '200mm-compressed': {
    label: '200mm Compressed',
    labelKo: '200mm 압축',
    prompt: '200mm telephoto lens, heavily compressed perspective',
    description: '극도의 원근 압축',
    aperture: 'f/2.8',
    dof: '극적 배경 압축'
  }
};

// =============================================
// Lighting Presets
// =============================================

export type LightingKey =
  | 'natural-soft'
  | 'natural-golden'
  | 'natural-blue'
  | 'studio-soft'
  | 'studio-dramatic'
  | 'rim-light'
  | 'neon'
  | 'low-key'
  | 'high-key'
  | 'silhouette';

export interface LightingPreset {
  label: string;
  labelKo: string;
  prompt: string;
  description: string;
  mood: string;
}

export const LIGHTINGS: Record<LightingKey, LightingPreset> = {
  'natural-soft': {
    label: 'Natural Soft',
    labelKo: '자연광 소프트',
    prompt: 'soft natural light, diffused daylight, gentle shadows',
    description: '부드러운 자연광',
    mood: '자연스러운, 편안한'
  },
  'natural-golden': {
    label: 'Golden Hour',
    labelKo: '골든아워',
    prompt: 'golden hour warm sunlight, long shadows, orange rim light',
    description: '일몰 직전 따뜻한 빛',
    mood: '로맨틱, 따뜻한'
  },
  'natural-blue': {
    label: 'Blue Hour',
    labelKo: '블루아워',
    prompt: 'blue hour twilight, cool ambient light, magical atmosphere',
    description: '일몰 직후 푸른 빛',
    mood: '신비로운, 차분한'
  },
  'studio-soft': {
    label: 'Studio Soft',
    labelKo: '스튜디오 소프트',
    prompt: 'professional softbox lighting, even illumination, minimal shadows',
    description: '스튜디오 소프트박스',
    mood: '깔끔한, 전문적'
  },
  'studio-dramatic': {
    label: 'Studio Dramatic',
    labelKo: '스튜디오 드라마틱',
    prompt: 'dramatic studio lighting, strong key light, deep shadows',
    description: '극적인 스튜디오 조명',
    mood: '극적, 강렬한'
  },
  'rim-light': {
    label: 'Rim Light',
    labelKo: '림라이트',
    prompt: 'strong rim light from behind, edge lighting, silhouette highlights',
    description: '뒤에서 오는 테두리 빛',
    mood: '분리감, 드라마틱'
  },
  'neon': {
    label: 'Neon',
    labelKo: '네온',
    prompt: 'colorful neon lighting, red and blue rim lights, urban night atmosphere',
    description: '네온 컬러 조명',
    mood: '도시적, 사이버펑크'
  },
  'low-key': {
    label: 'Low Key',
    labelKo: '로우키',
    prompt: 'low-key lighting, mostly shadows, single light source, film noir',
    description: '어두운 톤, 강한 그림자',
    mood: '미스터리, 긴장감'
  },
  'high-key': {
    label: 'High Key',
    labelKo: '하이키',
    prompt: 'high-key lighting, bright and even, minimal shadows, clean look',
    description: '밝은 톤, 그림자 최소',
    mood: '밝은, 깨끗한'
  },
  'silhouette': {
    label: 'Silhouette',
    labelKo: '실루엣',
    prompt: 'backlit silhouette, strong backlight, subject in shadow',
    description: '역광 실루엣',
    mood: '신비로운, 드라마틱'
  }
};

// =============================================
// Environment / Setting Presets
// =============================================

export type EnvironmentKey =
  | 'studio-white'
  | 'studio-dark'
  | 'indoor-modern'
  | 'indoor-cozy'
  | 'indoor-luxury'
  | 'urban-street'
  | 'urban-night'
  | 'urban-rain'
  | 'nature-forest'
  | 'nature-beach'
  | 'nature-mountain';

export interface EnvironmentPreset {
  label: string;
  labelKo: string;
  prompt: string;
  timeOfDay: string;
  weather: string;
}

export const ENVIRONMENTS: Record<EnvironmentKey, EnvironmentPreset> = {
  'studio-white': {
    label: 'White Studio',
    labelKo: '화이트 스튜디오',
    prompt: 'clean white studio background, professional photography setup, seamless backdrop',
    timeOfDay: 'controlled',
    weather: 'indoor'
  },
  'studio-dark': {
    label: 'Dark Studio',
    labelKo: '다크 스튜디오',
    prompt: 'dark studio background, black backdrop, dramatic lighting setup',
    timeOfDay: 'controlled',
    weather: 'indoor'
  },
  'indoor-modern': {
    label: 'Modern Interior',
    labelKo: '모던 인테리어',
    prompt: 'modern minimalist interior, clean lines, contemporary furniture, large windows',
    timeOfDay: 'daytime',
    weather: 'indoor'
  },
  'indoor-cozy': {
    label: 'Cozy Interior',
    labelKo: '아늑한 실내',
    prompt: 'cozy warm interior, soft textures, warm lighting, comfortable atmosphere',
    timeOfDay: 'evening',
    weather: 'indoor'
  },
  'indoor-luxury': {
    label: 'Luxury Interior',
    labelKo: '럭셔리 인테리어',
    prompt: 'luxurious elegant interior, high-end decor, sophisticated atmosphere',
    timeOfDay: 'evening',
    weather: 'indoor'
  },
  'urban-street': {
    label: 'Urban Street',
    labelKo: '도시 거리',
    prompt: 'urban city street, modern buildings, bustling atmosphere',
    timeOfDay: 'daytime',
    weather: 'clear'
  },
  'urban-night': {
    label: 'Urban Night',
    labelKo: '도시 야경',
    prompt: 'city street at night, neon signs, street lights, urban nightlife',
    timeOfDay: 'night',
    weather: 'clear'
  },
  'urban-rain': {
    label: 'Rainy City',
    labelKo: '비 오는 도시',
    prompt: 'rainy urban street, wet asphalt reflections, rain streaks, moody atmosphere',
    timeOfDay: 'night',
    weather: 'rainy'
  },
  'nature-forest': {
    label: 'Forest',
    labelKo: '숲',
    prompt: 'lush forest setting, trees, natural greenery, dappled sunlight',
    timeOfDay: 'daytime',
    weather: 'clear'
  },
  'nature-beach': {
    label: 'Beach',
    labelKo: '해변',
    prompt: 'beach setting, ocean waves, sandy shore, horizon line',
    timeOfDay: 'sunset',
    weather: 'clear'
  },
  'nature-mountain': {
    label: 'Mountain',
    labelKo: '산',
    prompt: 'mountain landscape, peaks, dramatic scenery, natural grandeur',
    timeOfDay: 'daytime',
    weather: 'clear'
  }
};

// =============================================
// Material / Detail Keywords
// =============================================

export type MaterialKey =
  | 'skin-natural'
  | 'skin-dewy'
  | 'fabric-silk'
  | 'fabric-cotton'
  | 'fabric-leather'
  | 'metal-chrome'
  | 'metal-matte'
  | 'glass-clear'
  | 'water-droplets'
  | 'texture-rough';

export interface MaterialPreset {
  label: string;
  labelKo: string;
  prompt: string;
}

export const MATERIALS: Record<MaterialKey, MaterialPreset> = {
  'skin-natural': {
    label: 'Natural Skin',
    labelKo: '자연스러운 피부',
    prompt: 'natural skin texture, realistic pores, subtle imperfections'
  },
  'skin-dewy': {
    label: 'Dewy Skin',
    labelKo: '촉촉한 피부',
    prompt: 'dewy glowing skin, healthy shine, hydrated look'
  },
  'fabric-silk': {
    label: 'Silk',
    labelKo: '실크',
    prompt: 'silk fabric texture, smooth sheen, elegant draping'
  },
  'fabric-cotton': {
    label: 'Cotton',
    labelKo: '면',
    prompt: 'cotton fabric texture, soft matte, natural wrinkles'
  },
  'fabric-leather': {
    label: 'Leather',
    labelKo: '가죽',
    prompt: 'leather texture, rich grain, subtle sheen'
  },
  'metal-chrome': {
    label: 'Chrome Metal',
    labelKo: '크롬 메탈',
    prompt: 'chrome metal surface, mirror reflections, polished shine'
  },
  'metal-matte': {
    label: 'Matte Metal',
    labelKo: '무광 메탈',
    prompt: 'matte metal texture, brushed surface, subtle reflections'
  },
  'glass-clear': {
    label: 'Clear Glass',
    labelKo: '투명 유리',
    prompt: 'clear glass, refractions, transparent surface'
  },
  'water-droplets': {
    label: 'Water Droplets',
    labelKo: '물방울',
    prompt: 'water droplets on surface, condensation, wet texture'
  },
  'texture-rough': {
    label: 'Rough Texture',
    labelKo: '거친 질감',
    prompt: 'rough textured surface, visible grain, tactile quality'
  }
};

// =============================================
// Style Presets
// =============================================

export type StyleKey =
  | 'photoreal-cinematic'
  | 'photoreal-editorial'
  | 'photoreal-documentary'
  | 'photoreal-portrait'
  | 'film-kodak'
  | 'film-noir'
  | 'clean-minimal'
  | 'moody-dramatic';

export interface StylePreset {
  label: string;
  labelKo: string;
  prompt: string;
  default: boolean;
}

export const STYLES: Record<StyleKey, StylePreset> = {
  'photoreal-cinematic': {
    label: 'Cinematic',
    labelKo: '시네마틱',
    prompt: 'ultra photoreal, cinematic color grading, movie still quality, professional cinematography',
    default: true
  },
  'photoreal-editorial': {
    label: 'Editorial',
    labelKo: '에디토리얼',
    prompt: 'high-fashion editorial photography, magazine quality, sophisticated styling',
    default: false
  },
  'photoreal-documentary': {
    label: 'Documentary',
    labelKo: '다큐멘터리',
    prompt: 'raw documentary style, candid moment, authentic and unposed',
    default: false
  },
  'photoreal-portrait': {
    label: 'Portrait',
    labelKo: '포트레이트',
    prompt: 'professional portrait photography, flattering lighting, beautiful skin tones',
    default: false
  },
  'film-kodak': {
    label: 'Kodak Film',
    labelKo: '코닥 필름',
    prompt: 'shot on Kodak Portra 400 film, natural film grain, warm color tones',
    default: false
  },
  'film-noir': {
    label: 'Film Noir',
    labelKo: '필름 느와르',
    prompt: 'film noir style, high contrast black and white, dramatic shadows',
    default: false
  },
  'clean-minimal': {
    label: 'Clean Minimal',
    labelKo: '클린 미니멀',
    prompt: 'clean minimalist aesthetic, simple composition, uncluttered',
    default: false
  },
  'moody-dramatic': {
    label: 'Moody Dramatic',
    labelKo: '무디 드라마틱',
    prompt: 'moody dramatic atmosphere, emotional intensity, cinematic tension',
    default: false
  }
};

// =============================================
// Quality Keywords
// =============================================

export type QualityKey =
  | 'high-detail'
  | '8k'
  | 'sharp'
  | 'clean-edges'
  | 'print-ready';

export interface QualityPreset {
  label: string;
  labelKo: string;
  prompt: string;
  default: boolean;
}

export const QUALITY_KEYWORDS: Record<QualityKey, QualityPreset> = {
  'high-detail': {
    label: 'High Detail',
    labelKo: '하이 디테일',
    prompt: 'highly detailed, intricate details',
    default: true
  },
  '8k': {
    label: '8K',
    labelKo: '8K 해상도',
    prompt: '8K resolution, ultra high definition',
    default: true
  },
  'sharp': {
    label: 'Sharp Focus',
    labelKo: '샤프 포커스',
    prompt: 'tack sharp focus, crisp details',
    default: true
  },
  'clean-edges': {
    label: 'Clean Edges',
    labelKo: '클린 엣지',
    prompt: 'clean edges, no artifacts',
    default: false
  },
  'print-ready': {
    label: 'Print Ready',
    labelKo: '인쇄용',
    prompt: 'print-ready quality, professional grade',
    default: false
  }
};

// =============================================
// Negative Prompts
// =============================================

export const IMAGE_NEGATIVE_PROMPTS = {
  // Always applied
  default: [
    'blurry',
    'low resolution',
    'lowres',
    'jpeg artifacts',
    'compression artifacts',
    'watermark',
    'text',
    'logo',
    'signature'
  ],

  // Human-specific
  human: [
    'deformed face',
    'distorted face',
    'extra fingers',
    'extra limbs',
    'mutated hands',
    'bad anatomy',
    'weird eyes',
    'crossed eyes',
    'plastic skin',
    'uncanny valley'
  ],

  // Style protection
  style: [
    'cartoon',
    'anime',
    'illustration',
    'painting',
    'drawing',
    '3d render',
    'cgi'
  ],

  // Optional extras
  optional: {
    'no-oversaturated': {
      label: '과채도 금지',
      prompt: 'oversaturated, overly vibrant colors'
    },
    'no-hdr': {
      label: 'HDR 금지',
      prompt: 'HDR, overprocessed, over-sharpened'
    },
    'no-vignette': {
      label: '비네팅 금지',
      prompt: 'heavy vignette, dark corners'
    },
    'no-grain': {
      label: '그레인 금지',
      prompt: 'excessive grain, noisy'
    }
  }
};

export type OptionalNegativeKey = keyof typeof IMAGE_NEGATIVE_PROMPTS.optional;

// =============================================
// Mood Presets (for AI auto-selection)
// =============================================

export type MoodKey =
  | 'romantic'
  | 'dramatic'
  | 'peaceful'
  | 'energetic'
  | 'mysterious'
  | 'melancholic'
  | 'luxurious'
  | 'natural';

export interface MoodPreset {
  label: string;
  labelKo: string;
  suggestedLighting: LightingKey;
  suggestedEnvironment: EnvironmentKey;
  suggestedStyle: StyleKey;
  suggestedLens: LensKey;
  colorTone: string;
}

export const MOODS: Record<MoodKey, MoodPreset> = {
  'romantic': {
    label: 'Romantic',
    labelKo: '로맨틱',
    suggestedLighting: 'natural-golden',
    suggestedEnvironment: 'nature-beach',
    suggestedStyle: 'photoreal-cinematic',
    suggestedLens: '85mm-portrait',
    colorTone: 'warm tones, soft contrast'
  },
  'dramatic': {
    label: 'Dramatic',
    labelKo: '드라마틱',
    suggestedLighting: 'low-key',
    suggestedEnvironment: 'studio-dark',
    suggestedStyle: 'moody-dramatic',
    suggestedLens: '85mm-portrait',
    colorTone: 'high contrast, deep shadows'
  },
  'peaceful': {
    label: 'Peaceful',
    labelKo: '평화로운',
    suggestedLighting: 'natural-soft',
    suggestedEnvironment: 'nature-forest',
    suggestedStyle: 'photoreal-documentary',
    suggestedLens: '50mm-normal',
    colorTone: 'soft, muted colors'
  },
  'energetic': {
    label: 'Energetic',
    labelKo: '에너지틱',
    suggestedLighting: 'studio-dramatic',
    suggestedEnvironment: 'urban-street',
    suggestedStyle: 'photoreal-editorial',
    suggestedLens: '35mm-standard',
    colorTone: 'vibrant, punchy colors'
  },
  'mysterious': {
    label: 'Mysterious',
    labelKo: '미스터리',
    suggestedLighting: 'silhouette',
    suggestedEnvironment: 'urban-night',
    suggestedStyle: 'film-noir',
    suggestedLens: '50mm-normal',
    colorTone: 'desaturated, cool tones'
  },
  'melancholic': {
    label: 'Melancholic',
    labelKo: '멜랑콜리',
    suggestedLighting: 'natural-blue',
    suggestedEnvironment: 'urban-rain',
    suggestedStyle: 'moody-dramatic',
    suggestedLens: '35mm-standard',
    colorTone: 'cool, desaturated'
  },
  'luxurious': {
    label: 'Luxurious',
    labelKo: '럭셔리',
    suggestedLighting: 'studio-soft',
    suggestedEnvironment: 'indoor-luxury',
    suggestedStyle: 'photoreal-editorial',
    suggestedLens: '85mm-portrait',
    colorTone: 'rich, sophisticated'
  },
  'natural': {
    label: 'Natural',
    labelKo: '자연스러운',
    suggestedLighting: 'natural-soft',
    suggestedEnvironment: 'indoor-modern',
    suggestedStyle: 'photoreal-documentary',
    suggestedLens: '50mm-normal',
    colorTone: 'true to life colors'
  }
};

// =============================================
// Framing Options
// =============================================

export type FramingKey =
  | 'rule-of-thirds-left'
  | 'rule-of-thirds-right'
  | 'center'
  | 'negative-space-top'
  | 'negative-space-side'
  | 'foreground-frame';

export interface FramingPreset {
  label: string;
  labelKo: string;
  prompt: string;
  useCase: string;
}

export const FRAMINGS: Record<FramingKey, FramingPreset> = {
  'rule-of-thirds-left': {
    label: 'Rule of Thirds (Left)',
    labelKo: '삼분할 (왼쪽)',
    prompt: 'subject positioned on left third, rule of thirds composition',
    useCase: '썸네일, SNS'
  },
  'rule-of-thirds-right': {
    label: 'Rule of Thirds (Right)',
    labelKo: '삼분할 (오른쪽)',
    prompt: 'subject positioned on right third, rule of thirds composition',
    useCase: '썸네일, SNS'
  },
  'center': {
    label: 'Center',
    labelKo: '중앙',
    prompt: 'subject centered in frame, symmetrical composition',
    useCase: '포스터, 프로필'
  },
  'negative-space-top': {
    label: 'Negative Space (Top)',
    labelKo: '여백 (상단)',
    prompt: 'large negative space at top of frame, subject in lower portion',
    useCase: '텍스트 추가용'
  },
  'negative-space-side': {
    label: 'Negative Space (Side)',
    labelKo: '여백 (측면)',
    prompt: 'negative space on one side, subject offset',
    useCase: '배너, 광고'
  },
  'foreground-frame': {
    label: 'Foreground Frame',
    labelKo: '전경 프레이밍',
    prompt: 'foreground elements framing the subject, depth layers',
    useCase: '시네마틱'
  }
};

// =============================================
// Default Selections
// =============================================

export const IMAGE_DEFAULT_SELECTIONS = {
  shotType: 'medium' as ShotTypeKey,
  cameraAngle: 'eye-level' as CameraAngleKey,
  lens: '85mm-portrait' as LensKey,
  lighting: 'natural-soft' as LightingKey,
  environment: 'studio-white' as EnvironmentKey,
  style: 'photoreal-cinematic' as StyleKey,
  quality: ['high-detail', '8k', 'sharp'] as QualityKey[],
  framing: 'rule-of-thirds-left' as FramingKey,
  materials: [] as MaterialKey[],
  negativeOptional: [] as OptionalNegativeKey[]
};
