import React from 'react';
import { BackgroundAsset, LocationType, TimeOfDay, Weather } from '../../types';
import { TrashIcon, PencilIcon, MagnifyingGlassPlusIcon } from '../Icons';

interface BackgroundCardProps {
  background: BackgroundAsset;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onZoom?: () => void;
}

const LOCATION_ICONS: Record<LocationType, string> = {
  indoor: '🏠',
  outdoor: '🌲',
  urban: '🏙️',
  nature: '🏔️',
  fantasy: '✨',
};

const TIME_ICONS: Record<TimeOfDay, string> = {
  day: '☀️',
  night: '🌙',
  sunset: '🌅',
  dawn: '🌄',
};

const WEATHER_ICONS: Record<Weather, string> = {
  sunny: '☀️',
  cloudy: '☁️',
  rainy: '🌧️',
  snowy: '❄️',
};

export const BackgroundCard: React.FC<BackgroundCardProps> = ({
  background,
  isSelected,
  onClick,
  onDelete,
  onEdit,
  onZoom,
}) => {
  const locationIcon = LOCATION_ICONS[background.locationType];

  return (
    <div
      className={`
        relative group bg-gray-800 rounded-xl border-2 transition-all duration-200 cursor-pointer
        ${isSelected ? 'border-green-500 ring-2 ring-green-500/30' : 'border-gray-700 hover:border-gray-600'}
      `}
      onClick={onClick}
    >
      {/* 이미지 영역 - 16:9 비율 */}
      <div className="relative aspect-video overflow-hidden rounded-t-lg">
        <img
          src={`data:${background.image.mimeType};base64,${background.image.data}`}
          alt={background.name}
          className="w-full h-full object-cover"
        />

        {/* 장소 유형 뱃지 */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-green-600 rounded text-xs font-medium text-white flex items-center gap-1">
          <span>{locationIcon}</span>
          <span>배경</span>
        </div>

        {/* 시간/날씨 정보 */}
        <div className="absolute top-2 right-2 flex gap-1">
          {background.timeOfDay && (
            <div className="w-7 h-7 bg-gray-900/80 rounded-full flex items-center justify-center text-sm">
              {TIME_ICONS[background.timeOfDay]}
            </div>
          )}
          {background.weather && (
            <div className="w-7 h-7 bg-gray-900/80 rounded-full flex items-center justify-center text-sm">
              {WEATHER_ICONS[background.weather]}
            </div>
          )}
        </div>

        {/* 컨텍스트 유지 표시 */}
        {background.maintainContext && (
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
        <h3 className="font-semibold text-white text-sm truncate">{background.name}</h3>
        {background.mood && (
          <p className="text-xs text-green-400 mt-0.5 line-clamp-1">{background.mood}</p>
        )}
        {background.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{background.description}</p>
        )}
      </div>
    </div>
  );
};

export default BackgroundCard;
