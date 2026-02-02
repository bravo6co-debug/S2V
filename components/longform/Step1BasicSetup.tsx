import React, { useState, useMemo } from 'react';
import type { LongformConfig, LongformDuration, LongformImageModel, TtsProvider, OpenAiVoice, GeminiVoice, OpenAiTtsModel } from '../../types/longform';
import { IMAGE_MODEL_OPTIONS, OPENAI_VOICE_OPTIONS, GEMINI_VOICE_OPTIONS, DURATION_OPTIONS, DEFAULT_TTS_CONFIG, DEFAULT_LONGFORM_CONFIG, calculateSceneCount, estimateImageCost, estimateTtsCost } from '../../types/longform';
import { AVAILABLE_TEXT_MODELS } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface Step1BasicSetupProps {
  onGenerate: (config: LongformConfig) => void;
  isGenerating: boolean;
}

export const Step1BasicSetup: React.FC<Step1BasicSetupProps> = ({ onGenerate, isGenerating }) => {
  const { hasApiKey, hasOpenaiApiKey, isAdmin, settings, openSettingsModal } = useAuth();

  const [topic, setTopic] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [showReference, setShowReference] = useState(false);
  const [duration, setDuration] = useState<LongformDuration>(DEFAULT_LONGFORM_CONFIG.duration);
  const [imageModel, setImageModel] = useState<LongformImageModel>(DEFAULT_LONGFORM_CONFIG.imageModel);
  const [textModel, setTextModel] = useState<string>(settings?.textModel || 'gemini-3-flash-preview');
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>(DEFAULT_TTS_CONFIG.provider);
  const [openaiModel, setOpenaiModel] = useState<OpenAiTtsModel>('tts-1');
  const [openaiVoice, setOpenaiVoice] = useState<OpenAiVoice>('nova');
  const [geminiVoice, setGeminiVoice] = useState<GeminiVoice>('Kore');

  // API 키 경고 모달
  const [showKeyWarning, setShowKeyWarning] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<LongformConfig | null>(null);

  const sceneCount = useMemo(() => calculateSceneCount(duration), [duration]);
  const ttsModel = ttsProvider === 'openai' ? openaiModel : 'gemini-2.5-flash-preview-tts';
  const imageCost = useMemo(() => estimateImageCost(imageModel, sceneCount), [imageModel, sceneCount]);
  const ttsCost = useMemo(() => estimateTtsCost(ttsModel, sceneCount), [ttsModel, sceneCount]);

  const googleModels = IMAGE_MODEL_OPTIONS.filter(m => m.provider === 'google');
  const fluxModels = IMAGE_MODEL_OPTIONS.filter(m => m.provider === 'eachlabs');

  const isOpenAIModel = (model: string) => model.startsWith('gpt-') || model.startsWith('o3-') || model.startsWith('o4-');
  const selectedModelLabel = AVAILABLE_TEXT_MODELS.find(m => m.value === textModel)?.label || textModel;

  const buildConfig = (overrideTextModel?: string): LongformConfig => ({
    topic: topic.trim(),
    referenceText: referenceText.trim() || undefined,
    duration,
    imageModel,
    textModel: overrideTextModel,
    tts: {
      provider: ttsProvider,
      model: ttsModel,
      voice: ttsProvider === 'openai' ? openaiVoice : geminiVoice,
    },
  });

  const handleSubmit = () => {
    if (!topic.trim()) return;

    const needsOpenAIKey = isOpenAIModel(textModel);
    const needsGeminiKey = !needsOpenAIKey;

    // API 키 검증
    if (needsOpenAIKey && !hasOpenaiApiKey) {
      setPendingConfig(buildConfig(textModel));
      setShowKeyWarning(true);
      return;
    }
    if (needsGeminiKey && !isAdmin && !hasApiKey) {
      setPendingConfig(buildConfig(textModel));
      setShowKeyWarning(true);
      return;
    }

    onGenerate(buildConfig(textModel));
  };

  // 모달: 설정 모델로 폴백 진행
  const handleFallbackProceed = () => {
    setShowKeyWarning(false);
    // textModel을 undefined로 보내서 백엔드가 설정 모델 사용
    onGenerate(buildConfig(undefined));
  };

  // 모달: 설정으로 이동
  const handleGoToSettings = () => {
    setShowKeyWarning(false);
    setPendingConfig(null);
    openSettingsModal();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* 주제 */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">주제</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="예: 한국 전통 음식의 역사와 현대 한식의 세계화"
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm"
          maxLength={200}
          disabled={isGenerating}
        />
        <p className="text-xs text-gray-500 mt-1 text-right">{topic.length}/200</p>
      </div>

      {/* 참고 자료 (선택) */}
      <div>
        <button
          type="button"
          onClick={() => setShowReference(!showReference)}
          disabled={isGenerating}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showReference ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          참고 자료 추가 (선택)
        </button>
        {showReference && (
          <div className="mt-2">
            <textarea
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              placeholder="시나리오 작성에 참고할 자료를 입력하세요. 기사, 블로그, 대본 등 원하는 내용을 붙여넣으면 주제에 맞게 각색됩니다."
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:outline-none text-[16px] sm:text-sm resize-y min-h-[120px]"
              rows={6}
              maxLength={5000}
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{referenceText.length}/5,000</p>
          </div>
        )}
      </div>

      {/* 텍스트 모델 (시나리오 생성) */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">텍스트 모델 (시나리오 생성)</label>
        <select
          value={textModel}
          onChange={(e) => setTextModel(e.target.value)}
          disabled={isGenerating}
          className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent min-h-[44px]"
        >
          <optgroup label="Google Gemini (Gemini API 키)">
            {AVAILABLE_TEXT_MODELS.filter(m => m.provider !== 'openai').map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="OpenAI (OpenAI API 키)">
            {AVAILABLE_TEXT_MODELS.filter(m => m.provider === 'openai').map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </optgroup>
        </select>
        {isOpenAIModel(textModel) ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs">
            <span className="text-blue-400">OpenAI API 키 필요</span>
            {!hasOpenaiApiKey && <span className="text-yellow-400 font-medium">(미설정)</span>}
          </div>
        ) : (
          <p className="mt-1 text-xs text-gray-500">Gemini API 키를 사용합니다</p>
        )}
      </div>

      {/* 영상 길이 */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">영상 길이</label>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDuration(opt.value)}
              disabled={isGenerating}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                duration === opt.value
                  ? 'bg-teal-600 text-white ring-2 ring-teal-400/50'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 이미지 모델 */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">이미지 모델</label>
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Google Gemini / Imagen</p>
          <div className="grid grid-cols-2 gap-2">
            {googleModels.map((m) => (
              <button
                key={m.value}
                onClick={() => setImageModel(m.value)}
                disabled={isGenerating}
                className={`p-2.5 rounded-lg text-left text-xs transition-all ${
                  imageModel === m.value
                    ? 'bg-teal-600/20 border-2 border-teal-500 text-teal-300'
                    : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <div className="font-medium">{m.label}</div>
                <div className="text-gray-400 mt-0.5">{m.costPerImage}/장 · {m.description}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">EachLabs FLUX</p>
          <div className="grid grid-cols-2 gap-2">
            {fluxModels.map((m) => (
              <button
                key={m.value}
                onClick={() => setImageModel(m.value)}
                disabled={isGenerating}
                className={`p-2.5 rounded-lg text-left text-xs transition-all ${
                  imageModel === m.value
                    ? 'bg-teal-600/20 border-2 border-teal-500 text-teal-300'
                    : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <div className="font-medium">{m.label}</div>
                <div className="text-gray-400 mt-0.5">{m.costPerImage}/장 · {m.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TTS 엔진 */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">TTS 엔진</label>
        <div className="flex gap-2">
          <button
            onClick={() => setTtsProvider('openai')}
            disabled={isGenerating}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
              ttsProvider === 'openai'
                ? 'bg-teal-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            OpenAI TTS (추천)
          </button>
          <button
            onClick={() => setTtsProvider('gemini')}
            disabled={isGenerating}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
              ttsProvider === 'gemini'
                ? 'bg-teal-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Gemini TTS
          </button>
        </div>
        {ttsProvider === 'gemini' && (
          <p className="text-xs text-yellow-400 mt-1">* 일일 호출 제한 있음. 60분 영상 생성 시 제한에 걸릴 수 있습니다.</p>
        )}
      </div>

      {/* TTS 모델 (OpenAI only) */}
      {ttsProvider === 'openai' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">TTS 모델</label>
          <div className="flex gap-2">
            <button
              onClick={() => setOpenaiModel('tts-1')}
              disabled={isGenerating}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                openaiModel === 'tts-1' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              tts-1 (가성비)
            </button>
            <button
              onClick={() => setOpenaiModel('tts-1-hd')}
              disabled={isGenerating}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                openaiModel === 'tts-1-hd' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              tts-1-hd (고품질)
            </button>
          </div>
        </div>
      )}

      {/* 음성 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">음성 선택</label>
        {ttsProvider === 'openai' ? (
          <div className="grid grid-cols-3 gap-2">
            {OPENAI_VOICE_OPTIONS.map((v) => (
              <button
                key={v.value}
                onClick={() => setOpenaiVoice(v.value)}
                disabled={isGenerating}
                className={`p-2 rounded-lg text-xs text-left transition-all ${
                  openaiVoice === v.value
                    ? 'bg-teal-600/20 border-2 border-teal-500 text-teal-300'
                    : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <div className="font-medium">{v.label}</div>
                <div className="text-gray-400 mt-0.5 line-clamp-1">{v.description}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {GEMINI_VOICE_OPTIONS.map((v) => (
              <button
                key={v.value}
                onClick={() => setGeminiVoice(v.value)}
                disabled={isGenerating}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  geminiVoice === v.value
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 예상 정보 */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-2">예상 정보</h4>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
          <div>총 씬 수: <span className="text-gray-200 font-medium">{sceneCount}개</span></div>
          <div>후킹 영상: <span className="text-gray-200 font-medium">10초 (실사 동영상)</span></div>
          <div>본편: <span className="text-gray-200 font-medium">{duration - 1}분 50초</span></div>
          <div>이미지 비용: <span className="text-teal-400 font-medium">{imageCost}</span></div>
          <div>TTS 비용: <span className="text-teal-400 font-medium">{ttsCost}</span></div>
        </div>
      </div>

      {/* 생성 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={isGenerating || !topic.trim()}
        className="w-full py-3 px-6 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold rounded-lg hover:from-teal-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[48px]"
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            시나리오 생성 중...
          </span>
        ) : (
          '시나리오 생성하기'
        )}
      </button>

      {/* API 키 경고 모달 */}
      {showKeyWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white">API 키 필요</h3>
            </div>

            <p className="text-sm text-gray-300 mb-2">
              선택한 모델 <span className="text-teal-400 font-medium">{selectedModelLabel}</span>의{' '}
              {isOpenAIModel(textModel) ? 'OpenAI' : 'Gemini'} API 키가 설정되지 않았습니다.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              설정에 저장된 기본 모델로 대체하여 진행하거나, 설정에서 API 키를 입력하세요.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleFallbackProceed}
                className="flex-1 py-2.5 px-4 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors min-h-[44px]"
              >
                기본 모델로 진행
              </button>
              <button
                onClick={handleGoToSettings}
                className="flex-1 py-2.5 px-4 bg-gray-700 text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors min-h-[44px]"
              >
                설정으로 이동
              </button>
            </div>
            <button
              onClick={() => { setShowKeyWarning(false); setPendingConfig(null); }}
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
