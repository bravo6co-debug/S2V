/**
 * Video Prompt Builder Utility
 *
 * Builds optimized prompts for Veo 3.1 video generation
 * using the 6-Block System:
 * [SUBJECT] + [ACTION] + [CAMERA] + [ENVIRONMENT] + [STYLE] + [NEGATIVE]
 */

import {
  CAMERA_ANGLES,
  CAMERA_MOVEMENTS,
  ENVIRONMENTS,
  STYLES,
  QUALITY_KEYWORDS,
  NEGATIVE_PROMPTS,
  MOODS,
  DEFAULT_SELECTIONS,
  CameraAngleKey,
  CameraMovementKey,
  EnvironmentKey,
  StyleKey,
  QualityKey,
  OptionalNegativeKey,
  MoodKey,
} from '../constants/videoPromptPresets';
import { Character } from '../types';

// =============================================
// Types
// =============================================

export interface VideoPromptConfig {
  // Subject (from character)
  character?: Character;
  customSubject?: string;

  // Action (user input - required)
  action: string;

  // Camera settings
  cameraAngle: CameraAngleKey;
  cameraMovement: CameraMovementKey;

  // Environment
  environment: EnvironmentKey;
  customEnvironment?: string;

  // Styles
  styles: StyleKey[];
  quality: QualityKey[];

  // Negative prompts
  negativeOptional: OptionalNegativeKey[];
}

export interface GeneratedPrompt {
  fullPrompt: string;
  negativePrompt: string;
  breakdown: {
    subject: string;
    action: string;
    camera: string;
    environment: string;
    style: string;
    quality: string;
  };
}

export interface AIRecommendation {
  cameraAngle: CameraAngleKey;
  cameraMovement: CameraMovementKey;
  environment: EnvironmentKey;
  styles: StyleKey[];
  reasoning: string;
}

// =============================================
// Main Functions
// =============================================

/**
 * Builds a character subject string from Character data
 */
export function buildSubjectFromCharacter(character: Character): string {
  const parts: string[] = [];

  // Age and personality
  if (character.age) {
    parts.push(`${character.age} year old`);
  }

  // Name or description
  if (character.personality) {
    parts.push(`${character.personality.toLowerCase()}`);
  }

  parts.push('Korean');

  // Outfit
  if (character.outfit) {
    parts.push(`wearing ${character.outfit.toLowerCase()}`);
  }

  // Combine with character name if available
  const namePrefix = character.name ? `${character.name}, ` : '';

  return `${namePrefix}a ${parts.join(' ')}`;
}

/**
 * Builds the complete video prompt from configuration
 */
export function buildVideoPrompt(config: VideoPromptConfig): GeneratedPrompt {
  // 1. Subject
  const subject = config.character
    ? buildSubjectFromCharacter(config.character)
    : config.customSubject || 'A person';

  // 2. Action (required)
  const action = config.action.trim();

  // 3. Camera
  const cameraAngle = CAMERA_ANGLES[config.cameraAngle];
  const cameraMovement = CAMERA_MOVEMENTS[config.cameraMovement];
  const cameraString = `${cameraAngle.prompt}, ${cameraMovement.prompt}`;

  // 4. Environment
  const environment = config.customEnvironment
    || ENVIRONMENTS[config.environment].prompt;

  // 5. Styles
  const stylePrompts = config.styles
    .map(key => STYLES[key].prompt)
    .filter(Boolean);
  const styleString = stylePrompts.join(', ');

  // 6. Quality
  const qualityPrompts = config.quality
    .map(key => QUALITY_KEYWORDS[key].prompt)
    .filter(Boolean);
  const qualityString = qualityPrompts.join(', ');

  // Build full prompt
  const fullPrompt = [
    `${subject} ${action}`,
    cameraString,
    environment,
    styleString,
    qualityString
  ].filter(Boolean).join('. ') + '.';

  // Build negative prompt
  const negativePrompts = [
    ...NEGATIVE_PROMPTS.default,
    ...config.negativeOptional.map(key => NEGATIVE_PROMPTS.optional[key].prompt)
  ];
  const negativePrompt = negativePrompts.join(', ');

  return {
    fullPrompt,
    negativePrompt,
    breakdown: {
      subject,
      action,
      camera: cameraString,
      environment,
      style: styleString,
      quality: qualityString
    }
  };
}

/**
 * Get AI-recommended settings based on mood
 */
export function getRecommendationByMood(mood: MoodKey): AIRecommendation {
  const moodPreset = MOODS[mood];

  return {
    cameraAngle: moodPreset.suggestedAngles[0],
    cameraMovement: moodPreset.suggestedMovements[0],
    environment: moodPreset.suggestedEnvironments[0],
    styles: moodPreset.suggestedStyles,
    reasoning: `${moodPreset.labelKo} 분위기에 최적화된 설정입니다.`
  };
}

/**
 * Analyze action text and suggest appropriate camera settings
 */
export function analyzeActionForCamera(action: string): {
  suggestedAngle: CameraAngleKey;
  suggestedMovement: CameraMovementKey;
} {
  const actionLower = action.toLowerCase();

  // Emotion-focused actions → close-up
  const emotionKeywords = ['smile', 'cry', 'laugh', 'stare', 'gaze', 'look', 'tear', '미소', '웃', '울', '바라', '응시'];
  const isEmotional = emotionKeywords.some(kw => actionLower.includes(kw));

  // Detail-focused actions → extreme close-up
  const detailKeywords = ['lip', 'eye', 'hand', 'finger', 'touch', '입술', '눈', '손', '만지'];
  const isDetail = detailKeywords.some(kw => actionLower.includes(kw));

  // Movement actions → tracking or wide
  const movementKeywords = ['walk', 'run', 'dance', 'jump', 'move', 'turn', '걷', '달리', '춤', '뛰', '돌아'];
  const isMovement = movementKeywords.some(kw => actionLower.includes(kw));

  // Dramatic actions → low angle or dutch
  const dramaticKeywords = ['fall', 'fight', 'scream', 'collapse', '쓰러', '싸우', '소리', '무너'];
  const isDramatic = dramaticKeywords.some(kw => actionLower.includes(kw));

  // Determine angle
  let suggestedAngle: CameraAngleKey = 'medium';
  if (isDetail) {
    suggestedAngle = 'extreme-close-up';
  } else if (isEmotional) {
    suggestedAngle = 'close-up';
  } else if (isMovement) {
    suggestedAngle = 'wide';
  } else if (isDramatic) {
    suggestedAngle = 'low-angle';
  }

  // Determine movement
  let suggestedMovement: CameraMovementKey = 'slow-push';
  if (isMovement) {
    suggestedMovement = 'tracking';
  } else if (isDramatic) {
    suggestedMovement = 'handheld';
  } else if (isDetail || isEmotional) {
    suggestedMovement = 'slow-push';
  }

  return { suggestedAngle, suggestedMovement };
}

/**
 * Get full AI recommendation based on action and mood
 */
export function getAIRecommendation(
  action: string,
  mood?: MoodKey
): AIRecommendation {
  // Start with action analysis
  const actionAnalysis = analyzeActionForCamera(action);

  // If mood is provided, blend with mood recommendations
  if (mood) {
    const moodRec = getRecommendationByMood(mood);

    // Prefer action-based angle if it's more specific
    const finalAngle = actionAnalysis.suggestedAngle !== 'medium'
      ? actionAnalysis.suggestedAngle
      : moodRec.cameraAngle;

    return {
      cameraAngle: finalAngle,
      cameraMovement: actionAnalysis.suggestedMovement,
      environment: moodRec.environment,
      styles: moodRec.styles,
      reasoning: `"${action}" 동작과 ${MOODS[mood].labelKo} 분위기에 맞춰 추천합니다.`
    };
  }

  // Action-only recommendation
  return {
    cameraAngle: actionAnalysis.suggestedAngle,
    cameraMovement: actionAnalysis.suggestedMovement,
    environment: DEFAULT_SELECTIONS.environment,
    styles: DEFAULT_SELECTIONS.styles,
    reasoning: `"${action}" 동작에 맞춰 추천합니다.`
  };
}

/**
 * Create default configuration
 */
export function createDefaultConfig(
  character?: Character,
  action: string = ''
): VideoPromptConfig {
  return {
    character,
    action,
    cameraAngle: DEFAULT_SELECTIONS.cameraAngle,
    cameraMovement: DEFAULT_SELECTIONS.cameraMovement,
    environment: DEFAULT_SELECTIONS.environment,
    styles: [...DEFAULT_SELECTIONS.styles],
    quality: [...DEFAULT_SELECTIONS.quality],
    negativeOptional: []
  };
}

/**
 * Apply AI recommendation to config
 */
export function applyRecommendation(
  config: VideoPromptConfig,
  recommendation: AIRecommendation
): VideoPromptConfig {
  return {
    ...config,
    cameraAngle: recommendation.cameraAngle,
    cameraMovement: recommendation.cameraMovement,
    environment: recommendation.environment,
    styles: recommendation.styles
  };
}

/**
 * Validate config and return errors
 */
export function validateConfig(config: VideoPromptConfig): string[] {
  const errors: string[] = [];

  if (!config.action || config.action.trim().length === 0) {
    errors.push('동작 설명을 입력해주세요.');
  }

  if (!config.character && !config.customSubject) {
    errors.push('캐릭터를 선택하거나 주체를 직접 입력해주세요.');
  }

  return errors;
}

/**
 * Get simple prompt for quick generation (without full builder)
 */
export function buildSimplePrompt(
  action: string,
  mood?: MoodKey,
  character?: Character
): string {
  const config = createDefaultConfig(character, action);

  if (mood) {
    const recommendation = getAIRecommendation(action, mood);
    const updatedConfig = applyRecommendation(config, recommendation);
    return buildVideoPrompt(updatedConfig).fullPrompt;
  }

  return buildVideoPrompt(config).fullPrompt;
}
