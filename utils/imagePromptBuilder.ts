/**
 * Image Prompt Builder Utility
 *
 * Builds optimized prompts for high-quality image generation
 * using the 9-Block System:
 * [SUBJECT] + [SETTING] + [COMPOSITION] + [CAMERA/LENS] + [LIGHTING] +
 * [MATERIAL/DETAIL] + [STYLE] + [QUALITY] + [NEGATIVE]
 */

import {
  SHOT_TYPES,
  CAMERA_ANGLES,
  LENSES,
  LIGHTINGS,
  ENVIRONMENTS,
  MATERIALS,
  STYLES,
  QUALITY_KEYWORDS,
  IMAGE_NEGATIVE_PROMPTS,
  MOODS,
  FRAMINGS,
  IMAGE_DEFAULT_SELECTIONS,
  ShotTypeKey,
  CameraAngleKey,
  LensKey,
  LightingKey,
  EnvironmentKey,
  MaterialKey,
  StyleKey,
  QualityKey,
  OptionalNegativeKey,
  MoodKey,
  FramingKey,
} from '../constants/imagePromptPresets';
import { Character } from '../types';

// =============================================
// Types
// =============================================

export interface ImagePromptConfig {
  // Subject
  subject: string;
  isHuman: boolean;

  // Composition
  shotType: ShotTypeKey;
  cameraAngle: CameraAngleKey;
  framing: FramingKey;

  // Camera
  lens: LensKey;

  // Environment
  environment: EnvironmentKey;
  customEnvironment?: string;

  // Lighting
  lighting: LightingKey;

  // Materials
  materials: MaterialKey[];

  // Style & Quality
  style: StyleKey;
  quality: QualityKey[];

  // Negative
  negativeOptional: OptionalNegativeKey[];

  // Additional
  additionalDetails?: string;
}

export interface GeneratedImagePrompt {
  fullPrompt: string;
  negativePrompt: string;
  breakdown: {
    subject: string;
    setting: string;
    composition: string;
    camera: string;
    lighting: string;
    material: string;
    style: string;
    quality: string;
  };
}

export interface AIImageRecommendation {
  shotType: ShotTypeKey;
  cameraAngle: CameraAngleKey;
  lens: LensKey;
  lighting: LightingKey;
  environment: EnvironmentKey;
  style: StyleKey;
  framing: FramingKey;
  reasoning: string;
}

// =============================================
// Main Functions
// =============================================

/**
 * Builds a subject string from Character data
 */
export function buildSubjectFromCharacter(character: Character): string {
  const parts: string[] = [];

  parts.push('Korean');

  if (character.age) {
    parts.push(`${character.age} year old`);
  }

  if (character.personality) {
    parts.push(character.personality.toLowerCase());
  }

  parts.push('person');

  if (character.outfit) {
    parts.push(`wearing ${character.outfit.toLowerCase()}`);
  }

  const namePrefix = character.name ? `${character.name}, ` : '';
  return `${namePrefix}a ${parts.join(' ')}`;
}

/**
 * Builds the complete image prompt from configuration
 */
export function buildImagePrompt(config: ImagePromptConfig): GeneratedImagePrompt {
  // 1. Subject
  const subject = config.subject;

  // 2. Setting / Environment
  const envPreset = config.customEnvironment
    ? config.customEnvironment
    : ENVIRONMENTS[config.environment].prompt;

  // 3. Composition
  const shotPreset = SHOT_TYPES[config.shotType];
  const anglePreset = CAMERA_ANGLES[config.cameraAngle];
  const framingPreset = FRAMINGS[config.framing];
  const compositionString = `${shotPreset.prompt}, ${anglePreset.prompt}, ${framingPreset.prompt}`;

  // 4. Camera/Lens
  const lensPreset = LENSES[config.lens];
  const cameraString = lensPreset.prompt;

  // 5. Lighting
  const lightingPreset = LIGHTINGS[config.lighting];
  const lightingString = lightingPreset.prompt;

  // 6. Materials
  const materialPrompts = config.materials
    .map(key => MATERIALS[key].prompt)
    .filter(Boolean);
  const materialString = materialPrompts.length > 0
    ? materialPrompts.join(', ')
    : '';

  // 7. Style
  const stylePreset = STYLES[config.style];
  const styleString = stylePreset.prompt;

  // 8. Quality
  const qualityPrompts = config.quality
    .map(key => QUALITY_KEYWORDS[key].prompt)
    .filter(Boolean);
  const qualityString = qualityPrompts.join(', ');

  // Build full prompt
  const promptParts = [
    subject,
    envPreset,
    compositionString,
    cameraString,
    lightingString,
    materialString,
    styleString,
    qualityString,
    config.additionalDetails
  ].filter(Boolean);

  const fullPrompt = promptParts.join('. ') + '.';

  // Build negative prompt
  const negativePrompts = [
    ...IMAGE_NEGATIVE_PROMPTS.default,
    ...(config.isHuman ? IMAGE_NEGATIVE_PROMPTS.human : []),
    ...IMAGE_NEGATIVE_PROMPTS.style,
    ...config.negativeOptional.map(key => IMAGE_NEGATIVE_PROMPTS.optional[key].prompt)
  ];
  const negativePrompt = negativePrompts.join(', ');

  return {
    fullPrompt,
    negativePrompt,
    breakdown: {
      subject,
      setting: envPreset,
      composition: compositionString,
      camera: cameraString,
      lighting: lightingString,
      material: materialString,
      style: styleString,
      quality: qualityString
    }
  };
}

/**
 * Get AI recommendation based on mood
 */
export function getRecommendationByMood(mood: MoodKey): AIImageRecommendation {
  const moodPreset = MOODS[mood];

  return {
    shotType: IMAGE_DEFAULT_SELECTIONS.shotType,
    cameraAngle: IMAGE_DEFAULT_SELECTIONS.cameraAngle,
    lens: moodPreset.suggestedLens,
    lighting: moodPreset.suggestedLighting,
    environment: moodPreset.suggestedEnvironment,
    style: moodPreset.suggestedStyle,
    framing: IMAGE_DEFAULT_SELECTIONS.framing,
    reasoning: `${moodPreset.labelKo} 분위기에 최적화된 설정입니다. 톤: ${moodPreset.colorTone}`
  };
}

/**
 * Analyze subject text and suggest appropriate settings
 */
export function analyzeSubjectForSettings(subject: string): {
  suggestedShot: ShotTypeKey;
  suggestedAngle: CameraAngleKey;
  suggestedLens: LensKey;
  isHuman: boolean;
} {
  const subjectLower = subject.toLowerCase();

  // Check if human
  const humanKeywords = ['person', 'man', 'woman', 'people', 'portrait', 'face', 'model', '사람', '여자', '남자', '인물'];
  const isHuman = humanKeywords.some(kw => subjectLower.includes(kw));

  // Emotion/face focus → close-up
  const emotionKeywords = ['emotion', 'expression', 'face', 'eyes', 'smile', 'cry', '표정', '감정', '눈', '미소'];
  const isEmotionFocused = emotionKeywords.some(kw => subjectLower.includes(kw));

  // Detail focus → extreme close-up
  const detailKeywords = ['detail', 'texture', 'close', 'lips', 'hands', '디테일', '질감', '입술', '손'];
  const isDetailFocused = detailKeywords.some(kw => subjectLower.includes(kw));

  // Action/full body → wide
  const actionKeywords = ['action', 'running', 'walking', 'dancing', 'full body', '액션', '달리', '걷', '춤', '전신'];
  const isActionFocused = actionKeywords.some(kw => subjectLower.includes(kw));

  // Landscape/environment → extreme wide
  const landscapeKeywords = ['landscape', 'scenery', 'view', 'panorama', '풍경', '전경', '뷰'];
  const isLandscape = landscapeKeywords.some(kw => subjectLower.includes(kw));

  // Determine shot type
  let suggestedShot: ShotTypeKey = 'medium';
  if (isDetailFocused) {
    suggestedShot = 'extreme-close-up';
  } else if (isEmotionFocused) {
    suggestedShot = 'close-up';
  } else if (isActionFocused) {
    suggestedShot = 'wide';
  } else if (isLandscape) {
    suggestedShot = 'extreme-wide';
  } else if (isHuman) {
    suggestedShot = 'medium';
  }

  // Determine angle
  let suggestedAngle: CameraAngleKey = 'eye-level';

  // Hero/powerful → low angle
  const powerKeywords = ['hero', 'powerful', 'strong', '영웅', '강한', '힘'];
  if (powerKeywords.some(kw => subjectLower.includes(kw))) {
    suggestedAngle = 'low-angle';
  }

  // Vulnerable/small → high angle
  const vulnerableKeywords = ['small', 'vulnerable', 'weak', '작은', '약한'];
  if (vulnerableKeywords.some(kw => subjectLower.includes(kw))) {
    suggestedAngle = 'high-angle';
  }

  // Determine lens
  let suggestedLens: LensKey = isHuman ? '85mm-portrait' : '50mm-normal';
  if (isLandscape) {
    suggestedLens = '24mm-wide';
  } else if (isDetailFocused) {
    suggestedLens = '135mm-telephoto';
  }

  return {
    suggestedShot,
    suggestedAngle,
    suggestedLens,
    isHuman
  };
}

/**
 * Get full AI recommendation based on subject and mood
 */
export function getAIRecommendation(
  subject: string,
  mood?: MoodKey
): AIImageRecommendation {
  const subjectAnalysis = analyzeSubjectForSettings(subject);

  if (mood) {
    const moodRec = getRecommendationByMood(mood);

    return {
      shotType: subjectAnalysis.suggestedShot,
      cameraAngle: subjectAnalysis.suggestedAngle,
      lens: subjectAnalysis.isHuman ? moodRec.lens : subjectAnalysis.suggestedLens,
      lighting: moodRec.lighting,
      environment: moodRec.environment,
      style: moodRec.style,
      framing: moodRec.framing,
      reasoning: `"${subject}" 주제와 ${MOODS[mood].labelKo} 분위기에 맞춰 추천합니다.`
    };
  }

  return {
    shotType: subjectAnalysis.suggestedShot,
    cameraAngle: subjectAnalysis.suggestedAngle,
    lens: subjectAnalysis.suggestedLens,
    lighting: IMAGE_DEFAULT_SELECTIONS.lighting,
    environment: IMAGE_DEFAULT_SELECTIONS.environment,
    style: IMAGE_DEFAULT_SELECTIONS.style,
    framing: IMAGE_DEFAULT_SELECTIONS.framing,
    reasoning: `"${subject}" 주제에 맞춰 추천합니다.`
  };
}

/**
 * Create default configuration
 */
export function createDefaultImageConfig(
  subject: string = '',
  isHuman: boolean = true
): ImagePromptConfig {
  return {
    subject,
    isHuman,
    shotType: IMAGE_DEFAULT_SELECTIONS.shotType,
    cameraAngle: IMAGE_DEFAULT_SELECTIONS.cameraAngle,
    framing: IMAGE_DEFAULT_SELECTIONS.framing,
    lens: IMAGE_DEFAULT_SELECTIONS.lens,
    lighting: IMAGE_DEFAULT_SELECTIONS.lighting,
    environment: IMAGE_DEFAULT_SELECTIONS.environment,
    style: IMAGE_DEFAULT_SELECTIONS.style,
    quality: [...IMAGE_DEFAULT_SELECTIONS.quality],
    materials: [],
    negativeOptional: []
  };
}

/**
 * Apply AI recommendation to config
 */
export function applyImageRecommendation(
  config: ImagePromptConfig,
  recommendation: AIImageRecommendation
): ImagePromptConfig {
  return {
    ...config,
    shotType: recommendation.shotType,
    cameraAngle: recommendation.cameraAngle,
    lens: recommendation.lens,
    lighting: recommendation.lighting,
    environment: recommendation.environment,
    style: recommendation.style,
    framing: recommendation.framing
  };
}

/**
 * Build simple prompt for quick generation
 */
export function buildSimpleImagePrompt(
  subject: string,
  mood?: MoodKey,
  isHuman: boolean = true
): string {
  const config = createDefaultImageConfig(subject, isHuman);

  if (mood) {
    const recommendation = getAIRecommendation(subject, mood);
    const updatedConfig = applyImageRecommendation(config, recommendation);
    return buildImagePrompt(updatedConfig).fullPrompt;
  }

  return buildImagePrompt(config).fullPrompt;
}

/**
 * Generate structured prompt for scenario AI to use
 * This provides instructions for the AI to generate properly structured prompts
 */
export function getImagePromptInstructions(): string {
  return `
### 이미지 프롬프트 9-Block 구조 (필수)

모든 이미지 프롬프트는 다음 9가지 요소를 포함해야 합니다:

1. **[SUBJECT]** - 주인공/대상 + 행동/상태 + 핵심 소품
   - 예: "Korean woman in her 20s, looking thoughtfully out the window, holding a coffee cup"

2. **[SETTING]** - 장소 + 시간대 + 분위기
   - 예: "modern minimalist apartment, morning light, peaceful atmosphere"

3. **[COMPOSITION]** - 샷타입 + 시점 + 프레이밍
   - 샷: extreme close-up / close-up / medium / wide
   - 시점: eye-level / low-angle / high-angle
   - 프레이밍: rule of thirds / center / negative space

4. **[CAMERA/LENS]** - 렌즈 + 조리개 + 심도
   - 예: "85mm portrait lens, f/1.8, shallow depth of field, creamy bokeh"

5. **[LIGHTING]** - 광원 종류 + 방향 + 대비 + 림라이트
   - 예: "soft natural window light from left, gentle shadows, subtle rim light"

6. **[MATERIAL/DETAIL]** - 질감 키워드 (피부/천/금속 등)
   - 예: "natural skin texture, silk fabric draping, steam rising from cup"

7. **[STYLE]** - 스타일 레벨
   - 필수: "ultra photoreal, cinematic color grading"
   - 옵션: film grain, editorial, documentary

8. **[QUALITY]** - 품질 지시
   - 필수: "highly detailed, 8K, sharp focus"

9. **[NEGATIVE]** - 금지 요소 (프롬프트 끝에 별도 표기)
   - 기본: "no text, no watermark, no blurry, no deformed face"

### 프롬프트 작성 예시

**최종 프롬프트:**
Korean woman in her late 20s with a contemplative expression, looking out through rain-streaked window, holding warm coffee cup. Cozy apartment interior, rainy evening, melancholic atmosphere. Medium close-up shot, eye-level angle, subject on left third of frame. 85mm portrait lens, f/1.8, shallow depth of field with creamy bokeh background. Soft diffused window light, gentle shadows on face, subtle rim light from lamp. Natural skin texture, raindrops on glass, steam rising from cup, cozy sweater texture. Ultra photoreal, cinematic color grading, subtle film grain. Highly detailed, 8K resolution, tack sharp focus on eyes.

**Negative:** blurry, low resolution, watermark, text, deformed face, extra fingers, cartoon, anime, illustration, oversaturated
`;
}
