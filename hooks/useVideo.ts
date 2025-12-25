import { useCallback, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import {
  VideoTimeline,
  TimelineScene,
  AudioTrack,
  Transition,
  AnimationConfig,
  VideoClip,
  Scene,
} from '../types';

interface UseVideoReturn {
  // 상태
  timeline: VideoTimeline | null;
  currentTime: number;
  isPlaying: boolean;
  generatingClipSceneId: string | null;
  isGeneratingAllClips: boolean;
  error: string | null;

  // 타임라인 관리
  createTimeline: () => void;
  setTimeline: (timeline: VideoTimeline | null) => void;

  // 타임라인 씬 관리
  addSceneToTimeline: (scene: TimelineScene) => void;
  updateTimelineScene: (sceneId: string, updates: Partial<TimelineScene>) => void;
  removeFromTimeline: (sceneId: string) => void;
  reorderTimelineScenes: (sceneIds: string[]) => void;

  // 전환 효과
  setTransition: (transition: Transition) => void;
  removeTransition: (fromSceneId: string, toSceneId: string) => void;

  // 오디오 트랙
  addAudioTrack: (track: AudioTrack) => void;
  updateAudioTrack: (trackId: string, updates: Partial<AudioTrack>) => void;
  removeAudioTrack: (trackId: string) => void;

  // 애니메이션
  setSceneAnimation: (sceneId: string, animation: AnimationConfig) => void;

  // 영상 클립 생성 (AI)
  generateVideoClip: (sceneId: string, sourceScene: Scene) => Promise<VideoClip>;
  generateAllVideoClips: (scenes: Scene[]) => Promise<void>;

  // 재생 컨트롤
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void;

  // 내보내기
  exportVideo: (config: ExportConfig) => Promise<Blob>;

  // 유틸리티
  getTotalDuration: () => number;
  getSceneAtTime: (time: number) => TimelineScene | null;
  clearError: () => void;
}

interface ExportConfig {
  width: number;
  height: number;
  fps: number;
  format: 'mp4' | 'webm';
  quality: 'high' | 'medium' | 'low';
}

export function useVideo(): UseVideoReturn {
  const {
    timeline,
    setTimeline: contextSetTimeline,
    addSceneToTimeline: contextAddScene,
    updateTimelineScene: contextUpdateScene,
    removeFromTimeline: contextRemoveFromTimeline,
  } = useProject();

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatingClipSceneId, setGeneratingClipSceneId] = useState<string | null>(null);
  const [isGeneratingAllClips, setIsGeneratingAllClips] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =============================================
  // 타임라인 관리
  // =============================================

  const createTimeline = useCallback(() => {
    const newTimeline: VideoTimeline = {
      id: crypto.randomUUID(),
      scenes: [],
      totalDuration: 0,
      audioTracks: [],
      transitions: [],
    };
    contextSetTimeline(newTimeline);
  }, [contextSetTimeline]);

  const setTimeline = useCallback((newTimeline: VideoTimeline | null) => {
    contextSetTimeline(newTimeline);
  }, [contextSetTimeline]);

  // =============================================
  // 타임라인 씬 관리
  // =============================================

  const addSceneToTimeline = useCallback((scene: TimelineScene) => {
    contextAddScene(scene);
  }, [contextAddScene]);

  const updateTimelineScene = useCallback((sceneId: string, updates: Partial<TimelineScene>) => {
    contextUpdateScene(sceneId, updates);
  }, [contextUpdateScene]);

  const removeFromTimeline = useCallback((sceneId: string) => {
    contextRemoveFromTimeline(sceneId);
  }, [contextRemoveFromTimeline]);

  const reorderTimelineScenes = useCallback((sceneIds: string[]) => {
    if (!timeline) return;

    const sceneMap = new Map(timeline.scenes.map(s => [s.id, s]));
    let currentStartTime = 0;

    const reorderedScenes = sceneIds
      .map((id, index) => {
        const scene = sceneMap.get(id);
        if (!scene) return null;

        const updatedScene: TimelineScene = {
          ...scene,
          position: index,
          startTime: currentStartTime,
        };
        currentStartTime += scene.duration;
        return updatedScene;
      })
      .filter((s): s is TimelineScene => s !== null);

    contextSetTimeline({
      ...timeline,
      scenes: reorderedScenes,
      totalDuration: currentStartTime,
    });
  }, [timeline, contextSetTimeline]);

  // =============================================
  // 전환 효과
  // =============================================

  const setTransition = useCallback((transition: Transition) => {
    if (!timeline) return;

    const existingIndex = timeline.transitions.findIndex(
      t => t.fromSceneId === transition.fromSceneId && t.toSceneId === transition.toSceneId
    );

    let newTransitions: Transition[];
    if (existingIndex !== -1) {
      newTransitions = timeline.transitions.map((t, i) =>
        i === existingIndex ? transition : t
      );
    } else {
      newTransitions = [...timeline.transitions, transition];
    }

    contextSetTimeline({
      ...timeline,
      transitions: newTransitions,
    });
  }, [timeline, contextSetTimeline]);

  const removeTransition = useCallback((fromSceneId: string, toSceneId: string) => {
    if (!timeline) return;

    contextSetTimeline({
      ...timeline,
      transitions: timeline.transitions.filter(
        t => !(t.fromSceneId === fromSceneId && t.toSceneId === toSceneId)
      ),
    });
  }, [timeline, contextSetTimeline]);

  // =============================================
  // 오디오 트랙
  // =============================================

  const addAudioTrack = useCallback((track: AudioTrack) => {
    if (!timeline) return;

    contextSetTimeline({
      ...timeline,
      audioTracks: [...timeline.audioTracks, track],
    });
  }, [timeline, contextSetTimeline]);

  const updateAudioTrack = useCallback((trackId: string, updates: Partial<AudioTrack>) => {
    if (!timeline) return;

    contextSetTimeline({
      ...timeline,
      audioTracks: timeline.audioTracks.map(t =>
        t.id === trackId ? { ...t, ...updates } : t
      ),
    });
  }, [timeline, contextSetTimeline]);

  const removeAudioTrack = useCallback((trackId: string) => {
    if (!timeline) return;

    contextSetTimeline({
      ...timeline,
      audioTracks: timeline.audioTracks.filter(t => t.id !== trackId),
    });
  }, [timeline, contextSetTimeline]);

  // =============================================
  // 애니메이션
  // =============================================

  const setSceneAnimation = useCallback((sceneId: string, animation: AnimationConfig) => {
    contextUpdateScene(sceneId, { animation });
  }, [contextUpdateScene]);

  // =============================================
  // 영상 클립 생성 (AI)
  // =============================================

  const generateVideoClip = useCallback(async (
    sceneId: string,
    sourceScene: Scene
  ): Promise<VideoClip> => {
    setGeneratingClipSceneId(sceneId);
    setError(null);

    try {
      // TODO: AI 영상 생성 API 연동 (Veo, Runway, Pika 등)
      // 현재는 placeholder

      // 시뮬레이션: 5-7초 클립 생성
      await new Promise(resolve => setTimeout(resolve, 2000));

      const clip: VideoClip = {
        id: crypto.randomUUID(),
        sceneId,
        duration: 5 + Math.random() * 2, // 5-7초
        createdAt: Date.now(),
        status: 'complete',
        // videoData와 thumbnail은 실제 API 연동 시 채워짐
      };

      // 타임라인 씬 업데이트
      if (timeline) {
        const timelineScene = timeline.scenes.find(s => s.sceneId === sceneId);
        if (timelineScene) {
          contextUpdateScene(timelineScene.id, { videoClip: clip });
        }
      }

      return clip;
    } catch (e) {
      const message = e instanceof Error ? e.message : '영상 클립 생성에 실패했습니다.';
      setError(message);
      throw e;
    } finally {
      setGeneratingClipSceneId(null);
    }
  }, [timeline, contextUpdateScene]);

  const generateAllVideoClips = useCallback(async (scenes: Scene[]): Promise<void> => {
    setIsGeneratingAllClips(true);
    setError(null);

    for (const scene of scenes) {
      try {
        await generateVideoClip(scene.id, scene);
      } catch (e) {
        console.error(`Failed to generate clip for scene ${scene.sceneNumber}:`, e);
        // 다른 씬은 계속 진행
      }
    }

    setIsGeneratingAllClips(false);
  }, [generateVideoClip]);

  // =============================================
  // 재생 컨트롤
  // =============================================

  const play = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const seek = useCallback((time: number) => {
    const maxTime = timeline?.totalDuration || 0;
    setCurrentTime(Math.max(0, Math.min(time, maxTime)));
  }, [timeline]);

  // =============================================
  // 내보내기
  // =============================================

  const exportVideo = useCallback(async (config: ExportConfig): Promise<Blob> => {
    // TODO: Canvas API + MediaRecorder 또는 FFmpeg.wasm으로 구현
    // 현재는 placeholder

    setError(null);

    try {
      // 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Placeholder blob
      return new Blob(['video data'], { type: `video/${config.format}` });
    } catch (e) {
      const message = e instanceof Error ? e.message : '영상 내보내기에 실패했습니다.';
      setError(message);
      throw e;
    }
  }, []);

  // =============================================
  // 유틸리티
  // =============================================

  const getTotalDuration = useCallback((): number => {
    return timeline?.totalDuration || 0;
  }, [timeline]);

  const getSceneAtTime = useCallback((time: number): TimelineScene | null => {
    if (!timeline) return null;

    for (const scene of timeline.scenes) {
      if (time >= scene.startTime && time < scene.startTime + scene.duration) {
        return scene;
      }
    }

    return null;
  }, [timeline]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // 상태
    timeline,
    currentTime,
    isPlaying,
    generatingClipSceneId,
    isGeneratingAllClips,
    error,

    // 타임라인 관리
    createTimeline,
    setTimeline,

    // 타임라인 씬 관리
    addSceneToTimeline,
    updateTimelineScene,
    removeFromTimeline,
    reorderTimelineScenes,

    // 전환 효과
    setTransition,
    removeTransition,

    // 오디오 트랙
    addAudioTrack,
    updateAudioTrack,
    removeAudioTrack,

    // 애니메이션
    setSceneAnimation,

    // 영상 클립 생성
    generateVideoClip,
    generateAllVideoClips,

    // 재생 컨트롤
    play,
    pause,
    seek,
    setCurrentTime,

    // 내보내기
    exportVideo,

    // 유틸리티
    getTotalDuration,
    getSceneAtTime,
    clearError,
  };
}

export default useVideo;
