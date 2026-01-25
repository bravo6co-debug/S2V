import React from 'react';
import type { SuggestedCharacter } from '../../types';

interface SuggestedCharacterCardProps {
  character: SuggestedCharacter;
  isCreated: boolean;
  onCreateClick: () => void;
}

const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const SuggestedCharacterCard: React.FC<SuggestedCharacterCardProps> = ({
  character,
  isCreated,
  onCreateClick,
}) => {
  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        isCreated
          ? 'border-green-500/50 bg-green-500/10'
          : 'border-gray-600 bg-gray-700/50 hover:bg-gray-700'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-white truncate">{character.name}</h4>
            <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-600 rounded">
              {character.role}
            </span>
          </div>
          <p className="text-sm text-gray-300 mt-1 line-clamp-2">{character.description}</p>
        </div>
        <div className="flex-shrink-0">
          {isCreated ? (
            <CheckCircleIcon className="w-5 h-5 text-green-500" />
          ) : (
            <button
              onClick={onCreateClick}
              className="px-2.5 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-500 transition-colors"
            >
              생성
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuggestedCharacterCard;
