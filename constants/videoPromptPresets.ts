/**
 * Video Prompt Presets for High-Quality Video Generation
 *
 * 6-Block System optimized for Veo 3.1:
 * [SUBJECT] + [ACTION] + [CAMERA] + [ENVIRONMENT] + [STYLE] + [NEGATIVE]
 */

// =============================================
// Camera Angle Presets
// =============================================

export type CameraAngleKey =
  | 'extreme-close-up'
  | 'close-up'
  | 'medium'
  | 'wide'
  | 'low-angle'
  | 'high-angle'
  | 'dutch'
  | 'pov';

export interface CameraAnglePreset {
  label: string;
  labelKo: string;
  prompt: string;
  description: string;
  bestFor: string[];
}

export const CAMERA_ANGLES: Record<CameraAngleKey, CameraAnglePreset> = {
  'extreme-close-up': {
    label: 'Extreme Close-up',
    labelKo: '익스트림 클로즈업',
    prompt: 'Extreme close-up shot',
    description: '눈, 입술, 손 등 특정 부위 강조',
    bestFor: ['감정', '디테일', '긴장감']
  },
  'close-up': {
    label: 'Close-up',
    labelKo: '클로즈업',
    prompt: 'Close-up shot',
    description: '얼굴 위주, 감정 전달',
    bestFor: ['대화', '감정', '반응']
  },
  'medium': {
    label: 'Medium Shot',
    labelKo: '미디엄샷',
    prompt: 'Medium shot',
    description: '상반신, 행동과 표정 동시 포착',
    bestFor: ['대화', '일상', '동작']
  },
  'wide': {
    label: 'Wide Shot',
    labelKo: '와이드샷',
    prompt: 'Wide establishing shot',
    description: '전신 + 환경, 상황 설명',
    bestFor: ['장소소개', '액션', '스케일']
  },
  'low-angle': {
    label: 'Low Angle',
    labelKo: '로우앵글',
    prompt: 'Low-angle shot looking up',
    description: '아래에서 위로, 위압감/영웅적',
    bestFor: ['히어로', '위압감', '권위']
  },
  'high-angle': {
    label: 'High Angle',
    labelKo: '하이앵글',
    prompt: 'High-angle shot looking down',
    description: '위에서 아래로, 취약함/전체조망',
    bestFor: ['취약함', '전체조망', '감시']
  },
  'dutch': {
    label: 'Dutch Angle',
    labelKo: '더치앵글',
    prompt: 'Dutch angle tilted frame',
    description: '기울어진 프레임, 불안/긴장',
    bestFor: ['불안', '긴장', '혼란']
  },
  'pov': {
    label: 'POV',
    labelKo: 'POV (1인칭)',
    prompt: 'First-person POV shot',
    description: '캐릭터 시점',
    bestFor: ['몰입', '공포', '액션']
  }
};

// =============================================
// Camera Movement Presets
// =============================================

export type CameraMovementKey =
  | 'static'
  | 'slow-push'
  | 'slow-pull'
  | 'tracking'
  | 'orbit'
  | 'handheld'
  | 'crane-up'
  | 'dolly-zoom'
  | 'fpv-drone';

export interface CameraMovementPreset {
  label: string;
  labelKo: string;
  prompt: string;
  description: string;
  intensity: number; // 0-4 scale
}

export const CAMERA_MOVEMENTS: Record<CameraMovementKey, CameraMovementPreset> = {
  'static': {
    label: 'Static',
    labelKo: '정적',
    prompt: 'static camera',
    description: '고정 카메라, 안정감',
    intensity: 0
  },
  'slow-push': {
    label: 'Slow Push-in',
    labelKo: '슬로우 푸시인',
    prompt: 'slow subtle push-in',
    description: '천천히 다가감, 집중/긴장 고조',
    intensity: 1
  },
  'slow-pull': {
    label: 'Slow Pull-out',
    labelKo: '슬로우 풀아웃',
    prompt: 'slow pull-out revealing surroundings',
    description: '천천히 멀어짐, 상황 공개',
    intensity: 1
  },
  'tracking': {
    label: 'Tracking',
    labelKo: '트래킹',
    prompt: 'smooth tracking shot following subject',
    description: '피사체 따라 이동',
    intensity: 2
  },
  'orbit': {
    label: 'Orbit',
    labelKo: '오빗 (회전)',
    prompt: 'orbiting around subject',
    description: '피사체 주위 회전',
    intensity: 2
  },
  'handheld': {
    label: 'Handheld',
    labelKo: '핸드헬드',
    prompt: 'subtle handheld camera movement',
    description: '현장감, 긴장감',
    intensity: 2
  },
  'crane-up': {
    label: 'Crane Up',
    labelKo: '크레인 업',
    prompt: 'crane shot rising upward',
    description: '위로 상승, 스케일 강조',
    intensity: 3
  },
  'dolly-zoom': {
    label: 'Dolly Zoom',
    labelKo: '돌리줌',
    prompt: 'dolly zoom vertigo effect',
    description: '버티고 효과, 충격/깨달음',
    intensity: 3
  },
  'fpv-drone': {
    label: 'FPV Drone',
    labelKo: 'FPV 드론',
    prompt: 'fast FPV drone shot',
    description: '고속 비행, 역동적',
    intensity: 4
  }
};

// =============================================
// Environment/Lighting Presets
// =============================================

export type EnvironmentCategory = 'indoor' | 'outdoor-urban' | 'outdoor-nature';
export type EnvironmentMood =
  | 'seductive'
  | 'warm'
  | 'elegant'
  | 'dramatic'
  | 'clean'
  | 'melancholic'
  | 'contemplative'
  | 'energetic'
  | 'romantic'
  | 'mysterious'
  | 'free'
  | 'mystical'
  | 'peaceful';

export type EnvironmentKey =
  // Indoor
  | 'neon-bar'
  | 'cozy-cafe'
  | 'luxury-hotel'
  | 'studio-dark'
  | 'studio-bright'
  // Outdoor Urban
  | 'rainy-city'
  | 'rooftop-night'
  | 'busy-street'
  // Outdoor Nature
  | 'golden-hour'
  | 'blue-hour'
  | 'beach-sunset'
  | 'forest-misty'
  | 'snowy-night';

export interface EnvironmentPreset {
  label: string;
  labelKo: string;
  prompt: string;
  category: EnvironmentCategory;
  mood: EnvironmentMood;
}

export const ENVIRONMENTS: Record<EnvironmentKey, EnvironmentPreset> = {
  // Indoor
  'neon-bar': {
    label: 'Neon Bar',
    labelKo: '네온 바',
    prompt: 'neon-lit bar at night, red and purple rim lighting, bokeh background, reflections on glass surfaces, moody atmosphere',
    category: 'indoor',
    mood: 'seductive'
  },
  'cozy-cafe': {
    label: 'Cozy Cafe',
    labelKo: '아늑한 카페',
    prompt: 'warm cozy cafe interior, soft natural window light, wooden textures, steam rising from drinks, intimate atmosphere',
    category: 'indoor',
    mood: 'warm'
  },
  'luxury-hotel': {
    label: 'Luxury Hotel',
    labelKo: '럭셔리 호텔',
    prompt: 'luxurious hotel room, soft diffused lighting, elegant decor, city lights through window, sophisticated atmosphere',
    category: 'indoor',
    mood: 'elegant'
  },
  'studio-dark': {
    label: 'Dark Studio',
    labelKo: '다크 스튜디오',
    prompt: 'dark studio with single spotlight, dramatic shadows, black background, high contrast lighting',
    category: 'indoor',
    mood: 'dramatic'
  },
  'studio-bright': {
    label: 'Bright Studio',
    labelKo: '브라이트 스튜디오',
    prompt: 'bright white studio, soft even lighting, clean minimal background, professional photography setup',
    category: 'indoor',
    mood: 'clean'
  },

  // Outdoor Urban
  'rainy-city': {
    label: 'Rainy City',
    labelKo: '비오는 도시',
    prompt: 'rainy urban street at night, wet asphalt reflections, neon signs, puddles, cinematic noir atmosphere, volumetric light through rain',
    category: 'outdoor-urban',
    mood: 'melancholic'
  },
  'rooftop-night': {
    label: 'Rooftop Night',
    labelKo: '옥상 야경',
    prompt: 'city rooftop at night, skyline in background, city lights bokeh, cool night breeze, urban solitude',
    category: 'outdoor-urban',
    mood: 'contemplative'
  },
  'busy-street': {
    label: 'Busy Street',
    labelKo: '번화가',
    prompt: 'busy city street, crowd in motion blur, urban energy, daytime natural lighting, dynamic atmosphere',
    category: 'outdoor-urban',
    mood: 'energetic'
  },

  // Outdoor Nature
  'golden-hour': {
    label: 'Golden Hour',
    labelKo: '골든아워',
    prompt: 'golden hour sunset, warm orange rim light, long shadows, magical soft glow, romantic atmosphere',
    category: 'outdoor-nature',
    mood: 'romantic'
  },
  'blue-hour': {
    label: 'Blue Hour',
    labelKo: '블루아워',
    prompt: 'blue hour twilight, cool blue ambient light, city lights emerging, mysterious calm atmosphere',
    category: 'outdoor-nature',
    mood: 'mysterious'
  },
  'beach-sunset': {
    label: 'Beach Sunset',
    labelKo: '해변 석양',
    prompt: 'beach at sunset, waves crashing, orange sky reflection on water, wind in hair, freedom atmosphere',
    category: 'outdoor-nature',
    mood: 'free'
  },
  'forest-misty': {
    label: 'Misty Forest',
    labelKo: '안개 낀 숲',
    prompt: 'misty forest, volumetric light rays through trees, fog, ethereal mysterious atmosphere',
    category: 'outdoor-nature',
    mood: 'mystical'
  },
  'snowy-night': {
    label: 'Snowy Night',
    labelKo: '눈 오는 밤',
    prompt: 'snowy night, falling snowflakes, warm street lamp light, cold breath visible, peaceful winter atmosphere',
    category: 'outdoor-nature',
    mood: 'peaceful'
  }
};

// =============================================
// Style Presets
// =============================================

export type StyleKey =
  | 'cinematic'
  | 'film-grain'
  | 'anamorphic'
  | 'high-contrast'
  | 'soft-dreamy'
  | 'noir'
  | 'vibrant'
  | 'desaturated';

export interface StylePreset {
  label: string;
  labelKo: string;
  prompt: string;
  default: boolean;
}

export const STYLES: Record<StyleKey, StylePreset> = {
  'cinematic': {
    label: 'Cinematic',
    labelKo: '시네마틱',
    prompt: 'cinematic, movie-like composition, professional color grading',
    default: true
  },
  'film-grain': {
    label: 'Film Grain',
    labelKo: '필름 그레인',
    prompt: '35mm film grain, analog film texture',
    default: false
  },
  'anamorphic': {
    label: 'Anamorphic',
    labelKo: '애너모픽',
    prompt: 'anamorphic lens, horizontal lens flare, wide aspect feel',
    default: false
  },
  'high-contrast': {
    label: 'High Contrast',
    labelKo: '하이 콘트라스트',
    prompt: 'high contrast, deep shadows, bright highlights',
    default: true
  },
  'soft-dreamy': {
    label: 'Soft Dreamy',
    labelKo: '소프트/몽환',
    prompt: 'soft dreamy glow, slight haze, romantic feel',
    default: false
  },
  'noir': {
    label: 'Noir',
    labelKo: '느와르',
    prompt: 'film noir style, dramatic shadows, moody atmosphere',
    default: false
  },
  'vibrant': {
    label: 'Vibrant',
    labelKo: '비비드',
    prompt: 'vibrant saturated colors, punchy look',
    default: false
  },
  'desaturated': {
    label: 'Desaturated',
    labelKo: '저채도',
    prompt: 'desaturated muted colors, subtle tones',
    default: false
  }
};

// =============================================
// Quality Keywords
// =============================================

export type QualityKey =
  | 'hyper-realistic'
  | '8k'
  | 'detailed'
  | 'unreal-engine'
  | 'ray-tracing';

export interface QualityPreset {
  label: string;
  labelKo: string;
  prompt: string;
  default: boolean;
}

export const QUALITY_KEYWORDS: Record<QualityKey, QualityPreset> = {
  'hyper-realistic': {
    label: 'Hyper-realistic',
    labelKo: '하이퍼 리얼리스틱',
    prompt: 'hyper-realistic, photorealistic',
    default: true
  },
  '8k': {
    label: '8K',
    labelKo: '8K',
    prompt: '8K resolution, ultra high definition',
    default: true
  },
  'detailed': {
    label: 'Detailed',
    labelKo: '디테일',
    prompt: 'intricate details, sharp focus',
    default: true
  },
  'unreal-engine': {
    label: 'Unreal Engine',
    labelKo: '언리얼 엔진',
    prompt: 'Unreal Engine 5 render quality',
    default: false
  },
  'ray-tracing': {
    label: 'Ray Tracing',
    labelKo: '레이 트레이싱',
    prompt: 'ray traced lighting, realistic reflections',
    default: false
  }
};

// =============================================
// Negative Prompts
// =============================================

export const NEGATIVE_PROMPTS = {
  // Always applied (default)
  default: [
    'blurry',
    'low quality',
    'distorted face',
    'deformed hands',
    'text',
    'watermark',
    'logo',
    'static image',
    'frame jump',
    'teleportation'
  ],

  // Optional additions
  optional: {
    'no-cartoon': {
      label: '만화풍 금지',
      prompt: 'cartoon style, anime style, illustration'
    },
    'no-slow-motion': {
      label: '슬로모션 금지',
      prompt: 'slow motion, speed ramp'
    },
    'no-shake': {
      label: '과도한 흔들림 금지',
      prompt: 'excessive camera shake, shaky cam'
    },
    'no-lens-effects': {
      label: '렌즈 효과 금지',
      prompt: 'lens flare, chromatic aberration'
    },
    'no-cg-look': {
      label: 'CG 느낌 금지',
      prompt: 'plastic skin, CGI look, uncanny valley'
    }
  }
};

export type OptionalNegativeKey = keyof typeof NEGATIVE_PROMPTS.optional;

// =============================================
// Mood Presets (for AI auto-selection)
// =============================================

export type MoodKey =
  | 'romantic'
  | 'seductive'
  | 'mysterious'
  | 'melancholic'
  | 'energetic'
  | 'peaceful'
  | 'dramatic'
  | 'warm';

export interface MoodPreset {
  label: string;
  labelKo: string;
  suggestedEnvironments: EnvironmentKey[];
  suggestedStyles: StyleKey[];
  suggestedAngles: CameraAngleKey[];
  suggestedMovements: CameraMovementKey[];
}

export const MOODS: Record<MoodKey, MoodPreset> = {
  'romantic': {
    label: 'Romantic',
    labelKo: '로맨틱/따뜻한',
    suggestedEnvironments: ['golden-hour', 'cozy-cafe', 'beach-sunset'],
    suggestedStyles: ['cinematic', 'soft-dreamy'],
    suggestedAngles: ['close-up', 'medium'],
    suggestedMovements: ['slow-push', 'static', 'orbit']
  },
  'seductive': {
    label: 'Seductive',
    labelKo: '섹시/유혹적',
    suggestedEnvironments: ['neon-bar', 'luxury-hotel', 'studio-dark'],
    suggestedStyles: ['cinematic', 'high-contrast', 'noir'],
    suggestedAngles: ['close-up', 'extreme-close-up', 'low-angle'],
    suggestedMovements: ['slow-push', 'orbit', 'handheld']
  },
  'mysterious': {
    label: 'Mysterious',
    labelKo: '미스터리/긴장',
    suggestedEnvironments: ['blue-hour', 'forest-misty', 'rainy-city'],
    suggestedStyles: ['noir', 'high-contrast', 'desaturated'],
    suggestedAngles: ['dutch', 'low-angle', 'pov'],
    suggestedMovements: ['slow-push', 'handheld', 'dolly-zoom']
  },
  'melancholic': {
    label: 'Melancholic',
    labelKo: '슬픔/감성',
    suggestedEnvironments: ['rainy-city', 'blue-hour', 'snowy-night'],
    suggestedStyles: ['desaturated', 'film-grain', 'soft-dreamy'],
    suggestedAngles: ['medium', 'wide', 'high-angle'],
    suggestedMovements: ['slow-pull', 'static', 'crane-up']
  },
  'energetic': {
    label: 'Energetic',
    labelKo: '에너지/역동',
    suggestedEnvironments: ['busy-street', 'studio-bright', 'beach-sunset'],
    suggestedStyles: ['vibrant', 'high-contrast', 'cinematic'],
    suggestedAngles: ['wide', 'low-angle', 'pov'],
    suggestedMovements: ['tracking', 'fpv-drone', 'handheld']
  },
  'peaceful': {
    label: 'Peaceful',
    labelKo: '평화로운',
    suggestedEnvironments: ['snowy-night', 'forest-misty', 'cozy-cafe'],
    suggestedStyles: ['soft-dreamy', 'desaturated', 'film-grain'],
    suggestedAngles: ['wide', 'medium'],
    suggestedMovements: ['static', 'slow-push', 'slow-pull']
  },
  'dramatic': {
    label: 'Dramatic',
    labelKo: '드라마틱',
    suggestedEnvironments: ['studio-dark', 'rooftop-night', 'rainy-city'],
    suggestedStyles: ['high-contrast', 'noir', 'anamorphic'],
    suggestedAngles: ['low-angle', 'dutch', 'extreme-close-up'],
    suggestedMovements: ['dolly-zoom', 'crane-up', 'slow-push']
  },
  'warm': {
    label: 'Warm',
    labelKo: '따뜻한',
    suggestedEnvironments: ['golden-hour', 'cozy-cafe', 'luxury-hotel'],
    suggestedStyles: ['cinematic', 'soft-dreamy', 'vibrant'],
    suggestedAngles: ['medium', 'close-up'],
    suggestedMovements: ['slow-push', 'orbit', 'static']
  }
};

// =============================================
// Action Verb Categories (for AI prompt assistance)
// =============================================

export interface ActionCategory {
  label: string;
  labelKo: string;
  examples: string[];
  examplesKo: string[];
}

export const ACTION_VERBS: Record<string, ActionCategory> = {
  'emotion': {
    label: 'Emotion',
    labelKo: '감정 표현',
    examples: [
      'gazing softly',
      'smiling gently',
      'laughing joyfully',
      'crying silently',
      'staring intensely',
      'looking away shyly'
    ],
    examplesKo: [
      '부드럽게 바라보며',
      '살며시 미소 짓고',
      '즐겁게 웃으며',
      '조용히 눈물 흘리며',
      '강렬하게 응시하고',
      '수줍게 시선을 피하며'
    ]
  },
  'movement': {
    label: 'Movement',
    labelKo: '이동/동작',
    examples: [
      'walking slowly',
      'running fast',
      'turning around',
      'stepping forward',
      'leaning against',
      'sitting down'
    ],
    examplesKo: [
      '천천히 걸으며',
      '빠르게 달리며',
      '뒤돌아보며',
      '앞으로 나서며',
      '기대어 서며',
      '앉으며'
    ]
  },
  'interaction': {
    label: 'Interaction',
    labelKo: '상호작용',
    examples: [
      'holding a glass',
      'touching face',
      'playing with hair',
      'lighting a cigarette',
      'opening a door',
      'picking up phone'
    ],
    examplesKo: [
      '잔을 들고',
      '얼굴을 만지며',
      '머리카락을 만지작거리며',
      '담배에 불을 붙이며',
      '문을 열며',
      '전화기를 집어 들며'
    ]
  },
  'dramatic': {
    label: 'Dramatic',
    labelKo: '드라마틱',
    examples: [
      'falling backwards',
      'collapsing',
      'reaching out desperately',
      'screaming',
      'fighting',
      'dodging'
    ],
    examplesKo: [
      '뒤로 쓰러지며',
      '무너지며',
      '필사적으로 손을 뻗으며',
      '소리치며',
      '싸우며',
      '피하며'
    ]
  },
  'subtle': {
    label: 'Subtle',
    labelKo: '미세한 동작',
    examples: [
      'breathing deeply',
      'blinking slowly',
      'lips parting slightly',
      'wind blowing hair',
      'fabric rippling',
      'steam rising'
    ],
    examplesKo: [
      '깊게 숨 쉬며',
      '천천히 눈 깜빡이며',
      '입술이 살짝 벌어지며',
      '바람에 머리카락이 날리며',
      '천이 물결치며',
      '김이 올라오며'
    ]
  }
};

// =============================================
// Default Selections
// =============================================

export const DEFAULT_SELECTIONS = {
  cameraAngle: 'close-up' as CameraAngleKey,
  cameraMovement: 'slow-push' as CameraMovementKey,
  environment: 'studio-dark' as EnvironmentKey,
  styles: ['cinematic', 'high-contrast'] as StyleKey[],
  quality: ['hyper-realistic', '8k', 'detailed'] as QualityKey[],
  negativeOptional: [] as OptionalNegativeKey[]
};
