import React, { useMemo, useState } from 'react';
import { LongformPlayer } from './LongformPlayer';
import { splitScenesForExportMulti, longformScenesToRemotionScenes } from '../../services/longformVideoService';
import { calculatePartRanges } from '../../types/longform';
import type { LongformScenario, LongformConfig, LongformScene } from '../../types/longform';
import type { PartExportState } from '../../hooks/useLongformExport';

interface Step4PreviewDownloadProps {
  scenario: LongformScenario;
  config: LongformConfig;
  partStates: PartExportState[];
  isExporting: boolean;
  onExportPart: (partIndex: number) => void;
  onCancelExport: () => void;
  onDownloadPart: (partIndex: number) => void;
  onReset: () => void;
  onRegenerateFailedScenes?: () => void;
  isRegenerating?: boolean;
}

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ExportProgressBar: React.FC<{ state: PartExportState; label: string }> = ({ state, label }) => {
  if (state.status !== 'rendering') return null;

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">{label} 렌더링 중...</span>
        <span className="text-white font-medium">{Math.round(state.progress)}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-500 transition-all duration-300"
          style={{ width: `${state.progress}%` }}
        />
      </div>
      {state.totalFrames && state.currentFrame && (
        <p className="text-xs text-gray-500">
          {state.currentFrame.toLocaleString()} / {state.totalFrames.toLocaleString()} 프레임
        </p>
      )}
    </div>
  );
};

export const Step4PreviewDownload: React.FC<Step4PreviewDownloadProps> = ({
  scenario,
  config,
  partStates,
  isExporting,
  onExportPart,
  onCancelExport,
  onDownloadPart,
  onReset,
  onRegenerateFailedScenes,
  isRegenerating = false,
}) => {
  const [showExportConfirm, setShowExportConfirm] = useState<number | null>(null);

  // 씬을 파트별로 분할
  const { parts, ranges } = useMemo(() => splitScenesForExportMulti(scenario), [scenario]);

  // 실패한 씬 찾기
  const failedScenes = useMemo(() =>
    scenario.scenes.filter((s: LongformScene) => s.imageStatus === 'failed'),
  [scenario.scenes]);

  // 각 파트별 실제 렌더링될 씬 수
  const partRenderableCounts = useMemo(() =>
    parts.map(partScenes => longformScenesToRemotionScenes(partScenes).length),
  [parts]);

  // 내보내기 버튼 클릭 핸들러 (실패 씬 있으면 확인 모달)
  const handleExportClick = (partIndex: number) => {
    if (failedScenes.length > 0) {
      setShowExportConfirm(partIndex);
    } else {
      onExportPart(partIndex);
    }
  };

  const handleConfirmExport = () => {
    if (showExportConfirm !== null) {
      onExportPart(showExportConfirm);
    }
    setShowExportConfirm(null);
  };

  // 전체 내보내기 진행률
  const totalProgress = useMemo(() => {
    if (partStates.length === 0) return 0;
    const completedParts = partStates.filter(s => s.status === 'complete').length;
    return Math.round((completedParts / partStates.length) * 100);
  }, [partStates]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      {/* 헤더 */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">{scenario.metadata.title}</h2>
        <p className="text-sm text-gray-400 mt-1">
          총 {scenario.scenes.length}개 씬 · ~{config.duration}분 · {parts.length}개 파트
        </p>
        {partStates.length > 0 && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all duration-300"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">
              {partStates.filter(s => s.status === 'complete').length}/{parts.length} 완료
            </span>
          </div>
        )}
      </div>

      {/* 실패 씬 경고 배너 */}
      {failedScenes.length > 0 && (
        <div className="bg-amber-900/30 border border-amber-600/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-amber-200 font-medium text-sm">
                {failedScenes.length}개 씬 이미지 생성 실패
              </p>
              <p className="text-amber-300/70 text-xs mt-1">
                씬 {failedScenes.map((s: LongformScene) => s.sceneNumber).join(', ')} — 해당 씬은 영상에서 제외됩니다.
              </p>
              {failedScenes.length <= 5 && (
                <ul className="mt-2 space-y-1">
                  {failedScenes.map((s: LongformScene) => (
                    <li key={s.id} className="text-xs text-gray-400">
                      <span className="text-amber-400">씬 {s.sceneNumber}:</span> {s.imageError || '알 수 없는 오류'}
                    </li>
                  ))}
                </ul>
              )}
              {onRegenerateFailedScenes && (
                <button
                  onClick={onRegenerateFailedScenes}
                  disabled={isRegenerating || isExporting}
                  className="mt-3 px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
                >
                  {isRegenerating ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      재생성 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      실패 씬 재생성
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 파트 목록 - 그리드 레이아웃 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {parts.map((partScenes, partIndex) => {
          const state = partStates[partIndex] || { status: 'idle', progress: 0 };
          const range = ranges[partIndex];
          const partDuration = partScenes.length; // 1분 x 씬 수

          return (
            <section key={partIndex} className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    파트 {partIndex + 1} (씬 {range.start + 1}~{range.end})
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {partScenes.length}개 씬 · ~{partDuration}분
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {state.status === 'complete' && (
                    <button
                      onClick={() => onDownloadPart(partIndex)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors min-h-[36px]"
                    >
                      <DownloadIcon className="w-4 h-4" />
                      다운로드
                    </button>
                  )}
                  {state.status !== 'rendering' && state.status !== 'complete' && (
                    <button
                      onClick={() => handleExportClick(partIndex)}
                      disabled={isExporting || isRegenerating}
                      className="px-3 py-1.5 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[36px]"
                    >
                      내보내기
                    </button>
                  )}
                </div>
              </div>

              <LongformPlayer scenes={partScenes} />

              <ExportProgressBar state={state} label={`파트 ${partIndex + 1}`} />

              {state.status === 'error' && (
                <p className="mt-2 text-sm text-red-400">{state.error}</p>
              )}

              {state.status === 'complete' && state.result && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  렌더링 완료 ({Math.round(state.result.duration / 60)}분 {Math.round(state.result.duration % 60)}초)
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* 취소/초기화 버튼 */}
      <div className="flex items-center justify-center gap-3 pt-2">
        {isExporting && (
          <button
            onClick={onCancelExport}
            className="px-4 py-2 text-sm bg-red-600/80 text-white rounded-lg hover:bg-red-500 transition-colors min-h-[44px]"
          >
            렌더링 취소
          </button>
        )}
        <button
          onClick={onReset}
          disabled={isExporting}
          className="px-4 py-2 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors min-h-[44px]"
        >
          처음으로
        </button>
      </div>

      {/* 안내 */}
      <div className="bg-gray-800/30 rounded-lg p-4 text-center">
        <p className="text-xs text-gray-400 mb-2">
          비디오는 브라우저에서 실시간 렌더링됩니다. 렌더링 중에는 탭을 닫지 마세요.
        </p>
        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-400">왜 2분 단위로 분할하나요?</p>
          <p>
            브라우저 메모리 제한으로 긴 영상을 한 번에 렌더링하면 크래시가 발생할 수 있습니다.
            2분(2씬) 단위로 분할하여 안정적인 렌더링을 보장합니다.
            렌더링된 파트들은 후편집 프로그램(CapCut, Premiere 등)에서 간단히 이어붙일 수 있습니다.
          </p>
        </div>
      </div>

      {/* 내보내기 확인 모달 */}
      {showExportConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">일부 씬이 제외됩니다</h3>
                <p className="text-gray-400 text-sm">
                  {failedScenes.length}개 씬 이미지 생성 실패
                </p>
              </div>
            </div>

            <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">원래 씬 수</span>
                <span className="text-white">{parts[showExportConfirm]?.length || 0}개</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">렌더링될 씬 수</span>
                <span className="text-amber-400">{partRenderableCounts[showExportConfirm] || 0}개</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">예상 영상 길이</span>
                <span className="text-white">~{partRenderableCounts[showExportConfirm] || 0}분</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowExportConfirm(null)}
                className="flex-1 px-4 py-2 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirmExport}
                className="flex-1 px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors"
              >
                그래도 내보내기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
