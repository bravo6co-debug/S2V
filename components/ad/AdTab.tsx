import React, { useState, useRef, useCallback } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAdScenario } from '../../hooks/useAdScenario';
import {
  AdScenarioConfig,
  ImageStyle,
  ScenarioTone,
  IMAGE_STYLE_OPTIONS,
  TONE_OPTIONS,
} from '../../types';
import { compressImageFile } from '../../services/imageCompression';
import ApiKeyRequiredModal from '../ApiKeyRequiredModal';
import { SparklesIcon, ClearIcon } from '../Icons';

// Ad Phase 라벨 매핑
const AD_PHASE_LABELS: Record<string, { label: string; color: string }> = {
  Attention: { label: '주목', color: 'bg-red-600' },
  Interest: { label: '관심', color: 'bg-orange-600' },
  Credibility: { label: '신뢰', color: 'bg-blue-600' },
  Proof: { label: '증명', color: 'bg-green-600' },
  Appeal: { label: '어필', color: 'bg-purple-600' },
  CTA: { label: 'CTA', color: 'bg-pink-600' },
};

const STORY_BEAT_COLORS: Record<string, string> = {
  Hook: 'bg-red-600',
  Setup: 'bg-blue-600',
  Development: 'bg-green-600',
  Climax: 'bg-yellow-600',
  Resolution: 'bg-purple-600',
};

// Icons
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

const AdTab: React.FC = () => {
  const { isAuthenticated, canUseApi } = useAuth();
  const { imageStyle: projectImageStyle } = useProject();
  const {
    adScenario,
    isGenerating,
    generatingImageSceneId,
    isGeneratingAllImages,
    error,
    generateAdScenario,
    setProductImage,
    generateSceneImage,
    generateAllSceneImages,
    replaceSceneImage,
    setAdScenario,
    clearError,
  } = useAdScenario();

  // Input form state
  const [productName, setProductName] = useState('');
  const [productFeatures, setProductFeatures] = useState('');
  const [tone, setTone] = useState<ScenarioTone>('inspirational');
  const [imageStyle, setImageStyle] = useState<ImageStyle>(projectImageStyle);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const productImageInputRef = useRef<HTMLInputElement>(null);
  const sceneImageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingSceneId, setUploadingSceneId] = useState<string | null>(null);

  // 광고 시나리오 생성
  const handleGenerate = useCallback(async () => {
    if (!isAuthenticated || !canUseApi) {
      setShowApiKeyModal(true);
      return;
    }
    if (!productName.trim()) return;

    const config: AdScenarioConfig = {
      productName: productName.trim(),
      productFeatures: productFeatures.trim(),
      tone,
      imageStyle,
    };

    try {
      await generateAdScenario(config);
    } catch {
      // error handled by hook
    }
  }, [isAuthenticated, canUseApi, productName, productFeatures, tone, imageStyle, generateAdScenario]);

  // 상품 이미지 업로드
  const handleProductImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file);
      setProductImage(compressed);
    } catch (err) {
      console.error('Product image upload failed:', err);
    }

    // Reset file input
    if (productImageInputRef.current) {
      productImageInputRef.current.value = '';
    }
  }, [setProductImage]);

  // 씬 이미지 업로드
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
    if (sceneImageInputRef.current) {
      sceneImageInputRef.current.value = '';
    }
  }, [uploadingSceneId, replaceSceneImage]);

  // 씬 이미지 생성
  const handleGenerateSceneImage = useCallback(async (sceneId: string) => {
    if (!isAuthenticated || !canUseApi) {
      setShowApiKeyModal(true);
      return;
    }
    await generateSceneImage(sceneId);
  }, [isAuthenticated, canUseApi, generateSceneImage]);

  // 전체 이미지 생성
  const handleGenerateAllImages = useCallback(async () => {
    if (!isAuthenticated || !canUseApi) {
      setShowApiKeyModal(true);
      return;
    }
    await generateAllSceneImages({ includeTTS: true, ttsVoice: 'Kore' });
  }, [isAuthenticated, canUseApi, generateAllSceneImages]);

  // 새 시나리오 생성 (현재 시나리오 초기화)
  const handleNewScenario = useCallback(() => {
    setAdScenario(null);
  }, [setAdScenario]);

  const hasAdScenario = adScenario !== null;

  return (
    <div className="h-full flex flex-col">
      {/* 광고 시나리오가 없을 때: 입력 폼 */}
      {!hasAdScenario ? (
        <div className="flex-grow flex flex-col items-center justify-center bg-gray-800/50 rounded-xl border border-gray-700 p-4 sm:p-8">
          <div className="w-full max-w-lg">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center">
                <MegaphoneIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-2">30초 광고 숏폼</h2>
              <p className="text-gray-400 text-xs sm:text-sm">
                상품 정보를 입력하면 AI가 6씬(5초씩) 광고 시나리오를 생성합니다.
                <br />생성 후 상품 이미지를 업로드하면 컨텍스트가 유지됩니다.
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* 상품명 */}
              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-300 mb-2 block">
                  상품명 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="예: 아쿠아 히알루론 세럼"
                  className="w-full p-2.5 sm:p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm"
                  disabled={isGenerating}
                />
              </div>

              {/* 상품 특징 */}
              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-300 mb-2 block">
                  상품 특징 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={productFeatures}
                  onChange={(e) => setProductFeatures(e.target.value)}
                  placeholder={"예:\n- 히알루론산 3중 보습\n- 48시간 수분 유지\n- 민감성 피부 테스트 완료\n- 무향료, 무색소"}
                  className="w-full h-28 p-2.5 sm:p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm resize-none"
                  disabled={isGenerating}
                />
              </div>

              {/* 톤 & 스타일 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-300 mb-2 block">톤/분위기</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as ScenarioTone)}
                    className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    disabled={isGenerating}
                  >
                    {TONE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-300 mb-2 block">이미지 스타일</label>
                  <select
                    value={imageStyle}
                    onChange={(e) => setImageStyle(e.target.value as ImageStyle)}
                    className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    disabled={isGenerating}
                  >
                    {IMAGE_STYLE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !productName.trim() || !productFeatures.trim()}
                className="w-full min-h-[48px] px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-600 rounded-lg hover:from-orange-400 hover:to-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    시나리오 생성 중...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <SparklesIcon className="w-4 h-4" />
                    광고 시나리오 생성
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* 광고 시나리오가 있을 때: 결과 표시 */
        <div className="h-full flex flex-col bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 p-3 sm:p-4 border-b border-gray-700 bg-gray-800">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-grow min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">{adScenario.title}</h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">{adScenario.synopsis}</p>
                <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
                  <span className="px-2 py-1 bg-orange-900/50 rounded text-orange-300">30초 광고</span>
                  <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">6씬 x 5초</span>
                  <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">{adScenario.productName}</span>
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={handleGenerateAllImages}
                  disabled={isGeneratingAllImages || isGenerating}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">전체 생성</span>
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
                    <button
                      onClick={() => productImageInputRef.current?.click()}
                      className="min-h-[36px] px-3 py-1.5 text-xs text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
                    >
                      변경
                    </button>
                    <button
                      onClick={() => setProductImage(undefined)}
                      className="min-h-[36px] p-2 text-red-400 bg-gray-700 rounded-lg hover:bg-gray-600"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
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

            {/* 씬 목록 */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-300">씬 구성 (6씬 x 5초)</h3>
              {adScenario.scenes.map((scene) => {
                const sceneImage = scene.customImage || scene.generatedImage;
                const isGeneratingThis = generatingImageSceneId === scene.id;
                const beatColor = STORY_BEAT_COLORS[scene.storyBeat] || 'bg-gray-600';

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
                                <button
                                  onClick={() => handleGenerateSceneImage(scene.id)}
                                  className="p-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                                  title="AI 이미지 생성"
                                >
                                  <SparklesIcon className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setUploadingSceneId(scene.id);
                                    sceneImageInputRef.current?.click();
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-gray-300 transition-colors"
                                  title="이미지 업로드"
                                >
                                  <UploadIcon className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                        {/* 씬 번호 뱃지 */}
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-bold text-white">
                          {scene.sceneNumber}
                        </span>
                      </div>

                      {/* 텍스트 영역 */}
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`px-1.5 py-0.5 ${beatColor} rounded text-[10px] font-bold text-white`}>
                            {scene.storyBeat}
                          </span>
                          <span className="text-[10px] text-gray-500">{scene.duration}초</span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-200 line-clamp-2 mb-1">
                          {scene.narration}
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-500 line-clamp-1">
                          {scene.visualDescription}
                        </p>
                      </div>

                      {/* Actions */}
                      {sceneImage && (
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleGenerateSceneImage(scene.id)}
                            disabled={isGeneratingThis}
                            className="p-1.5 text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                            title="이미지 재생성"
                          >
                            <SparklesIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setUploadingSceneId(scene.id);
                              sceneImageInputRef.current?.click();
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-300 transition-colors"
                            title="이미지 교체"
                          >
                            <UploadIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

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
      <input
        ref={sceneImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleSceneImageUpload}
        className="hidden"
      />

      {/* API 키 필요 모달 */}
      <ApiKeyRequiredModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        featureName="광고 시나리오 생성"
      />
    </div>
  );
};

export default AdTab;
