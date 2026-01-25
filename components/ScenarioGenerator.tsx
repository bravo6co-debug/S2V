import React, { useState } from 'react';
import { ScenarioConfig, ScenarioTone, TONE_OPTIONS } from '../types';
import { SparklesIcon, ClearIcon } from './Icons';

interface ScenarioGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: ScenarioConfig) => void;
  isLoading: boolean;
}

export const ScenarioGenerator: React.FC<ScenarioGeneratorProps> = ({
  isOpen,
  onClose,
  onGenerate,
  isLoading,
}) => {
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState<60 | 90 | 120>(60);
  const [tone, setTone] = useState<ScenarioTone>('emotional');

  const handleSubmit = () => {
    if (topic.trim()) {
      onGenerate({ topic: topic.trim(), duration, tone });
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setTopic('');
      setDuration(60);
      setTone('emotional');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div
        className="relative bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col gap-5 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          aria-label="Close modal"
        >
          <ClearIcon className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg">
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">시나리오 생성</h3>
            <p className="text-sm text-gray-400">주제를 입력하면 AI가 영상 시나리오를 작성합니다</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Topic Input */}
          <div>
            <label htmlFor="scenario-topic" className="text-sm font-medium text-gray-300 mb-2 block">
              영상 주제 <span className="text-red-400">*</span>
            </label>
            <textarea
              id="scenario-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 30대 여성이 퇴사 후 제주도에서 카페를 열며 새로운 삶을 시작하는 이야기"
              className="w-full h-28 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:outline-none transition-all text-sm resize-none"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              구체적인 상황, 인물, 감정을 포함할수록 더 좋은 시나리오가 생성됩니다
            </p>
          </div>

          {/* Duration Selection */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">영상 길이</label>
            <div className="grid grid-cols-3 gap-3">
              {([60, 90, 120] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  disabled={isLoading}
                  className={`py-3 px-4 rounded-lg font-medium transition-all ${
                    duration === d
                      ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  } disabled:opacity-50`}
                >
                  <div className="text-lg">{d === 60 ? '1분' : d === 90 ? '1분 30초' : '2분'}</div>
                  <div className="text-xs opacity-70">{Math.floor(d / 10)}~{Math.ceil(d / 8)}개 씬</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tone Selection */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">톤/분위기</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TONE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTone(option.value)}
                  disabled={isLoading}
                  title={option.description}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    tone === option.value
                      ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  } disabled:opacity-50`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-5 py-2.5 text-sm font-medium text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !topic.trim()}
            className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                생성 중...
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                시나리오 생성
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
