import { useCallback, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import {
  CharacterAsset,
  CharacterRole,
  ImageData,
  CharacterRelationship,
} from '../types';
import { extractCharacterData, generateCharacterPortraits } from '../services/geminiService';

interface UseCharactersReturn {
  // 상태
  characters: CharacterAsset[];
  activeCharacterIds: string[];
  isCreating: boolean;
  error: string | null;

  // 기본 CRUD
  addCharacter: (char: CharacterAsset) => void;
  updateCharacter: (id: string, updates: Partial<CharacterAsset>) => void;
  removeCharacter: (id: string) => void;

  // 활성화 관리
  toggleActiveCharacter: (id: string) => void;
  setActiveCharacterIds: (ids: string[]) => void;
  getActiveCharacters: () => CharacterAsset[];

  // AI 생성
  generateCharacter: (
    description: string,
    count: number,
    role: CharacterRole
  ) => Promise<CharacterAsset[]>;

  // 업로드
  createFromUpload: (
    image: ImageData,
    name: string,
    role: CharacterRole,
    metadata?: Partial<CharacterAsset>
  ) => CharacterAsset;

  // 유틸리티
  getCharacterById: (id: string) => CharacterAsset | undefined;
  getCharactersByRole: (role: CharacterRole) => CharacterAsset[];
  clearError: () => void;
}

export function useCharacters(): UseCharactersReturn {
  const {
    characters,
    addCharacter: contextAddCharacter,
    updateCharacter: contextUpdateCharacter,
    removeCharacter: contextRemoveCharacter,
    activeCharacterIds,
    setActiveCharacterIds,
    toggleActiveCharacter,
    aspectRatio,
  } = useProject();

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =============================================
  // 기본 CRUD
  // =============================================

  const addCharacter = useCallback((char: CharacterAsset) => {
    contextAddCharacter(char);
  }, [contextAddCharacter]);

  const updateCharacter = useCallback((id: string, updates: Partial<CharacterAsset>) => {
    contextUpdateCharacter(id, updates);
  }, [contextUpdateCharacter]);

  const removeCharacter = useCallback((id: string) => {
    contextRemoveCharacter(id);
  }, [contextRemoveCharacter]);

  // =============================================
  // 활성화된 캐릭터
  // =============================================

  const getActiveCharacters = useCallback((): CharacterAsset[] => {
    return activeCharacterIds
      .map(id => characters.find(c => c.id === id))
      .filter((c): c is CharacterAsset => c !== undefined);
  }, [activeCharacterIds, characters]);

  // =============================================
  // AI 캐릭터 생성
  // =============================================

  const generateCharacter = useCallback(async (
    description: string,
    count: number,
    role: CharacterRole
  ): Promise<CharacterAsset[]> => {
    setIsCreating(true);
    setError(null);

    try {
      // 1. AI로 캐릭터 데이터 추출
      const { name, age, personality, outfit, englishDescription } = await extractCharacterData(description);

      if (!englishDescription.trim()) {
        throw new Error('캐릭터 설명 분석에 실패했습니다. 더 자세히 작성해주세요.');
      }

      // 2. 캐릭터 초상화 생성
      const imagesData = await generateCharacterPortraits(englishDescription, count, aspectRatio);

      // 3. CharacterAsset 객체 생성
      const newCharacters: CharacterAsset[] = imagesData.map(imgData => ({
        id: crypto.randomUUID(),
        name: name || '이름 없음',
        role,
        image: imgData,
        description,
        maintainContext: role === 'protagonist' || role === 'supporting',
        age: age || '',
        personality: personality || '',
        outfit: outfit || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      // 4. Context에 추가
      newCharacters.forEach(char => contextAddCharacter(char));

      return newCharacters;
    } catch (e) {
      const message = e instanceof Error ? e.message : '캐릭터 생성에 실패했습니다.';
      setError(message);
      throw e;
    } finally {
      setIsCreating(false);
    }
  }, [aspectRatio, contextAddCharacter]);

  // =============================================
  // 이미지 업로드로 캐릭터 생성
  // =============================================

  const createFromUpload = useCallback((
    image: ImageData,
    name: string,
    role: CharacterRole,
    metadata?: Partial<CharacterAsset>
  ): CharacterAsset => {
    const newCharacter: CharacterAsset = {
      id: crypto.randomUUID(),
      name,
      role,
      image,
      description: metadata?.description || '',
      maintainContext: role === 'protagonist' || role === 'supporting',
      age: metadata?.age || '',
      personality: metadata?.personality || '',
      outfit: metadata?.outfit || '',
      relationships: metadata?.relationships || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    contextAddCharacter(newCharacter);
    return newCharacter;
  }, [contextAddCharacter]);

  // =============================================
  // 유틸리티
  // =============================================

  const getCharacterById = useCallback((id: string): CharacterAsset | undefined => {
    return characters.find(c => c.id === id);
  }, [characters]);

  const getCharactersByRole = useCallback((role: CharacterRole): CharacterAsset[] => {
    return characters.filter(c => c.role === role);
  }, [characters]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // 상태
    characters,
    activeCharacterIds,
    isCreating,
    error,

    // 기본 CRUD
    addCharacter,
    updateCharacter,
    removeCharacter,

    // 활성화 관리
    toggleActiveCharacter,
    setActiveCharacterIds,
    getActiveCharacters,

    // AI 생성
    generateCharacter,

    // 업로드
    createFromUpload,

    // 유틸리티
    getCharacterById,
    getCharactersByRole,
    clearError,
  };
}

export default useCharacters;
