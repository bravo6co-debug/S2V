import React from 'react';
import { PropAsset, PropRole, PropCategory } from '../../types';
import { TrashIcon, PencilIcon, MagnifyingGlassPlusIcon } from '../Icons';

interface PropCardProps {
  prop: PropAsset;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onZoom?: () => void;
}

const ROLE_BADGES: Record<PropRole, { label: string; icon: string; color: string }> = {
  keyProp: { label: '핵심', icon: '📦', color: 'bg-amber-600' },
  prop: { label: '일반', icon: '🎒', color: 'bg-gray-600' },
};

const CATEGORY_ICONS: Record<PropCategory, string> = {
  accessory: '💍',
  document: '📄',
  device: '📱',
  food: '🍕',
  clothing: '👔',
  vehicle: '🚗',
  nature: '🌸',
  other: '📦',
};

export const PropCard: React.FC<PropCardProps> = ({
  prop,
  isSelected,
  onClick,
  onDelete,
  onEdit,
  onZoom,
}) => {
  const roleBadge = ROLE_BADGES[prop.role];
  const categoryIcon = CATEGORY_ICONS[prop.category];

  return (
    <div
      className={`
        relative group bg-gray-800 rounded-xl border-2 transition-all duration-200 cursor-pointer
        ${isSelected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-gray-700 hover:border-gray-600'}
      `}
      onClick={onClick}
    >
      {/* 이미지 영역 */}
      <div className="relative aspect-square overflow-hidden rounded-t-lg">
        <img
          src={`data:${prop.image.mimeType};base64,${prop.image.data}`}
          alt={prop.name}
          className="w-full h-full object-cover"
        />

        {/* 역할 뱃지 */}
        <div className={`absolute top-2 left-2 px-2 py-1 ${roleBadge.color} rounded text-xs font-medium text-white flex items-center gap-1`}>
          <span>{roleBadge.icon}</span>
          <span>{roleBadge.label}</span>
        </div>

        {/* 카테고리 아이콘 */}
        <div className="absolute top-2 right-2 w-7 h-7 bg-gray-900/80 rounded-full flex items-center justify-center text-sm">
          {categoryIcon}
        </div>

        {/* 컨텍스트 유지 표시 */}
        {prop.maintainContext && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-purple-600/80 rounded text-xs text-white">
            🔒 컨텍스트
          </div>
        )}

        {/* 호버 오버레이 */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
        <h3 className="font-semibold text-white text-sm truncate">{prop.name}</h3>
        {prop.significance && (
          <p className="text-xs text-amber-400 mt-0.5 line-clamp-1">{prop.significance}</p>
        )}
        {prop.owner && (
          <p className="text-xs text-gray-500 mt-1">소유자: {prop.owner}</p>
        )}
      </div>
    </div>
  );
};

export default PropCard;
