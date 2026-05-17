import { useState, useCallback, useEffect, useRef } from 'react';
import type { LongformConfig, LongformScenario, LongformScene } from '../types/longform';
import { generateLongformScenario, validateNarration, LongformApiError } from '../services/longformApiClient';

const STORAGE_KEY = 's2v_longform_scenario_autosave';
const STORAGE_VERSION = 3; // 텍스트 전용 저장으로 변경 시 bump

interface AutosavePayload {
  version: number;
  savedAt: number;
  scenario: LongformScenario;
}

/**
 * 큰 base64 데이터(이미지/오디오)를 제거하여 텍스트만 남긴 시나리오 반환.
 * 자동저장 시 JSON.stringify 시간을 100배 단축 + localStorage 용량 안전.
 * 이미지/오디오는 React state에 메모리상 유지되므로 세션 내에는 그대로 사용 가능.
 * 새로고침 후엔 텍스트만 복원되고 이미지는 재생성 또는 재업로드 필요.
 */
function stripLargeData(scenario: LongformScenario): LongformScenario {
  return {
    ...scenario,
    scenes: scenario.scenes.map(s => ({
      ...s,
      generatedImage: undefined,
      narrationAudio: undefined,
      subScenes: (s.subScenes || []).map(sub => ({
        ...sub,
        generatedImage: undefined,
      })),
    })),
    characters: (scenario.characters || []).map(c => ({
      ...c,
      referenceImage: undefined,
    })),
  };
}

function loadAutosave(): LongformScenario | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AutosavePayload;
    if (data.version !== STORAGE_VERSION) return null;
    return data.scenario;
  } catch {
    return null;
  }
}

function saveAutosave(scenario: LongformScenario | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!scenario) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    // 항상 base64 데이터 제외하고 저장 (메인 스레드 블록 최소화)
    const lightweight = stripLargeData(scenario);
    const payload: AutosavePayload = { version: STORAGE_VERSION, savedAt: Date.now(), scenario: lightweight };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[longform-autosave] 저장 실패', e);
  }
}

interface UseLongformScenarioReturn {
  scenario: LongformScenario | null;
  isGenerating: boolean;
  error: string | null;
  errorRetryable: boolean;
  errorCode: string | null;

  setScenario: (scenario: LongformScenario | null) => void;
  generateScenario: (config: LongformConfig) => Promise<LongformScenario>;

  // Scene editing
  updateScene: (sceneNumber: number, updates: Partial<LongformScene>) => void;

  // Narration validation
  adjustNarration: (sceneNumber: number) => Promise<void>;
  isAdjustingNarration: number | null;

  clearError: () => void;
}

export function useLongformScenario(): UseLongformScenarioReturn {
  // 마운트 시 localStorage에서 자동 복원 — 탭 이동/새로고침해도 시나리오 보존
  const [scenario, setScenario] = useState<LongformScenario | null>(() => loadAutosave());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isAdjustingNarration, setIsAdjustingNarration] = useState<number | null>(null);

  // scenario 변경 시 디바운스로 localStorage 자동 저장
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveAutosave(scenario), 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [scenario]);

  const applyError = (err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback;
    setError(message);
    if (err instanceof LongformApiError) {
      setErrorRetryable(err.retryable);
      setErrorCode(err.code);
    } else {
      setErrorRetryable(false);
      setErrorCode(null);
    }
  };

  const generateScenario = useCallback(async (config: LongformConfig): Promise<LongformScenario> => {
    setIsGenerating(true);
    setError(null);
    setErrorRetryable(false);
    setErrorCode(null);

    try {
      const result = await generateLongformScenario(config);
      // config를 시나리오에 임베드 → autosave 후 복원 시 Step1 입력도 함께 회복됨
      const withConfig: LongformScenario = { ...result, config };
      setScenario(withConfig);
      return withConfig;
    } catch (err) {
      applyError(err, '시나리오 생성에 실패했습니다.');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const updateScene = useCallback((sceneNumber: number, updates: Partial<LongformScene>) => {
    setScenario(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        scenes: prev.scenes.map(s => {
          if (s.sceneNumber !== sceneNumber) return s;

          const merged: LongformScene = { ...s, ...updates };
          if (updates.narration !== undefined) {
            merged.narrationCharCount = updates.narration.length;
          }

          // ─── Legacy ↔ subScenes[0] 자동 양방향 미러링 ───
          // 외부 호출자가 한쪽만 업데이트해도 다른 쪽 자동 동기화 → drift 방지
          const legacyKeys = ['imagePrompt', 'generatedImage', 'imageStatus', 'imageError', 'userUploaded'] as const;
          const legacyTouched = legacyKeys.some(k => k in updates);
          const subScenesTouched = 'subScenes' in updates;

          if (legacyTouched && !subScenesTouched && merged.subScenes && merged.subScenes.length > 0) {
            // Legacy 필드만 변경 → subScenes[0]에 미러링
            const newSubs = [...merged.subScenes];
            newSubs[0] = {
              ...newSubs[0],
              imagePrompt: merged.imagePrompt,
              generatedImage: merged.generatedImage,
              imageStatus: merged.imageStatus,
              imageError: merged.imageError,
              userUploaded: merged.userUploaded,
            };
            merged.subScenes = newSubs;
          } else if (subScenesTouched && merged.subScenes && merged.subScenes.length > 0) {
            // subScenes 변경 → legacy 필드를 subScenes[0]에서 동기화
            const sub0 = merged.subScenes[0];
            merged.imagePrompt = sub0.imagePrompt;
            merged.generatedImage = sub0.generatedImage;
            merged.imageStatus = sub0.imageStatus;
            merged.imageError = sub0.imageError;
            merged.userUploaded = sub0.userUploaded;
          }

          return merged;
        }),
      };
    });
  }, []);

  const adjustNarration = useCallback(async (sceneNumber: number) => {
    if (!scenario) return;

    const scene = scenario.scenes.find(s => s.sceneNumber === sceneNumber);
    if (!scene) return;

    const charCount = scene.narration.length;
    if (charCount >= 432 && charCount <= 444) return;

    setIsAdjustingNarration(sceneNumber);

    try {
      const prevScene = scenario.scenes.find(s => s.sceneNumber === sceneNumber - 1);
      const result = await validateNarration(scene.narration, prevScene?.narration, scenario.config?.textModel);

      updateScene(sceneNumber, {
        narration: result.narration,
        narrationCharCount: result.charCount,
      });
    } catch (err) {
      applyError(err, '나레이션 보정에 실패했습니다.');
    } finally {
      setIsAdjustingNarration(null);
    }
  }, [scenario, updateScene]);

  const clearError = useCallback(() => {
    setError(null);
    setErrorRetryable(false);
    setErrorCode(null);
  }, []);

  return {
    scenario,
    isGenerating,
    error,
    errorRetryable,
    errorCode,
    setScenario,
    generateScenario,
    updateScene,
    adjustNarration,
    isAdjustingNarration,
    clearError,
  };
}
