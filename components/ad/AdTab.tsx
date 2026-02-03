import React, { useState, useRef, useCallback, useEffect } from 'react';
// JSZip: dynamic import at point of use (bundle optimization)
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAdScenario } from '../../hooks/useAdScenario';
import {
  AdScenarioConfigV2,
  AdType,
  IndustryCategory,
  TargetAudience,
  AdDuration,
  AdEngine,
  ImageStyle,
  ScenarioTone,
  AD_TYPE_OPTIONS,
  INDUSTRY_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  AD_DURATION_OPTIONS,
  AD_ENGINE_OPTIONS,
  IMAGE_STYLE_OPTIONS,
  TONE_OPTIONS,
} from '../../types';
import { compressImageFile } from '../../services/imageCompression';
import ApiKeyRequiredModal from '../ApiKeyRequiredModal';
import { SparklesIcon, ClearIcon, PencilIcon } from '../Icons';

// =============================================
// HDSER 비트 색상/라벨
// =============================================
const HDSER_BEAT_CONFIG: Record<string, { label: string; color: string }> = {
  Hook: { label: 'Hook', color: 'bg-red-600' },
  Discovery: { label: 'Discovery', color: 'bg-amber-600' },
  Story: { label: 'Story', color: 'bg-blue-600' },
  Experience: { label: 'Experience', color: 'bg-green-600' },
  Reason: { label: 'Reason', color: 'bg-purple-600' },
  // 하위 호환 (AICPAC)
  Setup: { label: 'Setup', color: 'bg-blue-600' },
  Development: { label: 'Development', color: 'bg-green-600' },
  Climax: { label: 'Climax', color: 'bg-yellow-600' },
  Resolution: { label: 'Resolution', color: 'bg-purple-600' },
};

// =============================================
// Icons
// =============================================
const MegaphoneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
  </svg>
);

const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const ImageIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const MusicNoteIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
  </svg>
);

const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const CloudIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
  </svg>
);

const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

// =============================================
// Wizard Step Types
// =============================================
type WizardStep = 1 | 2 | 3;

const AdTab: React.FC = () => {
  const { isAuthenticated, canUseApi } = useAuth();
  const { imageStyle: projectImageStyle } = useProject();
  const {
    adScenario,
    isGenerating,
    generatingImageSceneId,
    isGeneratingAllImages,
    error,
    generateAdScenarioV2,
    setProductImage,
    generateSceneImage,
    generateAllSceneImages,
    replaceSceneImage,
    setAdScenario,
    saveAdScenarioToFile,
    loadAdScenarioFromFile,
    cloudProjectId,
    isSavingToCloud,
    isLoadingFromCloud,
    cloudProjects,
    isLoadingProjects,
    saveToCloud,
    loadFromCloud,
    deleteFromCloud,
    fetchProjects,
    updateAdScene,
    clearError,
  } = useAdScenario();

  // =============================================
  // Wizard State
  // =============================================
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);

  // Step 1: 광고 유형
  const [adType, setAdType] = useState<AdType>('product-intro');

  // Step 2: 상품/서비스 정보 (공통)
  const [industry, setIndustry] = useState<IndustryCategory>('other');
  const [productName, setProductName] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<TargetAudience[]>(['all']);
  const [customTarget, setCustomTarget] = useState('');

  // Step 2: 제품 소개 (product-intro)
  const [usp1, setUsp1] = useState('');
  const [usp2, setUsp2] = useState('');
  const [launchReason, setLaunchReason] = useState('');
  const [priceInfo, setPriceInfo] = useState('');

  // Step 2: 문제 해결 (problem-solution)
  const [painPoint, setPainPoint] = useState('');
  const [solution, setSolution] = useState('');
  const [effectResult, setEffectResult] = useState('');

  // Step 2: 라이프스타일 (lifestyle)
  const [brandMood, setBrandMood] = useState('');
  const [usageScene, setUsageScene] = useState('');
  const [stylingKeywords, setStylingKeywords] = useState('');

  // Step 2: 후기/체험 (testimonial)
  const [beforeState, setBeforeState] = useState('');
  const [afterChange, setAfterChange] = useState('');
  const [experienceHighlight, setExperienceHighlight] = useState('');

  // Step 2: 이벤트/혜택 (promotion)
  const [offerDetails, setOfferDetails] = useState('');
  const [periodCondition, setPeriodCondition] = useState('');
  const [discountInfo, setDiscountInfo] = useState('');

  // Step 2: 브랜드 스토리 (brand-story)
  const [brandPhilosophy, setBrandPhilosophy] = useState('');
  const [originStory, setOriginStory] = useState('');
  const [coreMessage, setCoreMessage] = useState('');

  // Step 3: 표현 스타일
  const [tone, setTone] = useState<ScenarioTone>('inspirational');
  const [imageStyle, setImageStyle] = useState<ImageStyle>(projectImageStyle);
  const [duration, setDuration] = useState<AdDuration>(30);
  const [engine, setEngine] = useState<AdEngine>('gemini');

  // 프로젝트 목록 패널
  const [showProjectList, setShowProjectList] = useState(false);

  // Scene view refs
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const sceneImageInputRef = useRef<HTMLInputElement>(null);
  const scenarioFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingSceneId, setUploadingSceneId] = useState<string | null>(null);

  // =============================================
  // Target audience toggle
  // =============================================
  const toggleTarget = (target: TargetAudience) => {
    setSelectedTargets(prev => {
      if (target === 'all') return ['all'];
      const without = prev.filter(t => t !== 'all');
      if (without.includes(target)) {
        const result = without.filter(t => t !== target);
        return result.length === 0 ? ['all'] : result;
      }
      return [...without, target];
    });
  };

  // =============================================
  // Generate V2 scenario
  // =============================================
  const handleGenerateV2 = useCallback(async () => {
    if (!isAuthenticated || !canUseApi) {
      setShowApiKeyModal(true);
      return;
    }
    if (!productName.trim()) return;

    const config: AdScenarioConfigV2 = {
      adType,
      industry,
      productName: productName.trim(),
      targetAudiences: selectedTargets,
      customTarget: customTarget.trim() || undefined,
      tone,
      imageStyle,
      duration,
      // 유형별 고유 필드
      ...(adType === 'product-intro' && {
        usps: [usp1.trim(), usp2.trim()].filter(Boolean),
        launchReason: launchReason.trim() || undefined,
        priceInfo: priceInfo.trim() || undefined,
      }),
      ...(adType === 'problem-solution' && {
        painPoint: painPoint.trim() || undefined,
        solution: solution.trim() || undefined,
        effectResult: effectResult.trim() || undefined,
      }),
      ...(adType === 'lifestyle' && {
        brandMood: brandMood.trim() || undefined,
        usageScene: usageScene.trim() || undefined,
        stylingKeywords: stylingKeywords.trim() || undefined,
      }),
      ...(adType === 'testimonial' && {
        beforeState: beforeState.trim() || undefined,
        afterChange: afterChange.trim() || undefined,
        experienceHighlight: experienceHighlight.trim() || undefined,
      }),
      ...(adType === 'promotion' && {
        offerDetails: offerDetails.trim() || undefined,
        periodCondition: periodCondition.trim() || undefined,
        discountInfo: discountInfo.trim() || undefined,
      }),
      ...(adType === 'brand-story' && {
        brandPhilosophy: brandPhilosophy.trim() || undefined,
        originStory: originStory.trim() || undefined,
        coreMessage: coreMessage.trim() || undefined,
      }),
    };

    try {
      await generateAdScenarioV2(config);
    } catch {
      // error handled by hook
    }
  }, [isAuthenticated, canUseApi, adType, industry, productName, selectedTargets, customTarget, tone, imageStyle, duration,
    usp1, usp2, launchReason, priceInfo,
    painPoint, solution, effectResult,
    brandMood, usageScene, stylingKeywords,
    beforeState, afterChange, experienceHighlight,
    offerDetails, periodCondition, discountInfo,
    brandPhilosophy, originStory, coreMessage,
    generateAdScenarioV2]);

  // =============================================
  // Scene handlers (same as before)
  // =============================================
  const handleProductImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setProductImage(compressed);
    } catch (err) {
      console.error('Product image upload failed:', err);
    }
    if (productImageInputRef.current) productImageInputRef.current.value = '';
  }, [setProductImage]);

  const handleSceneImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingSceneId) return;
    try {
      const compressed = await compressImageFile(file);
      replaceSceneImage(uploadingSceneId, compressed);
    } catch (err) {
      console.error('Scene image upload failed:', err);
    }
    setUploadingSceneId(null);
    if (sceneImageInputRef.current) sceneImageInputRef.current.value = '';
  }, [uploadingSceneId, replaceSceneImage]);

  const handleGenerateSceneImage = useCallback(async (sceneId: string) => {
    if (!isAuthenticated || !canUseApi) { setShowApiKeyModal(true); return; }
    await generateSceneImage(sceneId);
  }, [isAuthenticated, canUseApi, generateSceneImage]);

  const handleGenerateAllImages = useCallback(async () => {
    if (!isAuthenticated || !canUseApi) { setShowApiKeyModal(true); return; }
    await generateAllSceneImages({ includeTTS: true, ttsVoice: 'Kore', engine });
  }, [isAuthenticated, canUseApi, generateAllSceneImages, engine]);

  const handleDownloadAllAudio = useCallback(async () => {
    if (!adScenario) return;
    const scenesWithAudio = adScenario.scenes.filter(s => s.narrationAudio?.data);
    if (scenesWithAudio.length === 0) return;

    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    scenesWithAudio.forEach((scene) => {
      const ext = scene.narrationAudio!.mimeType === 'audio/mp3' ? 'mp3' : 'wav';
      const beatLabel = HDSER_BEAT_CONFIG[scene.storyBeat]?.label || scene.storyBeat;
      const fileName = `${String(scene.sceneNumber).padStart(2, '0')}_${beatLabel}.${ext}`;
      zip.file(fileName, scene.narrationAudio!.data, { base64: true });
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${adScenario.title || 'narration'}_audio.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }, [adScenario]);

  const handleNewScenario = useCallback(() => {
    setAdScenario(null);
    setWizardStep(1);
    setShowProjectList(false);
  }, [setAdScenario]);

  const handleCloudSave = useCallback(async () => {
    if (!isAuthenticated) { setShowApiKeyModal(true); return; }
    await saveToCloud();
  }, [isAuthenticated, saveToCloud]);

  const handleToggleProjectList = useCallback(async () => {
    if (!showProjectList && isAuthenticated) {
      await fetchProjects();
    }
    setShowProjectList(prev => !prev);
  }, [showProjectList, isAuthenticated, fetchProjects]);

  const handleLoadProject = useCallback(async (projectId: string) => {
    await loadFromCloud(projectId);
    setShowProjectList(false);
  }, [loadFromCloud]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    await deleteFromCloud(projectId);
  }, [deleteFromCloud]);

  const handleScenarioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await loadAdScenarioFromFile(file);
    if (scenarioFileInputRef.current) scenarioFileInputRef.current.value = '';
  };

  const hasAdScenario = adScenario !== null;

  // =============================================
  // Step validation
  // =============================================
  const canProceedStep2 = true; // Step 1 always valid (radio selection)
  const canProceedStep3 = productName.trim().length > 0;
  const canGenerate = productName.trim().length > 0;

  // =============================================
  // Render
  // =============================================
  return (
    <div className="h-full flex flex-col">
      {!hasAdScenario ? (
        /* =============================================
         * WIZARD: 3-Step Guided Input
         * ============================================= */
        <div className="flex-grow flex flex-col bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          {/* Wizard Header / Step Indicator */}
          <div className="flex-shrink-0 p-3 sm:p-4 border-b border-gray-700 bg-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                  <MegaphoneIcon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-white">광고 시나리오</h2>
              </div>
              <div className="flex items-center gap-2">
                {isAuthenticated && (
                  <button
                    onClick={handleToggleProjectList}
                    className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
                  >
                    <FolderIcon className="w-3.5 h-3.5" />
                    내 프로젝트
                  </button>
                )}
                <button
                  onClick={() => scenarioFileInputRef.current?.click()}
                  className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
                >
                  <UploadIcon className="w-3.5 h-3.5" />
                  파일 불러오기
                </button>
              </div>
            </div>
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <React.Fragment key={step}>
                  <button
                    onClick={() => { if (step <= wizardStep) setWizardStep(step as WizardStep); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      wizardStep === step
                        ? 'bg-orange-600 text-white'
                        : wizardStep > step
                          ? 'bg-orange-900/50 text-orange-300 cursor-pointer hover:bg-orange-900/70'
                          : 'bg-gray-700 text-gray-500'
                    }`}
                    disabled={step > wizardStep}
                  >
                    <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">{step}</span>
                    <span className="hidden sm:inline">
                      {step === 1 ? '광고 유형' : step === 2 ? '상품 정보' : '스타일'}
                    </span>
                  </button>
                  {step < 3 && <div className={`flex-grow h-px ${wizardStep > step ? 'bg-orange-600' : 'bg-gray-700'}`} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* 프로젝트 목록 패널 (위저드 뷰) */}
          {showProjectList && (
            <div className="flex-shrink-0 border-b border-gray-700 bg-gray-900/80 p-3 sm:p-4 max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <FolderIcon className="w-3.5 h-3.5" />
                  내 프로젝트
                </h4>
                <button onClick={() => setShowProjectList(false)} className="text-gray-500 hover:text-gray-300 text-xs">닫기</button>
              </div>
              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-4">
                  <svg className="animate-spin w-5 h-5 text-gray-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                </div>
              ) : cloudProjects.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">저장된 프로젝트가 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {cloudProjects.map(project => (
                    <div
                      key={project._id}
                      className="flex items-center gap-2 p-2 rounded-lg border border-gray-700 bg-gray-800/50 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex-grow min-w-0 cursor-pointer" onClick={() => handleLoadProject(project._id)}>
                        <p className="text-xs font-medium text-gray-200 truncate">{project.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {project.productName && (
                            <span className="text-[10px] text-gray-500">{project.productName}</span>
                          )}
                          <span className="text-[10px] text-gray-600">
                            {new Date(project.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteProject(project._id)}
                        className="flex-shrink-0 p-1.5 text-gray-600 hover:text-red-400 transition-colors"
                        title="삭제"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {isLoadingFromCloud && (
                <div className="flex items-center justify-center py-2 mt-2 border-t border-gray-700">
                  <svg className="animate-spin w-4 h-4 text-blue-400 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  <span className="text-xs text-gray-400">불러오는 중...</span>
                </div>
              )}
            </div>
          )}

          {/* Wizard Content */}
          <div className="flex-grow overflow-y-auto p-3 sm:p-4">
            {/* =============================================
             * STEP 1: 광고 유형 선택
             * ============================================= */}
            {wizardStep === 1 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">어떤 목적의 광고를 만드시나요?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AD_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAdType(opt.value)}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        adType === opt.value
                          ? 'border-orange-500 bg-orange-900/30 ring-1 ring-orange-500'
                          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-sm font-medium text-white">{opt.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{opt.description}</div>
                      <div className="text-[10px] text-gray-500 mt-1">{opt.example}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* =============================================
             * STEP 2: 상품/서비스 정보
             * ============================================= */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                {/* 업종 */}
                <div>
                  <label className="text-xs font-medium text-gray-300 mb-1.5 block">업종 카테고리</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value as IndustryCategory)}
                    className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    disabled={isGenerating}
                  >
                    {INDUSTRY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* 상품/서비스명 */}
                <div>
                  <label className="text-xs font-medium text-gray-300 mb-1.5 block">
                    상품/서비스명 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="예: 시그니처 라떼, 두피 케어 프로그램"
                    className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm"
                    disabled={isGenerating}
                  />
                </div>

                {/* ===== 유형별 고유 필드 ===== */}

                {/* 제품 소개 */}
                {adType === 'product-intro' && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">핵심 특징/차별점 (USP)</label>
                      <div className="space-y-2">
                        <input type="text" value={usp1} onChange={(e) => setUsp1(e.target.value)}
                          placeholder="특징 1: 예) 유기농 원두 100%, 특허받은 성분"
                          className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                        <input type="text" value={usp2} onChange={(e) => setUsp2(e.target.value)}
                          placeholder="특징 2: 예) 48시간 보습 유지 (선택)"
                          className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">출시 배경/이유 <span className="text-gray-500">(선택)</span></label>
                      <input type="text" value={launchReason} onChange={(e) => setLaunchReason(e.target.value)}
                        placeholder="예: 고객 요청으로 개발, 3년간 연구 끝에 완성"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">가격대 <span className="text-gray-500">(선택)</span></label>
                      <input type="text" value={priceInfo} onChange={(e) => setPriceInfo(e.target.value)}
                        placeholder="예: 월 9,900원, 29,000원~"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                  </>
                )}

                {/* 문제 해결 */}
                {adType === 'problem-solution' && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">고객의 문제/불편점</label>
                      <input type="text" value={painPoint} onChange={(e) => setPainPoint(e.target.value)}
                        placeholder="예: 매일 아침 푸석한 피부, 두피 가려움이 심한 직장인"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">해결 방법/원리</label>
                      <input type="text" value={solution} onChange={(e) => setSolution(e.target.value)}
                        placeholder="예: 특허 세라마이드 성분이 피부 장벽을 복구"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">효과/결과</label>
                      <input type="text" value={effectResult} onChange={(e) => setEffectResult(e.target.value)}
                        placeholder="예: 2주 만에 피부 수분량 40% 증가, 사용자 95% 만족"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                  </>
                )}

                {/* 라이프스타일 */}
                {adType === 'lifestyle' && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">브랜드 분위기/무드</label>
                      <input type="text" value={brandMood} onChange={(e) => setBrandMood(e.target.value)}
                        placeholder="예: 미니멀하고 따뜻한, 자연친화적이고 여유로운"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">사용 장면/상황</label>
                      <input type="text" value={usageScene} onChange={(e) => setUsageScene(e.target.value)}
                        placeholder="예: 주말 아침 창가에서 커피 한잔, 퇴근 후 홈카페"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">연출 키워드 <span className="text-gray-500">(선택)</span></label>
                      <input type="text" value={stylingKeywords} onChange={(e) => setStylingKeywords(e.target.value)}
                        placeholder="예: 자연광, 린넨 소재, 우드톤, 식물"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                  </>
                )}

                {/* 후기/체험 */}
                {adType === 'testimonial' && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">사용 전 고민/상태</label>
                      <input type="text" value={beforeState} onChange={(e) => setBeforeState(e.target.value)}
                        placeholder="예: 다크서클이 심해서 항상 피곤해 보였음"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">사용 후 변화</label>
                      <input type="text" value={afterChange} onChange={(e) => setAfterChange(e.target.value)}
                        placeholder="예: 2주 사용 후 눈가가 확 밝아짐, 주변에서 먼저 알아봄"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">체험 포인트 <span className="text-gray-500">(선택)</span></label>
                      <input type="text" value={experienceHighlight} onChange={(e) => setExperienceHighlight(e.target.value)}
                        placeholder="예: 발림성이 좋고 끈적임 없음, 향이 은은해서 좋음"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                  </>
                )}

                {/* 이벤트/혜택 */}
                {adType === 'promotion' && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">이벤트/혜택 내용</label>
                      <input type="text" value={offerDetails} onChange={(e) => setOfferDetails(e.target.value)}
                        placeholder="예: 오픈 기념 전 메뉴 50% 할인, 1+1 이벤트"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">기간/조건</label>
                      <input type="text" value={periodCondition} onChange={(e) => setPeriodCondition(e.target.value)}
                        placeholder="예: 12월 한 달간, 선착순 100명, 앱 회원 한정"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">가격/할인 정보</label>
                      <input type="text" value={discountInfo} onChange={(e) => setDiscountInfo(e.target.value)}
                        placeholder="예: 정가 39,000원 → 19,500원, 첫 구매 30% 쿠폰"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                  </>
                )}

                {/* 브랜드 스토리 */}
                {adType === 'brand-story' && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">브랜드 철학/가치</label>
                      <input type="text" value={brandPhilosophy} onChange={(e) => setBrandPhilosophy(e.target.value)}
                        placeholder="예: 좋은 재료로 정직하게, 지속 가능한 뷰티"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">브랜드 탄생 배경 <span className="text-gray-500">(선택)</span></label>
                      <input type="text" value={originStory} onChange={(e) => setOriginStory(e.target.value)}
                        placeholder="예: 아토피 자녀를 위해 시작한 천연 화장품 연구"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-1.5 block">핵심 메시지</label>
                      <input type="text" value={coreMessage} onChange={(e) => setCoreMessage(e.target.value)}
                        placeholder="예: 당신의 피부에도 정직한 시간을 선물하세요"
                        className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm" disabled={isGenerating} />
                    </div>
                  </>
                )}

                {/* 타겟 고객 (공통) */}
                <div>
                  <label className="text-xs font-medium text-gray-300 mb-1.5 block">타겟 고객</label>
                  <div className="flex flex-wrap gap-1.5">
                    {TARGET_AUDIENCE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => toggleTarget(opt.value)}
                        className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          selectedTargets.includes(opt.value)
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={customTarget}
                    onChange={(e) => setCustomTarget(e.target.value)}
                    placeholder="타겟 상세 입력 (예: 서울 강남 거주 직장인, 피부 관리에 관심 많은)"
                    className="w-full mt-2 p-2.5 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm"
                    disabled={isGenerating}
                  />
                </div>
              </div>
            )}

            {/* =============================================
             * STEP 3: 표현 스타일
             * ============================================= */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                {/* 생성 엔진 */}
                <div>
                  <label className="text-xs font-medium text-gray-300 mb-1.5 block">이미지 생성 엔진</label>
                  <div className="grid grid-cols-2 gap-2">
                    {AD_ENGINE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setEngine(opt.value)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          engine === opt.value
                            ? opt.value === 'flux'
                              ? 'border-blue-500 bg-blue-900/30 ring-1 ring-blue-500'
                              : 'border-orange-500 bg-orange-900/30 ring-1 ring-orange-500'
                            : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                        }`}
                      >
                        <div className="text-sm font-bold text-white">{opt.label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{opt.description}</div>
                        <div className={`text-[10px] mt-1 ${opt.value === 'flux' ? 'text-blue-400' : 'text-green-400'}`}>{opt.cost}</div>
                      </button>
                    ))}
                  </div>
                  {engine === 'flux' && (
                    <p className="text-[10px] text-blue-300 mt-1.5 px-1">
                      FLUX 엔진: 앵커 이미지 기반 3단계 파이프라인으로 씬간 일관성을 강화합니다. EachLabs API 키 필요.
                    </p>
                  )}
                </div>

                {/* 톤 */}
                <div>
                  <label className="text-xs font-medium text-gray-300 mb-1.5 block">톤/분위기</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {TONE_OPTIONS.filter(t => t.category === 'commercial' || t.value === 'emotional' || t.value === 'comedic' || t.value === 'inspirational' || t.value === 'dramatic').map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setTone(opt.value)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          tone === opt.value
                            ? 'border-orange-500 bg-orange-900/30'
                            : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                        }`}
                      >
                        <div className="text-xs font-medium text-white">{opt.label}</div>
                        <div className="text-[10px] text-gray-500">{opt.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 이미지 스타일 */}
                <div>
                  <label className="text-xs font-medium text-gray-300 mb-1.5 block">비주얼 스타일</label>
                  <select
                    value={imageStyle}
                    onChange={(e) => setImageStyle(e.target.value as ImageStyle)}
                    className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {IMAGE_STYLE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* 영상 길이 */}
                <div>
                  <label className="text-xs font-medium text-gray-300 mb-1.5 block">영상 길이</label>
                  <div className="grid grid-cols-4 gap-2">
                    {AD_DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setDuration(opt.value)}
                        className={`p-2.5 rounded-lg border text-center transition-all ${
                          duration === opt.value
                            ? 'border-orange-500 bg-orange-900/30'
                            : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                        }`}
                      >
                        <div className="text-sm font-bold text-white">{opt.label}</div>
                        <div className="text-[10px] text-gray-500">{opt.scenes}씬</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="p-3 bg-gray-900/70 border border-gray-700 rounded-lg">
                  <h4 className="text-xs font-bold text-gray-300 mb-2">설정 요약</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    <span className="text-gray-500">광고 유형</span>
                    <span className="text-gray-300">{AD_TYPE_OPTIONS.find(o => o.value === adType)?.label}</span>
                    <span className="text-gray-500">업종</span>
                    <span className="text-gray-300">{INDUSTRY_OPTIONS.find(o => o.value === industry)?.label}</span>
                    <span className="text-gray-500">상품명</span>
                    <span className="text-gray-300 truncate">{productName || '-'}</span>
                    <span className="text-gray-500">길이</span>
                    <span className="text-gray-300">{duration}초 / {AD_DURATION_OPTIONS.find(o => o.value === duration)?.scenes}씬</span>
                    <span className="text-gray-500">이미지 엔진</span>
                    <span className={engine === 'flux' ? 'text-blue-300' : 'text-gray-300'}>
                      {AD_ENGINE_OPTIONS.find(o => o.value === engine)?.label}
                    </span>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Wizard Footer: Navigation Buttons */}
          <div className="flex-shrink-0 p-3 sm:p-4 border-t border-gray-700 bg-gray-800 flex items-center justify-between gap-2">
            {wizardStep > 1 ? (
              <button
                onClick={() => setWizardStep((wizardStep - 1) as WizardStep)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 flex items-center gap-1"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                이전
              </button>
            ) : <div />}

            {wizardStep < 3 ? (
              <button
                onClick={() => setWizardStep((wizardStep + 1) as WizardStep)}
                disabled={wizardStep === 2 && !canProceedStep3}
                className="min-h-[44px] px-4 py-2 text-sm font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                다음
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleGenerateV2}
                disabled={isGenerating || !canGenerate}
                className="min-h-[44px] px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-600 rounded-lg hover:from-orange-400 hover:to-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
            )}
          </div>
        </div>
      ) : (
        /* =============================================
         * SCENARIO RESULT VIEW (HDSER)
         * ============================================= */
        <div className="h-full flex flex-col bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 p-3 sm:p-4 border-b border-gray-700 bg-gray-800">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-grow min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">{adScenario.title}</h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">{adScenario.synopsis}</p>
                <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
                  <span className="px-2 py-1 bg-orange-900/50 rounded text-orange-300">{adScenario.totalDuration}초 광고</span>
                  <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">{adScenario.scenes.length}씬</span>
                  <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">{adScenario.productName}</span>
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {/* 엔진 선택 토글 */}
                <div className="flex items-center bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                  {AD_ENGINE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setEngine(opt.value)}
                      className={`min-h-[36px] px-2 py-1.5 text-[10px] font-medium transition-colors ${
                        engine === opt.value
                          ? opt.value === 'flux'
                            ? 'bg-blue-600 text-white'
                            : 'bg-orange-600 text-white'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                      title={opt.description}
                    >
                      {opt.value === 'gemini' ? 'Gemini' : 'FLUX'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleGenerateAllImages}
                  disabled={isGeneratingAllImages || isGenerating}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">전체 생성</span>
                </button>
                {isAuthenticated && (
                  <button
                    onClick={handleCloudSave}
                    disabled={isSavingToCloud}
                    className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-500 disabled:opacity-50 flex items-center gap-1"
                    title={cloudProjectId ? '클라우드 업데이트' : '클라우드 저장'}
                  >
                    {isSavingToCloud ? (
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <CloudIcon className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">{cloudProjectId ? '업데이트' : '클라우드 저장'}</span>
                  </button>
                )}
                {isAuthenticated && (
                  <button
                    onClick={handleToggleProjectList}
                    className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 flex items-center gap-1"
                    title="내 프로젝트"
                  >
                    <FolderIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">프로젝트</span>
                  </button>
                )}
                <button
                  onClick={saveAdScenarioToFile}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 flex items-center gap-1"
                  title="파일로 저장"
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">파일</span>
                </button>
                {adScenario.scenes.some(s => s.narrationAudio?.data) && (
                  <button
                    onClick={handleDownloadAllAudio}
                    className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-500 flex items-center gap-1"
                    title="나레이션 오디오 일괄 다운로드 (ZIP)"
                  >
                    <MusicNoteIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">오디오</span>
                  </button>
                )}
                <button
                  onClick={() => scenarioFileInputRef.current?.click()}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 flex items-center gap-1"
                  title="파일 불러오기"
                >
                  <UploadIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">파일</span>
                </button>
                <button
                  onClick={handleNewScenario}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 flex items-center gap-1"
                >
                  <ClearIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">새로 만들기</span>
                </button>
              </div>
            </div>
          </div>

          {/* 프로젝트 목록 패널 (결과 뷰) */}
          {showProjectList && (
            <div className="flex-shrink-0 border-b border-gray-700 bg-gray-900/80 p-3 sm:p-4 max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <FolderIcon className="w-3.5 h-3.5" />
                  내 프로젝트
                </h4>
                <button onClick={() => setShowProjectList(false)} className="text-gray-500 hover:text-gray-300 text-xs">닫기</button>
              </div>
              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-4">
                  <svg className="animate-spin w-5 h-5 text-gray-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                </div>
              ) : cloudProjects.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">저장된 프로젝트가 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {cloudProjects.map(project => (
                    <div
                      key={project._id}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                        cloudProjectId === project._id
                          ? 'border-green-600/50 bg-green-900/20'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex-grow min-w-0 cursor-pointer" onClick={() => handleLoadProject(project._id)}>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-medium text-gray-200 truncate">{project.title}</p>
                          {cloudProjectId === project._id && (
                            <span className="text-[9px] text-green-400 flex-shrink-0">현재</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {project.productName && (
                            <span className="text-[10px] text-gray-500">{project.productName}</span>
                          )}
                          <span className="text-[10px] text-gray-600">
                            {new Date(project.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteProject(project._id)}
                        className="flex-shrink-0 p-1.5 text-gray-600 hover:text-red-400 transition-colors"
                        title="삭제"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {isLoadingFromCloud && (
                <div className="flex items-center justify-center py-2 mt-2 border-t border-gray-700">
                  <svg className="animate-spin w-4 h-4 text-blue-400 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  <span className="text-xs text-gray-400">불러오는 중...</span>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="flex-grow overflow-y-auto p-3 sm:p-4 space-y-4">
            {/* 상품 이미지 업로드 섹션 */}
            <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 border border-orange-700/50 rounded-xl p-4">
              <h3 className="text-sm font-bold text-orange-300 mb-2 flex items-center gap-2">
                <UploadIcon className="w-4 h-4" />
                상품 이미지
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                상품 실물 이미지를 업로드하면 씬 이미지 생성 시 자동으로 참조됩니다.
              </p>
              <input
                ref={productImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleProductImageUpload}
                className="hidden"
              />
              {adScenario.productImage ? (
                <div className="flex items-center gap-3">
                  <img
                    src={`data:${adScenario.productImage.mimeType};base64,${adScenario.productImage.data}`}
                    alt="상품 이미지"
                    className="w-20 h-20 object-cover rounded-lg border border-orange-600/50"
                  />
                  <div className="flex-grow">
                    <p className="text-xs text-green-400 font-medium">상품 이미지 등록됨</p>
                    <p className="text-xs text-gray-500 mt-0.5">이미지 생성 시 자동 참조</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => productImageInputRef.current?.click()} className="min-h-[36px] px-3 py-1.5 text-xs text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600">변경</button>
                    <button onClick={() => setProductImage(undefined)} className="min-h-[36px] p-2 text-red-400 bg-gray-700 rounded-lg hover:bg-gray-600"><TrashIcon className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => productImageInputRef.current?.click()}
                  className="w-full min-h-[60px] border-2 border-dashed border-orange-600/50 rounded-lg flex items-center justify-center gap-2 text-orange-400 hover:border-orange-500 hover:text-orange-300 transition-colors"
                >
                  <UploadIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">상품 이미지 업로드</span>
                </button>
              )}
            </div>

            {/* HDSER 씬 목록 */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-300">HDSER 씬 구성</h3>
              {adScenario.scenes.map((scene) => {
                const sceneImage = scene.customImage || scene.generatedImage;
                const isGeneratingThis = generatingImageSceneId === scene.id;
                const beatConfig = HDSER_BEAT_CONFIG[scene.storyBeat] || { label: scene.storyBeat, color: 'bg-gray-600' };

                return (
                  <div key={scene.id} className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="flex gap-3 p-3">
                      {/* 이미지 영역 */}
                      <div className="relative flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28">
                        {sceneImage ? (
                          <img
                            src={`data:${sceneImage.mimeType};base64,${sceneImage.data}`}
                            alt={`씬 ${scene.sceneNumber}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-800 rounded-lg flex flex-col items-center justify-center gap-1.5">
                            {isGeneratingThis ? (
                              <svg className="animate-spin w-5 h-5 text-blue-400" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <>
                                <button onClick={() => handleGenerateSceneImage(scene.id)} className="p-1.5 text-blue-400 hover:text-blue-300 transition-colors" title="AI 이미지 생성">
                                  <SparklesIcon className="w-5 h-5" />
                                </button>
                                <button onClick={() => { setUploadingSceneId(scene.id); sceneImageInputRef.current?.click(); }} className="p-1.5 text-gray-400 hover:text-gray-300 transition-colors" title="이미지 업로드">
                                  <UploadIcon className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-bold text-white">
                          {scene.sceneNumber}
                        </span>
                      </div>

                      {/* 텍스트 영역 */}
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`px-1.5 py-0.5 ${beatConfig.color} rounded text-[10px] font-bold text-white`}>
                            {beatConfig.label}
                          </span>
                          <span className="text-[10px] text-gray-500">{scene.duration}초</span>
                          {scene.narrationAudio?.data && (
                            <span className="px-1.5 py-0.5 bg-teal-900/50 rounded text-[10px] text-teal-400" title={`오디오 ${scene.narrationAudio.durationMs ? (scene.narrationAudio.durationMs / 1000).toFixed(1) + '초' : '생성됨'}`}>
                              ♪
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-200 line-clamp-2 mb-1">
                          {scene.narration}
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-500 line-clamp-1">
                          {scene.visualDescription}
                        </p>
                        <button
                          onClick={() => setExpandedSceneId(expandedSceneId === scene.id ? null : scene.id)}
                          className={`mt-1 flex items-center gap-1 text-[10px] ${expandedSceneId === scene.id ? 'text-blue-400' : 'text-gray-500 hover:text-gray-400'} transition-colors`}
                        >
                          <PencilIcon className="w-3 h-3" />
                          {expandedSceneId === scene.id ? '프롬프트 접기' : '프롬프트 편집'}
                        </button>
                      </div>

                      {/* Actions */}
                      {sceneImage && (
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button onClick={() => handleGenerateSceneImage(scene.id)} disabled={isGeneratingThis} className="p-1.5 text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors" title="이미지 재생성">
                            <SparklesIcon className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setUploadingSceneId(scene.id); sceneImageInputRef.current?.click(); }} className="p-1.5 text-gray-400 hover:text-gray-300 transition-colors" title="이미지 교체">
                            <UploadIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 프롬프트 편집 영역 (접이식) */}
                    {expandedSceneId === scene.id && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-700/50 pt-2">
                        <div>
                          <label className="text-[10px] text-gray-400 mb-0.5 block">Image Prompt</label>
                          <textarea
                            value={scene.imagePrompt}
                            onChange={(e) => updateAdScene(scene.id, { imagePrompt: e.target.value })}
                            className="w-full bg-gray-800/70 text-xs text-gray-200 rounded p-2 resize-none border border-gray-700 focus:border-blue-500 focus:outline-none"
                            rows={3}
                            placeholder="이미지 생성용 영어 프롬프트..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 mb-0.5 block">Video Prompt</label>
                          <textarea
                            value={scene.videoPrompt || ''}
                            onChange={(e) => updateAdScene(scene.id, { videoPrompt: e.target.value })}
                            className="w-full bg-gray-800/70 text-xs text-gray-200 rounded p-2 resize-none border border-gray-700 focus:border-blue-500 focus:outline-none"
                            rows={2}
                            placeholder="영상 모션 프롬프트 (카메라 움직임, 장면 동작)..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 클라우드 저장 상태 */}
            {cloudProjectId && (
              <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg flex items-center gap-2">
                <CloudIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                <p className="text-xs text-green-300">
                  클라우드에 저장됨 &middot; 변경 사항은 &quot;클라우드 저장&quot; 버튼을 눌러 업데이트하세요.
                </p>
              </div>
            )}

            {/* 안내 메시지 */}
            <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
              <p className="text-xs text-blue-300">
                영상 제작 탭에서 프리뷰와 내보내기를 할 수 있습니다.
                상품 이미지를 먼저 업로드한 후 이미지를 생성하면 상품 컨텍스트가 유지됩니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={sceneImageInputRef} type="file" accept="image/*" onChange={handleSceneImageUpload} className="hidden" />
      <input ref={scenarioFileInputRef} type="file" accept=".json" onChange={handleScenarioFileChange} className="hidden" />

      {/* API 키 필요 모달 */}
      <ApiKeyRequiredModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} featureName="광고 시나리오 생성" />
    </div>
  );
};

export default AdTab;
