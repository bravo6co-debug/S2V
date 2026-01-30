import React, { useState, useRef, useCallback } from 'react';
import { generateFoodVideo, type FoodVideoResult } from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';

// 이미지 데이터 타입
interface FoodImageData {
  mimeType: string;
  data: string;
}

export const FoodVideoTab: React.FC = () => {
  const { isAuthenticated, canUseApi, openLoginModal, openSettingsModal } = useAuth();

  // 이미지 상태
  const [foodImage, setFoodImage] = useState<FoodImageData | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 프롬프트 상태
  const [prompt, setPrompt] = useState('');

  // 생성 상태
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 결과 상태
  const [result, setResult] = useState<FoodVideoResult | null>(null);
  const [translatedPrompt, setTranslatedPrompt] = useState<string | null>(null);

  // 이미지 업로드 처리
  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 10MB 제한
    if (file.size > 10 * 1024 * 1024) {
      setError('이미지 크기는 10MB 이하여야 합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type;

      setFoodImage({ mimeType, data: base64 });
      setImagePreviewUrl(dataUrl);
      setError(null);
    };
    reader.onerror = () => {
      setError('이미지 파일을 읽는데 실패했습니다.');
    };
    reader.readAsDataURL(file);
  }, []);

  // 파일 선택
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);

  // 드래그 앤 드롭
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // 이미지 제거
  const handleRemoveImage = useCallback(() => {
    setFoodImage(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // 영상 생성
  const handleGenerate = useCallback(async () => {
    if (!foodImage) {
      setError('음식 이미지를 업로드해 주세요.');
      return;
    }
    if (!prompt.trim()) {
      setError('프롬프트를 입력해 주세요.');
      return;
    }
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    if (!canUseApi) {
      openSettingsModal();
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);
    setTranslatedPrompt(null);

    try {
      const videoResult = await generateFoodVideo(foodImage, prompt.trim(), 6);
      setResult(videoResult);
      setTranslatedPrompt(videoResult.translatedPrompt);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '영상 생성에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [foodImage, prompt, isAuthenticated, canUseApi, openLoginModal, openSettingsModal]);

  // 영상 다운로드
  const handleDownload = useCallback(async () => {
    if (!result?.videoUrl) return;

    try {
      const response = await fetch(result.videoUrl);
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
      setError('영상 다운로드에 실패했습니다.');
    }
  }, [result]);

  // 재생성 (같은 이미지, 수정된 프롬프트)
  const handleRegenerate = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

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
              음식 사진과 한국어 설명으로 시네마틱 영상 생성
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow overflow-y-auto p-3 sm:p-4">
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">

          {/* 이미지 업로드 영역 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              음식 이미지
            </label>
            {imagePreviewUrl ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-gray-600 bg-gray-900">
                <img
                  src={imagePreviewUrl}
                  alt="Uploaded food"
                  className="w-full max-h-64 sm:max-h-80 object-contain"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-2 bg-red-600/80 hover:bg-red-500 text-white rounded-full transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="이미지 제거"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-600 hover:border-amber-500/50 rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-colors bg-gray-900/30 hover:bg-gray-900/50"
              >
                <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <p className="text-sm sm:text-base text-gray-400 font-medium">
                  클릭하거나 이미지를 드래그하세요
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  JPG, PNG, WebP (최대 10MB)
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* 한국어 프롬프트 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              한국어 프롬프트
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="예: 김이 모락모락 나는 라면을 젓가락으로 들어올리는 장면"
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-sm sm:text-base"
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">
                음식의 움직임이나 카메라 동작을 자유롭게 묘사하세요
              </p>
              <span className="text-xs text-gray-500">{prompt.length}/500</span>
            </div>
          </div>

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !foodImage || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm sm:text-base font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[48px]"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                영상 생성 중... (최대 5분 소요)
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                영상 생성
              </>
            )}
          </button>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-xl text-sm text-red-300">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-medium">오류</p>
                  <p className="text-xs text-red-400 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* 결과 영상 */}
          {result && (
            <div className="space-y-4">
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-sm sm:text-base font-bold text-white mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  생성된 영상
                </h3>

                {/* 비디오 플레이어 */}
                <div className="rounded-xl overflow-hidden bg-black border border-gray-700">
                  <video
                    src={result.videoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full max-h-80 sm:max-h-96"
                  >
                    브라우저가 비디오 재생을 지원하지 않습니다.
                  </video>
                </div>

                {/* 다운로드 + 재생성 버튼 */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors min-h-[44px]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    다운로드
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={isGenerating}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    프롬프트 수정 후 재생성
                  </button>
                </div>
              </div>

              {/* 변환된 영어 프롬프트 (참고용) */}
              {translatedPrompt && (
                <div className="p-3 bg-gray-900/50 border border-gray-700 rounded-xl">
                  <p className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                    변환된 영어 프롬프트 (참고)
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">{translatedPrompt}</p>
                </div>
              )}
            </div>
          )}

          {/* 사용 안내 (결과가 없을 때만) */}
          {!result && !isGenerating && (
            <div className="p-4 bg-gray-900/30 border border-gray-700/50 rounded-xl">
              <h4 className="text-xs sm:text-sm font-medium text-gray-300 mb-2">사용 방법</h4>
              <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
                <li>음식 사진을 업로드하세요</li>
                <li>원하는 움직임을 한국어로 설명하세요</li>
                <li>"영상 생성" 버튼을 클릭하면 AI가 자동으로 영어 프롬프트로 변환 후 영상을 만듭니다</li>
                <li>결과를 확인하고 프롬프트를 수정하여 다시 생성할 수 있습니다</li>
              </ol>
              <div className="mt-3 p-2.5 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                <p className="text-xs text-amber-400">
                  Hailuo API 키가 필요합니다. 설정에서 API 키를 등록하세요.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodVideoTab;
