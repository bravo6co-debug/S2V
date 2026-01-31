import { useCallback, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import {
  VideoTimeline,
  VideoClip,
  Scene,
  ImageData,
} from '../types';
import { generateVideoFromImage } from '../services/geminiService';

interface UseVideoReturn {
  // 상태
  timeline: VideoTimeline | null;
  currentTime: number;
  isPlaying: boolean;
  isPaused: boolean;
  isGenerating: boolean;
  generatingClipId: string | null;
  error: string | null;

  // 타임라인 관리
  createTimeline: (name?: string) => void;
  setTimeline: (timeline: VideoTimeline | null) => void;

  // 클립 관리
  addClipFromScene: (scene: Scene) => void;
  addClipsFromScenes: (scenes: Scene[]) => void;
  removeClip: (clipId: string) => void;
  reorderClip: (clipId: string, newOrder: number) => void;
  updateClip: (clipId: string, updates: Partial<VideoClip>) => void;

  // 영상 클립 생성 (AI)
  generateClipVideo: (clipId: string, referenceImages?: ImageData[]) => Promise<void>;
  generateAllClipVideos: (referenceImages?: ImageData[]) => Promise<void>;

  // 재생 컨트롤
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;

  // 유틸리티
  clearError: () => void;
}

export function useVideo(): UseVideoReturn {
  const { timeline, setTimeline: contextSetTimeline } = useProject();

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingClipId, setGeneratingClipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // =============================================
  // 타임라인 관리
  // =============================================

  const createTimeline = useCallback((name?: string) => {
    const newTimeline: VideoTimeline = {
      id: crypto.randomUUID(),
      name: name || '새 프로젝트',
      clips: [],
      totalDuration: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    contextSetTimeline(newTimeline);
  }, [contextSetTimeline]);

  const setTimeline = useCallback((newTimeline: VideoTimeline | null) => {
    contextSetTimeline(newTimeline);
  }, [contextSetTimeline]);

  // =============================================
  // 클립 관리
  // =============================================

  const addClipFromScene = useCallback((scene: Scene) => {
    if (!timeline) return;

    const sourceImage = scene.customImage || scene.generatedImage;
    if (!sourceImage) return;

    const newClip: VideoClip = {
      id: crypto.randomUUID(),
      sceneId: scene.id,
      order: timeline.clips.length,
      duration: scene.duration || 5,
      sourceImage,
      motionPrompt: scene.imagePrompt,
      status: 'pending',
      createdAt: Date.now(),
    };

    const updatedClips = [...timeline.clips, newClip];
    const totalDuration = updatedClips.reduce((sum, c) => sum + c.duration, 0);

    contextSetTimeline({
      ...timeline,
      clips: updatedClips,
      totalDuration,
      updatedAt: Date.now(),
    });
  }, [timeline, contextSetTimeline]);

  const addClipsFromScenes = useCallback((scenes: Scene[]) => {
    if (!timeline) return;

    const newClips: VideoClip[] = [];
    let order = timeline.clips.length;

    for (const scene of scenes) {
      const sourceImage = scene.customImage || scene.generatedImage;
      if (!sourceImage) continue;

      newClips.push({
        id: crypto.randomUUID(),
        sceneId: scene.id,
        order: order++,
        duration: scene.duration || 5,
        sourceImage,
        motionPrompt: scene.imagePrompt,
        status: 'pending',
        createdAt: Date.now(),
      });
    }

    if (newClips.length === 0) return;

    const updatedClips = [...timeline.clips, ...newClips];
    const totalDuration = updatedClips.reduce((sum, c) => sum + c.duration, 0);

    contextSetTimeline({
      ...timeline,
      clips: updatedClips,
      totalDuration,
      updatedAt: Date.now(),
    });
  }, [timeline, contextSetTimeline]);

  const removeClip = useCallback((clipId: string) => {
    if (!timeline) return;

    const updatedClips = timeline.clips
      .filter(c => c.id !== clipId)
      .map((clip, index) => ({ ...clip, order: index }));

    const totalDuration = updatedClips.reduce((sum, c) => sum + c.duration, 0);

    contextSetTimeline({
      ...timeline,
      clips: updatedClips,
      totalDuration,
      updatedAt: Date.now(),
    });
  }, [timeline, contextSetTimeline]);

  const reorderClip = useCallback((clipId: string, newOrder: number) => {
    if (!timeline) return;

    const clipIndex = timeline.clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) return;

    const clips = [...timeline.clips];
    const [movedClip] = clips.splice(clipIndex, 1);
    clips.splice(newOrder, 0, movedClip);

    const updatedClips = clips.map((clip, index) => ({ ...clip, order: index }));

    contextSetTimeline({
      ...timeline,
      clips: updatedClips,
      updatedAt: Date.now(),
    });
  }, [timeline, contextSetTimeline]);

  const updateClip = useCallback((clipId: string, updates: Partial<VideoClip>) => {
    if (!timeline) return;

    const updatedClips = timeline.clips.map(clip =>
      clip.id === clipId ? { ...clip, ...updates } : clip
    );

    const totalDuration = updatedClips.reduce((sum, c) => sum + c.duration, 0);

    contextSetTimeline({
      ...timeline,
      clips: updatedClips,
      totalDuration,
      updatedAt: Date.now(),
    });
  }, [timeline, contextSetTimeline]);

  // =============================================
  // 영상 클립 생성 (AI)
  // =============================================

  const generateClipVideo = useCallback(async (
    clipId: string,
    referenceImages?: ImageData[]
  ): Promise<void> => {
    if (!timeline) return;

    const clip = timeline.clips.find(c => c.id === clipId);
    if (!clip || !clip.sourceImage) return;

    setGeneratingClipId(clipId);
    setIsGenerating(true);
    setError(null);

    // 로컬 작업 복사본 사용 (stale closure 방지)
    let currentTimeline = { ...timeline };

    try {
      // Update status to 'generating'
      currentTimeline = {
        ...currentTimeline,
        clips: currentTimeline.clips.map(c =>
          c.id === clipId ? { ...c, status: 'generating' as const } : c
        ),
        updatedAt: Date.now(),
      };
      contextSetTimeline(currentTimeline);

      // Generate video using Hailuo API
      const result = await generateVideoFromImage(
        clip.sourceImage,
        clip.motionPrompt || 'Cinematic camera movement with subtle motion',
        Math.min(clip.duration, 6) // Hailuo 클립 최대 6초
      );

      // Update with generated video (로컬 복사본 기반 업데이트)
      currentTimeline = {
        ...currentTimeline,
        clips: currentTimeline.clips.map(c =>
          c.id === clipId
            ? {
                ...c,
                status: 'complete' as const,
                generatedVideo: {
                  url: result.videoUrl,
                  thumbnailUrl: result.thumbnailUrl,
                  duration: result.duration,
                },
              }
            : c
        ),
        updatedAt: Date.now(),
      };
      contextSetTimeline(currentTimeline);
    } catch (e) {
      const message = e instanceof Error ? e.message : '영상 클립 생성에 실패했습니다.';
      setError(message);

      // 에러 상태 업데이트 (로컬 복사본 기반)
      currentTimeline = {
        ...currentTimeline,
        clips: currentTimeline.clips.map(c =>
          c.id === clipId ? { ...c, status: 'error' as const, error: message } : c
        ),
        updatedAt: Date.now(),
      };
      contextSetTimeline(currentTimeline);
    } finally {
      setGeneratingClipId(null);
      setIsGenerating(false);
    }
  }, [timeline, contextSetTimeline]);

  const generateAllClipVideos = useCallback(async (
    referenceImages?: ImageData[]
  ): Promise<void> => {
    if (!timeline) return;

    const pendingClips = timeline.clips.filter(
      c => c.status === 'pending' && c.sourceImage
    );

    if (pendingClips.length === 0) return;

    setIsGenerating(true);
    setError(null);

    // 로컬 작업 복사본: 순차 실행 시 이전 결과를 누적 유지
    let currentTimeline = { ...timeline };

    for (const clip of pendingClips) {
      setGeneratingClipId(clip.id);

      // Update status to 'generating'
      currentTimeline = {
        ...currentTimeline,
        clips: currentTimeline.clips.map(c =>
          c.id === clip.id ? { ...c, status: 'generating' as const } : c
        ),
        updatedAt: Date.now(),
      };
      contextSetTimeline(currentTimeline);

      try {
        const result = await generateVideoFromImage(
          clip.sourceImage!,
          clip.motionPrompt || 'Cinematic camera movement with subtle motion',
          Math.min(clip.duration, 6)
        );

        // 성공: 로컬 복사본에 누적 (이전 클립 결과 유지)
        currentTimeline = {
          ...currentTimeline,
          clips: currentTimeline.clips.map(c =>
            c.id === clip.id
              ? {
                  ...c,
                  status: 'complete' as const,
                  generatedVideo: {
                    url: result.videoUrl,
                    thumbnailUrl: result.thumbnailUrl,
                    duration: result.duration,
                  },
                }
              : c
          ),
          updatedAt: Date.now(),
        };
        contextSetTimeline(currentTimeline);
      } catch (e) {
        console.error(`Failed to generate clip ${clip.id}:`, e);
        const message = e instanceof Error ? e.message : '영상 클립 생성에 실패했습니다.';
        setError(message);

        // 에러: 로컬 복사본에 에러 상태 누적
        currentTimeline = {
          ...currentTimeline,
          clips: currentTimeline.clips.map(c =>
            c.id === clip.id ? { ...c, status: 'error' as const, error: message } : c
          ),
          updatedAt: Date.now(),
        };
        contextSetTimeline(currentTimeline);
        // 에러가 나도 다음 클립 계속 진행
      }
    }

    setGeneratingClipId(null);
    setIsGenerating(false);
  }, [timeline, contextSetTimeline]);

  // =============================================
  // 재생 컨트롤
  // =============================================

  const play = useCallback(() => {
    setIsPlaying(true);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
  }, []);

  const seek = useCallback((time: number) => {
    const maxTime = timeline?.totalDuration || 0;
    setCurrentTime(Math.max(0, Math.min(time, maxTime)));
  }, [timeline]);

  // =============================================
  // 유틸리티
  // =============================================

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // 상태
    timeline,
    currentTime,
    isPlaying,
    isPaused,
    isGenerating,
    generatingClipId,
    error,

    // 타임라인 관리
    createTimeline,
    setTimeline,

    // 클립 관리
    addClipFromScene,
    addClipsFromScenes,
    removeClip,
    reorderClip,
    updateClip,

    // 영상 클립 생성
    generateClipVideo,
    generateAllClipVideos,

    // 재생 컨트롤
    play,
    pause,
    stop,
    seek,

    // 유틸리티
    clearError,
  };
}

export default useVideo;
