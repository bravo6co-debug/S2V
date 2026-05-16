import React, { useRef } from 'react';
import type { LongformScene, SubScene } from '../../types/longform';
import { NarrationCounter } from './NarrationCounter';

interface SceneCardProps {
  scene: LongformScene;
  onUpdate: (updates: Partial<LongformScene>) => void;
  onAdjustNarration: () => void;
  isAdjusting: boolean;
  disabled: boolean;
}

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

// 시간 라벨: N개 sub-image일 때 i번째의 (X~Y초) 표기
function subSceneTimeLabel(subIndex: number, totalSubs: number): string {
  if (totalSubs <= 1) return '';
  const seconds = 60 / totalSubs;
  const start = Math.round(subIndex * seconds);
  const end = Math.round((subIndex + 1) * seconds);
  return `${start}~${end}초`;
}

// scene.subScenes가 없거나 빈 배열이면 legacy 필드로 1개짜리 합성 배열 생성
function resolveSubScenes(scene: LongformScene): SubScene[] {
  if (scene.subScenes && scene.subScenes.length > 0) return scene.subScenes;
  return [{
    imagePrompt: scene.imagePrompt,
    generatedImage: scene.generatedImage,
    imageStatus: scene.imageStatus,
    imageError: scene.imageError,
    userUploaded: scene.userUploaded,
  }];
}

// subScenes 갱신 시 legacy 필드도 동기화 (subScenes[0] 매칭)
function buildSceneUpdate(newSubs: SubScene[]): Partial<LongformScene> {
  return {
    subScenes: newSubs,
    imagePrompt: newSubs[0]?.imagePrompt ?? '',
    generatedImage: newSubs[0]?.generatedImage,
    imageStatus: newSubs[0]?.imageStatus ?? 'pending',
    imageError: newSubs[0]?.imageError,
    userUploaded: newSubs[0]?.userUploaded,
  };
}

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  onUpdate,
  onAdjustNarration,
  isAdjusting,
  disabled,
}) => {
  const charCount = scene.narration.length;
  const needsAdjustment = charCount < 432 || charCount > 444;
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const subScenes = resolveSubScenes(scene);

  const updateSubScene = (subIndex: number, updates: Partial<SubScene>) => {
    const newSubs = subScenes.map((sub, i) => i === subIndex ? { ...sub, ...updates } : sub);
    onUpdate(buildSceneUpdate(newSubs));
  };

  const handleFileSelect = (subIndex: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      alert('이미지 크기는 10MB 이하여야 합니다.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, base64] = result.split(',');
      const mimeType = meta.match(/data:([^;]+)/)?.[1] || file.type;
      updateSubScene(subIndex, {
        generatedImage: { mimeType, data: base64 },
        imageStatus: 'completed',
        userUploaded: true,
        imageError: undefined,
      });
    };
    reader.onerror = () => alert('이미지 읽기에 실패했습니다.');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveUpload = (subIndex: number) => {
    updateSubScene(subIndex, {
      generatedImage: undefined,
      imageStatus: 'pending',
      userUploaded: false,
      imageError: undefined,
    });
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-teal-400">
            씬 {scene.sceneNumber}
          </span>
          <span className="text-xs text-gray-500">({scene.timeRange})</span>
          <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
            {scene.storyPhase}
          </span>
        </div>
        <span className="text-xs text-gray-500">{scene.mood}</span>
      </div>

      {/* Narration Keywords */}
      {scene.narrationKeywords && scene.narrationKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {scene.narrationKeywords.map((kw, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-teal-900/40 text-teal-300 rounded text-[10px] border border-teal-700/30">
              {kw}
            </span>
          ))}
          {scene.cameraAngle && (
            <span className="px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded text-[10px] border border-purple-700/30">
              {scene.cameraAngle}
            </span>
          )}
          {scene.lightingMood && (
            <span className="px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded text-[10px] border border-amber-700/30">
              {scene.lightingMood}
            </span>
          )}
        </div>
      )}

      {/* Sub-scenes (이미지 프롬프트 / 업로드) */}
      <div className="mb-3 space-y-2">
        {subScenes.map((sub, subIndex) => {
          const timeLabel = subSceneTimeLabel(subIndex, subScenes.length);
          const isMulti = subScenes.length > 1;
          return (
            <div key={subIndex} className={isMulti ? 'bg-gray-800/40 border border-gray-700/60 rounded p-2' : ''}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">
                  {isMulti ? `이미지 ${subIndex + 1} (${timeLabel})` : '이미지 프롬프트'}
                  {sub.userUploaded && (
                    <span className="text-teal-400 font-medium ml-1.5">(직접 업로드 사용 중)</span>
                  )}
                </label>
                {!sub.userUploaded && (
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[subIndex]?.click()}
                    disabled={disabled}
                    className="text-xs text-teal-400 hover:text-teal-300 disabled:opacity-50"
                  >
                    📎 직접 업로드
                  </button>
                )}
                <input
                  ref={el => { fileInputRefs.current[subIndex] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect(subIndex)}
                  disabled={disabled}
                />
              </div>

              {sub.userUploaded && sub.generatedImage ? (
                <div className="flex items-start gap-2 p-2 bg-gray-700/30 border border-teal-700/40 rounded">
                  <img
                    src={`data:${sub.generatedImage.mimeType};base64,${sub.generatedImage.data}`}
                    alt={`Scene ${scene.sceneNumber} sub${subIndex + 1}`}
                    className="w-24 h-auto rounded border border-gray-600 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-teal-300">✓ 직접 업로드된 이미지가 사용됩니다</p>
                    <p className="text-[10px] text-gray-500 mt-1">에셋 생성 시 AI 이미지 생성을 건너뜁니다.</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveUpload(subIndex)}
                      disabled={disabled}
                      className="mt-2 text-xs text-red-400 hover:text-red-300 underline disabled:opacity-50"
                    >
                      제거하고 AI 생성 사용
                    </button>
                  </div>
                </div>
              ) : (
                <textarea
                  value={sub.imagePrompt}
                  onChange={(e) => updateSubScene(subIndex, { imagePrompt: e.target.value })}
                  rows={3}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 resize-none focus:ring-1 focus:ring-teal-500 focus:border-transparent focus:outline-none"
                  disabled={disabled}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Narration */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">나레이션</label>
          <div className="flex items-center gap-2">
            <NarrationCounter charCount={charCount} />
            {needsAdjustment && (
              <button
                onClick={onAdjustNarration}
                disabled={disabled || isAdjusting}
                className="text-xs px-2 py-0.5 bg-yellow-600/20 text-yellow-400 rounded hover:bg-yellow-600/30 disabled:opacity-50"
              >
                {isAdjusting ? '보정 중...' : '자동 보정'}
              </button>
            )}
          </div>
        </div>
        <textarea
          value={scene.narration}
          onChange={(e) => onUpdate({ narration: e.target.value, narrationCharCount: e.target.value.length })}
          rows={4}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 resize-none focus:ring-1 focus:ring-teal-500 focus:border-transparent focus:outline-none"
          disabled={disabled}
        />
      </div>
    </div>
  );
};
