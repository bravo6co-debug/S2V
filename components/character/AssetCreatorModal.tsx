import React, { useState, useRef } from 'react';
import {
  CharacterAsset,
  PropAsset,
  BackgroundAsset,
  CharacterRole,
  PropRole,
  PropCategory,
  LocationType,
  TimeOfDay,
  Weather,
  ImageData,
  ImageStyle,
  IMAGE_STYLE_OPTIONS,
} from '../../types';
import { useProject } from '../../contexts/ProjectContext';
import { SparklesIcon, ClearIcon, LayersIcon } from '../Icons';
import { extractCharacterData, generateCharacterPortraits, generatePropImages, generateBackgroundImages } from '../../services/geminiService';

type AssetCategory = 'character' | 'prop' | 'background';

interface AssetCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: AssetCategory;
  mode: 'ai' | 'upload';
}

// 파일을 데이터 URL로 변환
const fileToImageData = (file: File): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64Data = dataUrl.split(',')[1];
      resolve({ mimeType: file.type, data: base64Data });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const AssetCreatorModal: React.FC<AssetCreatorModalProps> = ({
  isOpen,
  onClose,
  category,
  mode,
}) => {
  const { addCharacter, addProp, addBackground, aspectRatio, imageStyle: projectImageStyle, setImageStyle: setProjectImageStyle } = useProject();

  // 공통 상태
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [maintainContext, setMaintainContext] = useState(true);

  // 이미지 상태
  const [uploadedImage, setUploadedImage] = useState<ImageData | null>(null);
  const [generatedCount, setGeneratedCount] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [imageStyle, setImageStyleLocal] = useState<ImageStyle>(projectImageStyle);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 이미지 스타일 변경 시 프로젝트에도 반영
  const setImageStyle = (style: ImageStyle) => {
    setImageStyleLocal(style);
    setProjectImageStyle(style);
  };

  // 캐릭터 관련 상태
  const [characterRole, setCharacterRole] = useState<CharacterRole>('protagonist');
  const [age, setAge] = useState('');
  const [personality, setPersonality] = useState('');
  const [outfit, setOutfit] = useState('');

  // 소품 관련 상태
  const [propRole, setPropRole] = useState<PropRole>('keyProp');
  const [propCategory, setPropCategory] = useState<PropCategory>('accessory');
  const [significance, setSignificance] = useState('');

  // 배경 관련 상태
  const [locationType, setLocationType] = useState<LocationType>('indoor');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [weather, setWeather] = useState<Weather>('sunny');
  const [mood, setMood] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imageData = await fileToImageData(file);
        setUploadedImage(imageData);
      } catch (err) {
        setError('이미지 업로드에 실패했습니다.');
      }
    }
  };

  const handleAIGenerate = async () => {
    if (!description.trim()) {
      setError('설명을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (category === 'character') {
        // 캐릭터 AI 생성
        const { name: extractedName, age: extractedAge, personality: extractedPersonality, outfit: extractedOutfit, englishDescription } = await extractCharacterData(description);

        if (!englishDescription.trim()) {
          throw new Error('캐릭터 설명 분석에 실패했습니다.');
        }

        const imagesData = await generateCharacterPortraits(englishDescription, generatedCount, aspectRatio, imageStyle);

        imagesData.forEach((imgData) => {
          const newCharacter: CharacterAsset = {
            id: crypto.randomUUID(),
            name: name || extractedName || '이름 없음',
            role: characterRole,
            image: imgData,
            description,
            maintainContext: characterRole !== 'extra',
            age: age || extractedAge || '',
            personality: personality || extractedPersonality || '',
            outfit: outfit || extractedOutfit || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          addCharacter(newCharacter);
        });
      } else if (category === 'prop') {
        // 소품 AI 생성 - 소품 전용 함수 사용 (인물 없이 물건만 생성)
        const imagesData = await generatePropImages(description, generatedCount, aspectRatio, imageStyle);

        imagesData.forEach((imgData) => {
          const newProp: PropAsset = {
            id: crypto.randomUUID(),
            name: name || '소품',
            role: propRole,
            image: imgData,
            description,
            maintainContext: propRole === 'keyProp',
            category: propCategory,
            significance: propRole === 'keyProp' ? significance : undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          addProp(newProp);
        });
      } else {
        // 배경 AI 생성 - 배경 전용 함수 사용 (인물 없이 환경만 생성)
        const imagesData = await generateBackgroundImages(
          description,
          locationType,
          timeOfDay,
          weather,
          generatedCount,
          aspectRatio,
          imageStyle
        );

        imagesData.forEach((imgData) => {
          const newBackground: BackgroundAsset = {
            id: crypto.randomUUID(),
            name: name || '배경',
            role: 'background',
            image: imgData,
            description,
            maintainContext,
            locationType,
            timeOfDay,
            weather,
            mood,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          addBackground(newBackground);
        });
      }

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSubmit = () => {
    if (!uploadedImage) {
      setError('이미지를 업로드해주세요.');
      return;
    }

    if (!name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }

    if (category === 'character') {
      const newCharacter: CharacterAsset = {
        id: crypto.randomUUID(),
        name,
        role: characterRole,
        image: uploadedImage,
        description,
        maintainContext: characterRole !== 'extra',
        age,
        personality,
        outfit,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addCharacter(newCharacter);
    } else if (category === 'prop') {
      const newProp: PropAsset = {
        id: crypto.randomUUID(),
        name,
        role: propRole,
        image: uploadedImage,
        description,
        maintainContext: propRole === 'keyProp',
        category: propCategory,
        significance: propRole === 'keyProp' ? significance : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addProp(newProp);
    } else {
      const newBackground: BackgroundAsset = {
        id: crypto.randomUUID(),
        name,
        role: 'background',
        image: uploadedImage,
        description,
        maintainContext,
        locationType,
        timeOfDay,
        weather,
        mood,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addBackground(newBackground);
    }

    handleClose();
  };

  const handleClose = () => {
    // 상태 초기화
    setDescription('');
    setName('');
    setMaintainContext(true);
    setUploadedImage(null);
    setGeneratedCount(1);
    setImageStyleLocal(projectImageStyle);
    setCharacterRole('protagonist');
    setAge('');
    setPersonality('');
    setOutfit('');
    setPropRole('keyProp');
    setPropCategory('accessory');
    setSignificance('');
    setLocationType('indoor');
    setTimeOfDay('day');
    setWeather('sunny');
    setMood('');
    setError(null);
    onClose();
  };

  const getCategoryTitle = () => {
    switch (category) {
      case 'character': return '캐릭터';
      case 'prop': return '소품';
      case 'background': return '배경';
    }
  };

  const inputClass = "w-full p-2.5 text-sm bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none";
  const labelClass = "text-sm font-medium text-gray-300 mb-1.5 block";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="relative bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${mode === 'ai' ? 'bg-gradient-to-br from-indigo-600 to-purple-600' : 'bg-gray-700'}`}>
              {mode === 'ai' ? <SparklesIcon className="w-5 h-5 text-white" /> : <LayersIcon className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {getCategoryTitle()} {mode === 'ai' ? 'AI 생성' : '업로드'}
              </h3>
              <p className="text-xs text-gray-400">
                {mode === 'ai' ? '설명을 입력하면 AI가 이미지를 생성합니다' : '이미지를 업로드하고 정보를 입력하세요'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <ClearIcon className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-grow overflow-y-auto p-5 space-y-5">
          {/* 에러 표시 */}
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}

          {/* 업로드 모드: 이미지 업로드 */}
          {mode === 'upload' && (
            <div>
              <label className={labelClass}>이미지 업로드 *</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative aspect-video w-full bg-gray-700 border-2 border-dashed rounded-lg
                  flex items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors
                  ${uploadedImage ? 'border-indigo-500' : 'border-gray-600'}
                `}
              >
                {uploadedImage ? (
                  <img
                    src={`data:${uploadedImage.mimeType};base64,${uploadedImage.data}`}
                    alt="Uploaded"
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <div className="text-3xl mb-2">📤</div>
                    <p className="text-sm">클릭하여 이미지 업로드</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI 모드: 설명 입력 */}
          {mode === 'ai' && (
            <>
              <div>
                <label className={labelClass}>설명 (한국어) *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    category === 'character'
                      ? '예: 20대 후반 여성, 긴 갈색 머리, 따뜻한 미소, 캐주얼한 원피스'
                      : category === 'prop'
                      ? '예: 빈티지 금반지, 작은 루비가 박힌, 세월의 흔적이 느껴지는'
                      : '예: 아늑한 카페 내부, 따뜻한 조명, 나무 인테리어'
                  }
                  className={`${inputClass} min-h-[100px] resize-none`}
                  disabled={isLoading}
                />
              </div>

              {/* 생성 개수 */}
              <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                <label className="text-sm font-medium text-gray-300">생성 개수:</label>
                <div className="flex gap-1.5">
                  {([1, 2, 3, 4, 5] as const).map((num) => (
                    <button
                      key={num}
                      onClick={() => setGeneratedCount(num)}
                      disabled={isLoading}
                      className={`py-1.5 px-3 text-xs rounded-md transition-colors ${
                        generatedCount === num
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* 이미지 스타일 */}
              <div>
                <label className={labelClass}>이미지 스타일</label>
                <div className="grid grid-cols-3 gap-2">
                  {IMAGE_STYLE_OPTIONS.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => setImageStyle(style.value)}
                      disabled={isLoading}
                      className={`py-2 px-3 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        imageStyle === style.value
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <span>{style.emoji}</span>
                      <span>{style.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 공통: 이름 */}
          <div>
            <label className={labelClass}>이름 {mode === 'upload' ? '*' : '(선택)'}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${getCategoryTitle()} 이름`}
              className={inputClass}
              disabled={isLoading}
            />
          </div>

          {/* 캐릭터 전용 옵션 */}
          {category === 'character' && (
            <>
              <div>
                <label className={labelClass}>역할 *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'protagonist', label: '주인공', icon: '⭐' },
                    { value: 'supporting', label: '조연', icon: '👥' },
                    { value: 'extra', label: '단역', icon: '👤' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCharacterRole(opt.value as CharacterRole)}
                      disabled={isLoading}
                      className={`py-2 px-3 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        characterRole === opt.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'upload' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>나이</label>
                      <input
                        type="text"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="예: 25세"
                        className={inputClass}
                        disabled={isLoading}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>성격</label>
                      <input
                        type="text"
                        value={personality}
                        onChange={(e) => setPersonality(e.target.value)}
                        placeholder="예: 밝고 활발한"
                        className={inputClass}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>의상</label>
                    <input
                      type="text"
                      value={outfit}
                      onChange={(e) => setOutfit(e.target.value)}
                      placeholder="예: 캐주얼한 청바지와 티셔츠"
                      className={inputClass}
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* 소품 전용 옵션 */}
          {category === 'prop' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>역할</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'keyProp', label: '핵심 소품', icon: '📦' },
                      { value: 'prop', label: '일반 소품', icon: '🎒' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setPropRole(opt.value as PropRole)}
                        disabled={isLoading}
                        className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                          propRole === opt.value
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>카테고리</label>
                  <select
                    value={propCategory}
                    onChange={(e) => setPropCategory(e.target.value as PropCategory)}
                    className={inputClass}
                    disabled={isLoading}
                  >
                    <option value="accessory">💍 액세서리</option>
                    <option value="document">📄 문서</option>
                    <option value="device">📱 기기</option>
                    <option value="food">🍕 음식</option>
                    <option value="clothing">👔 의류</option>
                    <option value="vehicle">🚗 탈것</option>
                    <option value="nature">🌸 자연물</option>
                    <option value="other">📦 기타</option>
                  </select>
                </div>
              </div>

              {propRole === 'keyProp' && (
                <div>
                  <label className={labelClass}>스토리 의미</label>
                  <textarea
                    value={significance}
                    onChange={(e) => setSignificance(e.target.value)}
                    placeholder="이 소품이 스토리에서 갖는 의미를 설명하세요"
                    className={`${inputClass} min-h-[60px] resize-none`}
                    disabled={isLoading}
                  />
                </div>
              )}
            </>
          )}

          {/* 배경 전용 옵션 */}
          {category === 'background' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>장소 유형</label>
                  <select
                    value={locationType}
                    onChange={(e) => setLocationType(e.target.value as LocationType)}
                    className={inputClass}
                    disabled={isLoading}
                  >
                    <option value="indoor">🏠 실내</option>
                    <option value="outdoor">🌲 실외</option>
                    <option value="urban">🏙️ 도시</option>
                    <option value="nature">🏔️ 자연</option>
                    <option value="fantasy">✨ 판타지</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>시간대</label>
                  <select
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value as TimeOfDay)}
                    className={inputClass}
                    disabled={isLoading}
                  >
                    <option value="day">☀️ 낮</option>
                    <option value="night">🌙 밤</option>
                    <option value="sunset">🌅 노을</option>
                    <option value="dawn">🌄 새벽</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>날씨</label>
                  <select
                    value={weather}
                    onChange={(e) => setWeather(e.target.value as Weather)}
                    className={inputClass}
                    disabled={isLoading}
                  >
                    <option value="sunny">☀️ 맑음</option>
                    <option value="cloudy">☁️ 흐림</option>
                    <option value="rainy">🌧️ 비</option>
                    <option value="snowy">❄️ 눈</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>분위기</label>
                <input
                  type="text"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="예: 따뜻하고 포근한"
                  className={inputClass}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          {/* 컨텍스트 유지 옵션 */}
          {category !== 'character' && (
            <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
              <input
                type="checkbox"
                id="maintainContext"
                checked={maintainContext}
                onChange={(e) => setMaintainContext(e.target.checked)}
                className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                disabled={isLoading}
              />
              <label htmlFor="maintainContext" className="text-sm text-gray-300">
                <span className="font-medium">컨텍스트 유지</span>
                <span className="text-gray-500 ml-2">모든 장면에서 동일한 외형 유지</span>
              </label>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-700">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-5 py-2.5 text-sm font-medium text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={mode === 'ai' ? handleAIGenerate : handleUploadSubmit}
            disabled={isLoading || (mode === 'ai' && !description.trim()) || (mode === 'upload' && (!uploadedImage || !name.trim()))}
            className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {mode === 'ai' ? '생성 중...' : '저장 중...'}
              </>
            ) : (
              <>
                {mode === 'ai' && <SparklesIcon className="w-4 h-4" />}
                {mode === 'ai' ? `${getCategoryTitle()} 생성` : '저장'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetCreatorModal;
