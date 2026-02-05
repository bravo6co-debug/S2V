import React, { useState, useCallback, useMemo } from 'react';
import type { Scene, AspectRatio } from '../../types';
import type { TransitionConfig } from '../../remotion/types';
import { ClearIcon } from '../Icons';
import {
  needsPartSplit,
  splitScenesIntoParts,
  PART_SPLIT_THRESHOLD,
} from '../../services/videoService';

interface VideoExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: Scene[];
  onExport: (config: ExportConfig, partIndex?: number) => Promise<void>;
  // 멀티파트 모드용 props
  partStates?: PartExportState[];
  isExportingPart?: boolean;
  onDownloadPart?: (partIndex: number) => void;
}

export interface ExportConfig {
  aspectRatio: AspectRatio;
  resolution: '720p' | '1080p';
  fps: 24 | 30;
  transitionType: TransitionConfig['type'];
  transitionDuration: number;
  showSubtitles: boolean;
  includeAudio: boolean;
  format: 'mp4' | 'webm';
}

export interface PartExportState {
  status: 'idle' | 'rendering' | 'complete' | 'error';
  progress: number;
  error?: string;
  videoBlob?: Blob;
}

const RESOLUTION_OPTIONS = [
  { value: '720p', label: 'HD (720p)', width: 720, height: 1280 },
  { value: '1080p', label: 'Full HD (1080p)', width: 1080, height: 1920 },
] as const;

const TRANSITION_OPTIONS = [
  { value: 'fade', label: '페이드' },
  { value: 'dissolve', label: '디졸브' },
  { value: 'slide', label: '슬라이드' },
  { value: 'zoom', label: '줌' },
  { value: 'none', label: '없음' },
] as const;

export const VideoExportModal: React.FC<VideoExportModalProps> = ({
  isOpen,
  onClose,
  scenes,
  onExport,
  partStates,
  isExportingPart = false,
  onDownloadPart,
}) => {
  const [config, setConfig] = useState<ExportConfig>({
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 30,
    transitionType: 'fade',
    transitionDuration: 15,
    showSubtitles: true,
    includeAudio: true,
    format: 'webm',
  });

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const scenesWithImages = scenes.filter(s => s.generatedImage || s.customImage);
  const totalDuration = scenesWithImages.reduce((acc, s) => acc + s.duration, 0);

  // 파트 분할 필요 여부 확인
  const requiresPartSplit = needsPartSplit(scenes);
  const { parts, ranges } = useMemo(() => splitScenesIntoParts(scenes), [scenes]);

  // 나레이션 오디오가 있는 씬 수 확인
  const scenesWithAudio = scenes.filter(s => s.narrationAudio?.data);
  const hasNarrationAudio = scenesWithAudio.length > 0;

  // 단일 파트 내보내기 (2분 미만)
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setProgress(0);
    setError(null);

    try {
      await onExport(config);
      setProgress(100);
      setTimeout(() => {
        onClose();
        setIsExporting(false);
        setProgress(0);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '내보내기에 실패했습니다');
      setIsExporting(false);
    }
  }, [config, onExport, onClose]);

  // 파트별 내보내기 (2분 이상)
  const handleExportPart = useCallback(async (partIndex: number) => {
    setError(null);
    try {
      await onExport(config, partIndex);
    } catch (err) {
      setError(err instanceof Error ? err.message : '내보내기에 실패했습니다');
    }
  }, [config, onExport]);

  const updateConfig = <K extends keyof ExportConfig>(
    key: K,
    value: ExportConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700 flex-shrink-0">
          <h3 className="text-base sm:text-lg font-bold text-white">비디오 내보내기</h3>
          <button
            onClick={onClose}
            disabled={isExporting || isExportingPart}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <ClearIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto flex-grow">
          {/* 비디오 정보 */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">씬 수</span>
              <span className="text-white font-medium">{scenesWithImages.length}개</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-400">총 재생 시간</span>
              <span className="text-white font-medium">{formatDuration(totalDuration)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-400">나레이션 오디오</span>
              <span className={`font-medium ${hasNarrationAudio ? 'text-green-400' : 'text-gray-500'}`}>
                {hasNarrationAudio ? `${scenesWithAudio.length}개 씬` : '없음'}
              </span>
            </div>
            {requiresPartSplit && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-400">파트 분할</span>
                <span className="text-cyan-400 font-medium">{parts.length}개 파트</span>
              </div>
            )}
          </div>

          {/* 2분 이상 파트 분할 안내 */}
          {requiresPartSplit && (
            <div className="bg-cyan-900/30 border border-cyan-700/50 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-cyan-300">
                  <p className="font-medium mb-1">왜 파트로 분할하나요?</p>
                  <p className="text-cyan-400/80">
                    브라우저 메모리 제한으로 {PART_SPLIT_THRESHOLD / 60}분 이상 영상은 파트별로 렌더링해야 안정적입니다.
                    렌더링된 파트들은 CapCut, Premiere 등에서 간단히 이어붙일 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 화면 비율 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              화면 비율
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateConfig('aspectRatio', '9:16')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  config.aspectRatio === '9:16'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                9:16 (세로)
              </button>
              <button
                onClick={() => updateConfig('aspectRatio', '16:9')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  config.aspectRatio === '16:9'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                16:9 (가로)
              </button>
            </div>
          </div>

          {/* 해상도 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              해상도
            </label>
            <select
              value={config.resolution}
              onChange={(e) => updateConfig('resolution', e.target.value as ExportConfig['resolution'])}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {RESOLUTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 프레임 레이트 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              프레임 레이트
            </label>
            <div className="flex gap-2">
              {[24, 30].map((fps) => (
                <button
                  key={fps}
                  onClick={() => updateConfig('fps', fps as 24 | 30)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    config.fps === fps
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {fps} FPS
                </button>
              ))}
            </div>
          </div>

          {/* 트랜지션 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              장면 전환 효과
            </label>
            <select
              value={config.transitionType}
              onChange={(e) => updateConfig('transitionType', e.target.value as TransitionConfig['type'])}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {TRANSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 자막 표시 */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">
              자막 표시
            </label>
            <button
              onClick={() => updateConfig('showSubtitles', !config.showSubtitles)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                config.showSubtitles ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  config.showSubtitles ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {/* 나레이션 오디오 포함 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-300">
                나레이션 오디오 포함
              </label>
              {!hasNarrationAudio && (
                <span className="text-xs text-gray-500">(오디오 없음)</span>
              )}
            </div>
            <button
              onClick={() => updateConfig('includeAudio', !config.includeAudio)}
              disabled={!hasNarrationAudio}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                config.includeAudio && hasNarrationAudio ? 'bg-green-600' : 'bg-gray-600'
              } ${!hasNarrationAudio ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  config.includeAudio && hasNarrationAudio ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {/* 오디오 포함 안내 */}
          {hasNarrationAudio && config.includeAudio && (
            <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
                <span>{scenesWithAudio.length}개 씬의 TTS 나레이션이 비디오에 포함됩니다</span>
              </div>
            </div>
          )}

          {/* 파트별 내보내기 UI (2분 이상) */}
          {requiresPartSplit && partStates && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                파트별 내보내기
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {parts.map((partScenes, partIndex) => {
                  const range = ranges[partIndex];
                  const state = partStates[partIndex] || { status: 'idle', progress: 0 };

                  return (
                    <div
                      key={partIndex}
                      className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">
                          파트 {partIndex + 1}
                        </p>
                        <p className="text-xs text-gray-400">
                          씬 {range.start + 1}~{range.end} · {formatDuration(range.duration)}
                        </p>
                        {state.status === 'rendering' && (
                          <div className="mt-1 h-1 bg-gray-600 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all"
                              style={{ width: `${state.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {state.status === 'complete' && onDownloadPart ? (
                          <button
                            onClick={() => onDownloadPart(partIndex)}
                            className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-500"
                          >
                            다운로드
                          </button>
                        ) : state.status === 'rendering' ? (
                          <span className="text-xs text-blue-400">{Math.round(state.progress)}%</span>
                        ) : state.status === 'error' ? (
                          <button
                            onClick={() => handleExportPart(partIndex)}
                            disabled={isExportingPart}
                            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50"
                          >
                            재시도
                          </button>
                        ) : (
                          <button
                            onClick={() => handleExportPart(partIndex)}
                            disabled={isExportingPart}
                            className="px-3 py-1.5 text-xs bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50"
                          >
                            내보내기
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* 진행률 표시 (단일 내보내기 모드) */}
          {isExporting && !requiresPartSplit && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">내보내기 중...</span>
                <span className="text-white">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 sm:gap-3 p-3 sm:p-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isExporting || isExportingPart}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 disabled:opacity-50"
          >
            {requiresPartSplit ? '닫기' : '취소'}
          </button>
          {!requiresPartSplit && (
            <button
              onClick={handleExport}
              disabled={isExporting || scenesWithImages.length === 0}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? '내보내는 중...' : '내보내기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoExportModal;
