import React, { useState, useEffect, useMemo } from 'react';
import { Character } from '../../types';
import {
  CAMERA_ANGLES,
  CAMERA_MOVEMENTS,
  ENVIRONMENTS,
  STYLES,
  QUALITY_KEYWORDS,
  NEGATIVE_PROMPTS,
  MOODS,
  CameraAngleKey,
  CameraMovementKey,
  EnvironmentKey,
  StyleKey,
  QualityKey,
  OptionalNegativeKey,
  MoodKey,
} from '../../constants/videoPromptPresets';
import {
  VideoPromptConfig,
  GeneratedPrompt,
  createDefaultConfig,
  buildVideoPrompt,
  getAIRecommendation,
  applyRecommendation,
  validateConfig,
} from '../../utils/videoPromptBuilder';

// Icons
const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

interface VideoPromptBuilderProps {
  character?: Character;
  initialAction?: string;
  onGenerate: (prompt: string, negativePrompt: string) => void;
  onCancel: () => void;
  isGenerating?: boolean;
}

export const VideoPromptBuilder: React.FC<VideoPromptBuilderProps> = ({
  character,
  initialAction = '',
  onGenerate,
  onCancel,
  isGenerating = false,
}) => {
  // State
  const [config, setConfig] = useState<VideoPromptConfig>(() =>
    createDefaultConfig(character, initialAction)
  );
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Update character when prop changes
  useEffect(() => {
    setConfig(prev => ({ ...prev, character }));
  }, [character]);

  // Build prompt preview
  const generatedPrompt: GeneratedPrompt = useMemo(() => {
    return buildVideoPrompt(config);
  }, [config]);

  // AI Recommendation
  const aiRecommendation = useMemo(() => {
    if (config.action.trim().length > 2) {
      return getAIRecommendation(config.action, selectedMood || undefined);
    }
    return null;
  }, [config.action, selectedMood]);

  // Apply AI recommendation
  const handleApplyRecommendation = () => {
    if (aiRecommendation) {
      setConfig(prev => applyRecommendation(prev, aiRecommendation));
    }
  };

  // Handle mood selection
  const handleMoodSelect = (mood: MoodKey) => {
    setSelectedMood(mood);
    const recommendation = getAIRecommendation(config.action, mood);
    setConfig(prev => applyRecommendation(prev, recommendation));
  };

  // Handle generate
  const handleGenerate = () => {
    const validationErrors = validateConfig(config);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    onGenerate(generatedPrompt.fullPrompt, generatedPrompt.negativePrompt);
  };

  // Update config helper
  const updateConfig = <K extends keyof VideoPromptConfig>(
    key: K,
    value: VideoPromptConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // Toggle style
  const toggleStyle = (styleKey: StyleKey) => {
    setConfig(prev => ({
      ...prev,
      styles: prev.styles.includes(styleKey)
        ? prev.styles.filter(s => s !== styleKey)
        : [...prev.styles, styleKey]
    }));
  };

  // Toggle quality
  const toggleQuality = (qualityKey: QualityKey) => {
    setConfig(prev => ({
      ...prev,
      quality: prev.quality.includes(qualityKey)
        ? prev.quality.filter(q => q !== qualityKey)
        : [...prev.quality, qualityKey]
    }));
  };

  // Toggle negative optional
  const toggleNegative = (negativeKey: OptionalNegativeKey) => {
    setConfig(prev => ({
      ...prev,
      negativeOptional: prev.negativeOptional.includes(negativeKey)
        ? prev.negativeOptional.filter(n => n !== negativeKey)
        : [...prev.negativeOptional, negativeKey]
    }));
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-900">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-blue-400" />
          영상 프롬프트 빌더
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          고품질 영상을 위한 최적화된 프롬프트를 생성합니다
        </p>
      </div>

      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Character Display */}
        {character && (
          <div className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg">
            <img
              src={`data:${character.image.mimeType};base64,${character.image.data}`}
              alt={character.name}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div>
              <p className="text-white font-medium">{character.name}</p>
              <p className="text-xs text-gray-400">{character.age}세 · {character.personality}</p>
            </div>
          </div>
        )}

        {/* Action Input (Required) */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            동작 설명 <span className="text-red-400">*</span>
          </label>
          <textarea
            value={config.action}
            onChange={(e) => updateConfig('action', e.target.value)}
            placeholder="예: 맥주병 뚜껑을 이빨로 따며 장난스럽게 웃는다"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 동사로 시작하세요: "~한다", "~하며"
          </p>
        </div>

        {/* Mood Selection */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            분위기 선택
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MOODS) as MoodKey[]).map((moodKey) => (
              <button
                key={moodKey}
                onClick={() => handleMoodSelect(moodKey)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  selectedMood === moodKey
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {MOODS[moodKey].labelKo}
              </button>
            ))}
          </div>
        </div>

        {/* AI Recommendation */}
        {aiRecommendation && (
          <div className="p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-blue-300 flex items-center gap-1">
                  <SparklesIcon className="w-4 h-4" />
                  AI 추천 설정
                </p>
                <p className="text-xs text-blue-400 mt-1">{aiRecommendation.reasoning}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-blue-800/50 rounded text-xs text-blue-200">
                    📷 {CAMERA_ANGLES[aiRecommendation.cameraAngle].labelKo}
                  </span>
                  <span className="px-2 py-0.5 bg-blue-800/50 rounded text-xs text-blue-200">
                    🎬 {CAMERA_MOVEMENTS[aiRecommendation.cameraMovement].labelKo}
                  </span>
                  <span className="px-2 py-0.5 bg-blue-800/50 rounded text-xs text-blue-200">
                    🌃 {ENVIRONMENTS[aiRecommendation.environment].labelKo}
                  </span>
                </div>
              </div>
              <button
                onClick={handleApplyRecommendation}
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-500"
              >
                적용
              </button>
            </div>
          </div>
        )}

        {/* Advanced Options Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full px-3 py-2 bg-gray-700 rounded-lg text-gray-300 hover:bg-gray-600"
        >
          <span className="text-sm font-medium">⚙️ 고급 옵션</span>
          {showAdvanced ? (
            <ChevronUpIcon className="w-4 h-4" />
          ) : (
            <ChevronDownIcon className="w-4 h-4" />
          )}
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
            {/* Camera Angle */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                카메라 앵글
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(CAMERA_ANGLES) as CameraAngleKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => updateConfig('cameraAngle', key)}
                    className={`px-2 py-1.5 text-xs rounded transition-colors ${
                      config.cameraAngle === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    title={CAMERA_ANGLES[key].description}
                  >
                    {CAMERA_ANGLES[key].labelKo}
                  </button>
                ))}
              </div>
            </div>

            {/* Camera Movement */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                카메라 무빙
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(CAMERA_MOVEMENTS) as CameraMovementKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => updateConfig('cameraMovement', key)}
                    className={`px-2 py-1.5 text-xs rounded transition-colors ${
                      config.cameraMovement === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    title={CAMERA_MOVEMENTS[key].description}
                  >
                    {CAMERA_MOVEMENTS[key].labelKo}
                  </button>
                ))}
              </div>
            </div>

            {/* Environment */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                환경/조명
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(ENVIRONMENTS) as EnvironmentKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => updateConfig('environment', key)}
                    className={`px-2 py-1.5 text-xs rounded transition-colors ${
                      config.environment === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {ENVIRONMENTS[key].labelKo}
                  </button>
                ))}
              </div>
            </div>

            {/* Styles */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                스타일
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STYLES) as StyleKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => toggleStyle(key)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      config.styles.includes(key)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {config.styles.includes(key) ? '✓ ' : ''}{STYLES[key].labelKo}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                품질
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(QUALITY_KEYWORDS) as QualityKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => toggleQuality(key)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      config.quality.includes(key)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {config.quality.includes(key) ? '✓ ' : ''}{QUALITY_KEYWORDS[key].labelKo}
                  </button>
                ))}
              </div>
            </div>

            {/* Negative Prompts */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                추가 금지 옵션
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(NEGATIVE_PROMPTS.optional) as OptionalNegativeKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => toggleNegative(key)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      config.negativeOptional.includes(key)
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {config.negativeOptional.includes(key) ? '✓ ' : ''}{NEGATIVE_PROMPTS.optional[key].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Prompt Preview */}
        <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
          <p className="text-xs text-gray-500 mb-2">📝 생성될 프롬프트 미리보기:</p>
          <p className="text-sm text-gray-300 leading-relaxed">
            {generatedPrompt.fullPrompt || '동작을 입력하면 프롬프트가 생성됩니다.'}
          </p>
          {generatedPrompt.negativePrompt && (
            <>
              <p className="text-xs text-gray-500 mt-3 mb-1">🚫 Negative:</p>
              <p className="text-xs text-gray-500">{generatedPrompt.negativePrompt}</p>
            </>
          )}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg">
            {errors.map((error, idx) => (
              <p key={idx} className="text-sm text-red-300">{error}</p>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 p-4 border-t border-gray-700 bg-gray-900">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
        >
          취소
        </button>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !config.action.trim()}
          className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <SparklesIcon className="w-4 h-4" />
          {isGenerating ? '생성 중...' : '영상 생성 (8초)'}
        </button>
      </div>
    </div>
  );
};

export default VideoPromptBuilder;
