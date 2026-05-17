import { useState, useCallback, useRef } from 'react';
import type { LongformScenario, LongformCharacter } from '../types/longform';
import type { ImageStyle } from '../types';
import { extractLongformCharacters, generateCharacterImage } from '../services/longformApiClient';

export type CharacterExtractionStatus = 'idle' | 'extracting' | 'completed' | 'failed';

interface UseLongformCharactersReturn {
  characters: LongformCharacter[];
  extractionStatus: CharacterExtractionStatus;
  error: string | null;

  extractCharacters: (scenario: LongformScenario) => Promise<void>;
  updateCharacter: (characterId: string, updates: Partial<LongformCharacter>) => void;
  removeCharacter: (characterId: string) => void;
  addCharacter: () => void;
  generateImage: (characterId: string, imageModel: string, imageStyle?: ImageStyle) => Promise<void>;
  generateAllImages: (imageModel: string, imageStyle?: ImageStyle) => Promise<void>;
  setCharacters: (characters: LongformCharacter[]) => void;
  clearError: () => void;
}

export function useLongformCharacters(): UseLongformCharactersReturn {
  const [characters, setCharacters] = useState<LongformCharacter[]>([]);
  const [extractionStatus, setExtractionStatus] = useState<CharacterExtractionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const charactersRef = useRef<LongformCharacter[]>([]);

  // Keep ref in sync for use in generateImage/generateAllImages
  charactersRef.current = characters;

  const extractCharacters = useCallback(async (scenario: LongformScenario) => {
    setExtractionStatus('extracting');
    setError(null);
    try {
      const sceneInputs = scenario.scenes.map(s => ({
        sceneNumber: s.sceneNumber,
        imagePrompt: s.imagePrompt,
        narration: s.narration,
      }));
      const result = await extractLongformCharacters(
        sceneInputs,
        { title: scenario.metadata.title, synopsis: scenario.metadata.synopsis },
        scenario.config?.textModel,
      );
      setCharacters(result.characters);
      setExtractionStatus('completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : '캐릭터 추출에 실패했습니다.');
      setExtractionStatus('failed');
    }
  }, []);

  const updateCharacter = useCallback((characterId: string, updates: Partial<LongformCharacter>) => {
    setCharacters(prev => prev.map(c =>
      c.id === characterId ? { ...c, ...updates } : c
    ));
  }, []);

  const removeCharacter = useCallback((characterId: string) => {
    setCharacters(prev => prev.filter(c => c.id !== characterId));
  }, []);

  const addCharacter = useCallback(() => {
    const newChar: LongformCharacter = {
      id: crypto.randomUUID(),
      name: '새 캐릭터',
      nameEn: 'New Character',
      role: 'minor',
      appearanceDescription: '',
      outfit: '',
      personality: '',
      sceneNumbers: [],
      imageStatus: 'pending',
    };
    setCharacters(prev => [...prev, newChar]);
  }, []);

  const generateImage = useCallback(async (characterId: string, imageModel: string, imageStyle?: ImageStyle) => {
    const char = charactersRef.current.find(c => c.id === characterId);
    if (!char) return;

    setCharacters(prev => prev.map(c =>
      c.id === characterId ? { ...c, imageStatus: 'generating' as const } : c
    ));

    try {
      const result = await generateCharacterImage(
        char.nameEn,
        char.appearanceDescription,
        char.outfit,
        imageModel,
        imageStyle,
      );
      setCharacters(prev => prev.map(c =>
        c.id === characterId
          ? { ...c, referenceImage: result.image, imageStatus: 'completed' as const }
          : c
      ));
    } catch (err) {
      setCharacters(prev => prev.map(c =>
        c.id === characterId ? { ...c, imageStatus: 'failed' as const } : c
      ));
      setError(err instanceof Error ? err.message : '이미지 생성에 실패했습니다.');
    }
  }, []);

  const generateAllImages = useCallback(async (imageModel: string, imageStyle?: ImageStyle) => {
    const pending = charactersRef.current.filter(c => c.imageStatus !== 'completed');
    for (let i = 0; i < pending.length; i++) {
      await generateImage(pending[i].id, imageModel, imageStyle);
      if (i < pending.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }, [generateImage]);

  const clearError = useCallback(() => setError(null), []);

  return {
    characters,
    extractionStatus,
    error,
    extractCharacters,
    updateCharacter,
    removeCharacter,
    addCharacter,
    generateImage,
    generateAllImages,
    setCharacters,
    clearError,
  };
}
