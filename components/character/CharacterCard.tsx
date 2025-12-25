import React from 'react';
import { CharacterAsset, CharacterRole } from '../../types';
import { PlusCircleIcon, TrashIcon, PencilIcon, MagnifyingGlassPlusIcon } from '../Icons';

interface CharacterCardProps {
  character: CharacterAsset;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
  onActivate: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onZoom?: () => void;
}

const ROLE_BADGES: Record<CharacterRole, { label: string; icon: string; color: string }> = {
  protagonist: { label: '주인공', icon: '⭐', color: 'bg-yellow-600' },
  supporting: { label: '조연', icon: '👥', color: 'bg-blue-600' },
  extra: { label: '단역', icon: '👤', color: 'bg-gray-600' },
};

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  isSelected,
  isActive,
  onClick,
  onActivate,
  onDelete,
  onEdit,
  onZoom,
}) => {
  const roleBadge = ROLE_BADGES[character.role];

  return (
    <div
      className={`
        relative group bg-gray-800 rounded-xl border-2 transition-all duration-200 cursor-pointer
        ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-gray-700 hover:border-gray-600'}
        ${isActive ? 'ring-2 ring-green-500/50' : ''}
      `}
      onClick={onClick}
    >
      {/* 이미지 영역 */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-t-lg">
        <img
          src={`data:${character.image.mimeType};base64,${character.image.data}`}
          alt={character.name}
          className="w-full h-full object-cover"
        />

        {/* 활성화 표시 */}
        {isActive && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white text-xs">✓</span>
          </div>
        )}

        {/* 역할 뱃지 */}
        <div className={`absolute top-2 left-2 px-2 py-1 ${roleBadge.color} rounded text-xs font-medium text-white flex items-center gap-1`}>
          <span>{roleBadge.icon}</span>
          <span>{roleBadge.label}</span>
        </div>

        {/* 컨텍스트 유지 표시 */}
        {character.maintainContext && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-purple-600/80 rounded text-xs text-white">
            🔒 컨텍스트
          </div>
        )}

        {/* 호버 오버레이 */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
            }}
            className={`p-2 rounded-full text-white transition-colors ${
              isActive ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
            title={isActive ? '비활성화' : '활성화'}
          >
            <PlusCircleIcon className="w-5 h-5" />
          </button>
          {onZoom && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onZoom();
              }}
              className="p-2 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition-colors"
              title="확대"
            >
              <MagnifyingGlassPlusIcon className="w-5 h-5" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-2 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition-colors"
              title="수정"
            >
              <PencilIcon className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors"
            title="삭제"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 정보 영역 */}
      <div className="p-3">
        <h3 className="font-semibold text-white text-sm truncate">{character.name}</h3>
        {character.age && (
          <p className="text-xs text-gray-400 mt-0.5">{character.age}</p>
        )}
        {character.personality && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{character.personality}</p>
        )}
      </div>
    </div>
  );
};

export default CharacterCard;
