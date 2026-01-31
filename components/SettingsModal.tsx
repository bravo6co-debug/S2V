import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  AVAILABLE_TEXT_MODELS,
  AVAILABLE_IMAGE_MODELS,
  AVAILABLE_TTS_VOICES,
  DEFAULT_MODEL_CONFIG,
} from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, hasApiKey, hasHailuoApiKey, saveSettings, isLoading, loadSettings } = useAuth();

  const [apiKey, setApiKey] = useState('');
  const [hailuoApiKey, setHailuoApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showHailuoApiKey, setShowHailuoApiKey] = useState(false);
  const [textModel, setTextModel] = useState(DEFAULT_MODEL_CONFIG.textModel);
  const [imageModel, setImageModel] = useState(DEFAULT_MODEL_CONFIG.imageModel);
  const [videoModel, setVideoModel] = useState(DEFAULT_MODEL_CONFIG.videoModel);
  const [ttsVoice, setTtsVoice] = useState(DEFAULT_MODEL_CONFIG.ttsVoice);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 설정 불러오기
  useEffect(() => {
    if (isOpen && settings) {
      setTextModel(settings.textModel || DEFAULT_MODEL_CONFIG.textModel);
      setImageModel(settings.imageModel || DEFAULT_MODEL_CONFIG.imageModel);
      setVideoModel(settings.videoModel || DEFAULT_MODEL_CONFIG.videoModel);
      setTtsVoice(settings.ttsVoice || DEFAULT_MODEL_CONFIG.ttsVoice);
      setApiKey(''); // API 키는 보안상 표시하지 않음
      setHailuoApiKey('');
    }
  }, [isOpen, settings]);

  // 모달 열릴 때 설정 새로고침
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // loadSettings 의존성 제거 (무한 루프 방지)

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const updates: Record<string, string | undefined> = {
      textModel,
      imageModel,
      videoModel,
      ttsVoice,
    };

    // API 키가 입력된 경우에만 업데이트
    if (apiKey.trim()) {
      updates.geminiApiKey = apiKey.trim();
    }
    if (hailuoApiKey.trim()) {
      updates.hailuoApiKey = hailuoApiKey.trim();
    }

    const result = await saveSettings(updates);

    if (result.success) {
      setSuccess('설정이 저장되었습니다.');
      setApiKey('');
      setHailuoApiKey('');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(result.error || '설정 저장에 실패했습니다.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            AI 모델 설정
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 space-y-5 overflow-y-auto flex-grow">
          {/* API 키 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Gemini API 키
              {hasApiKey && (
                <span className="ml-2 text-xs text-green-400">(설정됨)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasApiKey ? '새 API 키로 변경하려면 입력' : 'API 키 입력'}
                className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showApiKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Google AI Studio에서 발급받은 API 키
            </p>
          </div>

          {/* EachLabs API 키 (Hailuo + FLUX) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              EachLabs API 키 (FLUX 이미지 / 동영상)
              {hasHailuoApiKey && (
                <span className="ml-2 text-xs text-green-400">(설정됨)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showHailuoApiKey ? 'text' : 'password'}
                value={hailuoApiKey}
                onChange={(e) => setHailuoApiKey(e.target.value)}
                placeholder={hasHailuoApiKey ? '새 API 키로 변경하려면 입력' : 'EachLabs API 키 입력'}
                className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowHailuoApiKey(!showHailuoApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showHailuoApiKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              FLUX 이미지 생성 및 Hailuo 동영상 생성에 사용됩니다
            </p>
            <a
              href="https://www.eachlabs.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              eachlabs.ai에서 API 키 발급받기
            </a>
          </div>

          <hr className="border-gray-700" />

          {/* 텍스트 모델 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              텍스트 모델 (시나리오 생성)
            </label>
            <select
              value={textModel}
              onChange={(e) => setTextModel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {AVAILABLE_TEXT_MODELS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>

          {/* 이미지 모델 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              이미지 모델 (이미지 생성)
            </label>
            <select
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <optgroup label="Google Gemini / Imagen (Gemini API 키)">
                {AVAILABLE_IMAGE_MODELS.filter(m => m.provider !== 'eachlabs').map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="FLUX Kontext (EachLabs API 키)">
                {AVAILABLE_IMAGE_MODELS.filter(m => m.provider === 'eachlabs').map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}{model.price ? ` - ${model.price}` : ''}
                  </option>
                ))}
              </optgroup>
            </select>
            {/* 선택된 모델에 따른 안내 메시지 */}
            {AVAILABLE_IMAGE_MODELS.find(m => m.value === imageModel)?.provider === 'eachlabs' ? (
              <div className="mt-2 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-300">
                  FLUX Kontext 모델은 EachLabs API 키가 필요합니다.
                  {!hasHailuoApiKey && (
                    <span className="text-yellow-400 font-medium"> (API 키 미설정)</span>
                  )}
                </p>
                <div className="mt-1.5 text-xs text-gray-400 space-y-0.5">
                  <p>FLUX Kontext Pro: $0.04/장 ($1로 약 25장)</p>
                  <p>FLUX Kontext Max: $0.08/장 ($1로 약 12장, 최고품질)</p>
                  <p className="text-gray-500 mt-1">참조 이미지 2장 이상 시 Multi-Image 모델 자동 사용</p>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                Gemini/Imagen 모델은 Gemini API 키를 사용합니다
              </p>
            )}
          </div>

          {/* TTS 음성 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              나레이션 음성
            </label>
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {AVAILABLE_TTS_VOICES.map((voice) => (
                <option key={voice.value} value={voice.value}>
                  {voice.label}
                </option>
              ))}
            </select>
          </div>

          {/* 에러/성공 메시지 */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
              {success}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex gap-3 p-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            disabled={isLoading}
          >
            닫기
          </button>
          <button
            onClick={handleSave}
            className="flex-1 min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                저장 중...
              </>
            ) : (
              '저장'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
