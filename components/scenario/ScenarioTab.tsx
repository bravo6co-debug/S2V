import React, { useState, useRef, useMemo } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useScenario } from '../../hooks/useScenario';
import { useQuickCharacterGeneration } from '../../hooks/useQuickCharacterGeneration';
import { TTSVoice } from '../../services/apiClient';
import {
  ScenarioConfig,
  Scene,
  ImageData,
  ScenarioTone,
  ScenarioMode,
  ImageStyle,
  SuggestedCharacter,
  TONE_OPTIONS,
  SCENARIO_MODE_OPTIONS,
  IMAGE_STYLE_OPTIONS,
} from '../../types';
import { SuggestedCharacterCard } from './SuggestedCharacterCard';
import { AssetManagementSection } from './AssetManagementSection';

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
  TrashIcon,
  PencilIcon,
  ClearIcon,
  LayersIcon,
  CheckCircleIcon,
  PlusCircleIcon,
} from '../Icons';

// Icons
const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ImageIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

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

// Scene Card Component
interface SceneCardProps {
  scene: Scene;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRegenerate: (sceneId: string, instruction?: string) => void;
  onGenerateImage: (sceneId: string) => void;
  onEditScene: (sceneId: string, updates: Partial<Scene>) => void;
  onDeleteScene: (sceneId: string) => void;
  onDownloadImage: (sceneId: string) => void;
  onReplaceImage: (sceneId: string, image: ImageData) => void;
  isRegenerating: boolean;
  isGeneratingImage: boolean;
}

const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  isExpanded,
  onToggleExpand,
  onRegenerate,
  onGenerateImage,
  onEditScene,
  onDeleteScene,
  onDownloadImage,
  onReplaceImage,
  isRegenerating,
  isGeneratingImage,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNarration, setEditedNarration] = useState(scene.narration);
  const [editedVisual, setEditedVisual] = useState(scene.visualDescription);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [showRegenInput, setShowRegenInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storyBeatColors: Record<string, string> = {
    Hook: 'bg-red-600',
    Setup: 'bg-blue-600',
    Development: 'bg-green-600',
    Climax: 'bg-yellow-600',
    Resolution: 'bg-purple-600',
  };

  const handleSaveEdit = () => {
    onEditScene(scene.id, {
      narration: editedNarration,
      visualDescription: editedVisual,
    });
    setIsEditing(false);
  };

  const handleRegenerate = () => {
    onRegenerate(scene.id, regenInstruction || undefined);
    setRegenInstruction('');
    setShowRegenInput(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64Data = dataUrl.split(',')[1];
        onReplaceImage(scene.id, { mimeType: file.type, data: base64Data });
      };
      reader.readAsDataURL(file);
    }
  };

  const currentImage = scene.customImage || scene.generatedImage;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <span className="text-base sm:text-lg font-bold text-gray-400">#{scene.sceneNumber}</span>
          <span className={`px-1.5 sm:px-2 py-0.5 text-xs font-medium text-white rounded ${storyBeatColors[scene.storyBeat] || 'bg-gray-600'}`}>
            {scene.storyBeat}
          </span>
          <span className="text-xs text-gray-500 hidden sm:inline">{scene.duration}초</span>
        </div>
        <p className="flex-grow text-xs sm:text-sm text-gray-300 truncate">{scene.visualDescription}</p>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {currentImage && (
            <span className="text-green-400" title="이미지 있음">
              <CheckCircleIcon className="w-4 h-4" />
            </span>
          )}
          {scene.imageSource === 'custom' && (
            <span className="text-xs text-amber-400 hidden sm:inline">교체됨</span>
          )}
          {isExpanded ? (
            <ChevronUpIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-3 sm:p-4 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* Left: Scene Details */}
            <div className="space-y-3">
              {isEditing ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">시각적 묘사</label>
                    <textarea
                      value={editedVisual}
                      onChange={(e) => setEditedVisual(e.target.value)}
                      className="w-full h-20 p-2 text-sm bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">내레이션</label>
                    <textarea
                      value={editedNarration}
                      onChange={(e) => setEditedNarration(e.target.value)}
                      className="w-full h-20 p-2 text-sm bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditedNarration(scene.narration);
                        setEditedVisual(scene.visualDescription);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-600 rounded hover:bg-gray-500"
                    >
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">시각적 묘사</label>
                    <p className="text-sm text-gray-200">{scene.visualDescription}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">내레이션</label>
                    <p className="text-sm text-gray-200 italic">"{scene.narration}"</p>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span><strong>카메라:</strong> {scene.cameraAngle}</span>
                    <span><strong>분위기:</strong> {scene.mood}</span>
                  </div>
                </>
              )}
            </div>

            {/* Right: Image Preview / Generation */}
            <div className="flex flex-col">
              {currentImage ? (
                <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden group">
                  <img
                    src={`data:${currentImage.mimeType};base64,${currentImage.data}`}
                    alt={`Scene ${scene.sceneNumber}`}
                    className="w-full h-full object-cover"
                  />
                  {/* 이미지 액션 버튼 */}
                  <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onDownloadImage(scene.id)}
                      className="p-1.5 bg-gray-800/80 rounded text-white hover:bg-gray-700"
                      title="다운로드"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 bg-gray-800/80 rounded text-white hover:bg-gray-700"
                      title="이미지 교체"
                    >
                      <UploadIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex items-center justify-center aspect-video bg-gray-900 rounded-lg border-2 border-dashed border-gray-700">
                  <div className="text-center text-gray-500">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs">이미지 미생성</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Image Prompt (collapsible) */}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
              이미지 프롬프트 보기 (영어)
            </summary>
            <pre className="mt-2 p-2 bg-gray-900 rounded text-gray-300 whitespace-pre-wrap text-xs">
              {scene.imagePrompt}
            </pre>
          </details>

          {/* Regeneration Input */}
          {showRegenInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={regenInstruction}
                onChange={(e) => setRegenInstruction(e.target.value)}
                placeholder="재생성 지시사항 (선택사항, 예: 더 극적으로)"
                className="flex-grow p-2 text-sm bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="px-3 py-2 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {isRegenerating ? '재생성 중...' : '확인'}
              </button>
              <button
                onClick={() => setShowRegenInput(false)}
                className="px-3 py-2 text-xs font-medium text-gray-300 bg-gray-600 rounded hover:bg-gray-500"
              >
                취소
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600"
              >
                <PencilIcon className="w-3.5 h-3.5" />
                편집
              </button>
            )}
            <button
              onClick={() => setShowRegenInput(true)}
              disabled={isRegenerating || showRegenInput}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-300 bg-purple-900/50 rounded hover:bg-purple-800/50 disabled:opacity-50"
            >
              <RefreshIcon className="w-3.5 h-3.5" />
              씬 재생성
            </button>
            <button
              onClick={() => onGenerateImage(scene.id)}
              disabled={isGeneratingImage}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-900/50 rounded hover:bg-indigo-800/50 disabled:opacity-50"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {isGeneratingImage ? '생성 중...' : currentImage ? '이미지 재생성' : '이미지 생성'}
            </button>
            <button
              onClick={() => onDeleteScene(scene.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-300 bg-red-900/50 rounded hover:bg-red-800/50 ml-auto"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

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
  const [imageStyle, setImageStyle] = useState<ImageStyle>(defaultImageStyle);

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
      setImageStyle(defaultImageStyle);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="relative bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col gap-4 sm:gap-5 p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
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

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Topic Input */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              영상 주제 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 30대 여성이 퇴사 후 제주도에서 카페를 열며 새로운 삶을 시작하는 이야기"
              className="w-full h-24 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:outline-none text-sm resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Scenario Mode Selection */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">시나리오 모드</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SCENARIO_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setMode(option.value)}
                  disabled={isLoading}
                  className={`flex items-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all text-left ${
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
          </div>

          {/* Image Style Selection */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">이미지 스타일</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {IMAGE_STYLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setImageStyle(option.value)}
                  disabled={isLoading}
                  className={`flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
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

          {/* Duration Selection */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">영상 길이</label>
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
                      className={`py-2 px-2 rounded-lg text-sm font-medium transition-all ${
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
                <div className="grid grid-cols-4 gap-2">
                  {([180, 300, 600] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDurationPreset(d);
                        setCustomDuration('');
                      }}
                      disabled={isLoading}
                      className={`py-2 px-2 rounded-lg text-sm font-medium transition-all ${
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
                      className={`w-full h-full py-2 px-2 rounded-lg text-xs text-center bg-gray-700 border transition-all ${
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
            <label className="text-sm font-medium text-gray-300 mb-2 block">톤/분위기</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TONE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTone(option.value)}
                  disabled={isLoading}
                  title={option.description}
                  className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
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
                className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-all text-left ${
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
                  className="w-full mt-2 p-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  disabled={isLoading}
                />
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-5 py-2.5 text-sm font-medium text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !topic.trim()}
            className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
    regeneratingSceneId,
    generatingImageSceneId,
    isGeneratingAllImages,
    isGeneratingTTS,
    ttsProgress,
    error,
    generateScenario,
    updateScene,
    removeScene,
    regenerateScene,
    generateSceneImage,
    generateAllSceneImages,
    replaceSceneImage,
    downloadSceneImage,
    saveScenarioToFile,
    loadScenarioFromFile,
    setScenario,
    clearError,
  } = useScenario();

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);
  const [ttsVoice, setTtsVoice] = useState<TTSVoice>('Kore');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    await generateSceneImage(sceneId, characterImages, propImages, backgroundImage);
  };

  const handleGenerateAllImages = async () => {
    await generateAllSceneImages(characterImages, propImages, backgroundImage, {
      includeTTS: true,
      ttsVoice: ttsVoice,
    });
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
        <div className="flex-grow flex flex-col items-center justify-center bg-gray-800/50 rounded-xl border border-gray-700 p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center">
              <SparklesIcon className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">시나리오를 생성하세요</h2>
            <p className="text-gray-400 text-sm mb-6">
              AI가 주제에 맞는 영상 시나리오를 작성합니다.
              장면별 내레이션, 시각적 묘사, 이미지 프롬프트가 자동으로 생성됩니다.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setIsGeneratorOpen(true)}
                className="w-full px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-500 hover:to-indigo-500"
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
                className="w-full px-6 py-3 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
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
                <h2 className="text-lg sm:text-xl font-bold text-white truncate">{scenario.title}</h2>
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
                </div>
              </div>
              <button
                onClick={() => setScenario(null)}
                className="p-2 text-gray-400 hover:text-white"
                title="닫기"
              >
                <ClearIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Active Assets (Characters, Props, Background) */}
            {(activeCharacters.length > 0 || activeProps.length > 0 || activeBackground) && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <p className="text-xs font-medium text-gray-400 mb-2">활성화된 에셋 (이미지 생성 참조):</p>
                <div className="flex flex-wrap items-center gap-4">
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
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
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
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
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
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
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
                className="px-2 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-700 border border-gray-600 rounded-lg text-gray-300 focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:opacity-50"
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
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50"
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
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                <DownloadIcon className="w-4 h-4" />
                <span className="hidden sm:inline">저장</span>
              </button>
              <button
                onClick={() => setIsGeneratorOpen(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                <SparklesIcon className="w-4 h-4" />
                <span className="hidden sm:inline">새 시나리오</span>
                <span className="sm:hidden">새로</span>
              </button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-3 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-300 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={clearError} className="text-red-400 hover:text-red-300">
                  <ClearIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Suggested Characters */}
            {scenario.suggestedCharacters && scenario.suggestedCharacters.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-300">
                    제안된 등장인물
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {scenario.suggestedCharacters.filter(c => isCharacterCreated(c.name)).length}/{scenario.suggestedCharacters.length} 생성됨
                    </span>
                    {missingCharacters.length > 0 && (
                      <button
                        onClick={handleGenerateAllMissingCharacters}
                        disabled={isQuickGenerating}
                        className="px-2 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isQuickGenerating ? '생성중...' : `모두 생성 (${missingCharacters.length})`}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  시나리오에 필요한 캐릭터입니다. "생성" 버튼으로 AI가 자동으로 생성합니다.
                </p>
                {quickGenError && (
                  <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-300 flex items-center justify-between">
                    <span>{quickGenError}</span>
                    <button onClick={clearQuickGenError} className="text-red-400 hover:text-red-300">
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
                    />
                  ))}
                </div>
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
                onRegenerate={regenerateScene}
                onGenerateImage={handleGenerateSceneImage}
                onEditScene={updateScene}
                onDeleteScene={removeScene}
                onDownloadImage={downloadSceneImage}
                onReplaceImage={replaceSceneImage}
                isRegenerating={regeneratingSceneId === scene.id}
                isGeneratingImage={generatingImageSceneId === scene.id}
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
    </div>
  );
};

export default ScenarioTab;
