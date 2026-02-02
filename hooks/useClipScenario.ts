import { useCallback, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import {
  Scenario,
  Scene,
  ClipScenarioConfig,
  ImageData,
} from '../types';
import {
  generateSceneImage as apiGenerateSceneImage,
} from '../services/geminiService';
import {
  generateClipScenario as apiGenerateClipScenario,
  generateNarration,
  TTSVoice,
} from '../services/apiClient';

interface GenerateAllOptions {
  includeTTS?: boolean;
  ttsVoice?: TTSVoice;
}

interface UseClipScenarioReturn {
  // 상태
  clipScenario: Scenario | null;
  isGenerating: boolean;
  generatingImageSceneId: string | null;
  isGeneratingAllImages: boolean;
  isGeneratingTTS: boolean;
  ttsProgress: { current: number; total: number };
  error: string | null;

  // 시나리오 관리
  setClipScenario: (scenario: Scenario | null) => void;
  generateClipScenario: (config: ClipScenarioConfig) => Promise<Scenario>;

  // 씬 편집
  updateClipScene: (sceneId: string, updates: Partial<Scene>) => void;

  // 이미지 생성
  generateSceneImage: (sceneId: string) => Promise<void>;
  generateAllSceneImages: (options?: GenerateAllOptions) => Promise<void>;

  // 이미지 교체
  replaceSceneImage: (sceneId: string, newImage: ImageData) => void;

  // 저장/불러오기
  saveClipScenarioToFile: () => void;
  loadClipScenarioFromFile: (file: File) => Promise<void>;

  // 유틸리티
  clearError: () => void;
}

export function useClipScenario(): UseClipScenarioReturn {
  const {
    clipScenario,
    setClipScenario: contextSetClipScenario,
    updateClipScene,
    aspectRatio,
  } = useProject();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingImageSceneId, setGeneratingImageSceneId] = useState<string | null>(null);
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsProgress, setTtsProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // =============================================
  // 클립 시나리오 관리
  // =============================================

  const setClipScenario = useCallback((newScenario: Scenario | null) => {
    contextSetClipScenario(newScenario);
  }, [contextSetClipScenario]);

  const generateClipScenario = useCallback(async (config: ClipScenarioConfig): Promise<Scenario> => {
    setIsGenerating(true);
    setError(null);

    try {
      const newScenario = await apiGenerateClipScenario(config);
      contextSetClipScenario(newScenario);
      return newScenario;
    } catch (e) {
      const message = e instanceof Error ? e.message : '클립 시나리오 생성에 실패했습니다.';
      setError(message);
      throw e;
    } finally {
      setIsGenerating(false);
    }
  }, [contextSetClipScenario]);

  // =============================================
  // 이미지 생성
  // =============================================

  const generateSceneImage = useCallback(async (sceneId: string): Promise<void> => {
    if (!clipScenario) throw new Error('클립 시나리오가 없습니다.');

    const scene = clipScenario.scenes.find(s => s.id === sceneId);
    if (!scene) throw new Error('씬을 찾을 수 없습니다.');

    setGeneratingImageSceneId(sceneId);
    setError(null);

    try {
      const imageData = await apiGenerateSceneImage(
        scene,
        [],    // characterImages
        [],    // propImages
        null,  // backgroundImage
        aspectRatio,
        clipScenario.imageStyle,
        undefined // namedCharacters
      );
      updateClipScene(sceneId, {
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
  }, [clipScenario, aspectRatio, updateClipScene]);

  const generateAllSceneImages = useCallback(async (
    options?: GenerateAllOptions
  ): Promise<void> => {
    if (!clipScenario) throw new Error('클립 시나리오가 없습니다.');

    const scenesWithoutImages = clipScenario.scenes.filter(s => !s.generatedImage && !s.customImage);
    const hasImagesToGenerate = scenesWithoutImages.length > 0;

    if (!hasImagesToGenerate && !options?.includeTTS) {
      setError('모든 씬에 이미지가 이미 생성되어 있습니다.');
      return;
    }

    setIsGeneratingAllImages(true);
    setError(null);

    let imageGenerationFailed = false;

    // 1. 이미지 생성 (Gemini)
    if (hasImagesToGenerate) {
      for (const scene of scenesWithoutImages) {
        setGeneratingImageSceneId(scene.id);
        try {
          const imageData = await apiGenerateSceneImage(
            scene,
            [],
            [],
            null,
            aspectRatio,
            clipScenario.imageStyle,
            undefined
          );
          updateClipScene(scene.id, {
            generatedImage: imageData,
            imageSource: 'ai',
          });
        } catch (e) {
          console.error(`Failed to generate image for clip scene ${scene.sceneNumber}:`, e);
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

    // 2. TTS 생성 (옵션)
    if (options?.includeTTS) {
      const scenesWithNarration = clipScenario.scenes.filter(
        s => s.narration?.trim() && !s.narrationAudio
      );

      if (scenesWithNarration.length > 0) {
        setIsGeneratingTTS(true);
        setTtsProgress({ current: 0, total: scenesWithNarration.length });
        const failedScenes: number[] = [];

        for (let i = 0; i < scenesWithNarration.length; i++) {
          const scene = scenesWithNarration[i];
          setTtsProgress({ current: i + 1, total: scenesWithNarration.length });

          // API 속도 제한 방지
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          let success = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const audio = await generateNarration(
                scene.narration,
                options.ttsVoice || 'Kore',
                scene.id
              );
              updateClipScene(scene.id, { narrationAudio: audio });
              success = true;
              break;
            } catch (e) {
              console.error(`TTS attempt ${attempt + 1}/3 failed for clip scene ${scene.sceneNumber}:`, e);
              if (attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
              }
            }
          }

          if (!success) {
            failedScenes.push(scene.sceneNumber);
          }
        }

        setIsGeneratingTTS(false);
        setTtsProgress({ current: 0, total: 0 });

        if (failedScenes.length > 0) {
          console.warn(`TTS 생성 실패 씬: ${failedScenes.join(', ')}`);
        }
      }
    }
  }, [clipScenario, aspectRatio, updateClipScene]);

  // =============================================
  // 이미지 교체
  // =============================================

  const replaceSceneImage = useCallback((sceneId: string, newImage: ImageData) => {
    if (!clipScenario) return;

    const scene = clipScenario.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const currentImage = scene.generatedImage || scene.customImage;
    const newHistory = currentImage
      ? [...(scene.imageHistory || []), currentImage]
      : scene.imageHistory || [];

    updateClipScene(sceneId, {
      customImage: newImage,
      imageSource: 'custom',
      imageHistory: newHistory,
    });
  }, [clipScenario, updateClipScene]);

  // =============================================
  // 저장/불러오기
  // =============================================

  const saveClipScenarioToFile = useCallback(() => {
    if (!clipScenario) return;

    const dataStr = JSON.stringify(clipScenario, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clip_scenario_${clipScenario.title.replace(/\s+/g, '_')}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [clipScenario]);

  const loadClipScenarioFromFile = useCallback(async (file: File): Promise<void> => {
    try {
      const text = await file.text();
      const loaded = JSON.parse(text) as Scenario;

      if (!loaded.id || !loaded.title || !loaded.scenes || !Array.isArray(loaded.scenes)) {
        throw new Error('Invalid scenario file format');
      }

      contextSetClipScenario(loaded);
    } catch (e) {
      const message = '클립 시나리오 파일을 불러오는데 실패했습니다.';
      setError(message);
      throw new Error(message);
    }
  }, [contextSetClipScenario]);

  // =============================================
  // 유틸리티
  // =============================================

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    clipScenario,
    isGenerating,
    generatingImageSceneId,
    isGeneratingAllImages,
    isGeneratingTTS,
    ttsProgress,
    error,

    setClipScenario,
    generateClipScenario,

    updateClipScene,

    generateSceneImage,
    generateAllSceneImages,

    replaceSceneImage,

    saveClipScenarioToFile,
    loadClipScenarioFromFile,

    clearError,
  };
}

export default useClipScenario;
