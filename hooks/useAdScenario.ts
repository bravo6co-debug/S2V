import { useCallback, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import {
  Scenario,
  Scene,
  AdScenarioConfig,
  AdScenarioConfigV2,
  AdEngine,
  ImageData,
} from '../types';
import {
  generateAdScenario as apiGenerateAdScenario,
  generateSceneImage as apiGenerateSceneImage,
} from '../services/geminiService';
import {
  generateAdScenarioV2 as apiGenerateAdScenarioV2,
  generateAdSceneImage as apiGenerateAdSceneImage,
  getStrengthForBeat,
  generateNarration,
  TTSVoice,
  saveProjectToCloud,
  getMyProjects,
  loadProjectFromCloud,
  deleteProjectFromCloud,
  CloudProjectListItem,
} from '../services/apiClient';

interface GenerateAllOptions {
  includeTTS?: boolean;
  ttsVoice?: TTSVoice;
  engine?: AdEngine;
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
  generateAdScenarioV2: (config: AdScenarioConfigV2) => Promise<Scenario>;
  setProductImage: (image: ImageData | undefined) => void;

  // 이미지 생성
  generateSceneImage: (sceneId: string) => Promise<void>;
  generateAllSceneImages: (options?: GenerateAllOptions) => Promise<void>;

  // 이미지 교체
  replaceSceneImage: (sceneId: string, newImage: ImageData) => void;

  // 저장/불러오기 (파일)
  saveAdScenarioToFile: () => void;
  loadAdScenarioFromFile: (file: File) => Promise<void>;

  // 클라우드 저장/불러오기
  cloudProjectId: string | null;
  isSavingToCloud: boolean;
  isLoadingFromCloud: boolean;
  cloudProjects: CloudProjectListItem[];
  isLoadingProjects: boolean;
  saveToCloud: () => Promise<string | null>;
  loadFromCloud: (projectId: string) => Promise<void>;
  deleteFromCloud: (projectId: string) => Promise<void>;
  fetchProjects: () => Promise<void>;

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

  // 클라우드 저장 상태
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);
  const [cloudProjects, setCloudProjects] = useState<CloudProjectListItem[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

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

  const generateAdScenarioV2 = useCallback(async (config: AdScenarioConfigV2): Promise<Scenario> => {
    setIsGenerating(true);
    setError(null);

    try {
      const newScenario = await apiGenerateAdScenarioV2(config);
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
    const engine = options?.engine || 'gemini';

    // 1. 이미지 생성
    if (hasImagesToGenerate) {
      if (engine === 'flux') {
        // =============================================
        // FLUX 엔진: 3단계 파이프라인 (앵커 → 변형)
        // =============================================
        try {
          const refImages: ImageData[] = [];
          if (adScenario.productImage) refImages.push(adScenario.productImage);

          // 앵커 씬 선택: Discovery > Story > 첫 번째
          const anchorScene = scenesWithoutImages.find(s => s.storyBeat === 'Discovery')
            || scenesWithoutImages.find(s => s.storyBeat === 'Story')
            || scenesWithoutImages[0];
          const remainingScenes = scenesWithoutImages.filter(s => s.id !== anchorScene.id);

          // 1단계: 앵커 이미지 생성
          setGeneratingImageSceneId(anchorScene.id);
          console.log(`[FLUX Pipeline] Generating anchor: scene ${anchorScene.sceneNumber} (${anchorScene.storyBeat})`);

          let anchorImage: ImageData;

          if (refImages.length > 0) {
            // 참조 이미지가 있으면 flux-2-turbo-edit 사용
            anchorImage = await apiGenerateAdSceneImage({
              imagePrompt: anchorScene.imagePrompt,
              mood: anchorScene.mood,
              cameraAngle: anchorScene.cameraAngle,
              pipelineStep: 'anchor',
              referenceImages: refImages,
              aspectRatio,
              imageStyle: adScenario.imageStyle,
            });
          } else {
            // 참조 이미지 없으면 기존 방식으로 폴백
            anchorImage = await apiGenerateSceneImage(
              anchorScene, [], [], null, aspectRatio, adScenario.imageStyle, undefined
            );
          }

          updateAdScene(anchorScene.id, {
            generatedImage: anchorImage,
            imageSource: 'ai',
          });

          // 2단계: 나머지 씬 변형 생성 (앵커 기반)
          for (const scene of remainingScenes) {
            setGeneratingImageSceneId(scene.id);
            const strength = getStrengthForBeat(scene.storyBeat);
            console.log(`[FLUX Pipeline] Generating variation: scene ${scene.sceneNumber} (${scene.storyBeat}, strength: ${strength})`);

            try {
              const imageData = await apiGenerateAdSceneImage({
                imagePrompt: scene.imagePrompt,
                mood: scene.mood,
                cameraAngle: scene.cameraAngle,
                pipelineStep: 'variation',
                anchorImage,
                strength,
                aspectRatio,
                imageStyle: adScenario.imageStyle,
              });
              updateAdScene(scene.id, {
                generatedImage: imageData,
                imageSource: 'ai',
              });
            } catch (e) {
              console.error(`Failed to generate variation for scene ${scene.sceneNumber}:`, e);
              const errorMessage = e instanceof Error ? e.message : '이미지 생성에 실패했습니다.';
              setError(`씬 ${scene.sceneNumber} 이미지 생성 실패: ${errorMessage}`);
              imageGenerationFailed = true;
              break;
            }
          }
        } catch (e) {
          console.error('FLUX pipeline anchor generation failed:', e);
          const errorMessage = e instanceof Error ? e.message : '앵커 이미지 생성에 실패했습니다.';
          setError(`FLUX 파이프라인 실패: ${errorMessage}`);
          imageGenerationFailed = true;
        }
        setGeneratingImageSceneId(null);
      } else {
        // =============================================
        // Gemini 엔진: 기존 방식 (변경 없음)
        // =============================================
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
        const failedScenes: number[] = [];

        for (let i = 0; i < scenesWithNarration.length; i++) {
          const scene = scenesWithNarration[i];
          setTtsProgress({ current: i + 1, total: scenesWithNarration.length });

          // API 속도 제한 방지: 첫 번째 이후 1초 딜레이
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
              updateAdScene(scene.id, { narrationAudio: audio });
              success = true;
              break;
            } catch (e) {
              console.error(`TTS attempt ${attempt + 1}/3 failed for ad scene ${scene.sceneNumber}:`, e);
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
  // 저장/불러오기
  // =============================================

  const saveAdScenarioToFile = useCallback(() => {
    if (!adScenario) return;

    const dataStr = JSON.stringify(adScenario, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ad_scenario_${adScenario.title.replace(/\s+/g, '_')}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [adScenario]);

  const loadAdScenarioFromFile = useCallback(async (file: File): Promise<void> => {
    try {
      const text = await file.text();
      const loaded = JSON.parse(text) as Scenario;

      // 기본 구조 검증
      if (!loaded.id || !loaded.title || !loaded.scenes || !Array.isArray(loaded.scenes)) {
        throw new Error('Invalid scenario file format');
      }

      contextSetAdScenario(loaded);
    } catch (e) {
      const message = '광고 시나리오 파일을 불러오는데 실패했습니다.';
      setError(message);
      throw new Error(message);
    }
  }, [contextSetAdScenario]);

  // =============================================
  // 클라우드 저장/불러오기
  // =============================================

  const saveToCloud = useCallback(async (): Promise<string | null> => {
    if (!adScenario) return null;

    setIsSavingToCloud(true);
    setError(null);

    try {
      const projectId = await saveProjectToCloud(adScenario, cloudProjectId || undefined);
      setCloudProjectId(projectId);
      return projectId;
    } catch (e) {
      const message = e instanceof Error ? e.message : '클라우드 저장에 실패했습니다.';
      setError(message);
      return null;
    } finally {
      setIsSavingToCloud(false);
    }
  }, [adScenario, cloudProjectId]);

  const loadFromCloud = useCallback(async (projectId: string): Promise<void> => {
    setIsLoadingFromCloud(true);
    setError(null);

    try {
      const scenario = await loadProjectFromCloud(projectId);
      contextSetAdScenario(scenario);
      setCloudProjectId(projectId);
    } catch (e) {
      const message = e instanceof Error ? e.message : '프로젝트를 불러오는데 실패했습니다.';
      setError(message);
    } finally {
      setIsLoadingFromCloud(false);
    }
  }, [contextSetAdScenario]);

  const deleteFromCloud = useCallback(async (projectId: string): Promise<void> => {
    setError(null);

    try {
      await deleteProjectFromCloud(projectId);
      setCloudProjects(prev => prev.filter(p => p._id !== projectId));
      if (cloudProjectId === projectId) {
        setCloudProjectId(null);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '프로젝트 삭제에 실패했습니다.';
      setError(message);
    }
  }, [cloudProjectId]);

  const fetchProjects = useCallback(async (): Promise<void> => {
    setIsLoadingProjects(true);

    try {
      const projects = await getMyProjects();
      setCloudProjects(projects);
    } catch (e) {
      console.error('Failed to fetch projects:', e);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

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
    generateAdScenarioV2,
    setProductImage,

    generateSceneImage,
    generateAllSceneImages,

    replaceSceneImage,

    saveAdScenarioToFile,
    loadAdScenarioFromFile,

    cloudProjectId,
    isSavingToCloud,
    isLoadingFromCloud,
    cloudProjects,
    isLoadingProjects,
    saveToCloud,
    loadFromCloud,
    deleteFromCloud,
    fetchProjects,

    updateAdScene,
    clearError,
  };
}

export default useAdScenario;
