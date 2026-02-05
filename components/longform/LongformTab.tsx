import React, { useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLongformScenario } from '../../hooks/useLongformScenario';
import { useLongformGeneration } from '../../hooks/useLongformGeneration';
import { useLongformExport } from '../../hooks/useLongformExport';
import { useLongformCharacters } from '../../hooks/useLongformCharacters';
import { StepIndicator } from './StepIndicator';
import { Step1BasicSetup } from './Step1BasicSetup';
import { Step2ScenarioEditor } from './Step2ScenarioEditor';
import { Step3CharacterSetup } from './Step3CharacterSetup';
import { Step3AssetGeneration } from './Step3AssetGeneration';
import { Step4PreviewDownload } from './Step4PreviewDownload';
import { generateSceneImages } from '../../services/longformApiClient';
import type { LongformStep, LongformConfig, LongformOutput, AssetStatus } from '../../types/longform';

export const LongformTab: React.FC = () => {
  const { canUseApi, hasOpenaiApiKey, hasApiKey, isAdmin, openSettingsModal } = useAuth();

  // 시나리오 훅
  const {
    scenario,
    isGenerating: isGeneratingScenario,
    error: scenarioError,
    generateScenario,
    updateScene,
    adjustNarration,
    isAdjustingNarration,
    setScenario,
    clearError,
  } = useLongformScenario();

  // 캐릭터 훅
  const {
    characters,
    extractionStatus,
    error: characterError,
    extractCharacters,
    updateCharacter,
    removeCharacter,
    addCharacter,
    generateImage: generateCharacterImage,
    generateAllImages: generateAllCharacterImages,
    setCharacters,
    clearError: clearCharacterError,
  } = useLongformCharacters();

  // 에셋 생성 훅
  const {
    progress,
    isGenerating: isGeneratingAssets,
    startGeneration,
    cancelGeneration,
  } = useLongformGeneration();

  // 내보내기 훅
  const {
    partStates,
    isExporting,
    startExportPart,
    cancelExport,
    downloadPart,
  } = useLongformExport();

  // 워크플로우 상태
  const [currentStep, setCurrentStep] = useState<LongformStep>(1);
  const [completedSteps, setCompletedSteps] = useState<LongformStep[]>([]);
  const [config, setConfig] = useState<LongformConfig | null>(null);
  const [output, setOutput] = useState<LongformOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showKeyWarning, setShowKeyWarning] = useState(false);
  const [missingKeyMessage, setMissingKeyMessage] = useState('');
  const [isRegeneratingFailed, setIsRegeneratingFailed] = useState(false);

  // 통합 에러
  const displayError = scenarioError || characterError || error;

  // STEP 1: 시나리오 생성
  const handleGenerateScenario = useCallback(async (newConfig: LongformConfig) => {
    if (!canUseApi) return;

    setConfig(newConfig);
    setError(null);

    try {
      await generateScenario(newConfig);
      setCompletedSteps(prev => [...prev, 1 as LongformStep]);
      setCurrentStep(2);
    } catch {
      // error handled by hook
    }
  }, [canUseApi, generateScenario]);

  // STEP 2 → 3 전환 (캐릭터 설정)
  const handleProceedToCharacterSetup = useCallback(() => {
    setCompletedSteps(prev => [...prev, 2 as LongformStep]);
    setCurrentStep(3);
  }, []);

  // STEP 3 → 4 전환 (에셋 생성)
  const handleProceedToGeneration = useCallback(() => {
    // 캐릭터를 시나리오에 저장
    if (scenario && characters.length > 0) {
      setScenario({ ...scenario, characters });
    }

    // API 키 검증: 에셋 생성 전에 필요한 키가 있는지 확인
    if (config) {
      const missing: string[] = [];
      if (config.tts.provider === 'openai' && !hasOpenaiApiKey) {
        missing.push('OpenAI API 키 (TTS 나레이션)');
      }
      if (config.tts.provider === 'gemini' && !isAdmin && !hasApiKey) {
        missing.push('Gemini API 키 (TTS 나레이션)');
      }
      if (missing.length > 0) {
        setMissingKeyMessage(missing.join('\n'));
        setShowKeyWarning(true);
        return;
      }
    }

    setCompletedSteps(prev => [...prev, 3 as LongformStep]);
    setCurrentStep(4);
  }, [scenario, characters, setScenario, config, hasOpenaiApiKey, hasApiKey, isAdmin]);

  // API 키 경고: 무시하고 진행
  const handleForceGeneration = useCallback(() => {
    setShowKeyWarning(false);
    setCompletedSteps(prev => [...prev, 3 as LongformStep]);
    setCurrentStep(4);
  }, []);

  // API 키 경고: 설정으로 이동
  const handleGoToSettings = useCallback(() => {
    setShowKeyWarning(false);
    openSettingsModal();
  }, [openSettingsModal]);

  // STEP 4: 에셋 생성 시작
  const handleStartGeneration = useCallback(async () => {
    if (!scenario || !config) return;
    try {
      const updatedScenario = await startGeneration(scenario, config);
      setScenario(updatedScenario);
    } catch {
      setError('에셋 생성 중 오류가 발생했습니다.');
    }
  }, [scenario, config, startGeneration, setScenario]);

  // STEP 4 완료 → 5 전환
  const handleGenerationComplete = useCallback(() => {
    setCompletedSteps(prev => [...prev, 4 as LongformStep]);
    setCurrentStep(5);
  }, []);

  // 실패한 씬 재생성 (Step5에서 호출)
  const handleRegenerateFailedScenes = useCallback(async () => {
    if (!scenario || !config) return;

    const failedScenes = scenario.scenes.filter(s => s.imageStatus === 'failed');
    if (failedScenes.length === 0) return;

    setIsRegeneratingFailed(true);
    setError(null);

    try {
      const sceneInputs = failedScenes.map(scene => {
        const sceneChars = (scenario.characters || [])
          .filter(c => c.sceneNumbers.includes(scene.sceneNumber));
        let imagePrompt = scene.imagePrompt;
        if (sceneChars.length > 0) {
          const charDesc = sceneChars
            .map(c => `[${c.nameEn}: ${c.appearanceDescription}, wearing ${c.outfit}]`)
            .join(' ');
          imagePrompt = `${charDesc} ${imagePrompt}`;
        }
        return {
          sceneNumber: scene.sceneNumber,
          imagePrompt,
          cameraAngle: scene.cameraAngle,
          lightingMood: scene.lightingMood,
          mood: scene.mood,
        };
      });

      const imageResults = await generateSceneImages(sceneInputs, config.imageModel, 5);

      // 결과 적용
      const updatedScenes = [...scenario.scenes];
      for (const r of imageResults.results) {
        const idx = updatedScenes.findIndex(s => s.sceneNumber === r.sceneNumber);
        if (idx >= 0) {
          updatedScenes[idx] = {
            ...updatedScenes[idx],
            generatedImage: r.success ? r.image : undefined,
            imageStatus: (r.success ? 'completed' : 'failed') as AssetStatus,
            imageError: r.success ? undefined : r.error,
          };
        }
      }

      setScenario({ ...scenario, scenes: updatedScenes });
    } catch {
      setError('실패 씬 재생성 중 오류가 발생했습니다.');
    } finally {
      setIsRegeneratingFailed(false);
    }
  }, [scenario, config, setScenario]);

  // 처음으로
  const handleReset = useCallback(() => {
    setCurrentStep(1);
    setCompletedSteps([]);
    setConfig(null);
    setScenario(null);
    setCharacters([]);
    setOutput(null);
    setError(null);
    clearError();
    clearCharacterError();
  }, [setScenario, setCharacters, clearError, clearCharacterError]);

  // 스텝별 콘텐츠 렌더링
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <Step1BasicSetup onGenerate={handleGenerateScenario} isGenerating={isGeneratingScenario} />;
      case 2:
        if (!scenario) {
          return (
            <div className="max-w-2xl mx-auto text-center py-12">
              <p className="text-gray-400">시나리오가 없습니다.</p>
              <button onClick={() => setCurrentStep(1)} className="mt-4 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 min-h-[44px]">
                이전 단계
              </button>
            </div>
          );
        }
        return (
          <Step2ScenarioEditor
            scenario={scenario}
            onUpdateScene={updateScene}
            onAdjustNarration={adjustNarration}
            isAdjustingNarration={isAdjustingNarration}
            onPrev={() => setCurrentStep(1)}
            onNext={handleProceedToCharacterSetup}
            disabled={false}
          />
        );
      case 3:
        if (!scenario || !config) {
          return (
            <div className="max-w-2xl mx-auto text-center py-12">
              <p className="text-gray-400">시나리오가 없습니다.</p>
              <button onClick={() => setCurrentStep(1)} className="mt-4 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 min-h-[44px]">
                처음으로
              </button>
            </div>
          );
        }
        return (
          <Step3CharacterSetup
            scenario={scenario}
            config={config}
            characters={characters}
            extractionStatus={extractionStatus}
            onExtractCharacters={extractCharacters}
            onUpdateCharacter={updateCharacter}
            onRemoveCharacter={removeCharacter}
            onAddCharacter={addCharacter}
            onGenerateImage={(id) => generateCharacterImage(id, config.imageModel)}
            onGenerateAllImages={() => generateAllCharacterImages(config.imageModel)}
            onPrev={() => setCurrentStep(2)}
            onNext={handleProceedToGeneration}
          />
        );
      case 4:
        if (!scenario || !config) {
          return (
            <div className="max-w-2xl mx-auto text-center py-12">
              <p className="text-gray-400">시나리오가 없습니다.</p>
              <button onClick={() => setCurrentStep(1)} className="mt-4 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 min-h-[44px]">
                처음으로
              </button>
            </div>
          );
        }
        return (
          <Step3AssetGeneration
            scenario={scenario}
            config={config}
            progress={progress}
            onStartGeneration={handleStartGeneration}
            onComplete={handleGenerationComplete}
            onCancel={cancelGeneration}
            isGenerating={isGeneratingAssets}
          />
        );
      case 5:
        if (!scenario || !config) {
          return (
            <div className="max-w-2xl mx-auto text-center py-12">
              <p className="text-gray-400">시나리오가 없습니다.</p>
              <button onClick={() => setCurrentStep(1)} className="mt-4 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 min-h-[44px]">
                처음으로
              </button>
            </div>
          );
        }
        return (
          <Step4PreviewDownload
            scenario={scenario}
            config={config}
            partStates={partStates}
            isExporting={isExporting}
            onExportPart={(partIndex) => startExportPart(scenario, partIndex)}
            onCancelExport={cancelExport}
            onDownloadPart={(partIndex) => downloadPart(partIndex, scenario)}
            onReset={handleReset}
            onRegenerateFailedScenes={handleRegenerateFailedScenes}
            isRegenerating={isRegeneratingFailed}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 단계 인디케이터 */}
      <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />

      {/* 에러 표시 */}
      {displayError && (
        <div className="mx-4 mb-2 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
          <p className="text-red-400 text-sm">{displayError}</p>
          <button
            onClick={() => { setError(null); clearError(); clearCharacterError(); }}
            className="text-red-500 text-xs underline mt-1"
          >
            닫기
          </button>
        </div>
      )}

      {/* 스텝 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 pb-4">
        {renderStepContent()}
      </div>

      {/* API 키 미설정 경고 모달 */}
      {showKeyWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white">API 키 미설정</h3>
            </div>

            <p className="text-sm text-gray-300 mb-2">
              에셋 생성에 필요한 API 키가 설정되지 않았습니다:
            </p>
            <p className="text-sm text-yellow-400 font-medium mb-4 whitespace-pre-line">
              {missingKeyMessage}
            </p>
            <p className="text-xs text-gray-400 mb-5">
              해당 키 없이 진행하면 나레이션 생성이 실패합니다. 설정에서 API 키를 입력해 주세요.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleGoToSettings}
                className="flex-1 py-2.5 px-4 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors min-h-[44px]"
              >
                설정으로 이동
              </button>
              <button
                onClick={handleForceGeneration}
                className="flex-1 py-2.5 px-4 bg-gray-700 text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors min-h-[44px]"
              >
                무시하고 진행
              </button>
            </div>
            <button
              onClick={() => setShowKeyWarning(false)}
              className="w-full mt-2 py-2 text-xs text-gray-500 hover:text-gray-400 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LongformTab;
