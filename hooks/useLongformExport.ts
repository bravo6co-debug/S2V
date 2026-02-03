import { useState, useCallback, useRef, useEffect } from 'react';
import type { LongformScenario, LongformOutput } from '../types/longform';
import {
  longformScenesToRemotionScenes,
  splitScenesForExport,
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
  part1State: PartExportState;
  part2State: PartExportState;
  isExporting: boolean;
  startExportPart1: (scenario: LongformScenario) => Promise<void>;
  startExportPart2: (scenario: LongformScenario) => Promise<void>;
  cancelExport: () => void;
  downloadPart: (part: 'part1' | 'part2', scenario: LongformScenario) => void;
  downloadHookVideo: (scenario: LongformScenario) => void;
}

const INITIAL_PART_STATE: PartExportState = { status: 'idle', progress: 0 };

export function useLongformExport(): UseLongformExportReturn {
  const [output, setOutput] = useState<LongformOutput | null>(null);
  const [part1State, setPart1State] = useState<PartExportState>(INITIAL_PART_STATE);
  const [part2State, setPart2State] = useState<PartExportState>(INITIAL_PART_STATE);

  // [B] 파트별 독립 AbortController (공유 시 Part2 시작이 Part1을 덮어씀)
  const abortPart1Ref = useRef<AbortController | null>(null);
  const abortPart2Ref = useRef<AbortController | null>(null);

  // [A] Blob URL을 ref로 추적 (stale closure 방지)
  const part1UrlRef = useRef<string | null>(null);
  const part2UrlRef = useRef<string | null>(null);

  // [C] 렌더링 상태를 ref로도 추적 (useCallback 내부에서 최신 상태 접근)
  const part1RenderingRef = useRef(false);
  const part2RenderingRef = useRef(false);

  const isExporting = part1State.status === 'rendering' || part2State.status === 'rendering';

  // [D] 컴포넌트 언마운트 시 리소스 정리
  useEffect(() => {
    return () => {
      abortPart1Ref.current?.abort();
      abortPart2Ref.current?.abort();
      if (part1UrlRef.current) URL.revokeObjectURL(part1UrlRef.current);
      if (part2UrlRef.current) URL.revokeObjectURL(part2UrlRef.current);
    };
  }, []);

  const startExportPart1 = useCallback(async (scenario: LongformScenario) => {
    // [C] 동시 렌더 가드
    if (part1RenderingRef.current) return;

    const controller = new AbortController();
    abortPart1Ref.current = controller;
    part1RenderingRef.current = true;

    const { part1 } = splitScenesForExport(scenario);
    const remotionScenes = longformScenesToRemotionScenes(part1);

    if (remotionScenes.length === 0) {
      part1RenderingRef.current = false;
      setPart1State({ status: 'error', progress: 0, error: '이미지가 생성된 씬이 없습니다' });
      return;
    }

    setPart1State({ status: 'rendering', progress: 0 });

    const result = await renderLongformPart(
      remotionScenes,
      (p: LongformRenderProgress) => {
        if (controller.signal.aborted) return;
        setPart1State(prev => ({
          ...prev,
          progress: p.progress,
          currentFrame: p.currentFrame,
          totalFrames: p.totalFrames,
        }));
      },
      controller.signal
    );

    part1RenderingRef.current = false;

    if (controller.signal.aborted) return;

    if (result.success) {
      // [A] ref에서 이전 URL 해제 (stale closure 방지)
      if (part1UrlRef.current) {
        URL.revokeObjectURL(part1UrlRef.current);
      }
      part1UrlRef.current = result.videoUrl ?? null;

      setPart1State({
        status: 'complete',
        progress: 100,
        totalFrames: result.duration * 30,
        currentFrame: result.duration * 30,
        result,
      });
      setOutput(prev => ({
        hookVideo: prev?.hookVideo ?? null,
        partOne: {
          blob: result.videoBlob,
          duration: result.duration,
          sceneCount: result.sceneCount,
          format: 'webm',
        },
        partTwo: prev?.partTwo ?? null,
      }));
    } else {
      setPart1State({ status: 'error', progress: 0, error: result.error });
    }
  }, []);

  const startExportPart2 = useCallback(async (scenario: LongformScenario) => {
    // [C] 동시 렌더 가드
    if (part2RenderingRef.current) return;

    const controller = new AbortController();
    abortPart2Ref.current = controller;
    part2RenderingRef.current = true;

    const { part2 } = splitScenesForExport(scenario);
    const remotionScenes = longformScenesToRemotionScenes(part2);

    if (remotionScenes.length === 0) {
      part2RenderingRef.current = false;
      setPart2State({ status: 'error', progress: 0, error: '이미지가 생성된 씬이 없습니다' });
      return;
    }

    setPart2State({ status: 'rendering', progress: 0 });

    const result = await renderLongformPart(
      remotionScenes,
      (p: LongformRenderProgress) => {
        if (controller.signal.aborted) return;
        setPart2State(prev => ({
          ...prev,
          progress: p.progress,
          currentFrame: p.currentFrame,
          totalFrames: p.totalFrames,
        }));
      },
      controller.signal
    );

    part2RenderingRef.current = false;

    if (controller.signal.aborted) return;

    if (result.success) {
      // [A] ref에서 이전 URL 해제
      if (part2UrlRef.current) {
        URL.revokeObjectURL(part2UrlRef.current);
      }
      part2UrlRef.current = result.videoUrl ?? null;

      setPart2State({
        status: 'complete',
        progress: 100,
        totalFrames: result.duration * 30,
        currentFrame: result.duration * 30,
        result,
      });
      setOutput(prev => ({
        hookVideo: prev?.hookVideo ?? null,
        partOne: prev?.partOne ?? null,
        partTwo: {
          blob: result.videoBlob,
          duration: result.duration,
          sceneCount: result.sceneCount,
          format: 'webm',
        },
      }));
    } else {
      setPart2State({ status: 'error', progress: 0, error: result.error });
    }
  }, []);

  // [E] cancelExport — ref 기반, deps 없음
  const cancelExport = useCallback(() => {
    abortPart1Ref.current?.abort();
    abortPart2Ref.current?.abort();
    abortPart1Ref.current = null;
    abortPart2Ref.current = null;
    part1RenderingRef.current = false;
    part2RenderingRef.current = false;

    // ref에서 Blob URL 해제
    if (part1UrlRef.current) {
      URL.revokeObjectURL(part1UrlRef.current);
      part1UrlRef.current = null;
    }
    if (part2UrlRef.current) {
      URL.revokeObjectURL(part2UrlRef.current);
      part2UrlRef.current = null;
    }

    setPart1State(prev => prev.status === 'rendering' ? INITIAL_PART_STATE : prev);
    setPart2State(prev => prev.status === 'rendering' ? INITIAL_PART_STATE : prev);
  }, []);

  const downloadPart = useCallback((part: 'part1' | 'part2', scenario: LongformScenario) => {
    const state = part === 'part1' ? part1State : part2State;
    if (state.result?.videoBlob) {
      const title = scenario.metadata.title.replace(/[^a-zA-Z0-9가-힣]/g, '_');
      const partLabel = part === 'part1' ? '파트1' : '파트2';
      downloadLongformVideo(state.result.videoBlob, `${title}_${partLabel}.webm`);
    }
  }, [part1State, part2State]);

  const downloadHookVideo = useCallback(async (scenario: LongformScenario) => {
    const hookUrl = scenario.hookScene.generatedVideo?.url;
    if (!hookUrl) return;

    try {
      const response = await fetch(hookUrl);
      const blob = await response.blob();
      const title = scenario.metadata.title.replace(/[^a-zA-Z0-9가-힣]/g, '_');
      downloadLongformVideo(blob, `${title}_후킹.mp4`);
    } catch (error) {
      console.error('Hook video download failed:', error);
    }
  }, []);

  return {
    output,
    part1State,
    part2State,
    isExporting,
    startExportPart1,
    startExportPart2,
    cancelExport,
    downloadPart,
    downloadHookVideo,
  };
}
