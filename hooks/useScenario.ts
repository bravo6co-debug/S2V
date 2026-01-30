import { useCallback, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import {
  Scenario,
  Scene,
  ScenarioConfig,
  ImageData,
  SceneAssetPlacement,
  CharacterAsset,
  SuggestedCharacter,
} from '../types';
import {
  generateScenario as apiGenerateScenario,
  regenerateScene as apiRegenerateScene,
  generateSceneImage as apiGenerateSceneImage,
} from '../services/geminiService';
import { generateNarration, TTSVoice, NamedCharacterImage } from '../services/apiClient';

interface GenerateAllOptions {
  includeTTS?: boolean;
  ttsVoice?: TTSVoice;
}

interface UseScenarioReturn {
  // 상태
  scenario: Scenario | null;
  isGenerating: boolean;
  regeneratingSceneId: string | null;
  generatingImageSceneId: string | null;
  isGeneratingAllImages: boolean;
  isGeneratingTTS: boolean;
  ttsProgress: { current: number; total: number };
  error: string | null;

  // 시나리오 관리
  setScenario: (scenario: Scenario | null) => void;
  generateScenario: (config: ScenarioConfig) => Promise<Scenario>;
  updateSuggestedCharacter: (characterName: string, updates: Partial<SuggestedCharacter>) => void;

  // 씬 관리
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  addScene: (scene: Scene, afterSceneId?: string) => void;
  removeScene: (sceneId: string) => void;
  duplicateScene: (sceneId: string) => void;
  reorderScenes: (sceneIds: string[]) => void;

  // 씬 재생성
  regenerateScene: (sceneId: string, instruction?: string) => Promise<Scene>;

  // 이미지 생성 (캐릭터 일관성 향상을 위해 allCharacters 추가)
  generateSceneImage: (
    sceneId: string,
    characterImages: ImageData[],
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    allCharacters?: CharacterAsset[]  // 전체 캐릭터 목록 (씬별 필터링용)
  ) => Promise<void>;
  generateAllSceneImages: (
    characterImages: ImageData[],
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    options?: GenerateAllOptions,
    allCharacters?: CharacterAsset[]  // 전체 캐릭터 목록 (씬별 필터링용)
  ) => Promise<void>;

  // 이미지 교체
  replaceSceneImage: (sceneId: string, newImage: ImageData) => void;
  downloadSceneImage: (sceneId: string, filename?: string) => void;

  // 에셋 관리
  setSceneAssets: (sceneId: string, assets: SceneAssetPlacement[]) => void;
  addAssetToScene: (sceneId: string, asset: SceneAssetPlacement) => void;
  removeAssetFromScene: (sceneId: string, assetId: string) => void;

  // 저장/불러오기
  saveScenarioToFile: () => void;
  loadScenarioFromFile: (file: File) => Promise<void>;

  // 유틸리티
  getSceneById: (sceneId: string) => Scene | undefined;
  clearError: () => void;
}

export function useScenario(): UseScenarioReturn {
  const {
    scenario,
    setScenario: contextSetScenario,
    updateScene: contextUpdateScene,
    addScene: contextAddScene,
    removeScene: contextRemoveScene,
    reorderScenes: contextReorderScenes,
    aspectRatio,
  } = useProject();

  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);
  const [generatingImageSceneId, setGeneratingImageSceneId] = useState<string | null>(null);
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsProgress, setTtsProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // =============================================
  // 시나리오 관리
  // =============================================

  const setScenario = useCallback((newScenario: Scenario | null) => {
    contextSetScenario(newScenario);
  }, [contextSetScenario]);

  const generateScenario = useCallback(async (config: ScenarioConfig): Promise<Scenario> => {
    setIsGenerating(true);
    setError(null);

    try {
      const newScenario = await apiGenerateScenario(config);
      contextSetScenario(newScenario);
      return newScenario;
    } catch (e) {
      const message = e instanceof Error ? e.message : '시나리오 생성에 실패했습니다.';
      setError(message);
      throw e;
    } finally {
      setIsGenerating(false);
    }
  }, [contextSetScenario]);

  // 제안된 캐릭터 수정 (이름, 설명 등)
  const updateSuggestedCharacter = useCallback((
    characterName: string,
    updates: Partial<SuggestedCharacter>
  ) => {
    if (!scenario) return;

    const updatedCharacters = scenario.suggestedCharacters.map(char => {
      if (char.name === characterName) {
        return { ...char, ...updates };
      }
      return char;
    });

    // 씬의 characters 배열에서도 이름 변경 반영
    let updatedScenes = scenario.scenes;
    if (updates.name && updates.name !== characterName) {
      updatedScenes = scenario.scenes.map(scene => {
        if (scene.characters && scene.characters.includes(characterName)) {
          return {
            ...scene,
            characters: scene.characters.map(name =>
              name === characterName ? updates.name! : name
            ),
          };
        }
        return scene;
      });
    }

    contextSetScenario({
      ...scenario,
      suggestedCharacters: updatedCharacters,
      scenes: updatedScenes,
      updatedAt: Date.now(),
    });
  }, [scenario, contextSetScenario]);

  // =============================================
  // 씬 관리
  // =============================================

  const updateScene = useCallback((sceneId: string, updates: Partial<Scene>) => {
    contextUpdateScene(sceneId, updates);
  }, [contextUpdateScene]);

  const addScene = useCallback((scene: Scene, afterSceneId?: string) => {
    contextAddScene(scene, afterSceneId);
  }, [contextAddScene]);

  const removeScene = useCallback((sceneId: string) => {
    if (scenario && scenario.scenes.length <= 1) {
      setError('최소 1개의 씬이 필요합니다.');
      return;
    }
    contextRemoveScene(sceneId);
  }, [contextRemoveScene, scenario]);

  const duplicateScene = useCallback((sceneId: string) => {
    if (!scenario) return;

    const originalScene = scenario.scenes.find(s => s.id === sceneId);
    if (!originalScene) return;

    const duplicatedScene: Scene = {
      ...originalScene,
      id: crypto.randomUUID(),
      generatedImage: undefined,
      customImage: undefined,
      imageSource: undefined,
      imageHistory: undefined,
    };

    contextAddScene(duplicatedScene, sceneId);
  }, [scenario, contextAddScene]);

  const reorderScenes = useCallback((sceneIds: string[]) => {
    contextReorderScenes(sceneIds);
  }, [contextReorderScenes]);

  // =============================================
  // 씬 재생성
  // =============================================

  const regenerateScene = useCallback(async (
    sceneId: string,
    instruction?: string
  ): Promise<Scene> => {
    if (!scenario) throw new Error('시나리오가 없습니다.');

    setRegeneratingSceneId(sceneId);
    setError(null);

    try {
      const newScene = await apiRegenerateScene(scenario, sceneId, instruction);
      contextUpdateScene(sceneId, newScene);
      return newScene;
    } catch (e) {
      const message = e instanceof Error ? e.message : '씬 재생성에 실패했습니다.';
      setError(message);
      throw e;
    } finally {
      setRegeneratingSceneId(null);
    }
  }, [scenario, contextUpdateScene]);

  // =============================================
  // 이미지 생성
  // =============================================

  // 씬에 등장하는 캐릭터만 필터링하여 namedCharacters 형태로 반환
  const filterCharactersForScene = useCallback((
    scene: Scene,
    allCharacters: CharacterAsset[]
  ): NamedCharacterImage[] => {
    if (!scene.characters || scene.characters.length === 0) {
      // 씬에 캐릭터 정보가 없으면 모든 캐릭터 전달 (하위 호환성)
      return allCharacters.map(c => ({ name: c.name, image: c.image }));
    }

    // 씬에 등장하는 캐릭터만 필터링
    const filteredCharacters: NamedCharacterImage[] = [];
    for (const charName of scene.characters) {
      // 이름으로 캐릭터 찾기 (대소문자 무시)
      const character = allCharacters.find(
        c => c.name.toLowerCase().trim() === charName.toLowerCase().trim()
      );
      if (character) {
        filteredCharacters.push({ name: character.name, image: character.image });
      }
    }

    // 매칭된 캐릭터가 없으면 모든 캐릭터 전달
    if (filteredCharacters.length === 0) {
      return allCharacters.map(c => ({ name: c.name, image: c.image }));
    }

    return filteredCharacters;
  }, []);

  const generateSceneImage = useCallback(async (
    sceneId: string,
    characterImages: ImageData[],
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    allCharacters?: CharacterAsset[]  // 전체 캐릭터 목록 (씬별 필터링용)
  ): Promise<void> => {
    if (!scenario) throw new Error('시나리오가 없습니다.');

    const scene = scenario.scenes.find(s => s.id === sceneId);
    if (!scene) throw new Error('씬을 찾을 수 없습니다.');

    setGeneratingImageSceneId(sceneId);
    setError(null);

    try {
      // 씬에 등장하는 캐릭터만 필터링 (캐릭터 일관성 향상)
      const namedCharacters = allCharacters && allCharacters.length > 0
        ? filterCharactersForScene(scene, allCharacters)
        : undefined;

      // 시나리오의 imageStyle을 전달
      const imageData = await apiGenerateSceneImage(
        scene,
        characterImages,
        propImages,
        backgroundImage,
        aspectRatio,
        scenario.imageStyle,
        namedCharacters  // 이름이 포함된 캐릭터 전달
      );
      contextUpdateScene(sceneId, {
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
  }, [scenario, aspectRatio, contextUpdateScene, filterCharactersForScene]);

  const generateAllSceneImages = useCallback(async (
    characterImages: ImageData[],
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    options?: GenerateAllOptions,
    allCharacters?: CharacterAsset[]  // 전체 캐릭터 목록 (씬별 필터링용)
  ): Promise<void> => {
    if (!scenario) throw new Error('시나리오가 없습니다.');

    const scenesWithoutImages = scenario.scenes.filter(s => !s.generatedImage);
    const hasImagesToGenerate = scenesWithoutImages.length > 0;

    // TTS만 생성하는 경우도 허용
    if (!hasImagesToGenerate && !options?.includeTTS) {
      setError('모든 씬에 이미지가 이미 생성되어 있습니다.');
      return;
    }

    setIsGeneratingAllImages(true);
    setError(null);

    let imageGenerationFailed = false;

    // 1. 이미지 생성
    if (hasImagesToGenerate) {
      for (const scene of scenesWithoutImages) {
        setGeneratingImageSceneId(scene.id);
        try {
          // 씬에 등장하는 캐릭터만 필터링 (캐릭터 일관성 향상)
          const namedCharacters = allCharacters && allCharacters.length > 0
            ? filterCharactersForScene(scene, allCharacters)
            : undefined;

          const imageData = await apiGenerateSceneImage(
            scene,
            characterImages,
            propImages,
            backgroundImage,
            aspectRatio,
            scenario.imageStyle,
            namedCharacters  // 이름이 포함된 캐릭터 전달
          );
          contextUpdateScene(scene.id, {
            generatedImage: imageData,
            imageSource: 'ai',
          });
        } catch (e) {
          console.error(`Failed to generate image for scene ${scene.sceneNumber}:`, e);
          const errorMessage = e instanceof Error ? e.message : '이미지 생성에 실패했습니다.';
          setError(`씬 ${scene.sceneNumber} 이미지 생성 실패: ${errorMessage}`);
          imageGenerationFailed = true;
          break;  // 에러 발생 시 즉시 중단
        }
      }
      setGeneratingImageSceneId(null);
    }

    setIsGeneratingAllImages(false);

    // 이미지 생성 실패 시 TTS 생성 건너뛰기
    if (imageGenerationFailed) {
      return;
    }

    // 2. TTS 생성 (옵션이 활성화된 경우)
    if (options?.includeTTS) {
      const scenesWithNarration = scenario.scenes.filter(
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
              contextUpdateScene(scene.id, { narrationAudio: audio });
              success = true;
              break;
            } catch (e) {
              console.error(`TTS attempt ${attempt + 1}/3 failed for scene ${scene.sceneNumber}:`, e);
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
  }, [scenario, aspectRatio, contextUpdateScene, filterCharactersForScene]);

  // =============================================
  // 이미지 교체
  // =============================================

  const replaceSceneImage = useCallback((sceneId: string, newImage: ImageData) => {
    if (!scenario) return;

    const scene = scenario.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    // 이미지 히스토리에 현재 이미지 추가
    const currentImage = scene.generatedImage || scene.customImage;
    const newHistory = currentImage
      ? [...(scene.imageHistory || []), currentImage]
      : scene.imageHistory || [];

    contextUpdateScene(sceneId, {
      customImage: newImage,
      imageSource: 'custom',
      imageHistory: newHistory,
    });
  }, [scenario, contextUpdateScene]);

  const downloadSceneImage = useCallback((sceneId: string, filename?: string) => {
    if (!scenario) return;

    const scene = scenario.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const image = scene.customImage || scene.generatedImage;
    if (!image) return;

    const dataUrl = `data:${image.mimeType};base64,${image.data}`;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename || `scene_${scene.sceneNumber}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [scenario]);

  // =============================================
  // 에셋 관리
  // =============================================

  const setSceneAssets = useCallback((sceneId: string, assets: SceneAssetPlacement[]) => {
    contextUpdateScene(sceneId, { assets });
  }, [contextUpdateScene]);

  const addAssetToScene = useCallback((sceneId: string, asset: SceneAssetPlacement) => {
    if (!scenario) return;

    const scene = scenario.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const currentAssets = scene.assets || [];
    // 중복 체크
    if (currentAssets.some(a => a.assetId === asset.assetId)) return;

    contextUpdateScene(sceneId, {
      assets: [...currentAssets, asset],
    });
  }, [scenario, contextUpdateScene]);

  const removeAssetFromScene = useCallback((sceneId: string, assetId: string) => {
    if (!scenario) return;

    const scene = scenario.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const currentAssets = scene.assets || [];
    contextUpdateScene(sceneId, {
      assets: currentAssets.filter(a => a.assetId !== assetId),
    });
  }, [scenario, contextUpdateScene]);

  // =============================================
  // 저장/불러오기
  // =============================================

  const saveScenarioToFile = useCallback(() => {
    if (!scenario) return;

    const dataStr = JSON.stringify(scenario, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scenario_${scenario.title.replace(/\s+/g, '_')}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [scenario]);

  const loadScenarioFromFile = useCallback(async (file: File): Promise<void> => {
    try {
      const text = await file.text();
      const loaded = JSON.parse(text) as Scenario;

      // 기본 구조 검증
      if (!loaded.id || !loaded.title || !loaded.scenes || !Array.isArray(loaded.scenes)) {
        throw new Error('Invalid scenario file format');
      }

      contextSetScenario(loaded);
    } catch (e) {
      const message = '시나리오 파일을 불러오는데 실패했습니다.';
      setError(message);
      throw new Error(message);
    }
  }, [contextSetScenario]);

  // =============================================
  // 유틸리티
  // =============================================

  const getSceneById = useCallback((sceneId: string): Scene | undefined => {
    return scenario?.scenes.find(s => s.id === sceneId);
  }, [scenario]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // 상태
    scenario,
    isGenerating,
    regeneratingSceneId,
    generatingImageSceneId,
    isGeneratingAllImages,
    isGeneratingTTS,
    ttsProgress,
    error,

    // 시나리오 관리
    setScenario,
    generateScenario,
    updateSuggestedCharacter,

    // 씬 관리
    updateScene,
    addScene,
    removeScene,
    duplicateScene,
    reorderScenes,

    // 씬 재생성
    regenerateScene,

    // 이미지 생성
    generateSceneImage,
    generateAllSceneImages,

    // 이미지 교체
    replaceSceneImage,
    downloadSceneImage,

    // 에셋 관리
    setSceneAssets,
    addAssetToScene,
    removeAssetFromScene,

    // 저장/불러오기
    saveScenarioToFile,
    loadScenarioFromFile,

    // 유틸리티
    getSceneById,
    clearError,
  };
}

export default useScenario;
