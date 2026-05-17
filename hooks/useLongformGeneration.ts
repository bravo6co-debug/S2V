import { useState, useCallback, useRef } from 'react';
import type { LongformScenario, LongformConfig, GenerationProgress, AssetStatus } from '../types/longform';
import {
  generateSceneImages,
  generateNarrations,
} from '../services/longformApiClient';
import {
  resolveSubScenes,
  buildCharacterImagePool,
  buildSceneImageInputs,
  applySceneImageResults,
} from '../services/longformSceneBuilder';

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

    // 전체 sub-image 평탄화 (롱폼1=씬당1, 롱폼2=씬당3, sub.userUploaded 포함)
    const allSubImages = scenario.scenes.flatMap(scene =>
      resolveSubScenes(scene).map((sub, subIndex) => ({ scene, sub, subIndex }))
    );
    const totalSubImages = allSubImages.length;
    const userUploadedCount = allSubImages.filter(x => x.sub.userUploaded).length;
    setProgress(createInitialProgress(totalSubImages, userUploadedCount));

    let updatedScenario = { ...scenario };

    try {
      updateProgress(p => ({ ...p, currentStep: 'scene-images' }));

      if (cancelledRef.current) throw new Error('Cancelled');

      // 캐릭터 풀 + 씬 입력 빌드 (사용자 업로드 자동 제외)
      const { characterImages, charImageMap } = buildCharacterImagePool(scenario.characters);
      const sceneInputs = buildSceneImageInputs(scenario.scenes, scenario.characters, charImageMap);
      const narrationInputs = scenario.scenes.map(s => ({ sceneNumber: s.sceneNumber, narration: s.narration }));

      // 이미지 생성은 필요한 sub-image가 있을 때만 호출
      const imagePromise = sceneInputs.length > 0
        ? generateSceneImages(sceneInputs, config.imageModel, 5, characterImages, config.imageStyle, config.aspectRatio)
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

      // sub-image 결과를 subScenes에 적용 + legacy 필드 자동 동기화
      let updatedScenes = applySceneImageResults(updatedScenario.scenes, imageResults.results);

      // 나레이션 결과 적용 (씬 단위)
      updatedScenes = updatedScenes.map(scene => {
        const r = narrationResults.results.find(res => res.sceneNumber === scene.sceneNumber);
        if (!r) return scene;
        return {
          ...scene,
          narrationAudio: r.success ? r.audio : undefined,
          narrationStatus: (r.success ? 'completed' : 'failed') as AssetStatus,
        };
      });

      updatedScenario = { ...updatedScenario, scenes: updatedScenes };

      // 사용자 업로드 + AI 생성 성공을 모두 완료로 카운트 (sub-image 단위)
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
