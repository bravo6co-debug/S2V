/**
 * Longform Scene Image Generation — 공통 헬퍼
 *
 * - 캐릭터 이미지 풀 빌드 (dedup)
 * - 씬 → sub-image 평탄화 + 캐릭터 텍스트 prefix + characterIndices 부착
 * - 결과 적용 (subScenes 매핑 + legacy 필드 자동 동기화)
 * - 실패한 sub-image 추출
 *
 * 사용처: useLongformGeneration.startGeneration, LongformTab.handleRegenerateFailedScenes
 * — 두 곳의 복붙 로직을 한 곳으로 통합.
 */

import type { LongformScene, LongformCharacter, SubScene, AssetStatus } from '../types/longform';
import type { ImageData } from '../types';
import type { SceneImageInput, SceneImageResult } from './longformApiClient';

/** scene.subScenes가 없거나 빈 배열이면 legacy 필드로 길이 1짜리 합성 배열 생성 */
export function resolveSubScenes(scene: LongformScene): SubScene[] {
  if (scene.subScenes && scene.subScenes.length > 0) return scene.subScenes;
  return [{
    imagePrompt: scene.imagePrompt,
    generatedImage: scene.generatedImage,
    imageStatus: scene.imageStatus,
    imageError: scene.imageError,
    userUploaded: scene.userUploaded,
  }];
}

/** 캐릭터 referenceImage를 deduplicated 풀로 만들고 id → 인덱스 매핑 반환 */
export function buildCharacterImagePool(characters: LongformCharacter[] | undefined): {
  characterImages: ImageData[];
  charImageMap: Map<string, number>;
} {
  const charImageMap = new Map<string, number>();
  const characterImages: ImageData[] = [];
  for (const char of (characters || [])) {
    if (char.referenceImage && !charImageMap.has(char.id)) {
      charImageMap.set(char.id, characterImages.length);
      characterImages.push(char.referenceImage);
    }
  }
  return { characterImages, charImageMap };
}

export interface BuildSceneInputsOptions {
  /** 특정 (scene, subIndex) 페어만 포함. undefined면 사용자 업로드 제외한 전체 */
  filter?: (scene: LongformScene, sub: SubScene, subIndex: number) => boolean;
  /** 사용자 업로드 sub는 자동 제외 (default true) */
  excludeUserUploaded?: boolean;
  /** 씬당 캐릭터 참조 이미지 최대 개수 (default 2) */
  maxCharacterRefs?: number;
}

/**
 * 씬을 sub-image 단위로 평탄화 + 캐릭터 텍스트 prefix + characterIndices 부착하여
 * generateSceneImages 호출용 SceneImageInput[] 생성.
 */
export function buildSceneImageInputs(
  scenes: LongformScene[],
  characters: LongformCharacter[] | undefined,
  charImageMap: Map<string, number>,
  options: BuildSceneInputsOptions = {},
): SceneImageInput[] {
  const { filter, excludeUserUploaded = true, maxCharacterRefs = 2 } = options;
  const inputs: SceneImageInput[] = [];

  for (const scene of scenes) {
    const subs = resolveSubScenes(scene);
    const sceneChars = (characters || []).filter(c => c.sceneNumbers.includes(scene.sceneNumber));

    for (let subIndex = 0; subIndex < subs.length; subIndex++) {
      const sub = subs[subIndex];
      if (excludeUserUploaded && sub.userUploaded) continue;
      if (filter && !filter(scene, sub, subIndex)) continue;

      let imagePrompt = sub.imagePrompt;
      if (sceneChars.length > 0) {
        const charDesc = sceneChars
          .map(c => `[${c.nameEn}: ${c.appearanceDescription}, wearing ${c.outfit}]`)
          .join(' ');
        imagePrompt = `${charDesc} ${imagePrompt}`;
      }

      const characterIndices = sceneChars
        .map(c => charImageMap.get(c.id))
        .filter((idx): idx is number => idx !== undefined)
        .slice(0, maxCharacterRefs);

      inputs.push({
        sceneNumber: scene.sceneNumber,
        subIndex,
        imagePrompt,
        cameraAngle: scene.cameraAngle,
        lightingMood: scene.lightingMood,
        mood: scene.mood,
        ...(characterIndices.length > 0 && { characterIndices }),
      });
    }
  }

  return inputs;
}

/**
 * generateSceneImages 결과를 scenes 배열에 적용.
 * - (sceneNumber, subIndex)로 매핑하여 subScenes[i]에 결과 반영
 * - 사용자 업로드 sub-image는 건드리지 않음
 * - legacy 필드(imageStatus, generatedImage, imageError, userUploaded)는 subScenes[0]과 자동 동기화
 */
export function applySceneImageResults(
  scenes: LongformScene[],
  results: SceneImageResult[],
): LongformScene[] {
  return scenes.map(scene => {
    const sceneResults = results.filter(r => r.sceneNumber === scene.sceneNumber);
    if (sceneResults.length === 0 && (!scene.subScenes || scene.subScenes.length === 0)) {
      return scene;
    }

    const existingSubs = resolveSubScenes(scene);
    const newSubs: SubScene[] = existingSubs.map((sub, idx) => {
      if (sub.userUploaded) return sub;
      const r = sceneResults.find(res => res.subIndex === idx);
      if (!r) return sub;
      return {
        ...sub,
        generatedImage: r.success ? r.image : undefined,
        imageStatus: (r.success ? 'completed' : 'failed') as AssetStatus,
        imageError: r.success ? undefined : r.error,
      };
    });

    return {
      ...scene,
      subScenes: newSubs,
      generatedImage: newSubs[0]?.generatedImage,
      imageStatus: newSubs[0]?.imageStatus || 'pending',
      imageError: newSubs[0]?.imageError,
      userUploaded: newSubs[0]?.userUploaded,
    };
  });
}

/** 실패한 sub-image의 (sceneNumber, subIndex) 쌍 추출 — 롱폼1/2 모두 정확히 감지 */
export function getFailedSubImages(scenes: LongformScene[]): Array<{ sceneNumber: number; subIndex: number }> {
  const failed: Array<{ sceneNumber: number; subIndex: number }> = [];
  for (const scene of scenes) {
    const subs = resolveSubScenes(scene);
    for (let i = 0; i < subs.length; i++) {
      if (subs[i].imageStatus === 'failed') {
        failed.push({ sceneNumber: scene.sceneNumber, subIndex: i });
      }
    }
  }
  return failed;
}
