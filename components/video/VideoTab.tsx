import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useVideo } from '../../hooks/useVideo';
import { useScenario } from '../../hooks/useScenario';
import { VideoClip, Scene } from '../../types';
import {
  SparklesIcon,
  TrashIcon,
  PlusCircleIcon,
  ClearIcon,
  LayersIcon,
} from '../Icons';

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
}

const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  isSelected,
  isPlaying,
  onSelect,
  onRegenerate,
  onDelete,
  isGenerating,
}) => {
  const thumbnailUrl = clip.generatedVideo?.thumbnailUrl || (clip.sourceImage ? `data:${clip.sourceImage.mimeType};base64,${clip.sourceImage.data}` : null);

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
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold text-white">시나리오에서 씬 가져오기</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <ClearIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              이미지가 있는 씬: {scenesWithImages.length}개 / 선택됨: {selectedSceneIds.length}개
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
                선택 해제
              </button>
            </div>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4">
          {scenesWithImages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              이미지가 있는 씬이 없습니다. 먼저 시나리오 탭에서 이미지를 생성하세요.
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
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
  const { characters, activeCharacterIds } = useProject();
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
      <div className="flex-shrink-0 p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">영상 제작</h2>
            <p className="text-sm text-gray-400 mt-1">
              {clips.length}개 클립 · {totalDuration}초 · {completedClips}/{clips.length} 완료
            </p>
          </div>
          <div className="flex gap-2">
            {scenario && scenario.scenes.some(s => s.generatedImage || s.customImage) && (
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                <LayersIcon className="w-4 h-4" />
                시나리오에서 가져오기
              </button>
            )}
            <button
              onClick={handleGenerateAllClips}
              disabled={isGenerating || clips.length === 0 || clips.every(c => c.generatedVideo)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
            >
              <SparklesIcon className="w-4 h-4" />
              {isGenerating ? '생성 중...' : '전체 비디오 생성'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearError} className="text-red-400 hover:text-red-300">
              <ClearIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col overflow-hidden p-4 gap-4">
        {clips.length === 0 ? (
          /* 클립이 없을 때 */
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
          <>
            {/* 클립 그리드 */}
            <div className="flex-grow overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
                      disabled={isGenerating || !selectedClip.sourceImage}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
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
                onClick={() => {/* TODO: Export functionality */}}
                disabled={completedClips === 0}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30"
                title="내보내기"
              >
                <DownloadIcon className="w-6 h-6" />
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
    </div>
  );
};

export default VideoTab;
