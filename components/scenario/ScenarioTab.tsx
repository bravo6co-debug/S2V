import React, { useState, useRef, useMemo } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { useScenario } from '../../hooks/useScenario';
import { useQuickCharacterGeneration } from '../../hooks/useQuickCharacterGeneration';
import { TTSVoice } from '../../services/apiClient';
import { compressImageFile } from '../../services/imageCompression';
import {
  ScenarioConfig,
  Scene,
  ImageData,
  ScenarioTone,
  ScenarioMode,
  ImageStyle,
  AspectRatio,
  SuggestedCharacter,
  CharacterAsset,
  CharacterRole,
  TONE_OPTIONS,
  SCENARIO_MODE_OPTIONS,
  IMAGE_STYLE_OPTIONS,
  AVAILABLE_IMAGE_MODELS,
} from '../../types';
import { SuggestedCharacterCard } from './SuggestedCharacterCard';
import { AssetManagementSection } from './AssetManagementSection';
import ApiKeyRequiredModal from '../ApiKeyRequiredModal';

// TTS 음성 옵션
const TTS_VOICE_OPTIONS: { value: TTSVoice; label: string }[] = [
  { value: 'Kore', label: 'Kore (한국어 여성)' },
  { value: 'Aoede', label: 'Aoede (여성)' },
  { value: 'Charon', label: 'Charon (남성)' },
  { value: 'Fenrir', label: 'Fenrir (남성, 깊은)' },
  { value: 'Puck', label: 'Puck (중성)' },
];
import {
  SparklesIcon,
  ClearIcon,
  PlusCircleIcon,
  UploadIcon,
  LayersIcon,
  DownloadIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '../Icons';

// 분리된 컴포넌트 import
import { SceneCard } from './SceneCard';

// Scenario Generator Modal
interface ScenarioGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: ScenarioConfig) => void;
  isLoading: boolean;
  defaultImageStyle: ImageStyle;
}

const ScenarioGeneratorModal: React.FC<ScenarioGeneratorModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  isLoading,
  defaultImageStyle,
}) => {
  const [topic, setTopic] = useState('');
  const [durationPreset, setDurationPreset] = useState<30 | 60 | 90 | 120 | 180 | 300 | 600 | null>(60);
  const [customDuration, setCustomDuration] = useState('');
  const [tone, setTone] = useState<ScenarioTone | 'custom'>('emotional');
  const [customTone, setCustomTone] = useState('');
  const [mode, setMode] = useState<ScenarioMode>('character');
  const [includeCharacters, setIncludeCharacters] = useState(false);  // 환경 모드에서 캐릭터 포함 여부
  const [imageStyle, setImageStyle] = useState<ImageStyle>(defaultImageStyle);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');  // 영상 비율

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!topic.trim()) return;

    const duration = durationPreset || parseInt(customDuration, 10) || 60;
    const config: ScenarioConfig = {
      topic: topic.trim(),
      duration,
      durationPreset: durationPreset || undefined,
      tone,
      customTone: tone === 'custom' ? customTone : undefined,
      mode,
      imageStyle,
      aspectRatio,
      includeCharacters: mode === 'environment' ? includeCharacters : undefined,
    };
    onGenerate(config);
  };

  const handleClose = () => {
    if (!isLoading) {
      setTopic('');
      setDurationPreset(60);
      setCustomDuration('');
      setTone('emotional');
      setCustomTone('');
      setMode('character');
      setIncludeCharacters(false);
      setImageStyle(defaultImageStyle);
      setAspectRatio('16:9');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="relative bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-2xl h-[90vh] sm:h-auto sm:max-h-[95vh] flex flex-col gap-3 sm:gap-5 p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleClose}
          disabled={isLoading}
          className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <ClearIcon className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg">
            <SparklesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white">시나리오 생성</h3>
            <p className="text-xs sm:text-sm text-gray-400">주제를 입력하면 AI가 영상 시나리오를 작성합니다</p>
          </div>
        </div>

        <div className="space-y-4 flex-grow overflow-y-auto pr-1 sm:pr-2 sm:max-h-[60vh]">
          {/* Topic Input */}
          <div>
            <label className="text-xs sm:text-sm font-medium text-gray-300 mb-2 block">
              영상 주제 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 30대 여성이 퇴사 후 제주도에서 카페를 열며 새로운 삶을 시작하는 이야기"
              className="w-full h-24 p-2 sm:p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Scenario Mode Selection */}
          <div>
            <label className="text-xs sm:text-sm font-medium text-gray-300 mb-2 block">시나리오 모드</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SCENARIO_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setMode(option.value)}
                  disabled={isLoading}
                  className={`min-h-[44px] flex items-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all text-left ${
                    mode === option.value
                      ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  } disabled:opacity-50`}
                >
                  <span className="text-lg">{option.emoji}</span>
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs opacity-70">{option.description}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* 환경/풍경 모드일 때 캐릭터 포함 옵션 */}
            {mode === 'environment' && (
              <div className="mt-3 p-2 sm:p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={includeCharacters}
                    onChange={(e) => setIncludeCharacters(e.target.checked)}
                    disabled={isLoading}
                    className="w-5 h-5 sm:w-4 sm:h-4 text-purple-600 bg-gray-700 border-gray-500 rounded focus:ring-purple-500 focus:ring-2"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-medium text-gray-200">캐릭터를 조연으로 가끔 등장</span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      풍경 중심이지만 캐릭터가 작게 또는 실루엣으로 등장합니다
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Image Style Selection */}
          <div>
            <label className="text-xs sm:text-sm font-medium text-gray-300 mb-2 block">이미지 스타일</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {IMAGE_STYLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setImageStyle(option.value)}
                  disabled={isLoading}
                  className={`min-h-[44px] flex items-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    imageStyle === option.value
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  } disabled:opacity-50`}
                >
                  <span>{option.emoji}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio Selection */}
          <div>
            <label className="text-xs sm:text-sm font-medium text-gray-300 mb-2 block">영상 비율</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAspectRatio('16:9')}
                disabled={isLoading}
                className={`min-h-[44px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  aspectRatio === '16:9'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                <span className="text-lg">📺</span>
                <div className="text-left">
                  <div>가로형 (16:9)</div>
                  <div className="text-xs opacity-70">YouTube, PC</div>
                </div>
              </button>
              <button
                onClick={() => setAspectRatio('9:16')}
                disabled={isLoading}
                className={`min-h-[44px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  aspectRatio === '9:16'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                <span className="text-lg">📱</span>
                <div className="text-left">
                  <div>세로형 (9:16)</div>
                  <div className="text-xs opacity-70">Shorts, Reels, TikTok</div>
                </div>
              </button>
            </div>
          </div>

          {/* Duration Selection */}
          <div>
            <label className="text-xs sm:text-sm font-medium text-gray-300 mb-2 block">영상 길이</label>
            <div className="space-y-2">
              {/* 숏폼 (30초 ~ 2분) */}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">숏폼</p>
                <div className="grid grid-cols-4 gap-2">
                  {([30, 60, 90, 120] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDurationPreset(d);
                        setCustomDuration('');
                      }}
                      disabled={isLoading}
                      className={`min-h-[44px] py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                        durationPreset === d
                          ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      } disabled:opacity-50`}
                    >
                      {d}초
                    </button>
                  ))}
                </div>
              </div>
              {/* 장편 (3분 ~ 10분) */}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">장편 (챕터 구조)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([180, 300, 600] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDurationPreset(d);
                        setCustomDuration('');
                      }}
                      disabled={isLoading}
                      className={`min-h-[44px] py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                        durationPreset === d
                          ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      } disabled:opacity-50`}
                    >
                      {d >= 60 ? `${d / 60}분` : `${d}초`}
                    </button>
                  ))}
                  <div className="relative">
                    <input
                      type="number"
                      value={customDuration}
                      onChange={(e) => {
                        setCustomDuration(e.target.value);
                        setDurationPreset(null);
                      }}
                      placeholder="직접(초)"
                      className={`w-full h-full min-h-[44px] py-2 px-2 rounded-lg text-[16px] sm:text-xs text-center bg-gray-700 border transition-all ${
                        customDuration && !durationPreset
                          ? 'border-purple-500 ring-2 ring-purple-400'
                          : 'border-gray-600'
                      } focus:outline-none`}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tone Selection */}
          <div>
            <label className="text-xs sm:text-sm font-medium text-gray-300 mb-2 block">톤/분위기</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TONE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTone(option.value)}
                  disabled={isLoading}
                  title={option.description}
                  className={`min-h-[44px] py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                    tone === option.value
                      ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  } disabled:opacity-50`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <button
                onClick={() => setTone('custom')}
                disabled={isLoading}
                className={`min-h-[44px] w-full py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all text-left ${
                  tone === 'custom'
                    ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                직접 입력
              </button>
              {tone === 'custom' && (
                <input
                  type="text"
                  value={customTone}
                  onChange={(e) => setCustomTone(e.target.value)}
                  placeholder="예: 긴장감 있는 스릴러 + 약간의 유머"
                  className="w-full mt-2 p-2.5 bg-gray-700 border border-gray-600 rounded-lg text-[16px] sm:text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  disabled={isLoading}
                />
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2 flex-shrink-0">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="min-h-[44px] px-5 py-2.5 text-sm font-medium text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !topic.trim()}
            className="min-h-[44px] px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

// Main Scenario Tab Component
export const ScenarioTab: React.FC = () => {
  const {
    characters,
    activeCharacterIds,
    toggleActiveCharacter,
    addCharacter,
    props,
    activePropIds,
    toggleActiveProp,
    backgrounds,
    activeBackgroundId,
    setActiveBackgroundId,
    aspectRatio,
    setAspectRatio,
    imageStyle: projectImageStyle,
    setImageStyle: setProjectImageStyle,
  } = useProject();

  // 인증 상태 확인
  const { isAuthenticated, canUseApi, settings: authSettings } = useAuth();

  // Quick character generation hook
  const {
    isGenerating: isQuickGenerating,
    generatingCharacterName,
    error: quickGenError,
    generateCharacter: quickGenerateCharacter,
    generateAllMissing,
    clearError: clearQuickGenError,
  } = useQuickCharacterGeneration();
  const {
    scenario,
    isGenerating,
    generatingImageSceneId,
    isGeneratingAllImages,
    isGeneratingTTS,
    ttsProgress,
    error,
    generateScenario,
    updateScene,
    removeScene,
    generateSceneImage,
    generateAllSceneImages,
    replaceSceneImage,
    downloadSceneImage,
    saveScenarioToFile,
    loadScenarioFromFile,
    setScenario,
    clearError,
    updateSuggestedCharacter,
    updateImagePrompt,
    updatingPromptSceneId,
  } = useScenario();

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);
  const [ttsVoice, setTtsVoice] = useState<TTSVoice>('Kore');
  const [isCharacterSectionCollapsed, setIsCharacterSectionCollapsed] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 씬 업데이트 핸들러 (시각적 묘사 변경 시 imagePrompt 자동 업데이트)
  const handleUpdateScene = async (sceneId: string, updates: Partial<Scene> & { needsPromptUpdate?: boolean }) => {
    const { needsPromptUpdate, ...sceneUpdates } = updates;

    // 기본 업데이트 먼저 적용
    updateScene(sceneId, sceneUpdates);

    // 시각적 묘사가 변경되었으면 imagePrompt 업데이트
    if (needsPromptUpdate && sceneUpdates.visualDescription) {
      await updateImagePrompt(sceneId, sceneUpdates.visualDescription);
    }
  };

  // 시나리오 생성 버튼 클릭 핸들러 (인증 체크)
  const handleOpenGenerator = () => {
    if (!isAuthenticated || !canUseApi) {
      setShowApiKeyModal(true);
      return;
    }
    setIsGeneratorOpen(true);
  };

  // 제안된 캐릭터가 이미 생성되었는지 확인
  const isCharacterCreated = (characterName: string): boolean => {
    return characters.some(
      (c) => c.name.toLowerCase() === characterName.toLowerCase()
    );
  };

  // 생성된 캐릭터 썸네일 찾기
  const getCreatedCharacterThumbnail = (characterName: string) => {
    const char = characters.find(
      (c) => c.name.toLowerCase() === characterName.toLowerCase()
    );
    return char?.image;
  };

  // 미생성 캐릭터 목록
  const missingCharacters = useMemo(() => {
    if (!scenario?.suggestedCharacters) return [];
    return scenario.suggestedCharacters.filter(
      (char) => !isCharacterCreated(char.name)
    );
  }, [scenario?.suggestedCharacters, characters]);

  // 역할 매핑: suggestedCharacter.role → CharacterRole
  const mapRoleToCharacterRole = (role: string): CharacterRole => {
    const normalized = role.toLowerCase().trim();
    if (normalized.includes('주인공') || normalized.includes('main') || normalized.includes('protagonist')) {
      return 'protagonist';
    }
    if (normalized.includes('조연') || normalized.includes('supporting')) {
      return 'supporting';
    }
    return 'extra';
  };

  // 캐릭터 이미지 업로드 처리
  const handleUploadCharacterImage = (char: SuggestedCharacter, imageData: ImageData) => {
    const characterRole = mapRoleToCharacterRole(char.role);

    const newCharacter: CharacterAsset = {
      id: crypto.randomUUID(),
      name: char.name,
      role: characterRole,
      image: imageData,
      description: char.description,
      maintainContext: characterRole !== 'extra',
      age: '',
      personality: '',
      outfit: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    addCharacter(newCharacter);

    // 주인공/조연은 자동 활성화
    if (characterRole !== 'extra') {
      toggleActiveCharacter(newCharacter.id);
    }
  };

  // 모든 미생성 캐릭터 일괄 생성
  const handleGenerateAllMissingCharacters = async () => {
    if (!scenario?.suggestedCharacters) return;
    const existingNames = characters.map((c) => c.name);
    await generateAllMissing(scenario.suggestedCharacters, existingNames);
  };

  // 활성화된 캐릭터 목록
  const activeCharacters = activeCharacterIds
    .map(id => characters.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);

  // 활성화된 소품 목록
  const activeProps = activePropIds
    .map(id => props.find(p => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  // 활성화된 배경
  const activeBackground = activeBackgroundId
    ? backgrounds.find(b => b.id === activeBackgroundId)
    : null;

  // 참조 이미지 생성
  const characterImages = activeCharacters.map(c => c.image);
  const propImages = activeProps.map(p => p.image);
  const backgroundImage = activeBackground?.image || null;

  const handleGenerateScenario = async (config: ScenarioConfig) => {
    try {
      await generateScenario(config);
      // 시나리오 스타일을 프로젝트 스타일로 동기화 (캐릭터 생성 시 동일 스타일 적용)
      if (config.imageStyle) {
        setProjectImageStyle(config.imageStyle);
      }
      setIsGeneratorOpen(false);
    } catch (e) {
      // error is handled by hook
    }
  };

  const handleGenerateSceneImage = async (sceneId: string) => {
    // 인증 체크
    if (!isAuthenticated || !canUseApi) {
      setShowApiKeyModal(true);
      return;
    }
    // 캐릭터 일관성 향상을 위해 전체 캐릭터 목록도 전달
    await generateSceneImage(sceneId, characterImages, propImages, backgroundImage, characters);
  };

  const handleGenerateAllImages = async () => {
    // 인증 체크
    if (!isAuthenticated || !canUseApi) {
      setShowApiKeyModal(true);
      return;
    }
    // 캐릭터 일관성 향상을 위해 전체 캐릭터 목록도 전달
    await generateAllSceneImages(characterImages, propImages, backgroundImage, {
      includeTTS: true,
      ttsVoice: ttsVoice,
    }, characters);  // 전체 캐릭터 목록 전달
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await loadScenarioFromFile(file);
    }
  };

  const toneLabel = scenario
    ? TONE_OPTIONS.find((t) => t.value === scenario.tone)?.label || scenario.tone
    : '';

  const modeInfo = scenario
    ? SCENARIO_MODE_OPTIONS.find((m) => m.value === scenario.mode)
    : null;

  const styleInfo = scenario
    ? IMAGE_STYLE_OPTIONS.find((s) => s.value === scenario.imageStyle)
    : null;

  const totalGeneratedImages = scenario?.scenes.filter((s) => s.generatedImage || s.customImage).length || 0;

  return (
    <div className="h-full flex flex-col">
      {/* 시나리오가 없을 때 */}
      {!scenario ? (
        <div className="flex-grow flex flex-col items-center justify-center bg-gray-800/50 rounded-xl border border-gray-700 p-4 sm:p-8">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center">
              <SparklesIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-2">시나리오를 생성하세요</h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-6">
              AI가 주제에 맞는 영상 시나리오를 작성합니다.
              장면별 내레이션, 시각적 묘사, 이미지 프롬프트가 자동으로 생성됩니다.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleOpenGenerator}
                className="min-h-[44px] w-full px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-500 hover:to-indigo-500"
              >
                <SparklesIcon className="w-4 h-4 inline mr-2" />
                새 시나리오 생성
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] w-full px-6 py-3 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                <UploadIcon className="w-4 h-4 inline mr-2" />
                시나리오 불러오기
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* 시나리오가 있을 때 */
        <div className="h-full flex flex-col bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 p-3 sm:p-4 border-b border-gray-700 bg-gray-800">
            <div className="flex items-start justify-between gap-2 sm:gap-4">
              <div className="flex-grow min-w-0">
                <h2 className="text-base sm:text-xl font-bold text-white truncate">{scenario.title}</h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1 line-clamp-2">{scenario.synopsis}</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 text-xs">
                  <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                    {scenario.totalDuration >= 60
                      ? `${Math.floor(scenario.totalDuration / 60)}분 ${scenario.totalDuration % 60}초`
                      : `${scenario.totalDuration}초`}
                  </span>
                  {modeInfo && (
                    <span className="px-2 py-1 bg-indigo-900/50 rounded text-indigo-300">
                      {modeInfo.emoji} {modeInfo.label}
                    </span>
                  )}
                  {styleInfo && (
                    <span className="px-2 py-1 bg-cyan-900/50 rounded text-cyan-300">
                      {styleInfo.emoji} {styleInfo.label}
                    </span>
                  )}
                  <span className="px-2 py-1 bg-purple-900/50 rounded text-purple-300">{toneLabel}</span>
                  <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                    {scenario.scenes.length}개 씬
                  </span>
                  {scenario.chapters && scenario.chapters.length > 1 && (
                    <span className="px-2 py-1 bg-amber-900/50 rounded text-amber-300">
                      {scenario.chapters.length}개 챕터
                    </span>
                  )}
                  <span className="px-2 py-1 bg-green-900/50 rounded text-green-300">
                    {totalGeneratedImages}/{scenario.scenes.length} 이미지
                  </span>
                  {authSettings?.imageModel && (() => {
                    const modelInfo = AVAILABLE_IMAGE_MODELS.find(m => m.value === authSettings.imageModel);
                    const isFlux = authSettings.imageModel.startsWith('flux-kontext-');
                    return (
                      <span className={`px-2 py-1 rounded ${isFlux ? 'bg-orange-900/50 text-orange-300' : 'bg-blue-900/50 text-blue-300'}`}>
                        {modelInfo?.label || authSettings.imageModel}
                      </span>
                    );
                  })()}
                </div>
                {/* AI 추천 톤/분위기 */}
                {scenario.recommendedTone && scenario.recommendedTone !== scenario.tone && (
                  <div className="mt-2 p-2 bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-700/50 rounded-lg">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-purple-300 font-medium">AI 추천 톤:</span>
                      {(() => {
                        const recommendedToneInfo = TONE_OPTIONS.find(t => t.value === scenario.recommendedTone);
                        return recommendedToneInfo ? (
                          <span className="px-2 py-0.5 bg-purple-600/50 rounded text-purple-200 text-xs font-medium">
                            {recommendedToneInfo.label}
                          </span>
                        ) : null;
                      })()}
                      <button
                        onClick={() => {
                          if (scenario.recommendedTone) {
                            setScenario({
                              ...scenario,
                              tone: scenario.recommendedTone,
                              updatedAt: Date.now(),
                            });
                          }
                        }}
                        className="min-h-[44px] sm:min-h-0 px-2 py-0.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-500 transition-colors"
                      >
                        적용
                      </button>
                    </div>
                    {scenario.recommendedToneReason && (
                      <p className="text-xs text-purple-200/70 mt-1">{scenario.recommendedToneReason}</p>
                    )}
                  </div>
                )}
                {/* AI 추천 이미지 스타일 */}
                {scenario.recommendedImageStyle && scenario.recommendedImageStyle !== scenario.imageStyle && (
                  <div className="mt-2 p-2 bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border border-yellow-700/50 rounded-lg">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-yellow-300 font-medium">AI 추천 스타일:</span>
                      {(() => {
                        const recommendedInfo = IMAGE_STYLE_OPTIONS.find(s => s.value === scenario.recommendedImageStyle);
                        return recommendedInfo ? (
                          <span className="px-2 py-0.5 bg-yellow-600/50 rounded text-yellow-200 text-xs font-medium">
                            {recommendedInfo.emoji} {recommendedInfo.label}
                          </span>
                        ) : null;
                      })()}
                      <button
                        onClick={() => {
                          if (scenario.recommendedImageStyle) {
                            setScenario({
                              ...scenario,
                              imageStyle: scenario.recommendedImageStyle,
                              updatedAt: Date.now(),
                            });
                            setProjectImageStyle(scenario.recommendedImageStyle);
                          }
                        }}
                        className="min-h-[44px] sm:min-h-0 px-2 py-0.5 text-xs font-medium text-white bg-yellow-600 rounded hover:bg-yellow-500 transition-colors"
                      >
                        적용
                      </button>
                    </div>
                    {scenario.recommendedImageStyleReason && (
                      <p className="text-xs text-yellow-200/70 mt-1">{scenario.recommendedImageStyleReason}</p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setScenario(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-gray-400 hover:text-white"
                title="닫기"
              >
                <ClearIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Active Assets (Characters, Props, Background) */}
            {(activeCharacters.length > 0 || activeProps.length > 0 || activeBackground) && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <p className="text-xs font-medium text-gray-400 mb-2">활성화된 에셋 (이미지 생성 참조):</p>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 overflow-x-auto">
                  {/* 캐릭터 */}
                  {activeCharacters.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-indigo-400">캐릭터:</span>
                      <div className="flex gap-1">
                        {activeCharacters.map((char) => (
                          <div key={char.id} className="relative group" title={char.name}>
                            <img
                              src={`data:${char.image.mimeType};base64,${char.image.data}`}
                              alt={char.name}
                              className="w-8 h-8 object-cover rounded-lg border-2 border-indigo-500"
                            />
                            <button
                              onClick={() => toggleActiveCharacter(char.id)}
                              className="absolute -top-1 -right-1 w-5 h-5 sm:w-4 sm:h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 소품 */}
                  {activeProps.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-400">소품:</span>
                      <div className="flex gap-1">
                        {activeProps.map((prop) => (
                          <div key={prop.id} className="relative group" title={prop.name}>
                            <img
                              src={`data:${prop.image.mimeType};base64,${prop.image.data}`}
                              alt={prop.name}
                              className="w-8 h-8 object-cover rounded-lg border-2 border-amber-500"
                            />
                            <button
                              onClick={() => toggleActiveProp(prop.id)}
                              className="absolute -top-1 -right-1 w-5 h-5 sm:w-4 sm:h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 배경 */}
                  {activeBackground && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-400">배경:</span>
                      <div className="relative group" title={activeBackground.name}>
                        <img
                          src={`data:${activeBackground.image.mimeType};base64,${activeBackground.image.data}`}
                          alt={activeBackground.name}
                          className="w-12 h-8 object-cover rounded-lg border-2 border-green-500"
                        />
                        <button
                          onClick={() => setActiveBackgroundId(null)}
                          className="absolute -top-1 -right-1 w-5 h-5 sm:w-4 sm:h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          x
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 sm:mt-4">
              {/* TTS 음성 선택 */}
              <select
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value as TTSVoice)}
                disabled={isGeneratingAllImages || isGeneratingTTS}
                className="min-h-[44px] px-2 py-1.5 sm:py-2 text-[16px] sm:text-sm bg-gray-700 border border-gray-600 rounded-lg text-gray-300 focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:opacity-50"
              >
                {TTS_VOICE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleGenerateAllImages}
                disabled={isGeneratingAllImages || isGeneratingTTS || !!generatingImageSceneId}
                className="min-h-[44px] flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50"
              >
                <LayersIcon className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {isGeneratingAllImages
                    ? '이미지 생성 중...'
                    : isGeneratingTTS
                      ? `TTS 생성 중... (${ttsProgress.current}/${ttsProgress.total})`
                      : '전체 콘텐츠 생성'}
                </span>
                <span className="sm:hidden">
                  {isGeneratingAllImages
                    ? '이미지...'
                    : isGeneratingTTS
                      ? `TTS ${ttsProgress.current}/${ttsProgress.total}`
                      : '전체 생성'}
                </span>
              </button>
              <button
                onClick={saveScenarioToFile}
                className="min-h-[44px] flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                <DownloadIcon className="w-4 h-4" />
                <span className="hidden sm:inline">저장</span>
              </button>
              <button
                onClick={handleOpenGenerator}
                className="min-h-[44px] flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                <SparklesIcon className="w-4 h-4" />
                <span className="hidden sm:inline">새 시나리오</span>
                <span className="sm:hidden">새로</span>
              </button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-3 p-2 sm:p-3 bg-red-900/50 border border-red-700 rounded-lg text-xs sm:text-sm text-red-300 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={clearError} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-400 hover:text-red-300">
                  <ClearIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Suggested Characters */}
            {scenario.suggestedCharacters && scenario.suggestedCharacters.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div
                  className="flex items-center justify-between mb-2 cursor-pointer hover:bg-gray-700/50 -mx-2 px-2 py-1 rounded transition-colors min-h-[44px]"
                  onClick={() => setIsCharacterSectionCollapsed(!isCharacterSectionCollapsed)}
                >
                  <div className="flex items-center gap-2">
                    {isCharacterSectionCollapsed ? (
                      <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                    )}
                    <h3 className="text-xs sm:text-sm font-medium text-gray-300">
                      제안된 등장인물
                    </h3>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-gray-500">
                      {scenario.suggestedCharacters.filter(c => isCharacterCreated(c.name)).length}/{scenario.suggestedCharacters.length} 생성됨
                    </span>
                    {missingCharacters.length > 0 && (
                      <button
                        onClick={handleGenerateAllMissingCharacters}
                        disabled={isQuickGenerating}
                        className="min-h-[44px] px-2 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isQuickGenerating ? '생성중...' : `모두 생성 (${missingCharacters.length})`}
                      </button>
                    )}
                  </div>
                </div>
                {!isCharacterSectionCollapsed && (
                  <>
                    <p className="text-xs text-gray-400 mb-3">
                      시나리오에 필요한 캐릭터입니다. "생성" 버튼으로 AI가 자동 생성하거나, 업로드 아이콘으로 기존 이미지를 사용할 수 있습니다.
                    </p>
                    {quickGenError && (
                      <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-300 flex items-center justify-between">
                        <span>{quickGenError}</span>
                        <button onClick={clearQuickGenError} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-400 hover:text-red-300">
                          <ClearIcon className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {scenario.suggestedCharacters.map((char, idx) => (
                        <SuggestedCharacterCard
                          key={`${char.name}-${idx}`}
                          character={char}
                          isCreated={isCharacterCreated(char.name)}
                          isGenerating={isQuickGenerating && generatingCharacterName === char.name}
                          createdThumbnail={getCreatedCharacterThumbnail(char.name)}
                          onQuickGenerate={() => quickGenerateCharacter(char)}
                          onUpload={(imageData) => handleUploadCharacterImage(char, imageData)}
                          onEdit={(updates) => updateSuggestedCharacter(char.name, updates)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Asset Management Section */}
            <AssetManagementSection />
          </div>

          {/* Scene List */}
          <div className="flex-grow overflow-y-auto p-2 sm:p-4 space-y-2 sm:space-y-3">
            {scenario.scenes.map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                isExpanded={expandedSceneId === scene.id}
                onToggleExpand={() => setExpandedSceneId(expandedSceneId === scene.id ? null : scene.id)}
                onGenerateImage={handleGenerateSceneImage}
                onEditScene={handleUpdateScene}
                onDeleteScene={removeScene}
                onDownloadImage={downloadSceneImage}
                onReplaceImage={replaceSceneImage}
                isGeneratingImage={generatingImageSceneId === scene.id}
                isUpdatingPrompt={updatingPromptSceneId === scene.id}
                isGeneratingAllImages={isGeneratingAllImages}
              />
            ))}
          </div>
        </div>
      )}

      {/* Scenario Generator Modal */}
      <ScenarioGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onGenerate={handleGenerateScenario}
        isLoading={isGenerating}
        defaultImageStyle={projectImageStyle}
      />

      {/* API 키 필요 모달 */}
      <ApiKeyRequiredModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        featureName="시나리오 생성"
      />
    </div>
  );
};

export default ScenarioTab;
