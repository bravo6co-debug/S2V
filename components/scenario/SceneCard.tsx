import React, { useState, useRef } from 'react';
import { Scene, ImageData } from '../../types';
import { compressImageFile } from '../../services/imageCompression';
import {
  TrashIcon,
  PencilIcon,
  CheckCircleIcon,
  DownloadIcon,
  UploadArrowIcon,
  ImageIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '../Icons';

interface SceneCardProps {
  scene: Scene;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onGenerateImage: (sceneId: string) => void;
  onEditScene: (sceneId: string, updates: Partial<Scene>) => Promise<void>;
  onDeleteScene: (sceneId: string) => void;
  onDownloadImage: (sceneId: string) => void;
  onReplaceImage: (sceneId: string, image: ImageData) => void;
  isGeneratingImage: boolean;
  isUpdatingPrompt?: boolean;
  isGeneratingAllImages?: boolean;
}

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  isExpanded,
  onToggleExpand,
  onGenerateImage,
  onEditScene,
  onDeleteScene,
  onDownloadImage,
  onReplaceImage,
  isGeneratingImage,
  isUpdatingPrompt = false,
  isGeneratingAllImages = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedNarration, setEditedNarration] = useState(scene.narration);
  const [editedVisual, setEditedVisual] = useState(scene.visualDescription);
  const [editedImagePrompt, setEditedImagePrompt] = useState(scene.imagePrompt);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storyBeatColors: Record<string, string> = {
    Hook: 'bg-red-600',
    Setup: 'bg-blue-600',
    Development: 'bg-green-600',
    Climax: 'bg-yellow-600',
    Resolution: 'bg-purple-600',
  };

  // 변경 여부 확인
  const visualDescriptionChanged = editedVisual !== scene.visualDescription;
  const imagePromptChanged = editedImagePrompt !== scene.imagePrompt;

  // 전체 작업 진행 중 여부 (편집 불가)
  const isBusy = isGeneratingImage || isGeneratingAllImages || isUpdatingPrompt || isSaving;

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      await onEditScene(scene.id, {
        narration: editedNarration,
        visualDescription: editedVisual,
        // imagePrompt 수동 편집 시 그대로 저장
        ...(imagePromptChanged && { imagePrompt: editedImagePrompt }),
        // 시각적 묘사가 변경되었으나 imagePrompt는 수동 편집 안 했으면 자동 업데이트 트리거
        // (수동 편집 시 사용자 의도 존중 — 자동 덮어쓰기 금지)
        ...(visualDescriptionChanged && !imagePromptChanged && { needsPromptUpdate: true }),
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Scene save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file);
        onReplaceImage(scene.id, { mimeType: compressed.mimeType, data: compressed.data });
      } catch (error) {
        // Fallback to uncompressed if compression fails
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64Data = dataUrl.split(',')[1];
          onReplaceImage(scene.id, { mimeType: file.type, data: base64Data });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const currentImage = scene.customImage || scene.generatedImage;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 cursor-pointer hover:bg-gray-750 transition-colors min-h-[44px]"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <span className="text-base sm:text-lg font-bold text-gray-400">#{scene.sceneNumber}</span>
          <span className={`px-1.5 sm:px-2 py-0.5 text-xs font-medium text-white rounded ${storyBeatColors[scene.storyBeat] || 'bg-gray-600'}`}>
            {scene.storyBeat}
          </span>
          <span className="text-xs text-gray-500 hidden sm:inline">{scene.duration}초</span>
        </div>
        <p className="flex-grow text-xs sm:text-sm text-gray-300 truncate">{scene.visualDescription}</p>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {currentImage && (
            <span className="text-green-400" title="이미지 있음">
              <CheckCircleIcon className="w-4 h-4" />
            </span>
          )}
          {scene.imageSource === 'custom' && (
            <span className="text-xs text-amber-400 hidden sm:inline">교체됨</span>
          )}
          {isExpanded ? (
            <ChevronUpIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-3 sm:p-4 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* Left: Scene Details */}
            <div className="space-y-3">
              {isEditing ? (
                <>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block">시각적 묘사</label>
                    <textarea
                      value={editedVisual}
                      onChange={(e) => setEditedVisual(e.target.value)}
                      className="w-full h-20 p-2 sm:p-3 text-[16px] sm:text-sm bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block">내레이션</label>
                    <textarea
                      value={editedNarration}
                      onChange={(e) => setEditedNarration(e.target.value)}
                      className="w-full h-20 p-2 sm:p-3 text-[16px] sm:text-sm bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block flex items-center gap-2">
                      <span>이미지 프롬프트</span>
                      <span className="text-[10px] text-gray-500 font-normal">영어 권장 · 한국어도 가능</span>
                      {imagePromptChanged && (
                        <span className="text-[10px] text-amber-400 font-normal">수정됨 — 시각적 묘사 변경 시 자동 업데이트 안 됨</span>
                      )}
                    </label>
                    <textarea
                      value={editedImagePrompt}
                      onChange={(e) => setEditedImagePrompt(e.target.value)}
                      className="w-full h-32 p-2 sm:p-3 text-[16px] sm:text-sm bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono"
                      placeholder="이미지 생성 모델에 전달될 프롬프트. 영어가 일반적으로 더 정확하지만 한국어도 가능합니다."
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      className="min-h-[44px] px-3 py-1.5 text-xs sm:text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? '저장 중...' : '저장'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditedNarration(scene.narration);
                        setEditedVisual(scene.visualDescription);
                        setEditedImagePrompt(scene.imagePrompt);
                      }}
                      disabled={isSaving}
                      className="min-h-[44px] px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-300 bg-gray-600 rounded hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block">시각적 묘사</label>
                    <p className="text-xs sm:text-sm text-gray-200">{scene.visualDescription}</p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-400 mb-1 block">내레이션</label>
                    <p className="text-xs sm:text-sm text-gray-200 italic">"{scene.narration}"</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:gap-4 text-xs text-gray-400">
                    <span><strong>카메라:</strong> {scene.cameraAngle}</span>
                    <span><strong>분위기:</strong> {scene.mood}</span>
                  </div>
                </>
              )}
            </div>

            {/* Right: Image Preview / Generation */}
            <div className="flex flex-col">
              {currentImage ? (
                <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden group">
                  <img
                    src={`data:${currentImage.mimeType};base64,${currentImage.data}`}
                    alt={`Scene ${scene.sceneNumber}`}
                    className="w-full h-full object-cover"
                  />
                  {/* 이미지 액션 버튼 */}
                  <div className="absolute bottom-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onDownloadImage(scene.id)}
                      className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 sm:p-1.5 bg-gray-800/80 rounded text-white hover:bg-gray-700 flex items-center justify-center"
                      title="다운로드"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 sm:p-1.5 bg-gray-800/80 rounded text-white hover:bg-gray-700 flex items-center justify-center"
                      title="이미지 교체"
                    >
                      <UploadArrowIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex items-center justify-center aspect-video bg-gray-900 rounded-lg border-2 border-dashed border-gray-700">
                  <div className="text-center text-gray-500">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs">이미지 미생성</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Image Prompt (collapsible) — 편집 모드에서는 위에 textarea로 노출됨 */}
          {!isEditing && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-400 hover:text-gray-300 min-h-[44px] flex items-center">
                이미지 프롬프트 보기
              </summary>
              <pre className="mt-2 p-2 sm:p-3 bg-gray-900 rounded text-gray-300 whitespace-pre-wrap text-xs overflow-x-auto">
                {scene.imagePrompt}
              </pre>
            </details>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                disabled={isBusy}
                className="min-h-[44px] flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PencilIcon className="w-3.5 h-3.5" />
                편집
              </button>
            )}
            <button
              onClick={() => onGenerateImage(scene.id)}
              disabled={isGeneratingImage || isUpdatingPrompt}
              className="min-h-[44px] flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium text-indigo-300 bg-indigo-900/50 rounded hover:bg-indigo-800/50 disabled:opacity-50"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {isGeneratingImage ? '생성 중...' : isUpdatingPrompt ? '프롬프트 업데이트 중...' : currentImage ? '이미지 재생성' : '이미지 생성'}
            </button>
            <button
              onClick={() => onDeleteScene(scene.id)}
              disabled={isBusy}
              className="min-h-[44px] flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium text-red-300 bg-red-900/50 rounded hover:bg-red-800/50 ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneCard;
