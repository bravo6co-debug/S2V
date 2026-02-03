import React, { useState, useRef } from 'react';
import type { LongformScenario, LongformConfig, LongformCharacter, CharacterRole } from '../../types/longform';
import type { CharacterExtractionStatus } from '../../hooks/useLongformCharacters';

interface Step3CharacterSetupProps {
  scenario: LongformScenario;
  config: LongformConfig;
  characters: LongformCharacter[];
  extractionStatus: CharacterExtractionStatus;
  onExtractCharacters: (scenario: LongformScenario) => Promise<void>;
  onUpdateCharacter: (characterId: string, updates: Partial<LongformCharacter>) => void;
  onRemoveCharacter: (characterId: string) => void;
  onAddCharacter: () => void;
  onGenerateImage: (characterId: string) => Promise<void>;
  onGenerateAllImages: () => Promise<void>;
  onPrev: () => void;
  onNext: () => void;
}

const ROLE_LABELS: Record<CharacterRole, string> = {
  main: '주인공',
  supporting: '조연',
  minor: '단역',
};

const ROLE_COLORS: Record<CharacterRole, string> = {
  main: 'bg-yellow-600/30 text-yellow-300 border-yellow-600/50',
  supporting: 'bg-blue-600/30 text-blue-300 border-blue-600/50',
  minor: 'bg-gray-600/30 text-gray-300 border-gray-600/50',
};

// ─── 캐릭터 카드 ──────────────────────────────────
interface CharacterCardProps {
  character: LongformCharacter;
  totalScenes: number;
  onUpdate: (updates: Partial<LongformCharacter>) => void;
  onRemove: () => void;
  onGenerateImage: () => void;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character, totalScenes, onUpdate, onRemove, onGenerateImage }) => {
  const [expanded, setExpanded] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) {
      alert('이미지 크기는 4MB 이하여야 합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      const mimeType = file.type || 'image/png';
      onUpdate({ referenceImage: { mimeType, data: base64 }, imageStatus: 'completed' });
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleScene = (sceneNum: number) => {
    const current = character.sceneNumbers;
    const updated = current.includes(sceneNum)
      ? current.filter(n => n !== sceneNum)
      : [...current, sceneNum].sort((a, b) => a - b);
    onUpdate({ sceneNumbers: updated });
  };

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
      {/* Header (always visible) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-700/30 transition-colors min-h-[44px]"
      >
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-lg bg-gray-700 flex-shrink-0 overflow-hidden">
          {character.referenceImage ? (
            <img
              src={`data:${character.referenceImage.mimeType};base64,${character.referenceImage.data}`}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-lg">
              {character.imageStatus === 'generating' ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : '?'}
            </div>
          )}
        </div>

        {/* Name + Role */}
        <div className="flex-1 text-left">
          <span className="text-white font-medium text-sm">{character.name}</span>
          <span className="text-gray-500 text-xs ml-1">({character.nameEn})</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[character.role]}`}>
          {ROLE_LABELS[character.role]}
        </span>
        <span className="text-gray-500 text-xs">{character.sceneNumbers.length}씬</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            {/* Name (Korean) */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">이름 (한국어)</label>
              <input
                type="text"
                value={character.name}
                onChange={e => onUpdate({ name: e.target.value })}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white min-h-[44px]"
              />
            </div>
            {/* Name (English) */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">이름 (영어)</label>
              <input
                type="text"
                value={character.nameEn}
                onChange={e => onUpdate({ nameEn: e.target.value })}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white min-h-[44px]"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">역할</label>
            <select
              value={character.role}
              onChange={e => onUpdate({ role: e.target.value as CharacterRole })}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white min-h-[44px]"
            >
              <option value="main">주인공</option>
              <option value="supporting">조연</option>
              <option value="minor">단역</option>
            </select>
          </div>

          {/* Appearance (English) */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">외형 묘사 (영어 — 이미지 생성에 사용)</label>
            <textarea
              value={character.appearanceDescription}
              onChange={e => onUpdate({ appearanceDescription: e.target.value })}
              rows={3}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none"
              placeholder="e.g. Young Korean man in mid-20s, short black hair, sharp jawline..."
            />
          </div>

          {/* Outfit (English) */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">의상 (영어)</label>
            <textarea
              value={character.outfit}
              onChange={e => onUpdate({ outfit: e.target.value })}
              rows={2}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none"
              placeholder="e.g. Navy blue hoodie, black jeans, white sneakers"
            />
          </div>

          {/* Personality (Korean) */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">성격 (한국어)</label>
            <textarea
              value={character.personality}
              onChange={e => onUpdate({ personality: e.target.value })}
              rows={2}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none"
              placeholder="호기심 많고 활발한 성격..."
            />
          </div>

          {/* Scene numbers */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">등장 씬 (클릭하여 토글)</label>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: totalScenes }, (_, i) => i + 1).map(num => {
                const active = character.sceneNumbers.includes(num);
                return (
                  <button
                    key={num}
                    onClick={() => toggleScene(num)}
                    className={`w-8 h-8 text-xs rounded-md font-medium transition-colors ${
                      active
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-700/50 text-gray-500 hover:bg-gray-700'
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reference image + actions */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {character.referenceImage && (
              <img
                src={`data:${character.referenceImage.mimeType};base64,${character.referenceImage.data}`}
                alt={character.name}
                className="w-20 h-20 rounded-lg object-cover border border-gray-700"
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={character.imageStatus === 'generating'}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs rounded-lg transition-colors min-h-[36px]"
            >
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                이미지 업로드
              </span>
            </button>
            <button
              onClick={onGenerateImage}
              disabled={character.imageStatus === 'generating' || !character.appearanceDescription}
              className="px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs rounded-lg transition-colors min-h-[36px]"
            >
              {character.imageStatus === 'generating' ? '생성 중...' : character.referenceImage ? '다시 생성' : 'AI 생성'}
            </button>
            {character.imageStatus === 'failed' && (
              <span className="text-red-400 text-xs">실패</span>
            )}

            {/* Delete */}
            <div className="ml-auto">
              {confirmDelete ? (
                <div className="flex items-center gap-1">
                  <button onClick={onRemove} className="px-2 py-1 bg-red-600 text-white text-xs rounded min-h-[32px]">삭제</button>
                  <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded min-h-[32px]">취소</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1.5 text-gray-500 hover:text-red-400 transition-colors min-h-[32px]"
                  title="캐릭터 삭제"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Step3 메인 ────────────────────────────────────
export const Step3CharacterSetup: React.FC<Step3CharacterSetupProps> = ({
  scenario,
  config,
  characters,
  extractionStatus,
  onExtractCharacters,
  onUpdateCharacter,
  onRemoveCharacter,
  onAddCharacter,
  onGenerateImage,
  onGenerateAllImages,
  onPrev,
  onNext,
}) => {
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const hasMainWithoutImage = characters.some(c => c.role === 'main' && !c.referenceImage);
  const anyGenerating = characters.some(c => c.imageStatus === 'generating');

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    try {
      await onGenerateAllImages();
    } finally {
      setIsGeneratingAll(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 py-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">캐릭터 설정</h2>
        <p className="text-sm text-gray-400 mt-1">
          시나리오에서 등장인물을 추출하고 레퍼런스 이미지를 생성합니다. 씬 이미지 생성 시 캐릭터 외형이 자동으로 반영됩니다.
        </p>
      </div>

      {/* Extract button */}
      {(extractionStatus === 'idle' || extractionStatus === 'failed') && characters.length === 0 && (
        <div className="text-center py-8 bg-gray-800/40 rounded-xl border border-gray-700/50">
          <p className="text-gray-400 text-sm mb-4">
            {extractionStatus === 'failed'
              ? '캐릭터 추출에 실패했습니다. 다시 시도해주세요.'
              : '시나리오에서 등장인물을 자동으로 추출합니다.'}
          </p>
          <button
            onClick={() => onExtractCharacters(scenario)}
            className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-medium rounded-lg transition-all min-h-[44px]"
          >
            캐릭터 자동 추출
          </button>
        </div>
      )}

      {/* Extracting spinner */}
      {extractionStatus === 'extracting' && (
        <div className="text-center py-12">
          <svg className="w-8 h-8 animate-spin text-teal-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-400 text-sm">시나리오에서 캐릭터를 추출하는 중...</p>
        </div>
      )}

      {/* Character list */}
      {characters.length > 0 && (
        <>
          <div className="text-sm text-gray-400">
            추출된 캐릭터: {characters.length}명
            {characters.filter(c => c.role === 'main').length > 0 && (
              <span className="ml-2 text-yellow-400">
                (주인공 {characters.filter(c => c.role === 'main').length}명)
              </span>
            )}
          </div>

          <div className="space-y-3">
            {characters.map(char => (
              <CharacterCard
                key={char.id}
                character={char}
                totalScenes={scenario.scenes.length}
                onUpdate={updates => onUpdateCharacter(char.id, updates)}
                onRemove={() => onRemoveCharacter(char.id)}
                onGenerateImage={() => onGenerateImage(char.id)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onAddCharacter}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors min-h-[44px]"
            >
              + 캐릭터 추가
            </button>
            <button
              onClick={() => onExtractCharacters(scenario)}
              disabled={extractionStatus === 'extracting'}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-gray-300 text-sm rounded-lg transition-colors min-h-[44px]"
            >
              다시 추출
            </button>
            <button
              onClick={handleGenerateAll}
              disabled={isGeneratingAll || anyGenerating || characters.every(c => c.imageStatus === 'completed')}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors min-h-[44px]"
            >
              {isGeneratingAll || anyGenerating ? '이미지 생성 중...' : '전체 레퍼런스 이미지 생성'}
            </button>
          </div>
        </>
      )}

      {/* No characters message (after extraction) */}
      {extractionStatus === 'completed' && characters.length === 0 && (
        <div className="text-center py-6 bg-gray-800/40 rounded-xl border border-gray-700/50">
          <p className="text-gray-400 text-sm mb-3">
            시나리오에서 캐릭터가 감지되지 않았습니다. 풍경/다큐멘터리 스타일 영상일 수 있습니다.
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={onAddCharacter}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg min-h-[44px]"
            >
              수동으로 추가
            </button>
            <button
              onClick={() => onExtractCharacters(scenario)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg min-h-[44px]"
            >
              다시 추출
            </button>
          </div>
        </div>
      )}

      {/* Warning for main character without image */}
      {hasMainWithoutImage && characters.length > 0 && (
        <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
          <p className="text-yellow-400 text-xs">
            주인공 캐릭터에 레퍼런스 이미지가 없습니다. 이미지 없이 진행하면 씬별 일관성이 텍스트 설명에만 의존합니다.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-gray-700/50">
        <button
          onClick={onPrev}
          className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm min-h-[44px]"
        >
          이전 단계
        </button>
        <button
          onClick={onNext}
          disabled={extractionStatus === 'extracting' || anyGenerating}
          className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-lg transition-all min-h-[44px]"
        >
          다음 단계: 에셋 생성
        </button>
      </div>
    </div>
  );
};
