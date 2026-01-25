import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useVideo } from '../../hooks/useVideo';
import { useScenario } from '../../hooks/useScenario';
import { VideoClip, Scene, NarrationAudio } from '../../types';
import { checkVeoApiAvailability } from '../../services/geminiService';
import { generateNarration, type TTSVoice } from '../../services/apiClient';
import { RemotionPlayer } from './RemotionPlayer';
import { VideoExportModal, type ExportConfig } from './VideoExportModal';
import { renderVideo, downloadVideo } from '../../services/videoService';
import {
  SparklesIcon,
  TrashIcon,
  PlusCircleIcon,
  ClearIcon,
  LayersIcon,
} from '../Icons';

// 비디오 생성 모드
type VideoMode = 'remotion' | 'veo';

// Veo API 상태 타입
type VeoApiStatus = 'unknown' | 'checking' | 'available' | 'unavailable';

// API 상태 아이콘
const ApiStatusIcon: React.FC<{ status: VeoApiStatus; error?: string }> = ({ status, error }) => {
  const statusConfig = {
    unknown: { color: 'text-gray-400', bg: 'bg-gray-600', label: 'API 상태 확인 안됨' },
    checking: { color: 'text-blue-400', bg: 'bg-blue-600', label: 'API 확인 중...' },
    available: { color: 'text-green-400', bg: 'bg-green-600', label: 'Veo API 사용 가능' },
    unavailable: { color: 'text-red-400', bg: 'bg-red-600', label: error || 'Veo API 사용 불가' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2" title={config.label}>
      <div className={`w-2 h-2 rounded-full ${config.bg} ${status === 'checking' ? 'animate-pulse' : ''}`} />
      <span className={`text-xs ${config.color}`}>{config.label}</span>
    </div>
  );
};

// Icons
const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PauseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
  </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const FilmIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
  </svg>
);

const ArrowLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const ArrowRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// 클립 카드 컴포넌트
interface ClipCardProps {
  clip: VideoClip;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  isGenerating: boolean;
  onPlayVideo?: () => void;
  onDownload?: () => void;
}

const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  isSelected,
  isPlaying,
  onSelect,
  onRegenerate,
  onDelete,
  isGenerating,
  onPlayVideo,
  onDownload,
}) => {
  const thumbnailUrl = clip.generatedVideo?.thumbnailUrl || (clip.sourceImage ? `data:${clip.sourceImage.mimeType};base64,${clip.sourceImage.data}` : null);
  const hasVideo = clip.generatedVideo?.url;

  return (
    <div
      className={`relative group bg-gray-800 rounded-lg border-2 transition-all duration-200 cursor-pointer overflow-hidden
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-700 hover:border-gray-600'}
        ${isPlaying ? 'ring-2 ring-green-500/50' : ''}
      `}
      onClick={onSelect}
    >
      {/* 썸네일 / 비디오 프리뷰 */}
      <div className="relative aspect-video bg-gray-900">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`Clip ${clip.order + 1}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FilmIcon className="w-8 h-8 text-gray-600" />
          </div>
        )}

        {/* 비디오 재생 버튼 (비디오가 있을 때만) */}
        {hasVideo && !isGenerating && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayVideo?.();
            }}
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
              <PlayIcon className="w-6 h-6 text-gray-900 ml-1" />
            </div>
          </button>
        )}

        {/* 상태 오버레이 */}
        {isGenerating && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 mx-auto text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-xs text-white mt-2">생성 중...</p>
            </div>
          </div>
        )}

        {/* 비디오 생성 상태 */}
        {clip.generatedVideo ? (
          <div className="absolute top-2 right-2 px-2 py-1 bg-green-600/80 rounded text-xs text-white font-medium">
            완료
          </div>
        ) : clip.sourceImage ? (
          <div className="absolute top-2 right-2 px-2 py-1 bg-amber-600/80 rounded text-xs text-white font-medium">
            대기
          </div>
        ) : (
          <div className="absolute top-2 right-2 px-2 py-1 bg-gray-600/80 rounded text-xs text-white font-medium">
            이미지 없음
          </div>
        )}

        {/* 클립 번호 */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-gray-900/80 rounded text-xs text-white font-bold">
          #{clip.order + 1}
        </div>

        {/* 길이 */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-gray-900/80 rounded text-xs text-white">
          {clip.duration}초
        </div>

        {/* 호버 액션 */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {hasVideo && onDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              className="p-2 bg-green-600 rounded-full text-white hover:bg-green-700"
              title="비디오 다운로드"
            >
              <DownloadIcon className="w-5 h-5" />
            </button>
          )}
          {clip.sourceImage && !isGenerating && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
              className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-700"
              title="비디오 재생성"
            >
              <RefreshIcon className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 bg-red-600 rounded-full text-white hover:bg-red-700"
            title="삭제"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 클립 정보 */}
      <div className="p-2">
        <p className="text-xs text-gray-400 truncate">
          {clip.motionPrompt || '모션 프롬프트 없음'}
        </p>
      </div>
    </div>
  );
};

// 타임라인 컴포넌트
interface TimelineProps {
  clips: VideoClip[];
  currentTime: number;
  totalDuration: number;
  onSeek: (time: number) => void;
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
}

const Timeline: React.FC<TimelineProps> = ({
  clips,
  currentTime,
  totalDuration,
  onSeek,
  selectedClipId,
  onSelectClip,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (timelineRef.current && totalDuration > 0) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const seekTime = percentage * totalDuration;
      onSeek(Math.max(0, Math.min(seekTime, totalDuration)));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playheadPosition = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="text-white font-medium">{formatTime(currentTime)}</span>
        <span className="text-gray-500">/</span>
        <span className="text-gray-400">{formatTime(totalDuration)}</span>
      </div>

      {/* 타임라인 트랙 */}
      <div
        ref={timelineRef}
        className="relative h-16 bg-gray-800 rounded-lg cursor-pointer overflow-hidden"
        onClick={handleTimelineClick}
      >
        {/* 클립 블록들 */}
        <div className="absolute inset-0 flex">
          {clips.map((clip, index) => {
            const widthPercent = totalDuration > 0 ? (clip.duration / totalDuration) * 100 : 0;
            return (
              <div
                key={clip.id}
                style={{ width: `${widthPercent}%` }}
                className={`h-full flex items-center justify-center border-r border-gray-700 transition-all
                  ${selectedClipId === clip.id ? 'bg-blue-600/50' : clip.generatedVideo ? 'bg-green-800/50' : 'bg-gray-700/50'}
                  ${clip.generatedVideo ? 'cursor-pointer hover:bg-green-700/50' : ''}
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectClip(clip.id);
                }}
              >
                <span className="text-xs text-white/70 font-medium">#{index + 1}</span>
              </div>
            );
          })}
        </div>

        {/* 재생 헤드 */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
          style={{ left: `${playheadPosition}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500" />
        </div>
      </div>
    </div>
  );
};

// 비디오 재생 모달
interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  clipNumber: number;
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  clipNumber,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-4xl">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300"
        >
          <ClearIcon className="w-8 h-8" />
        </button>
        <div className="bg-gray-900 rounded-xl overflow-hidden">
          <div className="p-3 bg-gray-800 border-b border-gray-700">
            <h3 className="text-white font-medium">클립 #{clipNumber} 미리보기</h3>
          </div>
          <div className="aspect-video bg-black">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              className="w-full h-full"
            >
              브라우저가 비디오 재생을 지원하지 않습니다.
            </video>
          </div>
        </div>
      </div>
    </div>
  );
};

// 씬 선택 모달 (시나리오에서 가져오기)
interface SceneImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: Scene[];
  onImport: (sceneIds: string[]) => void;
}

const SceneImportModal: React.FC<SceneImportModalProps> = ({
  isOpen,
  onClose,
  scenes,
  onImport,
}) => {
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const scenesWithImages = scenes.filter(s => s.generatedImage || s.customImage);

  const toggleScene = (sceneId: string) => {
    setSelectedSceneIds(prev =>
      prev.includes(sceneId)
        ? prev.filter(id => id !== sceneId)
        : [...prev, sceneId]
    );
  };

  const handleImport = () => {
    onImport(selectedSceneIds);
    setSelectedSceneIds([]);
    onClose();
  };

  const selectAll = () => {
    setSelectedSceneIds(scenesWithImages.map(s => s.id));
  };

  const deselectAll = () => {
    setSelectedSceneIds([]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700">
          <h3 className="text-base sm:text-lg font-bold text-white">씬 가져오기</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <ClearIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="p-3 sm:p-4 border-b border-gray-700">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs sm:text-sm text-gray-400">
              {scenesWithImages.length}개 / 선택: {selectedSceneIds.length}개
            </p>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                전체 선택
              </button>
              <button
                onClick={deselectAll}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                해제
              </button>
            </div>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-2 sm:p-4">
          {scenesWithImages.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">
              이미지가 있는 씬이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
              {scenesWithImages.map((scene) => {
                const image = scene.customImage || scene.generatedImage;
                const isSelected = selectedSceneIds.includes(scene.id);
                return (
                  <div
                    key={scene.id}
                    onClick={() => toggleScene(scene.id)}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                      ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-700 hover:border-gray-600'}
                    `}
                  >
                    <div className="aspect-video bg-gray-900">
                      {image && (
                        <img
                          src={`data:${image.mimeType};base64,${image.data}`}
                          alt={`Scene ${scene.sceneNumber}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="absolute top-2 left-2 px-2 py-1 bg-gray-900/80 rounded text-xs text-white font-bold">
                      #{scene.sceneNumber}
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                    <div className="p-2 bg-gray-800">
                      <p className="text-xs text-gray-400 truncate">{scene.visualDescription}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500"
          >
            취소
          </button>
          <button
            onClick={handleImport}
            disabled={selectedSceneIds.length === 0}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedSceneIds.length}개 씬 가져오기
          </button>
        </div>
      </div>
    </div>
  );
};

// 메인 VideoTab 컴포넌트
export const VideoTab: React.FC = () => {
  const { characters, activeCharacterIds, updateScene, aspectRatio } = useProject();
  const { scenario } = useScenario();
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

  // 비디오 생성 모드 (Remotion 또는 Veo API)
  const [videoMode, setVideoMode] = useState<VideoMode>('remotion');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  // TTS 나레이션 상태
  const [ttsVoice, setTtsVoice] = useState<TTSVoice>('Kore');

  // 나레이션 미리듣기 상태
  const [previewingSceneId, setPreviewingSceneId] = useState<string | null>(null);
  const [previewAudios, setPreviewAudios] = useState<Map<string, NarrationAudio>>(new Map());
  const [generatingPreviewSceneId, setGeneratingPreviewSceneId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Remotion 비디오 내보내기
  const handleRemotionExport = useCallback(async (config: ExportConfig) => {
    if (!scenario) return;

    setIsRendering(true);
    setRenderProgress(0);

    try {
      // previewAudios에 있는 오디오를 씬에 병합
      const scenesWithAudio = scenario.scenes.map(scene => {
        // 이미 씬에 오디오가 있으면 그대로 사용, 없으면 previewAudios에서 가져옴
        const previewAudio = previewAudios.get(scene.id);
        if (!scene.narrationAudio && previewAudio) {
          return { ...scene, narrationAudio: previewAudio };
        }
        return scene;
      });

      const result = await renderVideo(
        scenesWithAudio,
        config,
        (progress) => {
          setRenderProgress(progress.progress);
        }
      );

      if (result.success && result.videoBlob) {
        const filename = `${scenario.title || 'video'}_${Date.now()}.${config.format}`;
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
  }, [scenario, previewAudios]);

  // 씬의 TTS 상태 확인
  const getTTSStatus = useCallback(() => {
    if (!scenario) return { generated: 0, total: 0 };
    const scenesWithNarration = scenario.scenes.filter(s => s.narration?.trim());
    const scenesWithAudio = scenesWithNarration.filter(s => s.narrationAudio);
    return { generated: scenesWithAudio.length, total: scenesWithNarration.length };
  }, [scenario]);

  // 미리보기용 씬 데이터 (previewAudios 병합)
  const scenesForPreview = useMemo(() => {
    if (!scenario?.scenes) return [];
    return scenario.scenes.map(scene => {
      const previewAudio = previewAudios.get(scene.id);
      if (!scene.narrationAudio && previewAudio) {
        return { ...scene, narrationAudio: previewAudio };
      }
      return scene;
    });
  }, [scenario?.scenes, previewAudios]);

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

    updateScene(sceneId, { narrationAudio: audio });

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
  }, [previewAudios, previewingSceneId, updateScene]);

  // 컴포넌트 언마운트 시 오디오 정리
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // 비디오 다운로드 함수 (Veo용)
  const downloadVeoVideo = async (url: string, filename: string) => {
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

  // 전체 비디오 다운로드 (개별 파일로 - Veo용)
  const handleDownloadAll = async () => {
    const completedClipsList = clips.filter(c => c.generatedVideo?.url);
    if (completedClipsList.length === 0) return;

    setIsDownloading(true);
    try {
      for (let i = 0; i < completedClipsList.length; i++) {
        const clip = completedClipsList[i];
        if (clip.generatedVideo?.url) {
          await downloadVeoVideo(clip.generatedVideo.url, `clip_${clip.order + 1}.mp4`);
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

  // Veo API 상태
  const [veoApiStatus, setVeoApiStatus] = useState<VeoApiStatus>('unknown');
  const [veoApiError, setVeoApiError] = useState<string | undefined>();

  // Veo API 상태 체크
  const checkApiStatus = async () => {
    setVeoApiStatus('checking');
    setVeoApiError(undefined);

    const result = await checkVeoApiAvailability();

    if (result.available) {
      setVeoApiStatus('available');
    } else {
      setVeoApiStatus('unavailable');
      setVeoApiError(result.error);
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
    if (scenario) {
      addClipsFromScenes(scenario.scenes.filter(s => sceneIds.includes(s.id)));
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
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-white">영상 제작</h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1 truncate">
              {videoMode === 'remotion'
                ? `${scenario?.scenes.filter(s => s.generatedImage || s.customImage).length || 0}개 씬 · ${scenario?.scenes.reduce((acc, s) => acc + (s.generatedImage || s.customImage ? s.duration : 0), 0) || 0}초`
                : `${clips.length}개 클립 · ${totalDuration}초`}
            </p>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
            {videoMode === 'remotion' ? (
              <button
                onClick={() => setIsExportModalOpen(true)}
                disabled={!scenario || scenario.scenes.every(s => !s.generatedImage && !s.customImage)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg hover:from-green-500 hover:to-emerald-500 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">비디오 내보내기</span>
                <span className="sm:hidden">내보내기</span>
              </button>
            ) : (
              <>
                {scenario && scenario.scenes.some(s => s.generatedImage || s.customImage) && (
                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
                  >
                    <LayersIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">시나리오에서 가져오기</span>
                    <span className="sm:hidden">가져오기</span>
                  </button>
                )}
                <button
                  onClick={handleGenerateAllClips}
                  disabled={isGenerating || clips.length === 0 || clips.every(c => c.generatedVideo) || veoApiStatus === 'unavailable'}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
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
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-500">생성 방식:</span>
          <div className="flex bg-gray-900 rounded-lg p-1">
            <button
              onClick={() => setVideoMode('remotion')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                videoMode === 'remotion'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Remotion (무료)
            </button>
            <button
              onClick={() => setVideoMode('veo')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                videoMode === 'veo'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Veo API (AI)
            </button>
          </div>
          {videoMode === 'remotion' && (
            <span className="text-xs text-green-400">99% 비용 절감</span>
          )}
        </div>

        {/* Veo API 상태 표시 (Veo 모드일 때만) */}
        {videoMode === 'veo' && (
          <div className="mt-3 flex items-center justify-between bg-gray-900/50 rounded-lg px-3 py-2">
            <ApiStatusIcon status={veoApiStatus} error={veoApiError} />
            <button
              onClick={checkApiStatus}
              disabled={veoApiStatus === 'checking'}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              {veoApiStatus === 'checking' ? '확인 중...' : 'API 상태 확인'}
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-3 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-300">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">오류 발생</span>
              <button onClick={clearError} className="text-red-400 hover:text-red-300">
                <ClearIcon className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs">{error}</p>
            {veoApiStatus === 'unknown' && (
              <button
                onClick={checkApiStatus}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
              >
                API 상태를 확인해 보세요
              </button>
            )}
          </div>
        )}

        {/* API 사용 불가 경고 */}
        {veoApiStatus === 'unavailable' && !error && (
          <div className="mt-3 p-3 bg-amber-900/50 border border-amber-700 rounded-lg text-sm text-amber-300">
            <p className="font-medium mb-1">Veo API 사용 불가</p>
            <p className="text-xs text-amber-400">{veoApiError}</p>
            <p className="text-xs text-gray-400 mt-2">
              현재 API 키로는 Veo 2.0 비디오 생성을 사용할 수 없습니다.
              Google AI Studio에서 Veo API 접근 권한을 확인하세요.
            </p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col overflow-hidden p-2 sm:p-4 gap-3 sm:gap-4">
        {videoMode === 'remotion' ? (
          /* Remotion 모드 */
          <div className="flex-grow flex flex-col items-center justify-center overflow-y-auto">
            {scenario && scenario.scenes.some(s => s.generatedImage || s.customImage) ? (
              <div className="w-full max-w-sm sm:max-w-md mx-auto px-2 sm:px-0">
                <RemotionPlayer
                  scenes={scenesForPreview}
                  aspectRatio={aspectRatio}
                  transitionType="fade"
                  showSubtitles={true}
                  className="rounded-lg overflow-hidden shadow-2xl"
                />

                {/* TTS 나레이션 생성 섹션 */}
                <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <span className="text-sm font-medium text-white">AI 나레이션</span>
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
                      className="flex-1 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white"
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
                      {scenario?.scenes.filter(s => s.narration?.trim()).map((scene) => {
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
                            <div className="flex gap-1.5">
                              {/* 미리듣기 생성 버튼 */}
                              <button
                                onClick={() => handleGeneratePreview(scene.id, scene.narration)}
                                disabled={isGenerating}
                                className="flex-1 px-2 py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
                                  className={`px-2 py-1 text-xs font-medium rounded ${
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
                                  className="px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded"
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

                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-400 mb-3">
                    시나리오의 이미지를 기반으로 비디오를 미리볼 수 있습니다
                  </p>
                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg hover:from-green-500 hover:to-emerald-500"
                  >
                    <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    비디오 내보내기
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center">
                  <FilmIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">시나리오 이미지 필요</h3>
                <p className="text-gray-400 text-sm mb-4">
                  먼저 시나리오 탭에서 씬별 이미지를 생성하세요.<br />
                  Remotion은 생성된 이미지를 영상으로 변환합니다.
                </p>

                {/* TTS 나레이션 섹션 - 이미지 없이도 사용 가능 */}
                {scenario && getTTSStatus().total > 0 && (
                  <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700 text-left">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <span className="text-sm font-medium text-white">AI 나레이션</span>
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
                        className="flex-1 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white"
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
                      {scenario.scenes.filter(s => s.narration?.trim()).map((scene) => {
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
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleGeneratePreview(scene.id, scene.narration)}
                                disabled={isGenerating}
                                className="flex-1 px-2 py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded disabled:opacity-50"
                              >
                                {isGenerating ? '생성 중...' : hasPreview || hasApplied ? '다시 생성' : '미리듣기'}
                              </button>
                              {hasPreview && (
                                <>
                                  <button
                                    onClick={() => handlePlayPreview(scene.id)}
                                    className={`px-2 py-1 text-xs font-medium rounded ${
                                      isPlaying ? 'bg-red-600' : 'bg-blue-600'
                                    } text-white`}
                                  >
                                    {isPlaying ? '정지' : '재생'}
                                  </button>
                                  <button
                                    onClick={() => handleApplyPreview(scene.id)}
                                    className="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded"
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
          /* Veo 모드 - 클립이 없을 때 */
          <div className="flex-grow flex flex-col items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center">
                <FilmIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">클립을 추가하세요</h3>
              <p className="text-gray-400 text-sm mb-6">
                시나리오에서 이미지가 있는 씬을 가져와 AI 영상 클립을 생성합니다.
              </p>
              {scenario && scenario.scenes.some(s => s.generatedImage || s.customImage) ? (
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-500 hover:to-indigo-500"
                >
                  <LayersIcon className="w-4 h-4 inline mr-2" />
                  시나리오에서 가져오기
                </button>
              ) : (
                <p className="text-amber-400 text-sm">
                  먼저 시나리오 탭에서 이미지를 생성하세요
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Veo 모드 - 클립이 있을 때 */
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
                    onDownload={clip.generatedVideo?.url ? () => downloadVeoVideo(clip.generatedVideo!.url, `clip_${clip.order + 1}.mp4`) : undefined}
                  />
                ))}
              </div>
            </div>

            {/* 선택된 클립 상세 정보 */}
            {selectedClip && (
              <div className="flex-shrink-0 bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-white">클립 #{selectedClip.order + 1} 상세</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMoveClip(selectedClip.id, 'left')}
                      disabled={selectedClip.order === 0}
                      className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30"
                      title="왼쪽으로 이동"
                    >
                      <ArrowLeftIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveClip(selectedClip.id, 'right')}
                      disabled={selectedClip.order === clips.length - 1}
                      className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30"
                      title="오른쪽으로 이동"
                    >
                      <ArrowRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">모션 프롬프트</p>
                    <p className="text-sm text-gray-300">{selectedClip.motionPrompt || '없음'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">길이</p>
                    <p className="text-sm text-gray-300">{selectedClip.duration}초</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">상태</p>
                    <p className={`text-sm ${selectedClip.generatedVideo ? 'text-green-400' : 'text-amber-400'}`}>
                      {selectedClip.generatedVideo ? '비디오 생성 완료' : '대기 중'}
                    </p>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => handleGenerateClip(selectedClip.id)}
                      disabled={isGenerating || !selectedClip.sourceImage || veoApiStatus === 'unavailable'}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
                      title={veoApiStatus === 'unavailable' ? 'Veo API 사용 불가' : ''}
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
            <div className="flex-shrink-0 flex items-center justify-center gap-4 py-2">
              <button
                onClick={stop}
                disabled={!isPlaying}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30"
                title="정지"
              >
                <StopIcon className="w-6 h-6" />
              </button>
              <button
                onClick={isPlaying && !isPaused ? pause : play}
                disabled={completedClips === 0}
                className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50"
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
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30"
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
      {scenario && (
        <SceneImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          scenes={scenario.scenes}
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
      {scenario && (
        <VideoExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          scenes={scenario.scenes}
          onExport={handleRemotionExport}
        />
      )}
    </div>
  );
};

export default VideoTab;
