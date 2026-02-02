import React, { useState, useRef, useCallback } from 'react';
import {
  translateFoodPrompt,
  generateFoodVideo,
  generateMukbangImage,
  type FoodVideoResult,
  type MukbangPersonType,
  type MukbangImageResult,
  type ImageData,
} from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { compressImageForVideo, getBase64Size, formatBytes } from '../../services/imageCompression';

// =============================================
// 모드 타입 및 상수
// =============================================

type FoodVideoMode = 'basic' | 'mukbang';

interface FoodImageData {
  mimeType: string;
  data: string;
}

const PERSON_TYPE_OPTIONS: { value: MukbangPersonType; label: string }[] = [
  { value: 'young-woman', label: '20대 여성' },
  { value: 'young-man', label: '20대 남성' },
  { value: 'middle-woman', label: '40대 여성' },
  { value: 'middle-man', label: '40대 남성' },
];

// =============================================
// 공통 이미지 업로드 훅
// =============================================

function useImageUpload() {
  const [image, setImage] = useState<FoodImageData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sizeInfo, setSizeInfo] = useState<{ original: number; compressed: number } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) return '이미지 파일만 업로드할 수 있습니다.';
    if (file.size > 10 * 1024 * 1024) return '이미지 크기는 10MB 이하여야 합니다.';

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const originalSize = file.size;
      const compressed = await compressImageForVideo(dataUrl);
      const compressedSize = getBase64Size(compressed.data);

      setImage({ mimeType: compressed.mimeType, data: compressed.data });
      setPreviewUrl(`data:${compressed.mimeType};base64,${compressed.data}`);
      setSizeInfo({ original: originalSize, compressed: compressedSize });
      setWarning(
        compressed.upscaled
          ? `원본 이미지가 작아서 자동 확대되었습니다 (→ ${compressed.dimensions?.width}x${compressed.dimensions?.height}). 고화질 원본 이미지를 사용하면 더 좋은 결과가 생성됩니다.`
          : null
      );
      return null;
    } catch {
      return '이미지 처리에 실패했습니다. 다른 이미지를 시도해 주세요.';
    }
  }, []);

  const handleRemove = useCallback(() => {
    setImage(null);
    setPreviewUrl(null);
    setSizeInfo(null);
    setWarning(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  return { image, previewUrl, sizeInfo, warning, inputRef, handleUpload, handleRemove };
}

// =============================================
// 공통 Spinner 컴포넌트
// =============================================

const Spinner: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// =============================================
// 이미지 업로드 UI 컴포넌트
// =============================================

interface ImageUploadAreaProps {
  label: string;
  previewUrl: string | null;
  sizeInfo: { original: number; compressed: number } | null;
  warning: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
  placeholderText?: string;
  accentColor?: string;
}

const ImageUploadArea: React.FC<ImageUploadAreaProps> = ({
  label, previewUrl, sizeInfo, warning, inputRef,
  onFileSelect, onDrop, onRemove,
  placeholderText = '클릭하거나 이미지를 드래그하세요',
  accentColor = 'amber',
}) => {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      {previewUrl ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-gray-600 bg-gray-900">
          <img src={previewUrl} alt={label} className="w-full max-h-64 sm:max-h-80 object-contain" />
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 p-2 bg-red-600/80 hover:bg-red-500 text-white rounded-full transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="이미지 제거"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {sizeInfo && (
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-gray-900/80 rounded text-xs text-gray-300">
              {sizeInfo.original !== sizeInfo.compressed
                ? `${formatBytes(sizeInfo.original)} → ${formatBytes(sizeInfo.compressed)} (압축됨)`
                : formatBytes(sizeInfo.compressed)
              }
            </div>
          )}
          {warning && (
            <div className="absolute top-2 left-2 right-12 px-2 py-1.5 bg-amber-900/90 border border-amber-600/50 rounded text-xs text-amber-300">
              {warning}
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={handleDragOver}
          className={`border-2 border-dashed border-gray-600 hover:border-${accentColor}-500/50 rounded-xl p-6 sm:p-10 text-center cursor-pointer transition-colors bg-gray-900/30 hover:bg-gray-900/50`}
        >
          <svg className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <p className="text-sm text-gray-400 font-medium">{placeholderText}</p>
          <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP (최대 10MB)</p>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={onFileSelect} className="hidden" />
    </div>
  );
};

// =============================================
// 메인 컴포넌트
// =============================================

export const FoodVideoTab: React.FC = () => {
  const { isAuthenticated, canUseApi, openLoginModal, openSettingsModal } = useAuth();

  // 모드 선택
  const [mode, setMode] = useState<FoodVideoMode>('basic');

  // =============================================
  // 기본 모드 상태
  // =============================================
  const foodUpload = useImageUpload();

  const [koreanPrompt, setKoreanPrompt] = useState('');
  const [englishPrompt, setEnglishPrompt] = useState('');
  const [koreanDescription, setKoreanDescription] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FoodVideoResult | null>(null);

  // =============================================
  // 먹방 모드 상태
  // =============================================
  const mukFoodUpload = useImageUpload();
  const mukPersonUpload = useImageUpload();

  const [foodName, setFoodName] = useState('');
  const [personSource, setPersonSource] = useState<'upload' | 'generate'>('upload');
  const [personGenMode, setPersonGenMode] = useState<'preset' | 'custom'>('preset');
  const [personType, setPersonType] = useState<MukbangPersonType>('young-woman');
  const [customPersonDesc, setCustomPersonDesc] = useState('');
  const [customScenePrompt, setCustomScenePrompt] = useState('');
  const [isGeneratingMukbangImage, setIsGeneratingMukbangImage] = useState(false);
  const [mukbangComposite, setMukbangComposite] = useState<ImageData | null>(null);
  const [mukbangCompositeUrl, setMukbangCompositeUrl] = useState<string | null>(null);
  const [mukbangVideoPrompt, setMukbangVideoPrompt] = useState('');
  const [isGeneratingMukbangVideo, setIsGeneratingMukbangVideo] = useState(false);
  const [mukbangResult, setMukbangResult] = useState<FoodVideoResult | null>(null);
  const [mukbangError, setMukbangError] = useState<string | null>(null);

  // =============================================
  // 인증 체크
  // =============================================
  const checkAuth = useCallback((): boolean => {
    if (!isAuthenticated) { openLoginModal(); return false; }
    if (!canUseApi) { openSettingsModal(); return false; }
    return true;
  }, [isAuthenticated, canUseApi, openLoginModal, openSettingsModal]);

  // =============================================
  // 기본 모드 핸들러
  // =============================================

  const handleFoodFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) foodUpload.handleUpload(file).then(err => { if (err) setError(err); else setError(null); });
  }, [foodUpload]);

  const handleFoodDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) foodUpload.handleUpload(file).then(err => { if (err) setError(err); else setError(null); });
  }, [foodUpload]);

  const handleTranslate = useCallback(async () => {
    if (!koreanPrompt.trim()) { setError('한국어 프롬프트를 입력해 주세요.'); return; }
    if (!checkAuth()) return;

    setIsTranslating(true);
    setError(null);
    setEnglishPrompt('');
    setKoreanDescription('');
    setIsTranslated(false);

    try {
      const r = await translateFoodPrompt(koreanPrompt.trim());
      setEnglishPrompt(r.englishPrompt);
      setKoreanDescription(r.koreanDescription);
      setIsTranslated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '프롬프트 변환에 실패했습니다.');
    } finally {
      setIsTranslating(false);
    }
  }, [koreanPrompt, checkAuth]);

  const handleGenerate = useCallback(async () => {
    if (!foodUpload.image) { setError('음식 이미지를 업로드해 주세요.'); return; }
    if (!englishPrompt.trim()) { setError('영어 프롬프트가 필요합니다.'); return; }
    if (!checkAuth()) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const videoResult = await generateFoodVideo(foodUpload.image, englishPrompt.trim(), 6);
      setResult(videoResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '영상 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }, [foodUpload.image, englishPrompt, checkAuth]);

  const handleKoreanPromptChange = useCallback((value: string) => {
    setKoreanPrompt(value);
    if (isTranslated) { setIsTranslated(false); setEnglishPrompt(''); setKoreanDescription(''); }
  }, [isTranslated]);

  // =============================================
  // 먹방 모드 핸들러
  // =============================================

  const handleMukFoodFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) mukFoodUpload.handleUpload(file).then(err => { if (err) setMukbangError(err); else setMukbangError(null); });
  }, [mukFoodUpload]);

  const handleMukFoodDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) mukFoodUpload.handleUpload(file).then(err => { if (err) setMukbangError(err); else setMukbangError(null); });
  }, [mukFoodUpload]);

  const handleMukPersonFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) mukPersonUpload.handleUpload(file).then(err => { if (err) setMukbangError(err); else setMukbangError(null); });
  }, [mukPersonUpload]);

  const handleMukPersonDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) mukPersonUpload.handleUpload(file).then(err => { if (err) setMukbangError(err); else setMukbangError(null); });
  }, [mukPersonUpload]);

  // Step 1: 먹방 이미지 생성 (FLUX)
  const handleGenerateMukbangImage = useCallback(async () => {
    if (!mukFoodUpload.image) { setMukbangError('음식 이미지를 업로드해 주세요.'); return; }
    if (!foodName.trim()) { setMukbangError('음식 이름을 입력해 주세요.'); return; }
    if (personSource === 'upload' && !mukPersonUpload.image) { setMukbangError('인물 사진을 업로드해 주세요.'); return; }
    if (personSource === 'generate' && personGenMode === 'custom' && !customPersonDesc.trim()) { setMukbangError('인물 설명을 입력해 주세요.'); return; }
    if (!checkAuth()) return;

    setIsGeneratingMukbangImage(true);
    setMukbangError(null);
    setMukbangComposite(null);
    setMukbangCompositeUrl(null);
    setMukbangResult(null);

    try {
      const r: MukbangImageResult = await generateMukbangImage(
        mukFoodUpload.image,
        foodName.trim(),
        {
          personImage: personSource === 'upload' ? mukPersonUpload.image || undefined : undefined,
          generatePerson: personSource === 'generate',
          personType: personSource === 'generate' && personGenMode === 'preset' ? personType : undefined,
          customPersonPrompt: personSource === 'generate' && personGenMode === 'custom' ? customPersonDesc.trim() : undefined,
          customScenePrompt: customScenePrompt.trim() || undefined,
        }
      );

      setMukbangComposite(r.compositeImage);
      setMukbangCompositeUrl(`data:${r.compositeImage.mimeType};base64,${r.compositeImage.data}`);
      setMukbangVideoPrompt(r.videoPrompt);
    } catch (err) {
      setMukbangError(err instanceof Error ? err.message : '먹방 이미지 생성에 실패했습니다.');
    } finally {
      setIsGeneratingMukbangImage(false);
    }
  }, [mukFoodUpload.image, foodName, personSource, mukPersonUpload.image, personType, personGenMode, customPersonDesc, customScenePrompt, checkAuth]);

  // Step 2: 먹방 영상 생성 (Hailuo)
  const handleGenerateMukbangVideo = useCallback(async () => {
    if (!mukbangComposite) { setMukbangError('먼저 먹방 이미지를 생성해 주세요.'); return; }
    if (!checkAuth()) return;

    setIsGeneratingMukbangVideo(true);
    setMukbangError(null);
    setMukbangResult(null);

    try {
      const videoResult = await generateFoodVideo(mukbangComposite, mukbangVideoPrompt, 6);
      setMukbangResult(videoResult);
    } catch (err) {
      setMukbangError(err instanceof Error ? err.message : '영상 생성에 실패했습니다.');
    } finally {
      setIsGeneratingMukbangVideo(false);
    }
  }, [mukbangComposite, mukbangVideoPrompt, checkAuth]);

  // 영상 다운로드 (공통)
  const handleDownload = useCallback(async (videoUrl: string) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `food_video_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      const errSetter = mode === 'basic' ? setError : setMukbangError;
      errSetter('영상 다운로드에 실패했습니다.');
    }
  }, [mode]);

  // =============================================
  // Render
  // =============================================

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 010 8h-1" />
              <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-bold text-white">음식 영상 만들기</h2>
            <p className="text-xs sm:text-sm text-gray-400 truncate">
              {mode === 'basic' ? '음식 사진과 한국어 설명으로 숏츠(9:16) 영상 생성' : '음식 + 인물 합성으로 먹방 숏츠(9:16) 영상 생성'}
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex mt-3 bg-gray-900/60 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setMode('basic')}
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-all ${
              mode === 'basic'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            기본 모드
          </button>
          <button
            onClick={() => setMode('mukbang')}
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-all ${
              mode === 'mukbang'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            먹방 모드
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow overflow-y-auto p-3 sm:p-4">
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">

          {/* ============================================ */}
          {/* 기본 모드 (Basic Mode) */}
          {/* ============================================ */}
          {mode === 'basic' && (
            <>
              {/* 이미지 업로드 */}
              <ImageUploadArea
                label="음식 이미지"
                previewUrl={foodUpload.previewUrl}
                sizeInfo={foodUpload.sizeInfo}
                warning={foodUpload.warning}
                inputRef={foodUpload.inputRef}
                onFileSelect={handleFoodFileSelect}
                onDrop={handleFoodDrop}
                onRemove={foodUpload.handleRemove}
              />

              {/* Step 1: 프롬프트 변환 */}
              <div className="p-3 sm:p-4 bg-gray-900/40 border border-gray-700 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0">1</span>
                  <h3 className="text-sm font-bold text-white">프롬프트 변환</h3>
                  <span className="text-xs text-gray-500">한국어 → 영어 시네마틱 프롬프트</span>
                </div>

                <div>
                  <textarea
                    value={koreanPrompt}
                    onChange={(e) => handleKoreanPromptChange(e.target.value)}
                    placeholder="예: 김이 모락모락 나는 라면을 젓가락으로 들어올리는 장면"
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                  />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-gray-500">음식의 움직임이나 카메라 동작을 자유롭게 묘사하세요</p>
                    <span className="text-xs text-gray-500">{koreanPrompt.length}/500</span>
                  </div>
                </div>

                <button
                  onClick={handleTranslate}
                  disabled={isTranslating || !koreanPrompt.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                >
                  {isTranslating ? <><Spinner /> 프롬프트 변환 중...</> : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg>
                      프롬프트 변환
                    </>
                  )}
                </button>
              </div>

              {/* 변환 결과 */}
              {isTranslated && (
                <div className="p-3 sm:p-4 bg-gray-900/40 border border-emerald-700/50 rounded-xl space-y-3">
                  {koreanDescription && (
                    <div className="p-3 bg-emerald-900/30 border border-emerald-700/40 rounded-lg">
                      <p className="text-xs font-medium text-emerald-400 mb-1.5 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        이런 영상이 생성됩니다
                      </p>
                      <p className="text-sm text-gray-300 leading-relaxed">{koreanDescription}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      영어 프롬프트 (편집 가능)
                    </label>
                    <textarea
                      value={englishPrompt}
                      onChange={(e) => setEnglishPrompt(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-sm font-mono leading-relaxed"
                    />
                    <p className="text-xs text-gray-500 mt-1">영어 프롬프트를 직접 수정하여 원하는 영상을 더 정확하게 묘사할 수 있습니다</p>
                  </div>
                </div>
              )}

              {/* Step 2: 영상 생성 */}
              {isTranslated && (
                <div className="p-3 sm:p-4 bg-gray-900/40 border border-gray-700 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex-shrink-0">2</span>
                    <h3 className="text-sm font-bold text-white">영상 생성</h3>
                    <span className="text-xs text-gray-500">Hailuo AI로 영상 제작</span>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !foodUpload.image || !englishPrompt.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[48px]"
                  >
                    {isGenerating ? <><Spinner className="w-5 h-5" /> 영상 생성 중... (최대 5분 소요)</> : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        영상 생성
                      </>
                    )}
                  </button>
                  {!foodUpload.image && <p className="text-xs text-amber-400 text-center">영상을 생성하려면 먼저 음식 이미지를 업로드하세요</p>}
                </div>
              )}

              {/* 에러 */}
              {error && <ErrorBanner message={error} />}

              {/* 결과 */}
              {result && (
                <VideoResultArea
                  videoUrl={result.videoUrl}
                  onDownload={() => handleDownload(result.videoUrl)}
                  onRegenerate={handleGenerate}
                  isRegenerating={isGenerating}
                />
              )}

              {/* 안내 */}
              {!result && !isGenerating && !isTranslated && (
                <div className="p-4 bg-gray-900/30 border border-gray-700/50 rounded-xl">
                  <h4 className="text-xs sm:text-sm font-medium text-gray-300 mb-2">사용 방법</h4>
                  <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
                    <li>음식 사진을 업로드하세요</li>
                    <li>원하는 움직임을 한국어로 설명하세요</li>
                    <li><span className="text-blue-400 font-medium">&quot;프롬프트 변환&quot;</span> 버튼을 클릭하면 AI가 영어 시네마틱 프롬프트로 변환합니다</li>
                    <li>변환된 프롬프트를 확인하고 필요하면 직접 수정하세요</li>
                    <li><span className="text-amber-400 font-medium">&quot;영상 생성&quot;</span> 버튼으로 영상을 제작합니다</li>
                  </ol>
                  <div className="mt-3 p-2.5 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                    <p className="text-xs text-amber-400">
                      Gemini API 키 (프롬프트 변환)와 Hailuo API 키 (영상 생성)가 모두 필요합니다. 설정에서 API 키를 등록하세요.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ============================================ */}
          {/* 먹방 모드 (Mukbang Mode) */}
          {/* ============================================ */}
          {mode === 'mukbang' && (
            <>
              {/* Step 1: 음식 이미지 업로드 + 음식 이름 */}
              <div className="p-3 sm:p-4 bg-gray-900/40 border border-gray-700 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-pink-600 text-white text-xs font-bold flex-shrink-0">1</span>
                  <h3 className="text-sm font-bold text-white">음식 정보</h3>
                  <span className="text-xs text-gray-500">음식 사진 업로드 + 이름 입력</span>
                </div>

                <ImageUploadArea
                  label="음식 사진 (필수)"
                  previewUrl={mukFoodUpload.previewUrl}
                  sizeInfo={mukFoodUpload.sizeInfo}
                  warning={mukFoodUpload.warning}
                  inputRef={mukFoodUpload.inputRef}
                  onFileSelect={handleMukFoodFileSelect}
                  onDrop={handleMukFoodDrop}
                  onRemove={mukFoodUpload.handleRemove}
                  placeholderText="음식 사진을 업로드하세요"
                  accentColor="pink"
                />

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">음식 이름</label>
                  <input
                    type="text"
                    value={foodName}
                    onChange={(e) => setFoodName(e.target.value)}
                    placeholder="예: 라면, 치킨, 삼겹살, 떡볶이"
                    maxLength={50}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Step 2: 인물 설정 */}
              <div className="p-3 sm:p-4 bg-gray-900/40 border border-gray-700 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-pink-600 text-white text-xs font-bold flex-shrink-0">2</span>
                  <h3 className="text-sm font-bold text-white">인물 설정</h3>
                  <span className="text-xs text-gray-500">사진 업로드 또는 AI 생성</span>
                </div>

                {/* 인물 소스 토글 */}
                <div className="flex bg-gray-900/60 rounded-lg p-0.5 gap-0.5">
                  <button
                    onClick={() => setPersonSource('upload')}
                    className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all ${
                      personSource === 'upload'
                        ? 'bg-gray-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    사진 업로드
                  </button>
                  <button
                    onClick={() => setPersonSource('generate')}
                    className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all ${
                      personSource === 'generate'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    AI 생성
                  </button>
                </div>

                {personSource === 'upload' ? (
                  <ImageUploadArea
                    label="인물 사진"
                    previewUrl={mukPersonUpload.previewUrl}
                    sizeInfo={mukPersonUpload.sizeInfo}
                    warning={mukPersonUpload.warning}
                    inputRef={mukPersonUpload.inputRef}
                    onFileSelect={handleMukPersonFileSelect}
                    onDrop={handleMukPersonDrop}
                    onRemove={mukPersonUpload.handleRemove}
                    placeholderText="인물 사진을 업로드하세요"
                    accentColor="purple"
                  />
                ) : (
                  <div className="space-y-2">
                    {/* 프리셋 / 직접입력 서브 토글 */}
                    <div className="flex bg-gray-900/60 rounded-lg p-0.5 gap-0.5">
                      <button
                        onClick={() => setPersonGenMode('preset')}
                        className={`flex-1 py-1.5 px-2 text-[11px] font-medium rounded-md transition-all ${
                          personGenMode === 'preset'
                            ? 'bg-purple-700 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        프리셋 선택
                      </button>
                      <button
                        onClick={() => setPersonGenMode('custom')}
                        className={`flex-1 py-1.5 px-2 text-[11px] font-medium rounded-md transition-all ${
                          personGenMode === 'custom'
                            ? 'bg-purple-700 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        직접 입력
                      </button>
                    </div>

                    {personGenMode === 'preset' ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {PERSON_TYPE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setPersonType(opt.value)}
                              className={`p-3 rounded-lg border text-xs font-medium transition-all ${
                                personType === opt.value
                                  ? 'border-purple-500 bg-purple-900/30 text-purple-300'
                                  : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500">
                          FLUX AI가 선택한 유형의 인물을 자동 생성합니다
                        </p>
                      </>
                    ) : (
                      <>
                        <textarea
                          value={customPersonDesc}
                          onChange={(e) => setCustomPersonDesc(e.target.value)}
                          placeholder="예: 30대 여성, 긴 생머리, 흰색 블라우스, 자연스러운 메이크업"
                          className="w-full bg-gray-800/70 text-xs text-gray-200 rounded-lg p-2.5 resize-none border border-gray-700 focus:border-purple-500 focus:outline-none placeholder-gray-600"
                          rows={2}
                        />
                        <p className="text-[10px] text-gray-500">
                          한국어로 인물 특징을 입력하면 AI가 영어로 변환하여 생성합니다
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Step 3: 먹방 이미지 생성 */}
              <div className="p-3 sm:p-4 bg-gray-900/40 border border-gray-700 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-pink-600 text-white text-xs font-bold flex-shrink-0">3</span>
                  <h3 className="text-sm font-bold text-white">먹방 이미지 생성</h3>
                  <span className="text-xs text-gray-500">FLUX AI로 합성 장면 생성</span>
                </div>

                {/* 씬 프롬프트 (선택) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-400">씬 프롬프트 (선택)</label>
                    {customScenePrompt.trim() && (
                      <button
                        onClick={() => setCustomScenePrompt('')}
                        className="text-[10px] text-gray-500 hover:text-gray-400 transition-colors"
                      >
                        초기화
                      </button>
                    )}
                  </div>
                  <textarea
                    value={customScenePrompt}
                    onChange={(e) => setCustomScenePrompt(e.target.value)}
                    placeholder="비워두면 기본 프롬프트가 자동 적용됩니다. 원하는 장면을 한국어로 입력하면 AI가 영어로 변환합니다.&#10;예: 따뜻한 조명 아래 여성이 젓가락으로 라면을 들어올리며 행복하게 웃는 장면"
                    className="w-full bg-gray-800/70 text-xs text-gray-200 rounded-lg p-2.5 resize-none border border-gray-700 focus:border-pink-500 focus:outline-none placeholder-gray-600"
                    rows={3}
                    maxLength={500}
                  />
                  <div className="flex justify-between">
                    <p className="text-[10px] text-gray-500">
                      {customScenePrompt.trim() ? '한국어 설명 → AI가 영어 프롬프트로 변환하여 이미지 생성' : '기본 먹방 프롬프트가 자동으로 적용됩니다'}
                    </p>
                    <span className="text-[10px] text-gray-500">{customScenePrompt.length}/500</span>
                  </div>
                </div>

                <button
                  onClick={handleGenerateMukbangImage}
                  disabled={isGeneratingMukbangImage || !mukFoodUpload.image || !foodName.trim() || (personSource === 'upload' && !mukPersonUpload.image)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 rounded-lg hover:from-pink-400 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[48px]"
                >
                  {isGeneratingMukbangImage ? (
                    <><Spinner className="w-5 h-5" /> {customScenePrompt.trim() ? '프롬프트 변환 + 이미지 생성 중...' : '먹방 이미지 생성 중...'}</>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      먹방 이미지 생성
                    </>
                  )}
                </button>

                <div className="p-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg">
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    {customScenePrompt.trim()
                      ? '한국어 씬 설명을 AI가 영어로 변환한 후, FLUX 2 Turbo Edit로 합성 이미지를 생성합니다. (~$0.01/장)'
                      : 'FLUX 2 Turbo Edit 모델이 음식과 인물을 합성하여 자연스러운 먹방 장면을 생성합니다. 프롬프트는 자동 생성됩니다. (~$0.01/장)'
                    }
                  </p>
                </div>
              </div>

              {/* 합성 이미지 프리뷰 */}
              {mukbangCompositeUrl && (
                <div className="p-3 sm:p-4 bg-gray-900/40 border border-emerald-700/50 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    먹방 이미지 생성 완료
                  </h4>
                  <div className="rounded-xl overflow-hidden bg-black border border-gray-700 flex justify-center">
                    <img
                      src={mukbangCompositeUrl}
                      alt="Mukbang composite"
                      className="max-h-[400px] sm:max-h-[480px] object-contain"
                    />
                  </div>

                  {/* 이미지 재생성 */}
                  <button
                    onClick={handleGenerateMukbangImage}
                    disabled={isGeneratingMukbangImage}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors min-h-[36px]"
                  >
                    {isGeneratingMukbangImage ? <><Spinner className="w-3.5 h-3.5" /> 재생성 중...</> : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        이미지 재생성
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Step 4: 영상 생성 */}
              {mukbangComposite && (
                <div className="p-3 sm:p-4 bg-gray-900/40 border border-gray-700 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex-shrink-0">4</span>
                    <h3 className="text-sm font-bold text-white">영상 생성</h3>
                    <span className="text-xs text-gray-500">Hailuo AI로 먹방 영상 제작</span>
                  </div>
                  <button
                    onClick={handleGenerateMukbangVideo}
                    disabled={isGeneratingMukbangVideo}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[48px]"
                  >
                    {isGeneratingMukbangVideo ? <><Spinner className="w-5 h-5" /> 영상 생성 중... (최대 5분 소요)</> : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        먹방 영상 생성
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 에러 */}
              {mukbangError && <ErrorBanner message={mukbangError} />}

              {/* 결과 */}
              {mukbangResult && (
                <VideoResultArea
                  videoUrl={mukbangResult.videoUrl}
                  onDownload={() => handleDownload(mukbangResult.videoUrl)}
                  onRegenerate={handleGenerateMukbangVideo}
                  isRegenerating={isGeneratingMukbangVideo}
                />
              )}

              {/* 안내 */}
              {!mukbangResult && !isGeneratingMukbangImage && !isGeneratingMukbangVideo && !mukbangComposite && (
                <div className="p-4 bg-gray-900/30 border border-gray-700/50 rounded-xl">
                  <h4 className="text-xs sm:text-sm font-medium text-gray-300 mb-2">먹방 모드 사용 방법</h4>
                  <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
                    <li>음식 사진을 업로드하고 음식 이름을 입력하세요</li>
                    <li>인물 사진을 업로드하거나 AI로 생성할 유형을 선택하세요</li>
                    <li><span className="text-pink-400 font-medium">&quot;먹방 이미지 생성&quot;</span> 버튼으로 합성 장면을 만듭니다</li>
                    <li>합성 이미지를 확인하고, 마음에 들면 <span className="text-amber-400 font-medium">&quot;영상 생성&quot;</span>을 클릭합니다</li>
                  </ol>
                  <div className="mt-3 p-2.5 bg-pink-900/20 border border-pink-700/30 rounded-lg">
                    <p className="text-xs text-pink-400">
                      먹방 모드는 FLUX AI (이미지 합성)와 Hailuo AI (영상 생성)를 사용합니다.
                      EachLabs(Hailuo) API 키가 필요합니다. 프롬프트는 자동 생성됩니다.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================
// 공통 하위 컴포넌트
// =============================================

const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="p-3 bg-red-900/50 border border-red-700 rounded-xl text-sm text-red-300">
    <div className="flex items-start gap-2">
      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div>
        <p className="font-medium">오류</p>
        <p className="text-xs text-red-400 mt-1">{message}</p>
      </div>
    </div>
  </div>
);

interface VideoResultAreaProps {
  videoUrl: string;
  onDownload: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

const VideoResultArea: React.FC<VideoResultAreaProps> = ({ videoUrl, onDownload, onRegenerate, isRegenerating }) => (
  <div className="space-y-4">
    <div className="border-t border-gray-700 pt-4">
      <h3 className="text-sm sm:text-base font-bold text-white mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        생성된 영상
      </h3>
      <div className="rounded-xl overflow-hidden bg-black border border-gray-700 flex justify-center">
        <video
          src={videoUrl}
          controls
          autoPlay
          loop
          className="max-h-[480px] sm:max-h-[560px]"
          style={{ aspectRatio: '9/16' }}
        >
          브라우저가 비디오 재생을 지원하지 않습니다.
        </video>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          다운로드
        </button>
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          재생성
        </button>
      </div>
    </div>
  </div>
);

export default FoodVideoTab;
