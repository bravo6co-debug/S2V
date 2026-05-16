import { useState, useCallback } from 'react';
import type { LongformConfig, LongformScenario, LongformScene } from '../types/longform';
import { generateLongformScenario, validateNarration, LongformApiError } from '../services/longformApiClient';

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
  const [scenario, setScenario] = useState<LongformScenario | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isAdjustingNarration, setIsAdjustingNarration] = useState<number | null>(null);

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
      setScenario(result);
      return result;
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
        scenes: prev.scenes.map(s =>
          s.sceneNumber === sceneNumber
            ? { ...s, ...updates, narrationCharCount: updates.narration !== undefined ? updates.narration.length : s.narrationCharCount }
            : s
        ),
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
