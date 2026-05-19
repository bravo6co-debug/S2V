import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useVideo } from '../../hooks/useVideo';
import { VideoClip, Scene, NarrationAudio } from '../../types';
import { checkVideoApiAvailability } from '../../services/apiClient';
import { generateNarration, type TTSVoice } from '../../services/apiClient';
import { RemotionPlayer } from './RemotionPlayer';
import { VideoExportModal, type ExportConfig, type PartExportState } from './VideoExportModal';
import {
  renderVideo,
  downloadVideo,
  needsPartSplit,
  splitScenesIntoParts,
} from '../../services/videoService';
import {
  SparklesIcon,
  ClearIcon,
  LayersIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  DownloadIcon,
  FilmIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '../Icons';

// 분리된 컴포넌트 import
import { ClipCard } from './ClipCard';
import { Timeline } from './Timeline';
import { VideoPlayerModal } from './VideoPlayerModal';
import { SceneImportModal } from './SceneImportModal';

// 비디오 소스 타입 (어떤 시나리오를 사용하는지)
type VideoSource = 'scenario' | 'ad' | 'clip';

// 비디오 생성 모드 — Remotion(무료/자체 합성) 또는 AI 영상(HappyHorse/Seedance via EachLabs)
type VideoMode = 'remotion' | 'ai-video';

// AI 영상 API 상태 타입 (EachLabs 키 기반)
type VideoApiStatus = 'unknown' | 'checking' | 'available' | 'unavailable';

// API 상태 아이콘
const ApiStatusIcon: React.FC<{ status: VideoApiStatus; error?: string }> = ({ status, error }) => {
  const statusConfig = {
    unknown: { color: 'text-gray-400', bg: 'bg-gray-600', label: 'API 상태 확인 안됨' },
    checking: { color: 'text-blue-400', bg: 'bg-blue-600', label: 'API 확인 중...' },
    available: { color: 'text-green-400', bg: 'bg-green-600', label: 'AI 영상 API 사용 가능' },
    unavailable: { color: 'text-red-400', bg: 'bg-red-600', label: error || 'AI 영상 API 사용 불가' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2" title={config.label}>
      <div className={`w-2 h-2 rounded-full ${config.bg} ${status === 'checking' ? 'animate-pulse' : ''}`} />
      <span className={`text-xs ${config.color}`}>{config.label}</span>
    </div>
  );
};

// 메인 VideoTab 컴포넌트
export const VideoTab: React.FC = () => {
  const { characters, activeCharacterIds, updateScene, updateAdScene, updateClipScene, aspectRatio, scenario, adScenario, clipScenario } = useProject();

  // 비디오 소스 자동 결정 (어떤 시나리오를 사용하는지)
  const [videoSource, setVideoSource] = useState<VideoSource>(() => {
    const clipHasImages = clipScenario?.scenes.some(s => s.generatedImage || s.customImage);
    const adHasImages = adScenario?.scenes.some(s => s.generatedImage || s.customImage);
    const stdHasImages = scenario?.scenes.some(s => s.generatedImage || s.customImage);
    if (clipHasImages && !adHasImages && !stdHasImages) return 'clip';
    if (adHasImages && !stdHasImages) return 'ad';
    return 'scenario';
  });

  // 활성 시나리오 (videoSource에 따라 선택)
  const activeScenario = videoSource === 'clip' ? clipScenario : videoSource === 'ad' ? adScenario : scenario;
  const activeUpdateScene = videoSource === 'clip' ? updateClipScene : videoSource === 'ad' ? updateAdScene : updateScene;

  // 소스 변경 시 previewAudios 초기화 필요
  const prevSourceRef = useRef(videoSource);

  const {
    timeline,
    isGenerating,
    generatingClipId,
    isPlaying,
    isPaused,
    currentTime,
    error,
    createTimeline,
    addClipFromScene,
    addClipsFromScenes,
    removeClip,
    reorderClip,
    generateClipVideo,
    generateAllClipVideos,
    play,
    pause,
    stop,
    seek,
    clearError,
  } = useVideo();

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [playingVideoClip, setPlayingVideoClip] = useState<VideoClip | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // 비디오 생성 모드 (Remotion 또는 AI 영상 — HappyHorse/Seedance)
  const [videoMode, setVideoMode] = useState<VideoMode>('remotion');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  // 멀티파트 내보내기 상태 (2분 이상 영상)
  const [partStates, setPartStates] = useState<PartExportState[]>([]);
  const [isExportingPart, setIsExportingPart] = useState(false);
  const partBlobsRef = useRef<Map<number, Blob>>(new Map());

  // TTS 나레이션 상태
  const [ttsVoice, setTtsVoice] = useState<TTSVoice>('Kore');

  // 나레이션 미리듣기 상태
  const [previewingSceneId, setPreviewingSceneId] = useState<string | null>(null);
  const [previewAudios, setPreviewAudios] = useState<Map<string, NarrationAudio>>(new Map());
  const [generatingPreviewSceneId, setGeneratingPreviewSceneId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 소스 변경 시 previewAudios 초기화 + 모드 강제
  useEffect(() => {
    if (prevSourceRef.current !== videoSource) {
      setPreviewAudios(new Map());
      prevSourceRef.current = videoSource;
    }
    // 시나리오 소스일 때는 Remotion만 사용 (AI 영상 모델의 클립 길이가 맞지 않음)
    if (videoSource === 'scenario') {
      setVideoMode('remotion');
    }
    // 클립 소스일 때는 AI 영상만 사용 (씬당 15초)
    if (videoSource === 'clip') {
      setVideoMode('ai-video');
    }
  }, [videoSource]);

  // 파트 분할 필요 여부 확인
  const requiresPartSplit = useMemo(() => {
    if (!activeScenario) return false;
    return needsPartSplit(activeScenario.scenes);
  }, [activeScenario]);

  // 파트 정보 계산
  const { parts: sceneParts } = useMemo(() => {
    if (!activeScenario) return { parts: [], ranges: [] };
    return splitScenesIntoParts(activeScenario.scenes);
  }, [activeScenario]);

  // 모달 열 때 파트 상태 초기화
  useEffect(() => {
    if (isExportModalOpen && requiresPartSplit && sceneParts.length > 0) {
      setPartStates(sceneParts.map(() => ({ status: 'idle', progress: 0 })));
      partBlobsRef.current.clear();
    }
  }, [isExportModalOpen, requiresPartSplit, sceneParts.length]);

  // Remotion 비디오 내보내기 (단일 또는 파트별)
  const handleRemotionExport = useCallback(async (config: ExportConfig, partIndex?: number) => {
    if (!activeScenario) return;

    // previewAudios 병합 함수
    const mergeAudioToScenes = (scenes: Scene[]) =>
      scenes.map(scene => {
        const previewAudio = previewAudios.get(scene.id);
        if (!scene.narrationAudio && previewAudio) {
          return { ...scene, narrationAudio: previewAudio };
        }
        return scene;
      });

    // 파트별 내보내기 (2분 이상)
    if (partIndex !== undefined && requiresPartSplit) {
      const partScenes = sceneParts[partIndex];
      if (!partScenes || partScenes.length === 0) return;

      setIsExportingPart(true);
      setPartStates(prev => {
        const updated = [...prev];
        updated[partIndex] = { status: 'rendering', progress: 0 };
        return updated;
      });

      try {
        const scenesWithAudio = mergeAudioToScenes(partScenes);
        const result = await renderVideo(scenesWithAudio, config, (progress) => {
          setPartStates(prev => {
            const updated = [...prev];
            updated[partIndex] = { ...updated[partIndex], progress: progress.progress };
            return updated;
          });
        });

        if (result.success && result.videoBlob) {
          partBlobsRef.current.set(partIndex, result.videoBlob);
          setPartStates(prev => {
            const updated = [...prev];
            updated[partIndex] = { status: 'complete', progress: 100, videoBlob: result.videoBlob };
            return updated;
          });
        } else {
          throw new Error(result.error || '렌더링 실패');
        }
      } catch (err) {
        console.error(`Part ${partIndex + 1} export error:`, err);
        setPartStates(prev => {
          const updated = [...prev];
          updated[partIndex] = {
            status: 'error',
            progress: 0,
            error: err instanceof Error ? err.message : '렌더링 실패',
          };
          return updated;
        });
      } finally {
        setIsExportingPart(false);
      }
      return;
    }

    // 단일 내보내기 (2분 미만)
    setIsRendering(true);
    setRenderProgress(0);

    try {
      const scenesWithAudio = mergeAudioToScenes(activeScenario.scenes);
      const result = await renderVideo(scenesWithAudio, config, (progress) => {
        setRenderProgress(progress.progress);
      });

      if (result.success && result.videoBlob) {
        const filename = `${activeScenario.title || 'video'}_${Date.now()}.${config.format}`;
        downloadVideo(result.videoBlob, filename);
      } else {
        throw new Error(result.error || '렌더링 실패');
      }
    } catch (err) {
      console.error('Export error:', err);
      throw err;
    } finally {
      setIsRendering(false);
      setRenderProgress(0);
    }
  }, [activeScenario, previewAudios, requiresPartSplit, sceneParts]);

  // 파트 다운로드
  const handleDownloadPart = useCallback((partIndex: number) => {
    const blob = partBlobsRef.current.get(partIndex);
    if (blob && activeScenario) {
      const filename = `${activeScenario.title || 'video'}_파트${partIndex + 1}_${Date.now()}.webm`;
      downloadVideo(blob, filename);
    }
  }, [activeScenario]);

  // 씬의 TTS 상태 확인
  const getTTSStatus = useCallback(() => {
    if (!activeScenario) return { generated: 0, total: 0 };
    const scenesWithNarration = activeScenario.scenes.filter(s => s.narration?.trim());
    const scenesWithAudio = scenesWithNarration.filter(s => s.narrationAudio);
    return { generated: scenesWithAudio.length, total: scenesWithNarration.length };
  }, [activeScenario]);

  // 미리보기용 씬 데이터 (previewAudios 병합)
  const scenesForPreview = useMemo(() => {
    if (!activeScenario?.scenes) return [];
    return activeScenario.scenes.map(scene => {
      const previewAudio = previewAudios.get(scene.id);
      if (!scene.narrationAudio && previewAudio) {
        return { ...scene, narrationAudio: previewAudio };
      }
      return scene;
    });
  }, [activeScenario?.scenes, previewAudios]);

  // 나레이션 미리듣기 생성
  const handleGeneratePreview = useCallback(async (sceneId: string, narrationText: string) => {
    if (!narrationText?.trim()) return;

    setGeneratingPreviewSceneId(sceneId);
    try {
      const audio = await generateNarration(narrationText, ttsVoice, sceneId);
      setPreviewAudios(prev => new Map(prev).set(sceneId, audio));
    } catch (err) {
      console.error(`Preview generation failed for scene ${sceneId}:`, err);
      alert('미리듣기 생성에 실패했습니다.');
    } finally {
      setGeneratingPreviewSceneId(null);
    }
  }, [ttsVoice]);

  // 미리듣기 재생/정지
  const handlePlayPreview = useCallback((sceneId: string) => {
    const audio = previewAudios.get(sceneId);
    if (!audio?.data) return;

    // 다른 오디오가 재생 중이면 정지
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (previewingSceneId === sceneId) {
      // 같은 씬이면 정지
      setPreviewingSceneId(null);
      return;
    }

    // 새 오디오 재생
    const audioUrl = `data:${audio.mimeType || 'audio/wav'};base64,${audio.data}`;
    const audioElement = new Audio(audioUrl);
    audioRef.current = audioElement;

    audioElement.onended = () => {
      setPreviewingSceneId(null);
      audioRef.current = null;
    };

    audioElement.play();
    setPreviewingSceneId(sceneId);
  }, [previewAudios, previewingSceneId]);

  // 미리듣기 오디오를 비디오에 적용
  const handleApplyPreview = useCallback((sceneId: string) => {
    const audio = previewAudios.get(sceneId);
    if (!audio) return;

    activeUpdateScene(sceneId, { narrationAudio: audio });

    // 적용 후 미리듣기에서 제거
    setPreviewAudios(prev => {
      const newMap = new Map(prev);
      newMap.delete(sceneId);
      return newMap;
    });

    // 재생 중이면 정지
    if (previewingSceneId === sceneId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPreviewingSceneId(null);
    }
  }, [previewAudios, previewingSceneId, activeUpdateScene]);

  // 컴포넌트 언마운트 시 오디오 정리
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // 비디오 다운로드 함수
  const downloadClipVideo = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('비디오 다운로드에 실패했습니다.');
    }
  };

  // 전체 비디오 다운로드 (개별 파일로)
  const handleDownloadAll = async () => {
    const completedClipsList = clips.filter(c => c.generatedVideo?.url);
    if (completedClipsList.length === 0) return;

    setIsDownloading(true);
    try {
      for (let i = 0; i < completedClipsList.length; i++) {
        const clip = completedClipsList[i];
        if (clip.generatedVideo?.url) {
          await downloadClipVideo(clip.generatedVideo.url, `clip_${clip.order + 1}.mp4`);
          // 다운로드 간 간격
          if (i < completedClipsList.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    } finally {
      setIsDownloading(false);
    }
  };

  // AI 영상 API 상태 (EachLabs 키 기반)
  const [videoApiStatus, setVideoApiStatus] = useState<VideoApiStatus>('unknown');
  const [videoApiError, setVideoApiError] = useState<string | undefined>();

  // AI 영상 API 상태 체크
  const checkApiStatus = async () => {
    setVideoApiStatus('checking');
    setVideoApiError(undefined);

    const result = await checkVideoApiAvailability();

    if (result.available) {
      setVideoApiStatus('available');
    } else {
      setVideoApiStatus('unavailable');
      setVideoApiError(result.error);
    }
  };

  // 활성화된 캐릭터의 참조 이미지
  const referenceImages = activeCharacterIds
    .map(id => characters.find(c => c.id === id)?.image)
    .filter((img): img is NonNullable<typeof img> => img !== undefined);

  // 타임라인이 없을 때 자동 생성
  useEffect(() => {
    if (!timeline) {
      createTimeline('새 프로젝트');
    }
  }, [timeline, createTimeline]);

  const clips = timeline?.clips || [];
  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
  const completedClips = clips.filter(c => c.generatedVideo).length;

  const handleImportScenes = (sceneIds: string[]) => {
    if (activeScenario) {
      addClipsFromScenes(activeScenario.scenes.filter(s => sceneIds.includes(s.id)));
    }
  };

  const handleGenerateClip = async (clipId: string) => {
    await generateClipVideo(clipId, referenceImages);
  };

  const handleGenerateAllClips = async () => {
    await generateAllClipVideos(referenceImages);
  };

  const handleMoveClip = (clipId: string, direction: 'left' | 'right') => {
    const clip = clips.find(c => c.id === clipId);
    if (clip) {
      const newOrder = direction === 'left' ? clip.order - 1 : clip.order + 1;
      if (newOrder >= 0 && newOrder < clips.length) {
        reorderClip(clipId, newOrder);
      }
    }
  };

  const selectedClip = clips.find(c => c.id === selectedClipId);

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-2 sm:p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-bold text-white">영상 제작</h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1 truncate">
              {videoMode === 'remotion'
                ? `${activeScenario?.scenes.filter(s => s.generatedImage || s.customImage).length || 0}개 씬 · ${activeScenario?.scenes.reduce((acc, s) => acc + (s.generatedImage || s.customImage ? s.duration : 0), 0) || 0}초`
                : `${clips.length}개 클립 · ${totalDuration}초`}
            </p>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap justify-end">
            {videoMode === 'remotion' ? (
              <button
                onClick={() => setIsExportModalOpen(true)}
                disabled={!activeScenario || activeScenario.scenes.every(s => !s.generatedImage && !s.customImage)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 min-h-[44px]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">비디오 내보내기</span>
                <span className="sm:hidden">내보내기</span>
              </button>
            ) : (
              <>
                {activeScenario && activeScenario.scenes.some(s => s.generatedImage || s.customImage) && (
                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 min-h-[44px]"
                  >
                    <LayersIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">시나리오에서 가져오기</span>
                    <span className="sm:hidden">가져오기</span>
                  </button>
                )}
                <button
                  onClick={handleGenerateAllClips}
                  disabled={isGenerating || clips.length === 0 || clips.every(c => c.generatedVideo) || videoApiStatus === 'unavailable'}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 min-h-[44px]"
                >
                  <SparklesIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{isGenerating ? '생성 중...' : '전체 비디오 생성'}</span>
                  <span className="sm:hidden">{isGenerating ? '생성중' : '전체 생성'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 모드 토글 */}
        {videoSource === 'clip' ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">생성 방식:</span>
            <span className="text-xs text-cyan-400 font-medium">AI 영상 (HappyHorse / Seedance · 씬당 15초)</span>
          </div>
        ) : videoSource === 'ad' ? (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">생성 방식:</span>
            <div className="flex bg-gray-900 rounded-lg p-1">
              <button
                onClick={() => setVideoMode('remotion')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[44px] sm:min-h-0 ${
                  videoMode === 'remotion'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Remotion (무료)
              </button>
              <button
                onClick={() => setVideoMode('ai-video')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[44px] sm:min-h-0 ${
                  videoMode === 'ai-video'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                AI 영상
              </button>
            </div>
            {videoMode === 'remotion' && (
              <span className="text-xs text-green-400">99% 비용 절감</span>
            )}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">생성 방식:</span>
            <span className="text-xs text-green-400 font-medium">Remotion (무료)</span>
          </div>
        )}

        {/* 시나리오 소스 선택 (여러 시나리오가 존재할 때) */}
        {(scenario || adScenario || clipScenario) && [scenario, adScenario, clipScenario].filter(Boolean).length > 1 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">소스:</span>
            <div className="flex bg-gray-900 rounded-lg p-1">
              {scenario && (
                <button
                  onClick={() => setVideoSource('scenario')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[44px] sm:min-h-0 ${
                    videoSource === 'scenario'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  시나리오
                </button>
              )}
              {adScenario && (
                <button
                  onClick={() => setVideoSource('ad')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[44px] sm:min-h-0 ${
                    videoSource === 'ad'
                      ? 'bg-orange-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  광고
                </button>
              )}
              {clipScenario && (
                <button
                  onClick={() => setVideoSource('clip')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[44px] sm:min-h-0 ${
                    videoSource === 'clip'
                      ? 'bg-cyan-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  클립
                </button>
              )}
            </div>
            {videoSource === 'ad' && adScenario && (
              <span className="text-xs text-orange-400">{adScenario.productName}</span>
            )}
            {videoSource === 'clip' && clipScenario && (
              <span className="text-xs text-cyan-400">{clipScenario.totalDuration}초 · {clipScenario.scenes.length}씬</span>
            )}
          </div>
        )}

        {/* 단일 소스 표시 (소스 선택 버튼이 없는 경우) */}
        {[scenario, adScenario, clipScenario].filter(Boolean).length === 1 && (
          <>
            {videoSource === 'ad' && adScenario && (
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-600/20 text-orange-400 rounded">
                  광고 · {adScenario.productName}
                </span>
              </div>
            )}
            {videoSource === 'clip' && clipScenario && (
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-cyan-600/20 text-cyan-400 rounded">
                  클립 · {clipScenario.totalDuration}초 · {clipScenario.scenes.length}씬
                </span>
              </div>
            )}
          </>
        )}

        {/* AI 영상 API 상태 표시 (AI 영상 모드일 때) */}
        {(videoSource === 'clip' || (videoSource === 'ad' && videoMode === 'ai-video')) && (
          <div className="mt-3 flex items-center justify-between bg-gray-900/50 rounded-lg px-3 py-2 flex-wrap gap-2">
            <ApiStatusIcon status={videoApiStatus} error={videoApiError} />
            <button
              onClick={checkApiStatus}
              disabled={videoApiStatus === 'checking'}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 min-h-[44px] flex items-center"
            >
              {videoApiStatus === 'checking' ? '확인 중...' : 'API 상태 확인'}
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-3 p-2 sm:p-3 bg-red-900/50 border border-red-700 rounded-lg text-xs sm:text-sm text-red-300">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-xs sm:text-sm">오류 발생</span>
              <button onClick={clearError} className="text-red-400 hover:text-red-300 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <ClearIcon className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs">{error}</p>
            {videoApiStatus === 'unknown' && (
              <button
                onClick={checkApiStatus}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline min-h-[44px] flex items-center"
              >
                API 상태를 확인해 보세요
              </button>
            )}
          </div>
        )}

        {/* API 사용 불가 경고 */}
        {(videoSource === 'clip' || videoSource === 'ad') && videoApiStatus === 'unavailable' && !error && (
          <div className="mt-3 p-2 sm:p-3 bg-amber-900/50 border border-amber-700 rounded-lg text-xs sm:text-sm text-amber-300">
            <p className="font-medium mb-1 text-xs sm:text-sm">AI 영상 API 사용 불가</p>
            <p className="text-xs text-amber-400">{videoApiError}</p>
            <p className="text-xs text-gray-400 mt-2">
              설정에서 EachLabs API 키를 입력해 주세요.
              eachlabs.ai에서 API 키를 발급받을 수 있습니다.
            </p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col overflow-hidden p-2 sm:p-4 gap-3 sm:gap-4">
        {videoMode === 'remotion' ? (
          /* Remotion 모드 */
          <div className="flex-grow flex flex-col items-center justify-center overflow-y-auto">
            {activeScenario && activeScenario.scenes.some(s => s.generatedImage || s.customImage) ? (
              <div className="w-full max-w-sm sm:max-w-md mx-auto px-2 sm:px-0">
                <RemotionPlayer
                  scenes={scenesForPreview}
                  aspectRatio={aspectRatio}
                  transitionType="fade"
                  showSubtitles={true}
                  className="rounded-lg overflow-hidden shadow-2xl"
                />

                {/* TTS 나레이션 생성 섹션 */}
                <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-medium text-white">AI 나레이션</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {getTTSStatus().generated}/{getTTSStatus().total} 적용됨
                    </span>
                  </div>

                  {/* 음성 선택 */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-gray-400">음성:</span>
                    <select
                      value={ttsVoice}
                      onChange={(e) => setTtsVoice(e.target.value as TTSVoice)}
                      disabled={!!generatingPreviewSceneId}
                      className="flex-1 px-2 py-1.5 sm:py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white min-h-[44px] sm:min-h-0"
                    >
                      <option value="Kore">Kore (한국어 여성)</option>
                      <option value="Aoede">Aoede (여성)</option>
                      <option value="Charon">Charon (남성)</option>
                      <option value="Fenrir">Fenrir (남성, 깊은)</option>
                      <option value="Puck">Puck (중성)</option>
                    </select>
                  </div>

                  {/* 씬별 나레이션 리스트 */}
                  {getTTSStatus().total > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {activeScenario?.scenes.filter(s => s.narration?.trim()).map((scene) => {
                        const hasPreview = previewAudios.has(scene.id);
                        const hasApplied = !!scene.narrationAudio;
                        const isGenerating = generatingPreviewSceneId === scene.id;
                        const isPlaying = previewingSceneId === scene.id;

                        return (
                          <div
                            key={scene.id}
                            className="p-2 bg-gray-700/50 rounded-lg border border-gray-600"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-white">
                                씬 {scene.sceneNumber}
                              </span>
                              <div className="flex items-center gap-1">
                                {hasApplied && (
                                  <span className="text-xs text-green-400 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    적용됨
                                  </span>
                                )}
                                {hasPreview && !hasApplied && (
                                  <span className="text-xs text-yellow-400">미리듣기 가능</span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                              {scene.narration}
                            </p>
                            <div className="flex gap-1.5 flex-wrap">
                              {/* 미리듣기 생성 버튼 */}
                              <button
                                onClick={() => handleGeneratePreview(scene.id, scene.narration)}
                                disabled={isGenerating}
                                className="flex-1 px-2 py-1.5 sm:py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
                              >
                                {isGenerating ? (
                                  <span className="flex items-center justify-center gap-1">
                                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    생성 중
                                  </span>
                                ) : hasPreview || hasApplied ? '다시 생성' : '미리듣기 생성'}
                              </button>

                              {/* 재생/정지 버튼 (미리듣기가 있을 때만) */}
                              {hasPreview && (
                                <button
                                  onClick={() => handlePlayPreview(scene.id)}
                                  className={`px-2 py-1.5 sm:py-1 text-xs font-medium rounded min-h-[44px] sm:min-h-0 ${
                                    isPlaying
                                      ? 'text-white bg-red-600 hover:bg-red-500'
                                      : 'text-white bg-blue-600 hover:bg-blue-500'
                                  }`}
                                >
                                  {isPlaying ? '정지' : '재생'}
                                </button>
                              )}

                              {/* 비디오에 적용 버튼 (미리듣기가 있을 때만) */}
                              {hasPreview && (
                                <button
                                  onClick={() => handleApplyPreview(scene.id)}
                                  className="px-2 py-1.5 sm:py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded min-h-[44px] sm:min-h-0"
                                >
                                  적용
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-2">
                      나레이션 텍스트가 있는 씬이 없습니다
                    </p>
                  )}
                </div>

                <div className="mt-3 sm:mt-4 text-center">
                  <p className="text-xs sm:text-sm text-gray-400 mb-3">
                    시나리오의 이미지를 기반으로 비디오를 미리볼 수 있습니다
                  </p>
                  {/* 나레이션 누락 경고 */}
                  {getTTSStatus().total > 0 && getTTSStatus().generated < getTTSStatus().total && (
                    <div className="mb-3 p-2 bg-amber-900/40 border border-amber-700/50 rounded-lg text-xs text-amber-400">
                      나레이션이 {getTTSStatus().total - getTTSStatus().generated}개 씬에 적용되지 않았습니다.
                      내보내기 전에 모든 씬의 나레이션을 생성해 주세요.
                    </div>
                  )}
                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="px-5 sm:px-6 py-3 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg hover:from-green-500 hover:to-emerald-500 min-h-[44px]"
                  >
                    <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    비디오 내보내기
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center max-w-md px-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center">
                  <FilmIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mb-2">시나리오 이미지 필요</h3>
                <p className="text-gray-400 text-xs sm:text-sm mb-4">
                  먼저 시나리오 탭에서 씬별 이미지를 생성하세요.<br />
                  Remotion은 생성된 이미지를 영상으로 변환합니다.
                </p>

                {/* TTS 나레이션 섹션 - 이미지 없이도 사용 가능 */}
                {activeScenario && getTTSStatus().total > 0 && (
                  <div className="mt-5 sm:mt-6 p-3 sm:p-4 bg-gray-800/50 rounded-lg border border-gray-700 text-left">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-medium text-white">AI 나레이션</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {getTTSStatus().generated}/{getTTSStatus().total} 적용됨
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-gray-400">음성:</span>
                      <select
                        value={ttsVoice}
                        onChange={(e) => setTtsVoice(e.target.value as TTSVoice)}
                        disabled={!!generatingPreviewSceneId}
                        className="flex-1 px-2 py-1.5 sm:py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white min-h-[44px] sm:min-h-0"
                      >
                        <option value="Kore">Kore (한국어 여성)</option>
                        <option value="Aoede">Aoede (여성)</option>
                        <option value="Charon">Charon (남성)</option>
                        <option value="Fenrir">Fenrir (남성, 깊은)</option>
                        <option value="Puck">Puck (중성)</option>
                      </select>
                    </div>

                    {/* 씬별 나레이션 리스트 */}
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {activeScenario.scenes.filter(s => s.narration?.trim()).map((scene) => {
                        const hasPreview = previewAudios.has(scene.id);
                        const hasApplied = !!scene.narrationAudio;
                        const isGenerating = generatingPreviewSceneId === scene.id;
                        const isPlaying = previewingSceneId === scene.id;

                        return (
                          <div
                            key={scene.id}
                            className="p-2 bg-gray-700/50 rounded-lg border border-gray-600"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-white">씬 {scene.sceneNumber}</span>
                              {hasApplied && (
                                <span className="text-xs text-green-400">적용됨</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mb-2 line-clamp-1">{scene.narration}</p>
                            <div className="flex gap-1.5 flex-wrap">
                              <button
                                onClick={() => handleGeneratePreview(scene.id, scene.narration)}
                                disabled={isGenerating}
                                className="flex-1 px-2 py-1.5 sm:py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded disabled:opacity-50 min-h-[44px] sm:min-h-0"
                              >
                                {isGenerating ? '생성 중...' : hasPreview || hasApplied ? '다시 생성' : '미리듣기'}
                              </button>
                              {hasPreview && (
                                <>
                                  <button
                                    onClick={() => handlePlayPreview(scene.id)}
                                    className={`px-2 py-1.5 sm:py-1 text-xs font-medium rounded min-h-[44px] sm:min-h-0 ${
                                      isPlaying ? 'bg-red-600' : 'bg-blue-600'
                                    } text-white`}
                                  >
                                    {isPlaying ? '정지' : '재생'}
                                  </button>
                                  <button
                                    onClick={() => handleApplyPreview(scene.id)}
                                    className="px-2 py-1.5 sm:py-1 text-xs font-medium text-white bg-green-600 rounded min-h-[44px] sm:min-h-0"
                                  >
                                    적용
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 text-center">
                      이미지 없이도 나레이션 음성을 미리 생성할 수 있습니다
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : clips.length === 0 ? (
          /* AI 영상 모드 - 클립이 없을 때 */
          <div className="flex-grow flex flex-col items-center justify-center">
            <div className="text-center max-w-md px-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center">
                <FilmIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-2">클립을 추가하세요</h3>
              <p className="text-gray-400 text-xs sm:text-sm mb-6">
                시나리오에서 이미지가 있는 씬을 가져와 AI 영상 클립을 생성합니다.
              </p>
              {activeScenario && activeScenario.scenes.some(s => s.generatedImage || s.customImage) ? (
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-5 sm:px-6 py-3 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-500 hover:to-indigo-500 min-h-[44px]"
                >
                  <LayersIcon className="w-4 h-4 inline mr-2" />
                  시나리오에서 가져오기
                </button>
              ) : (
                <p className="text-amber-400 text-xs sm:text-sm">
                  먼저 시나리오 탭에서 이미지를 생성하세요
                </p>
              )}
            </div>
          </div>
        ) : (
          /* AI 영상 모드 - 클립이 있을 때 */
          <>
            {/* 클립 그리드 */}
            <div className="flex-grow overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                {clips.map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    isSelected={selectedClipId === clip.id}
                    isPlaying={isPlaying && !isPaused && selectedClipId === clip.id}
                    onSelect={() => setSelectedClipId(clip.id)}
                    onRegenerate={() => handleGenerateClip(clip.id)}
                    onDelete={() => removeClip(clip.id)}
                    isGenerating={generatingClipId === clip.id}
                    onPlayVideo={() => clip.generatedVideo?.url && setPlayingVideoClip(clip)}
                    onDownload={clip.generatedVideo?.url ? () => downloadClipVideo(clip.generatedVideo!.url, `clip_${clip.order + 1}.mp4`) : undefined}
                  />
                ))}
              </div>
            </div>

            {/* 선택된 클립 상세 정보 */}
            {selectedClip && (
              <div className="flex-shrink-0 bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm sm:text-base font-bold text-white">클립 #{selectedClip.order + 1} 상세</h4>
                  <div className="flex gap-1 sm:gap-2">
                    <button
                      onClick={() => handleMoveClip(selectedClip.id, 'left')}
                      disabled={selectedClip.order === 0}
                      className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="왼쪽으로 이동"
                    >
                      <ArrowLeftIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveClip(selectedClip.id, 'right')}
                      disabled={selectedClip.order === clips.length - 1}
                      className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="오른쪽으로 이동"
                    >
                      <ArrowRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-500 mb-1">모션 프롬프트</p>
                    <p className="text-xs sm:text-sm text-gray-300">{selectedClip.motionPrompt || '없음'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-500 mb-1">길이</p>
                    <p className="text-xs sm:text-sm text-gray-300">{selectedClip.duration}초</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-500 mb-1">상태</p>
                    <p className={`text-xs sm:text-sm ${selectedClip.generatedVideo ? 'text-green-400' : 'text-amber-400'}`}>
                      {selectedClip.generatedVideo ? '비디오 생성 완료' : '대기 중'}
                    </p>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => handleGenerateClip(selectedClip.id)}
                      disabled={isGenerating || !selectedClip.sourceImage || videoApiStatus === 'unavailable'}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 min-h-[44px]"
                      title={videoApiStatus === 'unavailable' ? 'AI 영상 API 사용 불가' : ''}
                    >
                      {selectedClip.generatedVideo ? '재생성' : '비디오 생성'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 타임라인 */}
            <Timeline
              clips={clips}
              currentTime={currentTime}
              totalDuration={totalDuration}
              onSeek={seek}
              selectedClipId={selectedClipId}
              onSelectClip={setSelectedClipId}
            />

            {/* 재생 컨트롤 */}
            <div className="flex-shrink-0 flex items-center justify-center gap-3 sm:gap-4 py-2">
              <button
                onClick={stop}
                disabled={!isPlaying}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="정지"
              >
                <StopIcon className="w-6 h-6" />
              </button>
              <button
                onClick={isPlaying && !isPaused ? pause : play}
                disabled={completedClips === 0}
                className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50 min-h-[48px] min-w-[48px] flex items-center justify-center"
                title={isPlaying && !isPaused ? '일시정지' : '재생'}
              >
                {isPlaying && !isPaused ? (
                  <PauseIcon className="w-6 h-6" />
                ) : (
                  <PlayIcon className="w-6 h-6" />
                )}
              </button>
              <button
                onClick={handleDownloadAll}
                disabled={completedClips === 0 || isDownloading}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title={isDownloading ? '다운로드 중...' : '전체 비디오 다운로드'}
              >
                {isDownloading ? (
                  <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <DownloadIcon className="w-6 h-6" />
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Scene Import Modal */}
      {activeScenario && (
        <SceneImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          scenes={activeScenario.scenes}
          onImport={handleImportScenes}
        />
      )}

      {/* Video Player Modal */}
      {playingVideoClip && playingVideoClip.generatedVideo?.url && (
        <VideoPlayerModal
          isOpen={true}
          onClose={() => setPlayingVideoClip(null)}
          videoUrl={playingVideoClip.generatedVideo.url}
          clipNumber={playingVideoClip.order + 1}
        />
      )}

      {/* Remotion Export Modal */}
      {activeScenario && (
        <VideoExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          scenes={activeScenario.scenes}
          onExport={handleRemotionExport}
          partStates={partStates}
          isExportingPart={isExportingPart}
          onDownloadPart={handleDownloadPart}
        />
      )}
    </div>
  );
};

export default VideoTab;
