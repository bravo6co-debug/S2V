/**
 * 모델별 최적화된 이미지 프롬프트 빌더
 *
 * - Gemini: 서술형 문단, 시네마틱/포토그래픽 언어, semantic negative
 * - Imagen: 주어→배경→스타일 구조, 퀄리티 모디파이어
 * - FLUX: 간결 명시적 지시, 메타지시 제거, "no text" 강조
 */

import type { ImageStyle } from './types.js';

type ModelCategory = 'gemini' | 'imagen' | 'flux';

// 스타일별 프롬프트 프리픽스
const STYLE_PREFIXES: Record<ImageStyle, string> = {
  photorealistic: 'Ultra-realistic DSLR photograph with cinematic lighting',
  animation: 'High-quality Japanese anime style illustration with clean linework and vibrant colors',
  illustration: 'Professional digital illustration with clean vector-like artwork and bold colors',
  cinematic: 'Cinematic film still with dramatic lighting and professional color grading',
  watercolor: 'Delicate watercolor painting with soft washes and organic textures',
  '3d_render': 'Pixar-style 3D rendered image with smooth textures and appealing character design',
  low_poly: 'Low-poly geometric 3D art style with faceted surfaces and minimalist aesthetic',
  pixel_art: 'Retro pixel art style with crisp pixels and limited color palette',
  stop_motion: 'Stop-motion animation style with tactile textures and handcrafted feel',
  sketch: 'Hand-drawn sketch style with pencil strokes and artistic linework',
  comic_book: 'Bold comic book style with strong outlines, halftone dots, and dynamic composition',
  art_movement: 'Classic art movement inspired style with expressive brushwork',
  motion_graphics: 'Modern motion graphics style with clean shapes and vibrant gradients',
};

export interface ScenePromptParams {
  imagePrompt: string;
  cameraAngle?: string;
  lightingMood?: string;
  mood?: string;
  imageStyle?: ImageStyle;
}

export interface HookPromptParams {
  visualDescription: string;
  imageStyle?: ImageStyle;
}

export interface CharacterPromptParams {
  characterName?: string;
  appearanceDescription: string;
  outfit?: string;
  imageStyle?: ImageStyle;
}

// ─── 모델 분류 ────────────────────────────────────

function getModelCategory(model: string): ModelCategory {
  if (model.startsWith('flux-kontext-')) return 'flux';
  if (model.startsWith('imagen-')) return 'imagen';
  return 'gemini';
}

// ─── 카메라/조명 중복 체크 ─────────────────────────

function hasCamera(text: string): boolean {
  return /\b(shot|angle|view|close-up|wide|medium|POV|bird's eye|low-angle|high-angle|Dutch|tracking)\b/i.test(text);
}

function hasLighting(text: string): boolean {
  return /\b(light|glow|sunlight|moonlight|neon|shadow|backlight|ambient|golden hour|blue hour|rim light)\b/i.test(text);
}

function enhanceBase(basePrompt: string, camera?: string, lighting?: string): string {
  let enhanced = basePrompt.trim();
  if (!hasCamera(enhanced) && camera) enhanced += `, ${camera}`;
  if (!hasLighting(enhanced) && lighting) enhanced += `, ${lighting}`;
  return enhanced;
}

// ─── 씬 프롬프트 ──────────────────────────────────

function getStylePrefix(style?: ImageStyle): string {
  return STYLE_PREFIXES[style || 'animation'];
}

function getStyleDescription(style?: ImageStyle): string {
  switch (style) {
    case 'photorealistic':
    case 'cinematic':
      return 'rendered with photorealistic detail, natural lighting, and professional cinematography';
    case 'illustration':
      return 'rendered in clean digital illustration style with bold colors and stylized aesthetics';
    case 'watercolor':
      return 'rendered in delicate watercolor style with soft washes and organic textures';
    case '3d_render':
      return 'rendered in Pixar-style 3D with smooth textures and appealing character design';
    case 'low_poly':
      return 'rendered in low-poly 3D style with geometric faceted surfaces';
    case 'pixel_art':
      return 'rendered in retro pixel art style with crisp pixels';
    case 'stop_motion':
      return 'rendered in stop-motion style with tactile handcrafted textures';
    case 'sketch':
      return 'rendered in hand-drawn sketch style with artistic pencil strokes';
    case 'comic_book':
      return 'rendered in bold comic book style with strong outlines and dynamic composition';
    case 'art_movement':
      return 'rendered in classic art movement style with expressive brushwork';
    case 'motion_graphics':
      return 'rendered in modern motion graphics style with clean shapes and gradients';
    case 'animation':
    default:
      return 'rendered in high-detail anime art style with realistic shading and atmospheric depth';
  }
}

function buildScenePromptGemini(p: ScenePromptParams): string {
  const enhanced = enhanceBase(p.imagePrompt, p.cameraAngle, p.lightingMood);
  const moodClause = p.mood ? ` The atmosphere conveys a sense of ${p.mood}.` : '';
  const stylePrefix = getStylePrefix(p.imageStyle);
  const styleDesc = getStyleDescription(p.imageStyle);

  return `${stylePrefix} scene depicting ${enhanced}.${moodClause} The scene is ${styleDesc}, using a rich and vibrant color palette. Professional composition with cinematic framing in widescreen 16:9 aspect ratio. No text, letters, words, numbers, or writing of any kind appear anywhere in the image, including no Chinese, Japanese, or Korean characters on signs, walls, banners, screens, or any surface. No watermarks, logos, or UI elements.`;
}

function buildScenePromptImagen(p: ScenePromptParams): string {
  const enhanced = enhanceBase(p.imagePrompt, p.cameraAngle, p.lightingMood);
  const moodPart = p.mood ? `, ${p.mood} mood` : '';
  const stylePrefix = getStylePrefix(p.imageStyle);

  return `${stylePrefix}, ${enhanced}${moodPart}. High-quality, stylized, beautiful, rich color palette, professional composition, realistic shading, atmospheric depth, 16:9 cinematic widescreen. No text, no letters, no numbers, no writing in any language including Chinese Japanese Korean on any surface, no watermarks, no logos.`;
}

function buildScenePromptFlux(p: ScenePromptParams): string {
  const enhanced = enhanceBase(p.imagePrompt, p.cameraAngle, p.lightingMood);
  const stylePrefix = getStylePrefix(p.imageStyle);

  return `${stylePrefix}, ${enhanced}. Absolutely no visible text, letters, numbers, or writing in any language including Chinese Japanese Korean on signs walls banners or any surface, no watermarks, no logos. 16:9 cinematic widescreen.`;
}

// ─── 후킹 프롬프트 ────────────────────────────────

function buildHookPromptGemini(p: HookPromptParams): string {
  const stylePrefix = getStylePrefix(p.imageStyle);
  const styleDesc = getStyleDescription(p.imageStyle);

  return `${stylePrefix} designed as a dramatic YouTube video hook: ${p.visualDescription}. The composition is bold and attention-grabbing with saturated colors and cinematic framing that creates immediate visual impact. ${styleDesc.charAt(0).toUpperCase() + styleDesc.slice(1)}. Widescreen 16:9 aspect ratio. No text, letters, words, numbers, or writing of any kind appear anywhere in the image, including no Chinese, Japanese, or Korean characters on signs, walls, banners, screens, or any surface. No watermarks, logos, or UI elements.`;
}

function buildHookPromptImagen(p: HookPromptParams): string {
  const stylePrefix = getStylePrefix(p.imageStyle);

  return `${stylePrefix}, ${p.visualDescription}. Eye-catching dramatic composition, high-quality, stylized, rich saturated color palette, professional cinematic framing, 16:9 widescreen, realistic shading, atmospheric depth. No text, no letters, no numbers, no writing in any language including Chinese Japanese Korean on any surface, no watermarks, no logos.`;
}

function buildHookPromptFlux(p: HookPromptParams): string {
  const stylePrefix = getStylePrefix(p.imageStyle);

  return `${stylePrefix}, ${p.visualDescription}. Eye-catching cinematic composition, saturated colors. Absolutely no visible text, letters, numbers, or writing in any language including Chinese Japanese Korean on signs walls banners or any surface, no watermarks, no logos. 16:9 widescreen.`;
}

// ─── 캐릭터 프롬프트 ──────────────────────────────

function getCharacterStyleDescription(style?: ImageStyle): string {
  switch (style) {
    case 'photorealistic':
    case 'cinematic':
      return 'photorealistic style with natural skin texture and professional studio lighting';
    case 'illustration':
      return 'digital illustration style with clean lines and stylized features';
    case 'watercolor':
      return 'delicate watercolor style with soft edges and organic textures';
    case '3d_render':
      return 'Pixar-style 3D rendered with smooth textures and appealing design';
    case 'low_poly':
      return 'low-poly 3D style with geometric faceted surfaces';
    case 'pixel_art':
      return 'retro pixel art style with crisp pixels';
    case 'stop_motion':
      return 'stop-motion style with handcrafted clay-like texture';
    case 'sketch':
      return 'hand-drawn sketch style with pencil strokes';
    case 'comic_book':
      return 'bold comic book style with strong outlines';
    case 'art_movement':
      return 'classic art movement style with expressive brushwork';
    case 'motion_graphics':
      return 'modern motion graphics style with clean vector shapes';
    case 'animation':
    default:
      return 'high-detail anime art style with vibrant colors';
  }
}

function buildCharacterPromptGemini(p: CharacterPromptParams): string {
  const name = p.characterName || 'character';
  const outfit = p.outfit || 'casual clothes';
  const stylePrefix = getStylePrefix(p.imageStyle);
  const charStyle = getCharacterStyleDescription(p.imageStyle);

  return `${stylePrefix} character portrait of ${name}. ${p.appearanceDescription}. The character is wearing ${outfit}. The portrait shows the upper body, with the character facing slightly to the side under soft, even lighting against a clean background. Rendered in ${charStyle}. No text, letters, words, numbers, or writing of any kind appear in the image, including no Chinese, Japanese, or Korean characters. No watermarks or UI elements.`;
}

function buildCharacterPromptImagen(p: CharacterPromptParams): string {
  const name = p.characterName || 'character';
  const outfit = p.outfit || 'casual clothes';
  const stylePrefix = getStylePrefix(p.imageStyle);

  return `${stylePrefix}, ${name}, ${p.appearanceDescription}, wearing ${outfit}. Character portrait, upper body, facing slightly to the side, clean background, soft lighting, high-quality, stylized, vibrant colors, high detail. No text, no letters, no numbers, no writing in any language including Chinese Japanese Korean, no watermarks.`;
}

function buildCharacterPromptFlux(p: CharacterPromptParams): string {
  const name = p.characterName || 'character';
  const outfit = p.outfit || 'casual clothes';
  const stylePrefix = getStylePrefix(p.imageStyle);

  return `${stylePrefix}, character portrait of ${name}. ${p.appearanceDescription}. Wearing ${outfit}. Upper body, slight side angle, clean background, soft lighting. Absolutely no visible text, letters, numbers, or writing in any language including Chinese Japanese Korean, no watermarks.`;
}

// ─── 통합 빌더 ────────────────────────────────────

export function buildImagePrompt(
  model: string,
  type: 'scene',
  params: ScenePromptParams,
): string;
export function buildImagePrompt(
  model: string,
  type: 'hook',
  params: HookPromptParams,
): string;
export function buildImagePrompt(
  model: string,
  type: 'character',
  params: CharacterPromptParams,
): string;
export function buildImagePrompt(
  model: string,
  type: 'scene' | 'hook' | 'character',
  params: ScenePromptParams | HookPromptParams | CharacterPromptParams,
): string {
  const category = getModelCategory(model);

  if (type === 'scene') {
    const p = params as ScenePromptParams;
    if (category === 'flux') return buildScenePromptFlux(p);
    if (category === 'imagen') return buildScenePromptImagen(p);
    return buildScenePromptGemini(p);
  }

  if (type === 'hook') {
    const p = params as HookPromptParams;
    if (category === 'flux') return buildHookPromptFlux(p);
    if (category === 'imagen') return buildHookPromptImagen(p);
    return buildHookPromptGemini(p);
  }

  const p = params as CharacterPromptParams;
  if (category === 'flux') return buildCharacterPromptFlux(p);
  if (category === 'imagen') return buildCharacterPromptImagen(p);
  return buildCharacterPromptGemini(p);
}
