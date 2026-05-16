import { useState, useCallback, useRef } from 'react';
import type { LongformScenario, LongformConfig, GenerationProgress, AssetStatus } from '../types/longform';
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
    const sceneCount = scenario.scenes.length;
    // 사용자가 직접 업로드한 씬은 이미지 생성 대상에서 제외 — 시작 시점부터 completed로 카운트
    const userUploadedCount = scenario.scenes.filter(s => s.userUploaded).length;
    setProgress(createInitialProgress(sceneCount, userUploadedCount));

    let updatedScenario = { ...scenario };

    try {
      // Scene images + narrations in parallel
      updateProgress(p => ({ ...p, currentStep: 'scene-images' }));

      if (cancelledRef.current) throw new Error('Cancelled');

      // 사용자가 업로드한 이미지가 있는 씬은 백엔드 호출에서 제외
      const scenesNeedingImage = scenario.scenes.filter(s => !s.userUploaded);

      // Enrich scene image prompts with character descriptions + metadata for consistency
      const sceneInputs = scenesNeedingImage.map(scene => {
        const sceneChars = (scenario.characters || [])
          .filter(c => c.sceneNumbers.includes(scene.sceneNumber));
        let imagePrompt = scene.imagePrompt;
        if (sceneChars.length > 0) {
          const charDesc = sceneChars
            .map(c => `[${c.nameEn}: ${c.appearanceDescription}, wearing ${c.outfit}]`)
            .join(' ');
          imagePrompt = `${charDesc} ${imagePrompt}`;
        }
        return {
          sceneNumber: scene.sceneNumber,
          imagePrompt,
          cameraAngle: scene.cameraAngle,
          lightingMood: scene.lightingMood,
          mood: scene.mood,
        };
      });
      const narrationInputs = scenario.scenes.map(s => ({ sceneNumber: s.sceneNumber, narration: s.narration }));

      // 이미지 생성은 필요한 씬이 있을 때만 호출 (모두 사용자 업로드면 스킵)
      const imagePromise = sceneInputs.length > 0
        ? generateSceneImages(sceneInputs, config.imageModel, 5)
        : Promise.resolve({ results: [] as { sceneNumber: number; success: boolean; image?: any; error?: string }[] });

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

      // Apply image results (실패 원인도 저장) — 사용자 업로드 씬은 결과에 없으므로 그대로 유지
      const updatedScenes = [...updatedScenario.scenes];
      for (const r of imageResults.results) {
        const idx = updatedScenes.findIndex(s => s.sceneNumber === r.sceneNumber);
        if (idx >= 0) {
          updatedScenes[idx] = {
            ...updatedScenes[idx],
            generatedImage: r.success ? r.image : undefined,
            imageStatus: (r.success ? 'completed' : 'failed') as AssetStatus,
            imageError: r.success ? undefined : r.error,
          };
        }
      }

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
