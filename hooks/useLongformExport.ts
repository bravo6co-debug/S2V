import { useState, useCallback, useRef, useEffect } from 'react';
import type { LongformScenario, LongformOutput, LongformPartOutput } from '../types/longform';
import { calculatePartRanges } from '../types/longform';
import {
  longformScenesToRemotionScenes,
  splitScenesForExportMulti,
  renderLongformPart,
  downloadLongformVideo,
  type LongformRenderProgress,
  type LongformRenderResult,
} from '../services/longformVideoService';

export interface PartExportState {
  status: 'idle' | 'rendering' | 'complete' | 'error';
  progress: number;
  currentFrame?: number;
  totalFrames?: number;
  result?: LongformRenderResult;
  error?: string;
}

interface UseLongformExportReturn {
  output: LongformOutput | null;
  partStates: PartExportState[];
  partCount: number;
  isExporting: boolean;
  startExportPart: (scenario: LongformScenario, partIndex: number) => Promise<void>;
  cancelExport: () => void;
  downloadPart: (partIndex: number, scenario: LongformScenario) => void;
  getPartRange: (scenario: LongformScenario, partIndex: number) => { start: number; end: number };
}

const INITIAL_PART_STATE: PartExportState = { status: 'idle', progress: 0 };

export function useLongformExport(): UseLongformExportReturn {
  const [output, setOutput] = useState<LongformOutput | null>(null);
  const [partStates, setPartStates] = useState<PartExportState[]>([]);
  const [partCount, setPartCount] = useState(0);

  // AbortController refs for each part
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());
  const renderingPartsRef = useRef<Set<number>>(new Set());
  const blobUrlsRef = useRef<Map<number, string>>(new Map());

  const isExporting = partStates.some(s => s.status === 'rendering');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach(ctrl => ctrl.abort());
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Initialize part states when scenario changes
  const initializeParts = useCallback((scenario: LongformScenario) => {
    const ranges = calculatePartRanges(scenario.scenes.length);
    const count = ranges.length;
    setPartCount(count);
    setPartStates(Array(count).fill(null).map(() => ({ ...INITIAL_PART_STATE })));
    setOutput({ parts: Array(count).fill(null) });
  }, []);

  const startExportPart = useCallback(async (scenario: LongformScenario, partIndex: number) => {
    // Initialize if not done
    const ranges = calculatePartRanges(scenario.scenes.length);
    if (partStates.length !== ranges.length) {
      initializeParts(scenario);
    }

    // Guard against concurrent render of same part
    if (renderingPartsRef.current.has(partIndex)) return;

    const controller = new AbortController();
    abortControllersRef.current.set(partIndex, controller);
    renderingPartsRef.current.add(partIndex);

    const { parts, ranges: partRanges } = splitScenesForExportMulti(scenario);
    const scenesForPart = parts[partIndex];

    if (!scenesForPart || scenesForPart.length === 0) {
      renderingPartsRef.current.delete(partIndex);
      setPartStates(prev => {
        const updated = [...prev];
        updated[partIndex] = { status: 'error', progress: 0, error: '씬이 없습니다' };
        return updated;
      });
      return;
    }

    const remotionScenes = longformScenesToRemotionScenes(scenesForPart);

    if (remotionScenes.length === 0) {
      renderingPartsRef.current.delete(partIndex);
      setPartStates(prev => {
        const updated = [...prev];
        updated[partIndex] = { status: 'error', progress: 0, error: '이미지가 생성된 씬이 없습니다' };
        return updated;
      });
      return;
    }

    setPartStates(prev => {
      const updated = [...prev];
      updated[partIndex] = { status: 'rendering', progress: 0 };
      return updated;
    });

    const result = await renderLongformPart(
      remotionScenes,
      (p: LongformRenderProgress) => {
        if (controller.signal.aborted) return;
        setPartStates(prev => {
          const updated = [...prev];
          updated[partIndex] = {
            ...updated[partIndex],
            progress: p.progress,
            currentFrame: p.currentFrame,
            totalFrames: p.totalFrames,
          };
          return updated;
        });
      },
      controller.signal
    );

    renderingPartsRef.current.delete(partIndex);

    if (controller.signal.aborted) return;

    if (result.success) {
      // Revoke previous URL
      const prevUrl = blobUrlsRef.current.get(partIndex);
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      if (result.videoUrl) blobUrlsRef.current.set(partIndex, result.videoUrl);

      setPartStates(prev => {
        const updated = [...prev];
        updated[partIndex] = {
          status: 'complete',
          progress: 100,
          totalFrames: result.duration * 30,
          currentFrame: result.duration * 30,
          result,
        };
        return updated;
      });

      setOutput(prev => {
        const parts = prev?.parts ? [...prev.parts] : Array(ranges.length).fill(null);
        const partOutput: LongformPartOutput = {
          partIndex,
          blob: result.videoBlob,
          duration: result.duration,
          sceneCount: result.sceneCount,
          sceneRange: partRanges[partIndex],
          format: 'webm',
        };
        parts[partIndex] = partOutput;
        return { parts };
      });
    } else {
      setPartStates(prev => {
        const updated = [...prev];
        updated[partIndex] = { status: 'error', progress: 0, error: result.error };
        return updated;
      });
    }
  }, [partStates.length, initializeParts]);

  const cancelExport = useCallback(() => {
    abortControllersRef.current.forEach(ctrl => ctrl.abort());
    abortControllersRef.current.clear();
    renderingPartsRef.current.clear();

    blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    blobUrlsRef.current.clear();

    setPartStates(prev =>
      prev.map(s => s.status === 'rendering' ? { ...INITIAL_PART_STATE } : s)
    );
  }, []);

  const downloadPart = useCallback((partIndex: number, scenario: LongformScenario) => {
    const state = partStates[partIndex];
    if (state?.result?.videoBlob) {
      const title = scenario.metadata.title.replace(/[^a-zA-Z0-9가-힣]/g, '_');
      const ranges = calculatePartRanges(scenario.scenes.length);
      const range = ranges[partIndex];
      const partLabel = `파트${partIndex + 1}_씬${range.start + 1}-${range.end}`;
      downloadLongformVideo(state.result.videoBlob, `${title}_${partLabel}.webm`);
    }
  }, [partStates]);

  const getPartRange = useCallback((scenario: LongformScenario, partIndex: number) => {
    const ranges = calculatePartRanges(scenario.scenes.length);
    return ranges[partIndex] || { start: 0, end: 0 };
  }, []);

  return {
    output,
    partStates,
    partCount,
    isExporting,
    startExportPart,
    cancelExport,
    downloadPart,
    getPartRange,
  };
}
