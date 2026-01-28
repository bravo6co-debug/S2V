import React, { useRef, useState } from 'react';
import type { SuggestedCharacter, ImageData } from '../../types';
import { compressImageFile } from '../../services/imageCompression';

interface SuggestedCharacterCardProps {
  character: SuggestedCharacter;
  isCreated: boolean;
  isGenerating?: boolean;
  createdThumbnail?: ImageData;
  onQuickGenerate: () => void;
  onUpload?: (imageData: ImageData) => void;
  onEdit?: (updates: Partial<SuggestedCharacter>) => void;
}

const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// 업로드 아이콘
const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

// 다운로드 아이콘
const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

// 편집 아이콘
const PencilIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

// 체크 아이콘 (저장용)
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

// X 아이콘 (취소용)
const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const SuggestedCharacterCard: React.FC<SuggestedCharacterCardProps> = ({
  character,
  isCreated,
  isGenerating = false,
  createdThumbnail,
  onQuickGenerate,
  onUpload,
  onEdit,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(character.name);
  const [editedDescription, setEditedDescription] = useState(character.description);

  const handleStartEdit = () => {
    setEditedName(character.name);
    setEditedDescription(character.description);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (onEdit && (editedName !== character.name || editedDescription !== character.description)) {
      onEdit({
        name: editedName.trim() || character.name,
        description: editedDescription.trim() || character.description,
      });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedName(character.name);
    setEditedDescription(character.description);
    setIsEditing(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      try {
        const compressed = await compressImageFile(file);
        onUpload({ mimeType: compressed.mimeType, data: compressed.data });
      } catch (error) {
        // Fallback to uncompressed if compression fails
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64Data = dataUrl.split(',')[1];
          onUpload({ mimeType: file.type, data: base64Data });
        };
        reader.readAsDataURL(file);
      }
    }
    // Reset input
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDownload = () => {
    if (!createdThumbnail) return;

    const extension = createdThumbnail.mimeType.split('/')[1] || 'png';
    const link = document.createElement('a');
    link.href = `data:${createdThumbnail.mimeType};base64,${createdThumbnail.data}`;
    link.download = `${character.name}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={`p-3 rounded-lg border transition-all duration-200 ${
        isCreated
          ? 'border-green-500/50 bg-green-500/10'
          : isGenerating
          ? 'border-purple-500/50 bg-purple-500/10'
          : 'border-gray-600 bg-gray-700/50 hover:bg-gray-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* 썸네일 또는 플레이스홀더 */}
        <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-600">
          {isCreated && createdThumbnail ? (
            <img
              src={`data:${createdThumbnail.mimeType};base64,${createdThumbnail.data}`}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : isGenerating ? (
            <div className="w-full h-full flex items-center justify-center bg-purple-900/50">
              <SpinnerIcon className="w-5 h-5 text-purple-400" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>

        {/* 캐릭터 정보 */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            // 편집 모드
            <div className="space-y-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="캐릭터 이름"
                className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="캐릭터 설명 (이미지 생성 프롬프트로 사용됨)"
                rows={2}
                className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          ) : (
            // 일반 모드
            <>
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-white truncate">{character.name}</h4>
                <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-600 rounded flex-shrink-0">
                  {character.role}
                </span>
              </div>
              <p className="text-sm text-gray-300 mt-1 line-clamp-2">{character.description}</p>
            </>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex-shrink-0">
          {isEditing ? (
            // 편집 모드 버튼
            <div className="flex items-center gap-1">
              <button
                onClick={handleSaveEdit}
                className="p-1 text-green-400 hover:text-green-300 hover:bg-gray-600 rounded transition-colors"
                title="저장"
              >
                <CheckIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
                title="취소"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ) : isCreated ? (
            <div className="flex items-center gap-1">
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
              {onEdit && (
                <button
                  onClick={handleStartEdit}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
                  title="편집"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              )}
              {createdThumbnail && (
                <button
                  onClick={handleDownload}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
                  title="이미지 다운로드"
                >
                  <DownloadIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : isGenerating ? (
            <span className="text-xs text-purple-400">생성중...</span>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={onQuickGenerate}
                disabled={isGenerating}
                className="px-2.5 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="AI로 캐릭터 이미지 생성"
              >
                생성
              </button>
              {onEdit && (
                <button
                  onClick={handleStartEdit}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
                  title="편집"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              )}
              {onUpload && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="이미지 업로드"
                  >
                    <UploadIcon className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuggestedCharacterCard;
