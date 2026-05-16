import { useState, useCallback, useRef } from 'react';
import type { LongformScenario, LongformConfig, GenerationProgress, AssetStatus } from '../types/longform';
import type { ImageData } from '../types';
import {
  generateSceneImages,
  generateNarrations,
} from '../services/longformApiClient';

interface UseLongformGenerationReturn {
  progress: GenerationProgress | null;
  isGenerating: boolean;
  startGeneration: (scenario: LongformScenario, config: LongformConfig) => Promise<LongformScenario>;
  cancelGeneration: () => void;
}

function createInitialProgress(sceneCount: number, preCompletedImages: number = 0): GenerationProgress {
  return {
    currentStep: 'scene-images',
    sceneImages: { total: sceneCount, completed: preCompletedImages, failed: 0, inProgress: 0 },
    narrations: { total: sceneCount, completed: 0, failed: 0, inProgress: 0 },
    overallPercent: 0,
  };
}

function calcPercent(p: GenerationProgress): number {
  const imagesW = 60;
  const narrationsW = 40;

  let pct = 0;
  if (p.sceneImages.total > 0) pct += (p.sceneImages.completed / p.sceneImages.total) * imagesW;
  if (p.narrations.total > 0) pct += (p.narrations.completed / p.narrations.total) * narrationsW;

  return Math.min(Math.round(pct), 100);
}

export function useLongformGeneration(): UseLongformGenerationReturn {
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const cancelledRef = useRef(false);

  const updateProgress = useCallback((updater: (prev: GenerationProgress) => GenerationProgress) => {
    setProgress(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      next.overallPercent = calcPercent(next);
      return next;
    });
  }, []);

  const startGeneration = useCallback(async (
    scenario: LongformScenario,
    config: LongformConfig
  ): Promise<LongformScenario> => {
    cancelledRef.current = false;
    setIsGenerating(true);

    // 전체 sub-image 카운트 계산 (롱폼1=씬당1, 롱폼2=씬당3)
    const allSubImages = scenario.scenes.flatMap(scene =>
      (scene.subScenes || [{ imagePrompt: scene.imagePrompt, imageStatus: scene.imageStatus, userUploaded: scene.userUploaded }])
        .map((sub, subIndex) => ({ scene, sub, subIndex }))
    );
    const totalSubImages = allSubImages.length;
    const userUploadedCount = allSubImages.filter(x => x.sub.userUploaded).length;
    setProgress(createInitialProgress(totalSubImages, userUploadedCount));

    let updatedScenario = { ...scenario };

    try {
      // Scene images + narrations in parallel
      updateProgress(p => ({ ...p, currentStep: 'scene-images' }));

      if (cancelledRef.current) throw new Error('Cancelled');

      // 사용자가 업로드하지 않은 sub-image만 백엔드 호출 대상
      const subImagesToGenerate = allSubImages.filter(x => !x.sub.userUploaded);

      // 캐릭터 이미지 풀 (deduplicated) — 페이로드 중복 방지
      // 캐릭터 id → 풀 인덱스 매핑
      const charImageMap = new Map<string, number>();
      const characterImages: ImageData[] = [];
      for (const char of (scenario.characters || [])) {
        if (char.referenceImage && !charImageMap.has(char.id)) {
          charImageMap.set(char.id, characterImages.length);
          characterImages.push(char.referenceImage);
        }
      }

      // Enrich scene image prompts with character descriptions + metadata for consistency
      const sceneInputs = subImagesToGenerate.map(({ scene, sub, subIndex }) => {
        const sceneChars = (scenario.characters || [])
          .filter(c => c.sceneNumbers.includes(scene.sceneNumber));
        let imagePrompt = sub.imagePrompt;
        if (sceneChars.length > 0) {
          const charDesc = sceneChars
            .map(c => `[${c.nameEn}: ${c.appearanceDescription}, wearing ${c.outfit}]`)
            .join(' ');
          imagePrompt = `${charDesc} ${imagePrompt}`;
        }
        // 캐릭터 참조 이미지 인덱스 (최대 2개) — 백엔드에서 풀에서 resolve
        const characterIndices = sceneChars
          .map(c => charImageMap.get(c.id))
          .filter((idx): idx is number => idx !== undefined)
          .slice(0, 2);
        return {
          sceneNumber: scene.sceneNumber,
          subIndex,
          imagePrompt,
          cameraAngle: scene.cameraAngle,
          lightingMood: scene.lightingMood,
          mood: scene.mood,
          ...(characterIndices.length > 0 && { characterIndices }),
        };
      });
      const narrationInputs = scenario.scenes.map(s => ({ sceneNumber: s.sceneNumber, narration: s.narration }));

      // 이미지 생성은 필요한 sub-image가 있을 때만 호출 (캐릭터 풀 함께 전달)
      const imagePromise = sceneInputs.length > 0
        ? generateSceneImages(sceneInputs, config.imageModel, 5, characterImages)
        : Promise.resolve({ results: [] as Awaited<ReturnType<typeof generateSceneImages>>['results'] });

      const [imageResults, narrationResults] = await Promise.all([
        imagePromise,
        generateNarrations(
          narrationInputs,
          config.tts.provider,
          config.tts.model,
          config.tts.voice as string,
          5
        ),
      ]);

      // sub-image 결과를 (sceneNumber, subIndex) 키로 씬에 적용 + legacy 필드 동기화 유지
      const updatedScenes = updatedScenario.scenes.map(scene => {
        const sceneResults = imageResults.results.filter(r => r.sceneNumber === scene.sceneNumber);
        if (sceneResults.length === 0 && (!scene.subScenes || scene.subScenes.length === 0)) {
          return scene;
        }

        // 기존 subScenes 복사 후 결과 적용 (사용자 업로드된 sub-image는 손대지 않음)
        const existingSubs = scene.subScenes || [{
          imagePrompt: scene.imagePrompt,
          generatedImage: scene.generatedImage,
          imageStatus: scene.imageStatus,
          imageError: scene.imageError,
          userUploaded: scene.userUploaded,
        }];
        const newSubs = existingSubs.map((sub, idx) => {
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

        // Legacy 필드는 subScenes[0]과 동기화
        return {
          ...scene,
          subScenes: newSubs,
          generatedImage: newSubs[0]?.generatedImage,
          imageStatus: newSubs[0]?.imageStatus || 'pending',
          imageError: newSubs[0]?.imageError,
          userUploaded: newSubs[0]?.userUploaded,
        };
      });

      // Apply narration results
      for (const r of narrationResults.results) {
        const idx = updatedScenes.findIndex(s => s.sceneNumber === r.sceneNumber);
        if (idx >= 0) {
          updatedScenes[idx] = {
            ...updatedScenes[idx],
            narrationAudio: r.success ? r.audio : undefined,
            narrationStatus: (r.success ? 'completed' : 'failed') as AssetStatus,
          };
        }
      }

      updatedScenario = { ...updatedScenario, scenes: updatedScenes };

      // 사용자 업로드 + AI 생성 성공을 모두 완료로 카운트
      const imgCompleted = imageResults.results.filter(r => r.success).length + userUploadedCount;
      const imgFailed = imageResults.results.filter(r => !r.success).length;
      const narCompleted = narrationResults.results.filter(r => r.success).length;
      const narFailed = narrationResults.results.filter(r => !r.success).length;

      updateProgress(p => ({
        ...p,
        currentStep: 'completed',
        sceneImages: { ...p.sceneImages, completed: imgCompleted, failed: imgFailed, inProgress: 0 },
        narrations: { ...p.narrations, completed: narCompleted, failed: narFailed, inProgress: 0 },
      }));

    } catch (err) {
      if ((err as Error).message !== 'Cancelled') {
        console.error('Generation error:', err);
      }
    } finally {
      setIsGenerating(false);
    }

    return updatedScenario;
  }, [updateProgress]);

  const cancelGeneration = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return { progress, isGenerating, startGeneration, cancelGeneration };
}
