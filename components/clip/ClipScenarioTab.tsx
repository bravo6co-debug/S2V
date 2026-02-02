import React, { useState, useRef, useMemo } from 'react';
import {
  ClipScenarioConfig,
  ClipDuration,
  Scene,
  ImageData,
  ScenarioTone,
  ScenarioMode,
  ImageStyle,
  TONE_OPTIONS,
  SCENARIO_MODE_OPTIONS,
  IMAGE_STYLE_OPTIONS,
} from '../../types';
import { useClipScenario } from '../../hooks/useClipScenario';
import { useProject } from '../../contexts/ProjectContext';
import { TTSVoice } from '../../services/apiClient';
import { compressImageFile } from '../../services/imageCompression';
import {
  SparklesIcon,
  TrashIcon,
  PencilIcon,
  ClearIcon,
  CheckCircleIcon,
} from '../Icons';

// =============================================
// TTS 보이스 옵션
// =============================================
const TTS_VOICE_OPTIONS: { value: TTSVoice; label: string }[] = [
  { value: 'Kore', label: 'Kore (한국어 여성)' },
  { value: 'Aoede', label: 'Aoede (여성)' },
  { value: 'Charon', label: 'Charon (남성)' },
  { value: 'Fenrir', label: 'Fenrir (남성, 깊은)' },
  { value: 'Puck', label: 'Puck (중성)' },
];

// =============================================
// 듀레이션 프리셋
// =============================================
const DURATION_PRESETS: { value: ClipDuration; label: string; scenes: number }[] = [
  { value: 30, label: '30초', scenes: 5 },
  { value: 60, label: '60초', scenes: 10 },
  { value: 90, label: '90초', scenes: 15 },
  { value: 120, label: '2분', scenes: 20 },
];

// =============================================
// 스토리비트 색상
// =============================================
const BEAT_COLORS: Record<string, string> = {
  Hook: 'bg-red-600',
  Setup: 'bg-blue-600',
  Development: 'bg-yellow-600',
  Climax: 'bg-purple-600',
  Resolution: 'bg-green-600',
};

// =============================================
// 씬 카드 컴포넌트
// =============================================
interface SceneCardProps {
  scene: Scene;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEditScene: (sceneId: string, updates: Partial<Scene>) => void;
  onGenerateImage: (sceneId: string) => void;
  onDeleteScene?: (sceneId: string) => void;
  onReplaceImage: (sceneId: string, image: ImageData) => void;
  isGeneratingImage: boolean;
}

const ClipSceneCard: React.FC<SceneCardProps> = ({
  scene,
  isExpanded,
  onToggleExpand,
  onEditScene,
  onGenerateImage,
  onReplaceImage,
  isGeneratingImage,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editNarration, setEditNarration] = useState(scene.narration);
  const [editVisual, setEditVisual] = useState(scene.visualDescription);
  const [editVideoPrompt, setEditVideoPrompt] = useState(scene.videoPrompt || '');
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const currentImage = scene.customImage || scene.generatedImage;
  const narrationLength = scene.narration?.length || 0;

  const handleSaveEdit = () => {
    onEditScene(scene.id, {
      narration: editNarration,
      visualDescription: editVisual,
      videoPrompt: editVideoPrompt,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditNarration(scene.narration);
    setEditVisual(scene.visualDescription);
    setEditVideoPrompt(scene.videoPrompt || '');
    setIsEditing(false);
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      onReplaceImage(scene.id, compressed);
    } catch (err) {
      console.error('Image replace failed:', err);
    }
    e.target.value = '';
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 text-left hover:bg-gray-750 transition-colors min-h-[44px]"
      >
        <span className="text-gray-400 text-xs sm:text-sm font-mono w-6 sm:w-8 flex-shrink-0">
          #{scene.sceneNumber}
        </span>
        <span className={`${BEAT_COLORS[scene.storyBeat] || 'bg-gray-600'} text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0`}>
          {scene.storyBeat}
        </span>
        <span className="text-gray-300 text-xs sm:text-sm truncate flex-1">
          {scene.visualDescription}
        </span>
        <span className="text-gray-500 text-[10px] sm:text-xs flex-shrink-0">6s</span>
        {currentImage && (
          <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
        )}
        <svg className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-3 sm:p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Details */}
            <div className="space-y-3">
              {isEditing ? (
                <>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">나레이션 ({editNarration.length}자)</label>
                    <textarea
                      value={editNarration}
                      onChange={e => setEditNarration(e.target.value)}
                      className="w-full bg-gray-900 text-gray-200 rounded p-2 text-[16px] sm:text-sm h-16 resize-none border border-gray-600 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                    {editNarration.length < 20 && (
                      <p className="text-yellow-400 text-[10px] mt-0.5">20자 이상 권장</p>
                    )}
                    {editNarration.length > 30 && (
                      <p className="text-red-400 text-[10px] mt-0.5">30자 초과! TTS 재생 시간 초과 가능</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">시각 묘사</label>
                    <textarea
                      value={editVisual}
                      onChange={e => setEditVisual(e.target.value)}
                      className="w-full bg-gray-900 text-gray-200 rounded p-2 text-[16px] sm:text-sm h-16 resize-none border border-gray-600 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">비디오 프롬프트 (모션)</label>
                    <textarea
                      value={editVideoPrompt}
                      onChange={e => setEditVideoPrompt(e.target.value)}
                      className="w-full bg-gray-900 text-gray-200 rounded p-2 text-[16px] sm:text-sm h-16 resize-none border border-gray-600 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="Hailuo motion prompt (English)"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded min-h-[36px]"
                    >
                      저장
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded min-h-[36px]"
                    >
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-xs text-gray-500">나레이션</span>
                    <p className="text-gray-200 text-sm mt-0.5">{scene.narration}</p>
                    <span className={`text-[10px] ${narrationLength >= 20 && narrationLength <= 30 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {narrationLength}자 {narrationLength < 20 ? '(너무 짧음)' : narrationLength > 30 ? '(초과!)' : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">시각 묘사</span>
                    <p className="text-gray-300 text-xs mt-0.5">{scene.visualDescription}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] sm:text-xs">
                    <span className="bg-gray-700 px-2 py-0.5 rounded text-gray-300">{scene.cameraAngle}</span>
                    <span className="bg-gray-700 px-2 py-0.5 rounded text-gray-300">{scene.mood}</span>
                  </div>
                  {scene.videoPrompt && (
                    <div>
                      <span className="text-xs text-cyan-400">videoPrompt</span>
                      <p className="text-gray-400 text-[10px] sm:text-xs mt-0.5 font-mono bg-gray-900 p-2 rounded">
                        {scene.videoPrompt}
                      </p>
                    </div>
                  )}
                  {scene.narrationAudio && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-green-400">TTS</span>
                      <audio
                        src={`data:audio/mp3;base64,${scene.narrationAudio.data}`}
                        controls
                        className="h-7 flex-1"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right: Image */}
            <div>
              {currentImage ? (
                <div className="relative group">
                  <img
                    src={`data:${currentImage.mimeType};base64,${currentImage.data}`}
                    alt={`씬 ${scene.sceneNumber}`}
                    className="w-full aspect-video object-cover rounded"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => replaceInputRef.current?.click()}
                      className="bg-gray-800 bg-opacity-80 text-white text-xs px-3 py-1.5 rounded hover:bg-opacity-100"
                    >
                      교체
                    </button>
                  </div>
                  {scene.imageSource === 'custom' && (
                    <span className="absolute top-1 right-1 bg-blue-600 text-[9px] text-white px-1.5 py-0.5 rounded">교체됨</span>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-video border-2 border-dashed border-gray-600 rounded flex flex-col items-center justify-center text-gray-500 gap-1">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs">이미지 없음</span>
                </div>
              )}
              <input
                ref={replaceInputRef}
                type="file"
                accept="image/*"
                onChange={handleReplaceFile}
                className="hidden"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded min-h-[36px]"
              >
                <PencilIcon className="w-3.5 h-3.5" />
                편집
              </button>
            )}
            <button
              onClick={() => onGenerateImage(scene.id)}
              disabled={isGeneratingImage}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs rounded min-h-[36px]"
            >
              {isGeneratingImage ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <SparklesIcon className="w-3.5 h-3.5" />
              )}
              {currentImage ? '재생성' : '이미지 생성'}
            </button>
            <button
              onClick={() => replaceInputRef.current?.click()}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded min-h-[36px]"
            >
              이미지 교체
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================
// 시나리오 생성 모달
// =============================================
interface GeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: ClipScenarioConfig) => void;
  isLoading: boolean;
}

const ClipGeneratorModal: React.FC<GeneratorModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  isLoading,
}) => {
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState<ClipDuration>(60);
  const [tone, setTone] = useState<ScenarioTone>('emotional');
  const [mode, setMode] = useState<ScenarioMode>('character');
  const [imageStyle, setImageStyle] = useState<ImageStyle>('photorealistic');

  if (!isOpen) return null;

  const handleGenerate = () => {
    if (!topic.trim()) return;
    onGenerate({ topic: topic.trim(), duration, tone, mode, imageStyle });
  };

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-80" onClick={handleClose}>
      <div
        className="bg-gray-900 w-full sm:w-[560px] sm:max-h-[85vh] rounded-t-2xl sm:rounded-xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">클립 시나리오 생성</h2>
            <button onClick={handleClose} disabled={isLoading} className="text-gray-400 hover:text-white p-1">
              <ClearIcon className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Hailuo AI 전용 6초 단위 클립 영상 시나리오를 생성합니다.
          </p>

          {/* Topic */}
          <div>
            <label className="text-sm text-gray-300 block mb-1.5">주제 *</label>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="예: 서울의 숨은 카페 투어, 가을 단풍 여행 브이로그, 한국 전통 요리 과정..."
              className="w-full bg-gray-800 text-gray-200 rounded-lg p-3 text-[16px] sm:text-sm h-20 resize-none border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm text-gray-300 block mb-1.5">영상 길이</label>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => setDuration(preset.value)}
                  disabled={isLoading}
                  className={`py-2.5 px-2 rounded-lg text-center transition-colors min-h-[44px] ${
                    duration === preset.value
                      ? 'bg-cyan-600 text-white ring-2 ring-cyan-400'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <div className="text-sm font-medium">{preset.label}</div>
                  <div className="text-[10px] text-gray-400">{preset.scenes}씬</div>
                </button>
              ))}
            </div>
          </div>

          {/* Mode */}
          <div>
            <label className="text-sm text-gray-300 block mb-1.5">모드</label>
            <div className="grid grid-cols-2 gap-2">
              {SCENARIO_MODE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  disabled={isLoading}
                  className={`py-2 px-3 rounded-lg text-left transition-colors min-h-[44px] ${
                    mode === opt.value
                      ? 'bg-cyan-600 text-white ring-2 ring-cyan-400'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="text-sm">{opt.emoji} {opt.label}</span>
                  <p className="text-[10px] opacity-70 mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Image Style */}
          <div>
            <label className="text-sm text-gray-300 block mb-1.5">이미지 스타일</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {IMAGE_STYLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setImageStyle(opt.value)}
                  disabled={isLoading}
                  className={`py-2 px-2 rounded-lg text-center transition-colors min-h-[44px] text-xs ${
                    imageStyle === opt.value
                      ? 'bg-cyan-600 text-white ring-2 ring-cyan-400'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="text-sm text-gray-300 block mb-1.5">톤/분위기</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TONE_OPTIONS.filter(t => t.category === 'story').map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTone(opt.value)}
                  disabled={isLoading}
                  className={`py-1.5 px-2 rounded-lg text-center transition-colors min-h-[36px] text-xs ${
                    tone === opt.value
                      ? 'bg-cyan-600 text-white ring-2 ring-cyan-400'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isLoading || !topic.trim()}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-all min-h-[48px] flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                시나리오 생성 중...
              </>
            ) : (
              <>
                <SparklesIcon className="w-5 h-5" />
                클립 시나리오 생성
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================
// 메인 탭 컴포넌트
// =============================================
const ClipScenarioTab: React.FC = () => {
  const {
    clipScenario,
    isGenerating,
    generatingImageSceneId,
    isGeneratingAllImages,
    isGeneratingTTS,
    ttsProgress,
    error,
    setClipScenario,
    generateClipScenario,
    updateClipScene,
    generateSceneImage,
    generateAllSceneImages,
    replaceSceneImage,
    saveClipScenarioToFile,
    loadClipScenarioFromFile,
    clearError,
  } = useClipScenario();

  const { setCurrentTab } = useProject();

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);
  const [ttsVoice, setTtsVoice] = useState<TTSVoice>('Kore');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 통계
  const totalGeneratedImages = useMemo(
    () => clipScenario?.scenes.filter(s => s.generatedImage || s.customImage).length || 0,
    [clipScenario?.scenes]
  );
  const totalScenes = clipScenario?.scenes.length || 0;
  const totalTTS = useMemo(
    () => clipScenario?.scenes.filter(s => s.narrationAudio).length || 0,
    [clipScenario?.scenes]
  );

  // 시나리오 생성
  const handleGenerate = async (config: ClipScenarioConfig) => {
    try {
      await generateClipScenario(config);
      setIsGeneratorOpen(false);
    } catch {
      // error는 hook에서 관리
    }
  };

  // 파일 불러오기
  const handleLoadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await loadClipScenarioFromFile(file);
    } catch {
      // error는 hook에서 관리
    }
    e.target.value = '';
  };

  // 전체 이미지 + TTS 생성
  const handleGenerateAll = async () => {
    try {
      await generateAllSceneImages({ includeTTS: true, ttsVoice });
    } catch {
      // error는 hook에서 관리
    }
  };

  // 영상 제작 탭으로 이동
  const handleGoToVideo = () => {
    setCurrentTab('video');
  };

  // =============================================
  // 빈 상태 (시나리오 없음)
  // =============================================
  if (!clipScenario) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-24 px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-5xl mb-2">
            <svg className="w-16 h-16 mx-auto text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">클립 시나리오</h2>
          <p className="text-gray-400 text-sm">
            Hailuo AI 전용 6초 단위 클립 영상 시나리오를 생성합니다.
            <br />최대 2분, 씬당 6초, 모션 프롬프트 자동 생성.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() => setIsGeneratorOpen(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-lg transition-all min-h-[48px]"
            >
              <SparklesIcon className="w-5 h-5" />
              새 클립 시나리오
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors min-h-[48px]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              파일 불러오기
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleLoadFile}
          className="hidden"
        />
        <ClipGeneratorModal
          isOpen={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
          onGenerate={handleGenerate}
          isLoading={isGenerating}
        />
      </div>
    );
  }

  // =============================================
  // 시나리오 있음
  // =============================================
  return (
    <div className="space-y-4 pb-32">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{clipScenario.title}</h2>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">{clipScenario.synopsis}</p>
          </div>
          <span className="bg-cyan-600 text-white text-[10px] sm:text-xs px-2 py-1 rounded flex-shrink-0">
            클립
          </span>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-400">
          <span>{clipScenario.totalDuration}초 ({totalScenes}씬 × 6초)</span>
          <span>|</span>
          <span>이미지: {totalGeneratedImages}/{totalScenes}</span>
          <span>|</span>
          <span>TTS: {totalTTS}/{totalScenes}</span>
          <span>|</span>
          <span>{clipScenario.imageStyle}</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <select
          value={ttsVoice}
          onChange={e => setTtsVoice(e.target.value as TTSVoice)}
          className="bg-gray-800 text-gray-200 text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-2 border border-gray-700 min-h-[44px]"
        >
          {TTS_VOICE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <button
          onClick={handleGenerateAll}
          disabled={isGeneratingAllImages || isGeneratingTTS}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs sm:text-sm font-medium rounded-lg transition-all min-h-[44px]"
        >
          {isGeneratingAllImages ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              이미지 생성 중...
            </>
          ) : isGeneratingTTS ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              TTS {ttsProgress.current}/{ttsProgress.total}
            </>
          ) : (
            <>
              <SparklesIcon className="w-4 h-4" />
              <span className="hidden sm:inline">전체 이미지 + TTS 생성</span>
              <span className="sm:hidden">전체 생성</span>
            </>
          )}
        </button>

        <button
          onClick={saveClipScenarioToFile}
          className="flex items-center gap-1 px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs sm:text-sm rounded-lg min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span className="hidden sm:inline">저장</span>
        </button>

        {totalGeneratedImages > 0 && (
          <button
            onClick={handleGoToVideo}
            className="flex items-center gap-1 px-3 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm rounded-lg min-h-[44px] ml-auto"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">영상 제작으로</span>
            <span className="sm:hidden">영상</span>
          </button>
        )}

        <button
          onClick={() => setIsGeneratorOpen(true)}
          className="flex items-center gap-1 px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs sm:text-sm rounded-lg min-h-[44px]"
        >
          새 시나리오
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-300 hover:text-white ml-2">
            <ClearIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Scene List */}
      <div className="space-y-2">
        {clipScenario.scenes.map(scene => (
          <ClipSceneCard
            key={scene.id}
            scene={scene}
            isExpanded={expandedSceneId === scene.id}
            onToggleExpand={() => setExpandedSceneId(
              expandedSceneId === scene.id ? null : scene.id
            )}
            onEditScene={updateClipScene}
            onGenerateImage={generateSceneImage}
            onReplaceImage={replaceSceneImage}
            isGeneratingImage={generatingImageSceneId === scene.id}
          />
        ))}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleLoadFile}
        className="hidden"
      />

      {/* Generator Modal */}
      <ClipGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onGenerate={handleGenerate}
        isLoading={isGenerating}
      />
    </div>
  );
};

export default ClipScenarioTab;
