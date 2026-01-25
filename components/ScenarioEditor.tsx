import React, { useState } from 'react';
import { Scenario, Scene, ImageData, TONE_OPTIONS } from '../types';
import { SparklesIcon, TrashIcon, PencilIcon, ClearIcon, LayersIcon, CheckCircleIcon } from './Icons';

// Icons for scenario editor
const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

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

interface SceneCardProps {
  scene: Scene;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRegenerate: (sceneId: string, instruction?: string) => void;
  onGenerateImage: (sceneId: string) => void;
  onEditScene: (sceneId: string, updates: Partial<Scene>) => void;
  onDeleteScene: (sceneId: string) => void;
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
  isRegenerating,
  isGeneratingImage,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNarration, setEditedNarration] = useState(scene.narration);
  const [editedVisual, setEditedVisual] = useState(scene.visualDescription);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [showRegenInput, setShowRegenInput] = useState(false);

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

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg font-bold text-gray-400">#{scene.sceneNumber}</span>
          <span className={`px-2 py-0.5 text-xs font-medium text-white rounded ${storyBeatColors[scene.storyBeat] || 'bg-gray-600'}`}>
            {scene.storyBeat}
          </span>
          <span className="text-xs text-gray-500">{scene.duration}초</span>
        </div>
        <p className="flex-grow text-sm text-gray-300 truncate">{scene.visualDescription}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          {scene.generatedImage && (
            <span className="text-green-400" title="이미지 생성됨">
              <CheckCircleIcon className="w-4 h-4" />
            </span>
          )}
          {isExpanded ? (
            <ChevronUpIcon className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Scene Details */}
            <div className="space-y-3">
              {isEditing ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">시각적 묘사</label>
                    <textarea
                      value={editedVisual}
                      onChange={(e) => setEditedVisual(e.target.value)}
                      className="w-full h-20 p-2 text-sm bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">내레이션</label>
                    <textarea
                      value={editedNarration}
                      onChange={(e) => setEditedNarration(e.target.value)}
                      className="w-full h-20 p-2 text-sm bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
              {scene.generatedImage ? (
                <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                  <img
                    src={`data:${scene.generatedImage.mimeType};base64,${scene.generatedImage.data}`}
                    alt={`Scene ${scene.sceneNumber}`}
                    className="w-full h-full object-cover"
                  />
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
              {isGeneratingImage ? '생성 중...' : scene.generatedImage ? '이미지 재생성' : '이미지 생성'}
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

interface ScenarioEditorProps {
  scenario: Scenario;
  onUpdateScenario: (scenario: Scenario) => void;
  onRegenerateScene: (sceneId: string, instruction?: string) => void;
  onGenerateSceneImage: (sceneId: string) => void;
  onGenerateAllImages: () => void;
  onSaveScenario: () => void;
  onLoadScenario: (file: File) => void;
  onClose: () => void;
  regeneratingSceneId: string | null;
  generatingImageSceneId: string | null;
  isGeneratingAllImages: boolean;
}

export const ScenarioEditor: React.FC<ScenarioEditorProps> = ({
  scenario,
  onUpdateScenario,
  onRegenerateScene,
  onGenerateSceneImage,
  onGenerateAllImages,
  onSaveScenario,
  onLoadScenario,
  onClose,
  regeneratingSceneId,
  generatingImageSceneId,
  isGeneratingAllImages,
}) => {
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(
    scenario.scenes[0]?.id || null
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const toneLabel = TONE_OPTIONS.find((t) => t.value === scenario.tone)?.label || scenario.tone;
  const totalGeneratedImages = scenario.scenes.filter((s) => s.generatedImage).length;

  const handleEditScene = (sceneId: string, updates: Partial<Scene>) => {
    const updatedScenes = scenario.scenes.map((s) =>
      s.id === sceneId ? { ...s, ...updates } : s
    );
    onUpdateScenario({
      ...scenario,
      scenes: updatedScenes,
      updatedAt: Date.now(),
    });
  };

  const handleDeleteScene = (sceneId: string) => {
    if (scenario.scenes.length <= 1) {
      alert('최소 1개의 씬이 필요합니다.');
      return;
    }
    const updatedScenes = scenario.scenes
      .filter((s) => s.id !== sceneId)
      .map((s, index) => ({ ...s, sceneNumber: index + 1 }));
    onUpdateScenario({
      ...scenario,
      scenes: updatedScenes,
      updatedAt: Date.now(),
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadScenario(file);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-grow min-w-0">
            <h2 className="text-xl font-bold text-white truncate">{scenario.title}</h2>
            <p className="text-sm text-gray-400 mt-1">{scenario.synopsis}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                {scenario.totalDuration}초
              </span>
              <span className="px-2 py-1 bg-purple-900/50 rounded text-purple-300">{toneLabel}</span>
              <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                {scenario.scenes.length}개 씬
              </span>
              <span className="px-2 py-1 bg-green-900/50 rounded text-green-300">
                {totalGeneratedImages}/{scenario.scenes.length} 이미지
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Close editor"
          >
            <ClearIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Suggested Characters */}
        {scenario.suggestedCharacters.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-xs font-medium text-gray-400 mb-2">제안된 등장인물:</p>
            <div className="flex flex-wrap gap-2">
              {scenario.suggestedCharacters.map((char, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-indigo-900/30 rounded text-xs text-indigo-300"
                  title={char.description}
                >
                  {char.name} ({char.role})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={onGenerateAllImages}
            disabled={isGeneratingAllImages || !!generatingImageSceneId}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LayersIcon className="w-4 h-4" />
            {isGeneratingAllImages ? '이미지 생성 중...' : '전체 이미지 생성'}
          </button>
          <button
            onClick={onSaveScenario}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            <DownloadIcon className="w-4 h-4" />
            저장
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            <UploadIcon className="w-4 h-4" />
            불러오기
          </button>
        </div>
      </div>

      {/* Scene List */}
      <div className="flex-grow overflow-y-auto p-4 space-y-3">
        {scenario.scenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            isExpanded={expandedSceneId === scene.id}
            onToggleExpand={() =>
              setExpandedSceneId(expandedSceneId === scene.id ? null : scene.id)
            }
            onRegenerate={onRegenerateScene}
            onGenerateImage={onGenerateSceneImage}
            onEditScene={handleEditScene}
            onDeleteScene={handleDeleteScene}
            isRegenerating={regeneratingSceneId === scene.id}
            isGeneratingImage={generatingImageSceneId === scene.id}
          />
        ))}
      </div>
    </div>
  );
};
