import { useCallback, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import {
  Scenario,
  Scene,
  AdScenarioConfig,
  ImageData,
} from '../types';
import {
  generateAdScenario as apiGenerateAdScenario,
  generateSceneImage as apiGenerateSceneImage,
} from '../services/geminiService';
import { generateNarration, TTSVoice } from '../services/apiClient';

interface GenerateAllOptions {
  includeTTS?: boolean;
  ttsVoice?: TTSVoice;
}

interface UseAdScenarioReturn {
  // 상태
  adScenario: Scenario | null;
  isGenerating: boolean;
  generatingImageSceneId: string | null;
  isGeneratingAllImages: boolean;
  isGeneratingTTS: boolean;
  ttsProgress: { current: number; total: number };
  error: string | null;

  // 시나리오 관리
  setAdScenario: (scenario: Scenario | null) => void;
  generateAdScenario: (config: AdScenarioConfig) => Promise<Scenario>;
  setProductImage: (image: ImageData | undefined) => void;

  // 이미지 생성
  generateSceneImage: (sceneId: string) => Promise<void>;
  generateAllSceneImages: (options?: GenerateAllOptions) => Promise<void>;

  // 이미지 교체
  replaceSceneImage: (sceneId: string, newImage: ImageData) => void;

  // 유틸리티
  clearError: () => void;
}

export function useAdScenario(): UseAdScenarioReturn {
  const {
    adScenario,
    setAdScenario: contextSetAdScenario,
    updateAdScene,
    aspectRatio,
  } = useProject();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingImageSceneId, setGeneratingImageSceneId] = useState<string | null>(null);
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsProgress, setTtsProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // =============================================
  // 광고 시나리오 관리
  // =============================================

  const setAdScenario = useCallback((newScenario: Scenario | null) => {
    contextSetAdScenario(newScenario);
  }, [contextSetAdScenario]);

  const generateAdScenario = useCallback(async (config: AdScenarioConfig): Promise<Scenario> => {
    setIsGenerating(true);
    setError(null);

    try {
      const newScenario = await apiGenerateAdScenario(config);
      contextSetAdScenario(newScenario);
      return newScenario;
    } catch (e) {
      const message = e instanceof Error ? e.message : '광고 시나리오 생성에 실패했습니다.';
      setError(message);
      throw e;
    } finally {
      setIsGenerating(false);
    }
  }, [contextSetAdScenario]);

  const setProductImage = useCallback((image: ImageData | undefined) => {
    if (!adScenario) return;
    contextSetAdScenario({
      ...adScenario,
      productImage: image,
      updatedAt: Date.now(),
    });
  }, [adScenario, contextSetAdScenario]);

  // =============================================
  // 이미지 생성
  // =============================================

  const generateSceneImage = useCallback(async (sceneId: string): Promise<void> => {
    if (!adScenario) throw new Error('광고 시나리오가 없습니다.');

    const scene = adScenario.scenes.find(s => s.id === sceneId);
    if (!scene) throw new Error('씬을 찾을 수 없습니다.');

    setGeneratingImageSceneId(sceneId);
    setError(null);

    try {
      // 광고 시나리오의 상품 이미지를 prop 참조에 자동 추가
      const propImages: ImageData[] = adScenario.productImage
        ? [adScenario.productImage]
        : [];

      const imageData = await apiGenerateSceneImage(
        scene,
        [],         // characterImages - 광고는 캐릭터 없음
        propImages, // 상품 이미지
        null,       // backgroundImage
        aspectRatio,
        adScenario.imageStyle,
        undefined   // namedCharacters
      );
      updateAdScene(sceneId, {
        generatedImage: imageData,
        imageSource: 'ai',
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : '이미지 생성에 실패했습니다.';
      setError(message);
      throw e;
    } finally {
      setGeneratingImageSceneId(null);
    }
  }, [adScenario, aspectRatio, updateAdScene]);

  const generateAllSceneImages = useCallback(async (
    options?: GenerateAllOptions
  ): Promise<void> => {
    if (!adScenario) throw new Error('광고 시나리오가 없습니다.');

    const scenesWithoutImages = adScenario.scenes.filter(s => !s.generatedImage && !s.customImage);
    const hasImagesToGenerate = scenesWithoutImages.length > 0;

    if (!hasImagesToGenerate && !options?.includeTTS) {
      setError('모든 씬에 이미지가 이미 생성되어 있습니다.');
      return;
    }

    setIsGeneratingAllImages(true);
    setError(null);

    let imageGenerationFailed = false;

    // 1. 이미지 생성
    if (hasImagesToGenerate) {
      const propImages: ImageData[] = adScenario.productImage
        ? [adScenario.productImage]
        : [];

      for (const scene of scenesWithoutImages) {
        setGeneratingImageSceneId(scene.id);
        try {
          const imageData = await apiGenerateSceneImage(
            scene,
            [],
            propImages,
            null,
            aspectRatio,
            adScenario.imageStyle,
            undefined
          );
          updateAdScene(scene.id, {
            generatedImage: imageData,
            imageSource: 'ai',
          });
        } catch (e) {
          console.error(`Failed to generate image for ad scene ${scene.sceneNumber}:`, e);
          const errorMessage = e instanceof Error ? e.message : '이미지 생성에 실패했습니다.';
          setError(`씬 ${scene.sceneNumber} 이미지 생성 실패: ${errorMessage}`);
          imageGenerationFailed = true;
          break;
        }
      }
      setGeneratingImageSceneId(null);
    }

    setIsGeneratingAllImages(false);

    if (imageGenerationFailed) return;

    // 2. TTS 생성 (옵션이 활성화된 경우)
    if (options?.includeTTS) {
      const scenesWithNarration = adScenario.scenes.filter(
        s => s.narration?.trim() && !s.narrationAudio
      );

      if (scenesWithNarration.length > 0) {
        setIsGeneratingTTS(true);
        setTtsProgress({ current: 0, total: scenesWithNarration.length });

        for (let i = 0; i < scenesWithNarration.length; i++) {
          const scene = scenesWithNarration[i];
          setTtsProgress({ current: i + 1, total: scenesWithNarration.length });

          try {
            const audio = await generateNarration(
              scene.narration,
              options.ttsVoice || 'Kore',
              scene.id
            );
            updateAdScene(scene.id, { narrationAudio: audio });
          } catch (e) {
            console.error(`TTS failed for ad scene ${scene.sceneNumber}:`, e);
          }
        }

        setIsGeneratingTTS(false);
        setTtsProgress({ current: 0, total: 0 });
      }
    }
  }, [adScenario, aspectRatio, updateAdScene]);

  // =============================================
  // 이미지 교체
  // =============================================

  const replaceSceneImage = useCallback((sceneId: string, newImage: ImageData) => {
    if (!adScenario) return;

    const scene = adScenario.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const currentImage = scene.generatedImage || scene.customImage;
    const newHistory = currentImage
      ? [...(scene.imageHistory || []), currentImage]
      : scene.imageHistory || [];

    updateAdScene(sceneId, {
      customImage: newImage,
      imageSource: 'custom',
      imageHistory: newHistory,
    });
  }, [adScenario, updateAdScene]);

  // =============================================
  // 유틸리티
  // =============================================

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    adScenario,
    isGenerating,
    generatingImageSceneId,
    isGeneratingAllImages,
    isGeneratingTTS,
    ttsProgress,
    error,

    setAdScenario,
    generateAdScenario,
    setProductImage,

    generateSceneImage,
    generateAllSceneImages,

    replaceSceneImage,

    clearError,
  };
}

export default useAdScenario;
