import React, { useState, useMemo } from 'react';
import {
  CharacterAsset,
  PropAsset,
  BackgroundAsset,
  CharacterRole,
  PropRole,
  AssetRole,
} from '../../types';
import { useProject } from '../../contexts/ProjectContext';
import { CharacterCard } from './CharacterCard';
import { PropCard } from './PropCard';
import { BackgroundCard } from './BackgroundCard';
import { AssetCreatorModal } from './AssetCreatorModal';
import { SparklesIcon, PlusCircleIcon, TrashIcon, LayersIcon } from '../Icons';

type AssetCategory = 'character' | 'prop' | 'background';
type RoleFilter = 'all' | AssetRole;

interface AssetTabProps {
  onAssetSelect?: (asset: CharacterAsset | PropAsset | BackgroundAsset) => void;
}

export const AssetTab: React.FC<AssetTabProps> = ({ onAssetSelect }) => {
  const {
    characters,
    props,
    backgrounds,
    removeCharacter,
    removeProp,
    removeBackground,
    activeCharacterIds,
    toggleActiveCharacter,
    aspectRatio,
  } = useProject();

  // 탭 상태
  const [activeCategory, setActiveCategory] = useState<AssetCategory>('character');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 모달 상태
  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);
  const [creatorMode, setCreatorMode] = useState<'ai' | 'upload'>('ai');

  // 선택된 에셋 상태
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // =============================================
  // 필터링된 에셋 목록
  // =============================================

  const filteredCharacters = useMemo(() => {
    let filtered = characters;

    // 역할 필터
    if (roleFilter !== 'all' && ['protagonist', 'supporting', 'extra'].includes(roleFilter)) {
      filtered = filtered.filter(c => c.role === roleFilter);
    }

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [characters, roleFilter, searchQuery]);

  const filteredProps = useMemo(() => {
    let filtered = props;

    // 역할 필터
    if (roleFilter !== 'all' && ['keyProp', 'prop'].includes(roleFilter)) {
      filtered = filtered.filter(p => p.role === roleFilter);
    }

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [props, roleFilter, searchQuery]);

  const filteredBackgrounds = useMemo(() => {
    let filtered = backgrounds;

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.name.toLowerCase().includes(query) ||
        b.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [backgrounds, searchQuery]);

  // =============================================
  // 핸들러
  // =============================================

  const handleOpenCreator = (mode: 'ai' | 'upload') => {
    setCreatorMode(mode);
    setIsCreatorModalOpen(true);
  };

  const handleDeleteAsset = (id: string) => {
    if (activeCategory === 'character') {
      removeCharacter(id);
    } else if (activeCategory === 'prop') {
      removeProp(id);
    } else {
      removeBackground(id);
    }
    if (selectedAssetId === id) {
      setSelectedAssetId(null);
    }
  };

  const handleAssetClick = (asset: CharacterAsset | PropAsset | BackgroundAsset) => {
    setSelectedAssetId(asset.id);
    onAssetSelect?.(asset);
  };

  // =============================================
  // 역할 필터 옵션
  // =============================================

  const roleFilterOptions = useMemo(() => {
    if (activeCategory === 'character') {
      return [
        { value: 'all', label: '전체' },
        { value: 'protagonist', label: '주인공', icon: '⭐' },
        { value: 'supporting', label: '조연', icon: '👥' },
        { value: 'extra', label: '단역', icon: '👤' },
      ];
    } else if (activeCategory === 'prop') {
      return [
        { value: 'all', label: '전체' },
        { value: 'keyProp', label: '핵심 소품', icon: '📦' },
        { value: 'prop', label: '일반 소품', icon: '🎒' },
      ];
    }
    return [{ value: 'all', label: '전체' }];
  }, [activeCategory]);

  // =============================================
  // 카테고리 탭
  // =============================================

  const categories: { key: AssetCategory; label: string; count: number }[] = [
    { key: 'character', label: '캐릭터', count: characters.length },
    { key: 'prop', label: '소품', count: props.length },
    { key: 'background', label: '배경', count: backgrounds.length },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* 헤더 */}
      <div className="flex-shrink-0 p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <LayersIcon className="w-6 h-6" />
            에셋 관리
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenCreator('ai')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-500 hover:to-purple-500 transition-all"
            >
              <SparklesIcon className="w-4 h-4" />
              AI로 생성
            </button>
            <button
              onClick={() => handleOpenCreator('upload')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <PlusCircleIcon className="w-4 h-4" />
              업로드
            </button>
          </div>
        </div>

        {/* 카테고리 탭 */}
        <div className="flex gap-1 p-1 bg-gray-900/50 rounded-lg">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCategory(cat.key);
                setRoleFilter('all');
              }}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                activeCategory === cat.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              {cat.label}
              <span className="ml-1.5 text-xs opacity-70">({cat.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 필터 바 */}
      <div className="flex-shrink-0 p-3 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center gap-3">
          {/* 검색 */}
          <div className="flex-grow">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 또는 설명으로 검색..."
              className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
            />
          </div>

          {/* 역할 필터 */}
          {roleFilterOptions.length > 1 && (
            <div className="flex gap-1">
              {roleFilterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRoleFilter(opt.value as RoleFilter)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    roleFilter === opt.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {'icon' in opt && <span className="mr-1">{opt.icon}</span>}
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 에셋 그리드 */}
      <div className="flex-grow overflow-y-auto p-4">
        {/* 캐릭터 그리드 */}
        {activeCategory === 'character' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredCharacters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                isSelected={selectedAssetId === character.id}
                isActive={activeCharacterIds.includes(character.id)}
                onClick={() => handleAssetClick(character)}
                onActivate={() => toggleActiveCharacter(character.id)}
                onDelete={() => handleDeleteAsset(character.id)}
              />
            ))}
            {filteredCharacters.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500">
                <p className="text-sm">등록된 캐릭터가 없습니다.</p>
                <p className="text-xs mt-1">AI로 생성하거나 이미지를 업로드하세요.</p>
              </div>
            )}
          </div>
        )}

        {/* 소품 그리드 */}
        {activeCategory === 'prop' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProps.map((prop) => (
              <PropCard
                key={prop.id}
                prop={prop}
                isSelected={selectedAssetId === prop.id}
                onClick={() => handleAssetClick(prop)}
                onDelete={() => handleDeleteAsset(prop.id)}
              />
            ))}
            {filteredProps.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500">
                <p className="text-sm">등록된 소품이 없습니다.</p>
                <p className="text-xs mt-1">AI로 생성하거나 이미지를 업로드하세요.</p>
              </div>
            )}
          </div>
        )}

        {/* 배경 그리드 */}
        {activeCategory === 'background' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredBackgrounds.map((bg) => (
              <BackgroundCard
                key={bg.id}
                background={bg}
                isSelected={selectedAssetId === bg.id}
                onClick={() => handleAssetClick(bg)}
                onDelete={() => handleDeleteAsset(bg.id)}
              />
            ))}
            {filteredBackgrounds.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500">
                <p className="text-sm">등록된 배경이 없습니다.</p>
                <p className="text-xs mt-1">AI로 생성하거나 이미지를 업로드하세요.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 활성화된 캐릭터 바 */}
      {activeCharacterIds.length > 0 && (
        <div className="flex-shrink-0 p-3 border-t border-gray-700 bg-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-400">
              활성화된 캐릭터 ({activeCharacterIds.length}/5):
            </span>
            <div className="flex gap-2">
              {activeCharacterIds.map((id) => {
                const char = characters.find((c) => c.id === id);
                if (!char) return null;
                return (
                  <div key={id} className="relative group">
                    <img
                      src={`data:${char.image.mimeType};base64,${char.image.data}`}
                      alt={char.name}
                      className="w-10 h-10 object-cover rounded-lg border-2 border-indigo-500"
                    />
                    <button
                      onClick={() => toggleActiveCharacter(id)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      {char.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 에셋 생성 모달 */}
      {isCreatorModalOpen && (
        <AssetCreatorModal
          isOpen={isCreatorModalOpen}
          onClose={() => setIsCreatorModalOpen(false)}
          category={activeCategory}
          mode={creatorMode}
        />
      )}
    </div>
  );
};

export default AssetTab;
