
import React, { useState, useEffect } from 'react';
import { GeneratedItem, ImageData, Chapter, DragItem, Character, AspectRatio, Scenario, ScenarioConfig, Scene } from './types';
import { generateImages, generateCharacterPortraits, editImage, extractCharacterData, generateScenario, regenerateScene, generateSceneImage } from './services/geminiService';
import { ResultDisplay } from './components/ResultDisplay';
import { IdIcon, LayersIcon, SparklesIcon, MagnifyingGlassPlusIcon, PlusCircleIcon, CheckCircleIcon, TrashIcon, ClearIcon, PencilIcon, AspectRatioHorizontalIcon, AspectRatioVerticalIcon } from './components/Icons';
import { ChapterDisplay } from './components/ChapterDisplay';
import { ScenarioGenerator } from './components/ScenarioGenerator';
import { ScenarioEditor } from './components/ScenarioEditor';

// Icon for scenario mode toggle
const FilmIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
  </svg>
);

const ImageModeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const cinematicLooksData = {
  "장르 기반 시네마틱 룩 (Genre-Based)": [
    {
      title: "필름 누아르",
      description: "극단적인 명암 대비, 깊은 그림자, 흑백 또는 매우 낮은 채도, 젖은 도로의 빛 반사 효과를 강조합니다.",
      promptFragment: "Film Noir style, extreme chiaroscuro lighting, deep shadows, black and white or heavily desaturated colors, dramatic low-key lighting, reflections on wet streets"
    },
    {
      title: "사이버펑크 네온",
      description: "어둡고 차가운 톤을 기반으로 네온(마젠타/시안) 색상을 극대화하고, 인공적인 조명, 안개, 렌즈 플레어 효과를 추가합니다.",
      promptFragment: "Cyberpunk neon aesthetic, dark and cool tones (blues/greens) with vibrant magenta and cyan neon lights, artificial lighting, foggy or smoggy atmosphere, lens flare"
    },
    {
      title: "감성 멜로",
      description: "부드러운 콘트라스트, 따뜻한 색감, 하이라이트의 빛 번짐(블룸) 효과로 몽환적인 느낌을 강조합니다.",
      promptFragment: "Romantic melodrama style, soft contrast, warm color palette, bloom effect on highlights, dreamy and ethereal atmosphere, flattering skin tones"
    },
    {
      title: "서부극",
      description: "세피아 톤에 가까운 색감, 바랜 듯한 채도, 강한 햇빛 아래의 높은 콘트라스트와 필름 그레인으로 거친 느낌을 살립니다.",
      promptFragment: "Classic Western film look, sepia-toned color palette, desaturated colors, high contrast under harsh sunlight, visible film grain, dusty atmosphere"
    },
    {
      title: "공포 스릴러",
      description: "의도적으로 손상된 필름 효과(스크래치, 먼지), 낮은 채도, 특정 색(주로 붉은색) 강조, 비네팅 효과를 줍니다.",
      promptFragment: "Grindhouse horror style, damaged film effect with scratches and dust, high contrast, desaturated colors with selective color pops (especially red), heavy vignetting, gritty texture"
    }
  ],
  "시대/역사 기반 시네마틱 룩 (Era/Historical-Based)": [
    {
      title: "1920년대 무성영화",
      description: "완전 흑백, 높은 콘트라스트, 약간의 화면 깜빡임, 거친 필름 그레인으로 무성영화 시대를 재현합니다.",
      promptFragment: "1920s silent film aesthetic, high-contrast black and white, noticeable film grain, slight flicker effect, dramatic and expressive lighting"
    },
    {
      title: "테크니컬러 영화",
      description: "1950년대 할리우드 영화처럼 매우 높은 채도, 특히 빨강, 파랑, 초록을 강렬하고 비현실적으로 표현합니다.",
      promptFragment: "Glorious Technicolor style of 1950s Hollywood, hyper-saturated colors, especially vibrant reds, blues, and greens, clean and sharp image"
    },
    {
      title: "1980년대 VHS",
      description: "낮은 해상도, 색 번짐, 화면 노이즈 라인, 빛바랜 색감으로 80년대 VHS 테이프의 질감을 표현합니다.",
      promptFragment: "80s VHS aesthetic, low resolution, color bleeding, analog video noise and tracking lines, slightly faded colors, soft image quality"
    },
    {
      title: "90년대 캠코더",
      description: "4:3 화면비, 약간의 디지털 노이즈, VHS보다 선명하지만 현대 영상보다는 부드러운 질감을 재현합니다.",
      promptFragment: "90s camcorder look, 4:3 aspect ratio, slight digital noise, softer than modern video but clearer than VHS, occasional date/time stamp overlay"
    }
  ],
  "촬영 기술/매체 기반 시네마틱 룩 (Technique/Medium-Based)": [
    {
      title: "아나모픽 렌즈",
      description: "가로로 긴 타원형의 보케와 수평으로 뻗는 렌즈 플레어로 영화적인 느낌을 강조합니다.",
      promptFragment: "Shot on an anamorphic lens, distinctive horizontal lens flare, oval-shaped bokeh, cinematic widescreen feel"
    },
    {
      title: "슈퍼 8mm 필름",
      description: "매우 거칠고 큰 입자감, 따뜻한 색감, 비네팅, 약간의 화면 흔들림으로 인디 영화 스타일을 연출합니다.",
      promptFragment: "Super 8mm film aesthetic, heavy and coarse film grain, warm color cast, vignetting, slight frame jitter, nostalgic and raw feel"
    },
    {
      title: "블리치 바이패스",
      description: "채도를 크게 낮추고 콘트라스트와 입자감을 높여 거칠고 차가우며 비정한 느낌을 줍니다.",
      promptFragment: "Bleach bypass film processing effect, reduced saturation, high contrast, increased grain, harsh and gritty look, retaining silver in the film stock"
    },
    {
      title: "틸트-시프트",
      description: "렌즈를 기울여 초점면을 왜곡, 특정 영역만 선명하게 만들어 미니어처 장난감처럼 보이는 효과를 줍니다.",
      promptFragment: "Tilt-shift photography effect, selective focus creating a shallow depth of field, making the scene look like a miniature scale model"
    }
  ]
};

const ItemModal: React.FC<{ item: GeneratedItem; onClose: () => void; }> = ({ item, onClose }) => {
    const [isZoomed, setIsZoomed] = React.useState(false);
    const [position, setPosition] = React.useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragStart, setDragStart] = React.useState({ clientX: 0, clientY: 0, positionX: 0, positionY: 0 });
    const imageRef = React.useRef<HTMLImageElement>(null);
    const wasDragged = React.useRef(false);
    const scale = 2.5;

    React.useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [onClose]);

    React.useEffect(() => {
        const handlePanKeyDown = (e: KeyboardEvent) => {
            if (!isZoomed || !imageRef.current) return;
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            e.preventDefault();

            const step = 20 / scale;
            const img = imageRef.current;
            const maxX = Math.max(0, (img.clientWidth * scale - img.clientWidth) / (2 * scale));
            const maxY = Math.max(0, (img.clientHeight * scale - img.clientHeight) / (2 * scale));

            setPosition(p => {
                let newX = p.x, newY = p.y;
                switch (e.key) {
                    case 'ArrowUp': newY += step; break;
                    case 'ArrowDown': newY -= step; break;
                    case 'ArrowLeft': newX += step; break;
                    case 'ArrowRight': newX -= step; break;
                }
                return { x: Math.max(-maxX, Math.min(maxX, newX)), y: Math.max(-maxY, Math.min(maxY, newY)) };
            });
        };

        window.addEventListener('keydown', handlePanKeyDown);
        return () => window.removeEventListener('keydown', handlePanKeyDown);
    }, [isZoomed]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isZoomed) return;
        
        e.preventDefault();
        wasDragged.current = false;
        setIsDragging(true);
        setDragStart({ clientX: e.clientX, clientY: e.clientY, positionX: position.x, positionY: position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !isZoomed || !imageRef.current) return;
        e.preventDefault();
        wasDragged.current = true;

        const deltaX = e.clientX - dragStart.clientX;
        const deltaY = e.clientY - dragStart.clientY;
        
        const newX = dragStart.positionX + (deltaX / scale);
        const newY = dragStart.positionY + (deltaY / scale);

        const img = imageRef.current;
        const maxX = Math.max(0, (img.clientWidth * scale - img.clientWidth) / (2 * scale));
        const maxY = Math.max(0, (img.clientHeight * scale - img.clientHeight) / (2 * scale));

        setPosition({ x: Math.max(-maxX, Math.min(maxX, newX)), y: Math.max(-maxY, Math.min(maxY, newY)) });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleClick = () => {
        if (wasDragged.current) return;
         setIsZoomed(prev => {
            if (prev) {
                setPosition({ x: 0, y: 0 });
            }
            return !prev;
        });
    }

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const src = `data:${item.image.mimeType};base64,${item.image.data}`;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 transition-opacity duration-300" onClick={onClose} role="dialog" aria-modal="true">
            <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <div className="overflow-hidden rounded-lg" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp}>
                    <img
                        ref={imageRef}
                        src={src}
                        alt="Enlarged result"
                        className="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-300 ease-in-out select-none"
                        style={{
                            transform: `scale(${isZoomed ? scale : 1}) translate(${position.x}px, ${position.y}px)`,
                            cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                        }}
                        onMouseDown={handleMouseDown}
                        onClick={handleClick}
                        draggable="false"
                    />
                </div>
                 <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full text-white hover:bg-gray-700 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Close item view">
                    <span className="text-lg">❌</span>
                </button>
            </div>
        </div>
    );
};

const CharacterSheetModal: React.FC<{
    character: Character;
    onSave: (updatedCharacter: Character) => void;
    onClose: () => void;
}> = ({ character, onSave, onClose }) => {
    const [formData, setFormData] = useState(character);

    useEffect(() => {
        setFormData(character);
    }, [character]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = () => {
        onSave(formData);
        onClose();
    };
    
    const inputClass = "w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors text-sm";
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col gap-4 p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-indigo-300 flex items-center gap-2">
                    <PencilIcon />
                    캐릭터 시트 편집
                </h3>
                <div className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="name" className="text-sm font-medium text-gray-400 mb-1 block">이름</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className={inputClass} />
                    </div>
                     <div>
                        <label htmlFor="age" className="text-sm font-medium text-gray-400 mb-1 block">나이</label>
                        <input type="text" id="age" name="age" value={formData.age} onChange={handleChange} className={inputClass} />
                    </div>
                     <div>
                        <label htmlFor="personality" className="text-sm font-medium text-gray-400 mb-1 block">성격</label>
                        <textarea id="personality" name="personality" value={formData.personality} onChange={handleChange} className={`${inputClass} min-h-[60px]`} />
                    </div>
                     <div>
                        <label htmlFor="outfit" className="text-sm font-medium text-gray-400 mb-1 block">대표 의상</label>
                        <textarea id="outfit" name="outfit" value={formData.outfit} onChange={handleChange} className={`${inputClass} min-h-[60px]`} />
                    </div>
                </div>
                 <div className="flex justify-end gap-3 mt-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors">
                        취소
                    </button>
                    <button onClick={handleSubmit} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
};


const RegenerationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    prompt: string;
    onPromptChange: (newPrompt: string) => void;
    onSubmit: () => void;
    isLoading: boolean;
}> = ({ isOpen, onClose, prompt, onPromptChange, onSubmit, isLoading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col gap-4 p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-yellow-300 flex items-center gap-2">
                    <SparklesIcon />
                    이미지 수정
                </h3>
                <p className="text-sm text-gray-400">
                    현재 이미지를 기준으로 변경하고 싶은 내용을 영어로 입력하세요. (예: make the character smile, change clothes to red)
                </p>
                <textarea
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    className="w-full h-40 p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-yellow-500 focus:outline-none transition-colors text-sm font-mono"
                    placeholder="Enter modifications in English..."
                    aria-label="Edit image modification prompt"
                />
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors">
                        취소
                    </button>
                    <button onClick={onSubmit} disabled={isLoading || !prompt.trim()} className="px-4 py-2 text-sm font-bold text-black bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors disabled:bg-yellow-800 disabled:opacity-70">
                        {isLoading ? '수정 중...' : '이미지 수정 시작'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CharacterCreationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (description: string, count: number) => void;
    isLoading: boolean;
}> = ({ isOpen, onClose, onSubmit, isLoading }) => {
    const [description, setDescription] = useState('');
    const [count, setCount] = useState<1 | 2 | 3 | 4 | 5>(1);

    const handleSubmit = () => {
        if (description.trim()) {
            onSubmit(description, count);
        } else {
            alert('캐릭터 묘사를 입력해주세요.');
        }
    };
    
    const handleClose = () => {
        setDescription('');
        setCount(1);
        onClose();
    }

    if (!isOpen) return null;

    const labelClass = "text-sm font-medium text-gray-300 mb-1 block";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="relative bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col gap-4 p-6" onClick={(e) => e.stopPropagation()}>
                <button onClick={handleClose} disabled={isLoading} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors disabled:opacity-50" aria-label="Close modal">
                   <ClearIcon className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-indigo-300 flex items-center gap-2">
                    <IdIcon />
                    등장인물 생성
                </h3>
                <p className="text-sm text-gray-400">
                    생성할 캐릭터의 이름, 나이, 성격, 의상, 외형 등을 자유롭게 서술해주세요. AI가 내용을 분석하여 캐릭터 시트를 자동으로 채워줍니다.
                </p>
                <div>
                    <label htmlFor="character-description" className={labelClass}>캐릭터 묘사 (한국어)</label>
                    <textarea
                        id="character-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full h-40 p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors text-sm"
                        placeholder="예: 20대 후반의 남자 김민준. 그는 냉철하고 이성적인 성격이며, 평소 검은색 터틀넥 스웨터를 즐겨 입는다. 짧은 검은 머리에 날카로운 눈매를 가졌다."
                        aria-label="Character description"
                    />
                </div>
                 <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-md">
                    <label className="text-sm font-medium text-gray-300">생성 개수:</label>
                     <div className="flex gap-1.5">
                        {([1, 2, 3, 4, 5] as const).map(num => (
                            <button key={num} onClick={() => setCount(num)} disabled={isLoading} className={`py-1 px-3 text-xs rounded-md transition-colors flex items-center gap-1 ${count === num ? 'bg-indigo-600 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>
                                <LayersIcon className="w-3 h-3" />
                                {num}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={handleClose} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50">
                        취소
                    </button>
                    <button onClick={handleSubmit} disabled={isLoading || !description.trim()} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-800 disabled:opacity-70">
                        {isLoading ? '생성 중...' : '생성 시작'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ConfirmationModal: React.FC<{
    config: { title: string; message: string; onConfirm: () => void; };
    onClose: () => void;
}> = ({ config, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleConfirmClick = () => {
        config.onConfirm();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col gap-4 p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                    <TrashIcon className="w-5 h-5" />
                    {config.title}
                </h3>
                <p className="text-sm text-gray-300">{config.message}</p>
                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors">
                        취소
                    </button>
                    <button onClick={handleConfirmClick} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                        삭제 확인
                    </button>
                </div>
            </div>
        </div>
    );
};


const getFriendlyErrorMessage = (originalError: unknown): string => {
    const message = originalError instanceof Error ? originalError.message : '알 수 없는 오류가 발생했습니다.';
    if (message.startsWith('PROMPT_BLOCKED:')) {
        const reason = message.split(':')[1]?.trim();
        let userMessage = '오류: 입력하신 내용에 부적절한 단어가 포함되어 생성이 차단되었습니다.';
        if (reason && reason !== 'BLOCK_REASON_UNSPECIFIED') {
            userMessage += ` (사유: ${reason})`;
        }
        return userMessage;
    }
    if (message.includes('Character data extraction failed')) {
        return '오류: 캐릭터 설명 분석에 실패했습니다. 내용을 조금 더 자세히 작성하거나, 잠시 후 다시 시도해주세요.';
    }
    if (message.includes('Image generation failed')) {
        return '오류: 이미지 생성에 실패했습니다. API 무료 사용량을 초과했거나, 일시적인 서비스 오류일 수 있습니다. 잠시 후 다시 시도해 주세요.';
    }
    if (message.includes('Image editing failed')) {
        return '오류: 이미지 수정에 실패했습니다. API 무료 사용량을 초과했거나, 서비스가 요청을 처리할 수 없습니다. 다시 시도해 주세요.';
    }
     if (message.includes('Character generation failed')) {
        return '오류: 캐릭터 생성에 실패했습니다. API 무료 사용량을 초과했거나, 부적절한 프롬프트일 수 있습니다.';
    }
    if (message.includes('Video generation failed')) {
        return '오류: 동영상 생성에 실패했습니다. API 문제, 서비스 점검, 또는 부적절한 프롬프트일 수 있습니다. 잠시 후 다시 시도해 주세요.';
    }
    if (message.includes('Scenario generation failed')) {
        return '오류: 시나리오 생성에 실패했습니다. 주제를 더 구체적으로 작성하거나, 잠시 후 다시 시도해 주세요.';
    }
    if (message.includes('Scene regeneration failed')) {
        return '오류: 씬 재생성에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    }
    return message;
};

// Helper to convert a file to a data URL
const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const App: React.FC = () => {
    const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [modalItem, setModalItem] = useState<GeneratedItem | null>(null);
    
    // Character management state
    const [characterLibrary, setCharacterLibrary] = useState<(Character | null)[]>(Array(5).fill(null));
    const [activeCharacters, setActiveCharacters] = useState<(Character | null)[]>(Array(5).fill(null));

    // Character Selection State
    const [isCharacterSelectionMode, setIsCharacterSelectionMode] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    // Chapters State
    const [chapters, setChapters] = useState<Chapter[]>([]);

    // Inputs
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    const [sceneDescription, setSceneDescription] = useState('');
    const [promptCamera, setPromptCamera] = useState('Default');
    const [numberOfImages, setNumberOfImages] = useState<1 | 2 | 3 | 4 | 5>(1);
    const [activeFilters, setActiveFilters] = useState<{ title: string; intensity: number }[]>([]);

    // Regeneration states
    const [regenModalState, setRegenModalState] = useState<{ isOpen: boolean; itemId: string | null; prompt: string; }>({ isOpen: false, itemId: null, prompt: '' });
    const [regeneratingImageId, setRegeneratingImageId] = useState<string | null>(null);

    // Character Creation states
    const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
    const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
    
    // Confirmation Modal State
    const [confirmationConfig, setConfirmationConfig] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    // Character Sheet Modal State
    const [sheetModalState, setSheetModalState] = useState<{ isOpen: boolean; character: Character | null }>({ isOpen: false, character: null });

    // Scenario Mode States
    const [appMode, setAppMode] = useState<'image' | 'scenario'>('image');
    const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
    const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
    const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
    const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);
    const [generatingImageSceneId, setGeneratingImageSceneId] = useState<string | null>(null);
    const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);

    // --- Cinematic Look Handlers ---
    const handleRemoveFilter = (title: string) => {
        setActiveFilters(prev => prev.filter(f => f.title !== title));
    };

    const handleToggleFilter = (title: string) => {
        const isAlreadyActive = activeFilters.some(f => f.title === title);
        if (isAlreadyActive) {
            handleRemoveFilter(title);
        } else {
            if (activeFilters.length < 3) {
                setActiveFilters(prev => [...prev, { title, intensity: 100 }]);
            }
        }
    };

    const handleIntensityChange = (title: string, intensity: number) => {
        setActiveFilters(prev => prev.map(f => f.title === title ? { ...f, intensity } : f));
    };

    // --- Character Management Handlers ---
    const handleLibraryImageChange = (index: number, imageData: ImageData | null) => {
        setCharacterLibrary(prev => {
            const newLibrary = [...prev];
            if (imageData) {
                const existingChar = prev[index];
                newLibrary[index] = {
                    id: existingChar?.id || crypto.randomUUID(),
                    image: imageData,
                    name: existingChar?.name || `캐릭터 ${index + 1}`,
                    age: existingChar?.age || '',
                    personality: existingChar?.personality || '',
                    outfit: existingChar?.outfit || '',
                };
            } else {
                newLibrary[index] = null;
            }
            return newLibrary;
        });
    };

    const handleLibraryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const dataUrl = await fileToDataUrl(file);
                const base64Data = dataUrl.split(',')[1];
                handleLibraryImageChange(index, { mimeType: file.type, data: base64Data });
            } catch (error) {
                console.error("File to data URL conversion failed", error);
                setError("파일을 이미지로 변환하는 데 실패했습니다.");
            }
        }
    };

    const handleActivateCharacter = (libraryIndex: number) => {
        const charToActivate = characterLibrary[libraryIndex];
        if (!charToActivate) return;

        const isAlreadyActive = activeCharacters.some(activeChar => activeChar && activeChar.id === charToActivate.id);
        if (isAlreadyActive) return;

        const firstEmptySlot = activeCharacters.findIndex(slot => slot === null);
        if (firstEmptySlot !== -1) {
            setActiveCharacters(prev => {
                const newActive = [...prev];
                newActive[firstEmptySlot] = charToActivate;
                return newActive;
            });
        } else {
            alert('활성화 슬롯이 가득 찼습니다. (최대 5개)');
        }
    };

    const handleDeactivateCharacter = (activeIndex: number) => {
        setActiveCharacters(prev =>
            prev.map((char, i) => (i === activeIndex ? null : char))
        );
    };

    const handleOpenSheetModal = (character: Character) => {
        setSheetModalState({ isOpen: true, character });
    };
    
    const handleSaveCharacterSheet = (updatedCharacter: Character) => {
        setCharacterLibrary(prev => prev.map(c => (c && c.id === updatedCharacter.id ? updatedCharacter : c)));
        setActiveCharacters(prev => prev.map(c => (c && c.id === updatedCharacter.id ? updatedCharacter : c)));
    };

    const handleOpenRegenModal = (id: string) => {
        const allItems = [...generatedItems, ...chapters.flatMap(c => c.items)];
        const item = allItems.find(i => i.id === id);
        if(!item) return;

        setRegenModalState({
            isOpen: true,
            itemId: id,
            prompt: '',
        });
    };
    
    const handleCloseRegenModal = () => {
        setRegenModalState({ isOpen: false, itemId: null, prompt: '' });
    };
    
    const handleCreateCharacter = async (description: string, count: number) => {
        setIsCharacterModalOpen(false);
        setIsCreatingCharacter(true);
        setIsLoading(true);
        setError(null);
        
        try {
            const { name, age, personality, outfit, englishDescription } = await extractCharacterData(description);
            
            if (!englishDescription.trim()) {
                throw new Error("Character data extraction failed: AI could not generate an English appearance description. Please be more specific in the character details.");
            }
    
            const newImagesData = await generateCharacterPortraits(englishDescription, count, aspectRatio);
            const newCharacterImages: GeneratedItem[] = newImagesData.map(imgData => ({
                id: crypto.randomUUID(),
                type: 'image',
                prompt: `[캐릭터 생성] ${description}`,
                image: imgData,
                aspectRatio: aspectRatio,
                characterData: {
                    name: name || '이름 없음',
                    age: age || '',
                    personality: personality || '',
                    outfit: outfit || '',
                }
            }));
            setGeneratedItems(prev => [...newCharacterImages, ...prev]);
        } catch (e) {
            setError(getFriendlyErrorMessage(e));
        } finally {
            setIsLoading(false);
            setIsCreatingCharacter(false);
        }
    };
    
    const handleEditImage = async () => {
        if (regenModalState.itemId === null) return;

        const { itemId, prompt: modificationPrompt } = regenModalState;
        
        const allItems = [...generatedItems, ...chapters.flatMap(c => c.items)];
        const itemToEdit = allItems.find(i => i.id === itemId);
        
        if (!itemToEdit) {
            setError("수정할 원본 이미지를 찾을 수 없습니다.");
            handleCloseRegenModal();
            return;
        }

        handleCloseRegenModal();
        setRegeneratingImageId(itemId);
        setError(null);

        try {
            const newImageData = await editImage(itemToEdit.image, modificationPrompt);

            const updatedPrompt = `${itemToEdit.prompt}\n[EDIT: ${modificationPrompt}]`;
            const updatedItem: GeneratedItem = { ...itemToEdit, image: newImageData, prompt: updatedPrompt, aspectRatio: itemToEdit.aspectRatio };

            setGeneratedItems(prev => prev.map(item => item.id === itemId ? updatedItem : item));
            setChapters(prev => prev.map(chapter => ({
                ...chapter,
                items: chapter.items.map(item => item.id === itemId ? updatedItem : item)
            })));

        } catch (e) {
            setError(`이미지 수정 실패: ${getFriendlyErrorMessage(e)}`);
        } finally {
            setRegeneratingImageId(null);
        }
    };

    // --- Scenario Handlers ---
    const handleGenerateScenario = async (config: ScenarioConfig) => {
        setIsGeneratingScenario(true);
        setError(null);
        try {
            const scenario = await generateScenario(config);
            setCurrentScenario(scenario);
            setIsScenarioModalOpen(false);
            setAppMode('scenario');
        } catch (e) {
            setError(getFriendlyErrorMessage(e));
        } finally {
            setIsGeneratingScenario(false);
        }
    };

    const handleRegenerateScene = async (sceneId: string, instruction?: string) => {
        if (!currentScenario) return;
        setRegeneratingSceneId(sceneId);
        setError(null);
        try {
            const newScene = await regenerateScene(currentScenario, sceneId, instruction);
            setCurrentScenario(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    scenes: prev.scenes.map(s => s.id === sceneId ? newScene : s),
                    updatedAt: Date.now(),
                };
            });
        } catch (e) {
            setError(getFriendlyErrorMessage(e));
        } finally {
            setRegeneratingSceneId(null);
        }
    };

    const handleGenerateSceneImage = async (sceneId: string) => {
        if (!currentScenario) return;
        const scene = currentScenario.scenes.find(s => s.id === sceneId);
        if (!scene) return;

        setGeneratingImageSceneId(sceneId);
        setError(null);
        try {
            const characterImages = activeCharacters.filter((c): c is Character => c !== null).map(c => c.image);
            const imageData = await generateSceneImage(scene, characterImages, aspectRatio);
            setCurrentScenario(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, generatedImage: imageData } : s),
                    updatedAt: Date.now(),
                };
            });
        } catch (e) {
            setError(getFriendlyErrorMessage(e));
        } finally {
            setGeneratingImageSceneId(null);
        }
    };

    const handleGenerateAllSceneImages = async () => {
        if (!currentScenario) return;
        const scenesWithoutImages = currentScenario.scenes.filter(s => !s.generatedImage);
        if (scenesWithoutImages.length === 0) {
            alert('모든 씬에 이미지가 이미 생성되어 있습니다.');
            return;
        }

        setIsGeneratingAllImages(true);
        setError(null);
        const characterImages = activeCharacters.filter((c): c is Character => c !== null).map(c => c.image);

        for (const scene of scenesWithoutImages) {
            setGeneratingImageSceneId(scene.id);
            try {
                const imageData = await generateSceneImage(scene, characterImages, aspectRatio);
                setCurrentScenario(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        scenes: prev.scenes.map(s => s.id === scene.id ? { ...s, generatedImage: imageData } : s),
                        updatedAt: Date.now(),
                    };
                });
            } catch (e) {
                console.error(`Failed to generate image for scene ${scene.sceneNumber}:`, e);
                // Continue with other scenes even if one fails
            }
        }
        setGeneratingImageSceneId(null);
        setIsGeneratingAllImages(false);
    };

    const handleSaveScenario = () => {
        if (!currentScenario) return;
        const dataStr = JSON.stringify(currentScenario, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scenario_${currentScenario.title.replace(/\s+/g, '_')}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLoadScenario = async (file: File) => {
        try {
            const text = await file.text();
            const loaded = JSON.parse(text) as Scenario;
            // Validate basic structure
            if (!loaded.id || !loaded.title || !loaded.scenes || !Array.isArray(loaded.scenes)) {
                throw new Error('Invalid scenario file format');
            }
            setCurrentScenario(loaded);
            setAppMode('scenario');
        } catch (e) {
            setError('시나리오 파일을 불러오는데 실패했습니다. 올바른 JSON 파일인지 확인해주세요.');
        }
    };

    const handleCloseScenarioEditor = () => {
        setCurrentScenario(null);
        setAppMode('image');
    };

    const handleGenerate = async () => {
        const finalActiveCharacters = activeCharacters.filter((c): c is Character => c !== null);
        if (finalActiveCharacters.length === 0 || !sceneDescription.trim() || isLoading) return;
        
        setIsLoading(true);
        setError(null);

        const activeCharsForPrompt = activeCharacters.filter((c): c is Character => c !== null);

        let characterDetails = '';
        if (activeCharsForPrompt.length > 0) {
            characterDetails = '\n\n**Character Details:**\n' + activeCharsForPrompt.map(c =>
                `- **${c.name}:** Described as ${c.age}, with a personality of '${c.personality}'. They are wearing '${c.outfit}'.`
            ).join('\n');
        }

        const characterNames = activeCharsForPrompt.map(c => `@${c.name}`).join(', ');

        let combinedPrompt = `
**Scene Description:**
- **Characters:** ${characterNames || 'The character'}
- **Scene:** ${sceneDescription}
- **Camera:** ${promptCamera}
${characterDetails}
        `.trim();
        
        if (activeFilters.length > 0) {
            const lookFragments = activeFilters.map(filter => {
                const look = Object.values(cinematicLooksData).flat().find(l => l.title === filter.title);
                if (look) {
                    return `(${look.promptFragment}:${(filter.intensity / 100).toFixed(2)})`;
                }
                return '';
            }).filter(Boolean).join(', ');

            if (lookFragments) {
                combinedPrompt += `\n\n**Cinematic Style:** ${lookFragments}`;
            }
        }

        try {
            const finalActiveCharacterImages = finalActiveCharacters.map(c => c.image);
            const newImagesData = await generateImages(combinedPrompt, finalActiveCharacterImages, numberOfImages, aspectRatio);

            const newGeneratedImages: GeneratedItem[] = newImagesData.map(imgData => ({
                id: crypto.randomUUID(),
                type: 'image',
                prompt: combinedPrompt,
                image: imgData,
                aspectRatio: aspectRatio,
            }));

            setGeneratedItems(prev => [...newGeneratedImages, ...prev]);
            setSceneDescription('');

        } catch (e) {
            setError(getFriendlyErrorMessage(e));
        } finally {
            setIsLoading(false);
        }
    };
    
    // Chapter Handlers
    const handleAddChapter = () => {
        const newChapter: Chapter = {
            id: crypto.randomUUID(),
            name: `챕터 ${chapters.length + 1}`,
            items: [],
        };
        setChapters(prev => [...prev, newChapter]);
    };

    const handleDeleteChapter = (id: string) => {
        const chapterToDelete = chapters.find(c => c.id === id);
        if (!chapterToDelete) return;
        
        setConfirmationConfig({
            title: "챕터 삭제",
            message: `'${chapterToDelete.name}' 챕터를 삭제하시겠습니까? 챕터 안의 모든 항목은 '생성된 결과물' 목록으로 이동됩니다.`,
            onConfirm: () => {
                setGeneratedItems(prev => [...chapterToDelete.items, ...prev]);
                setChapters(prev => prev.filter(c => c.id !== id));
            }
        });
    };
    
    const handleRenameChapter = (id: string, newName: string) => {
        setChapters(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
    };

    const handleRemoveItemFromChapter = (itemId: string, sourceChapterId: string) => {
        const sourceChapter = chapters.find(c => c.id === sourceChapterId);
        if (!sourceChapter) return;

        const itemToMove = sourceChapter.items.find(item => item.id === itemId);
        if (!itemToMove) return;

        // Move item back to generatedItems
        setGeneratedItems(prev => [itemToMove, ...prev]);

        // Remove item from the source chapter
        setChapters(prev => prev.map(c =>
            c.id === sourceChapterId
                ? { ...c, items: c.items.filter(item => item.id !== itemId) }
                : c
        ));
    };


    // Drag and Drop Handlers
    const handleItemDragStart = (e: React.DragEvent, dragItem: DragItem) => {
        e.dataTransfer.setData("application/json", JSON.stringify(dragItem));
        e.dataTransfer.effectAllowed = "move";
        (e.target as HTMLElement).style.opacity = '0.5';
    };

    const handleDrop = (destination: { type: 'results' | 'chapter', id: string }, e: React.DragEvent, targetId: string | null = null) => {
        const dragItemData: DragItem | null = JSON.parse(e.dataTransfer.getData("application/json") || 'null');
        if (!dragItemData || dragItemData.itemId === targetId) return;
        const { itemId: draggedItemId, source } = dragItemData;
    
        const allItems = {
            results: [...generatedItems],
            chapters: new Map(chapters.map(c => [c.id, [...c.items]]))
        };
    
        // 1. Find and remove item from source
        let itemToMove: GeneratedItem | null = null;
        if (source.type === 'results') {
            const itemIndex = allItems.results.findIndex(i => i.id === draggedItemId);
            if (itemIndex > -1) {
                [itemToMove] = allItems.results.splice(itemIndex, 1);
            }
        } else { // chapter
            const sourceChapterItems = allItems.chapters.get(source.id);
            if (sourceChapterItems) {
                const itemIndex = sourceChapterItems.findIndex(i => i.id === draggedItemId);
                if (itemIndex > -1) {
                    [itemToMove] = sourceChapterItems.splice(itemIndex, 1);
                }
            }
        }
    
        if (!itemToMove) return;
    
        // 2. Add item to destination
        if (destination.type === 'results') {
            if (targetId) {
                const targetIndex = allItems.results.findIndex(i => i.id === targetId);
                if (targetIndex > -1) {
                    allItems.results.splice(targetIndex, 0, itemToMove);
                } else {
                    allItems.results.push(itemToMove); // fallback
                }
            } else {
                allItems.results.push(itemToMove);
            }
        } else { // chapter
            const destChapterItems = allItems.chapters.get(destination.id);
            if (destChapterItems) {
                if (targetId) {
                    const targetIndex = destChapterItems.findIndex(i => i.id === targetId);
                    if (targetIndex > -1) {
                        destChapterItems.splice(targetIndex, 0, itemToMove);
                    } else {
                        destChapterItems.push(itemToMove); // fallback
                    }
                } else {
                    destChapterItems.push(itemToMove);
                }
            }
        }
    
        // 3. Set new states
        setGeneratedItems(allItems.results);
        setChapters(prevChapters => prevChapters.map(c => ({
            ...c,
            items: allItems.chapters.get(c.id) || c.items
        })));
    };
    
    // Character Selection & Deletion Handlers
    const toggleCharacterSelectionMode = () => {
        setIsCharacterSelectionMode(prev => !prev);
        setSelectedItemIds(new Set()); // Reset on toggle
    };

    const handleItemSelection = (itemId: string) => {
        setSelectedItemIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const confirmCharacterSelection = () => {
        const itemsToMove = generatedItems.filter(
            item => selectedItemIds.has(item.id)
        );

        const emptySlots = characterLibrary.reduce((count, slot) => count + (slot === null ? 1 : 0), 0);

        if (itemsToMove.length > emptySlots) {
            alert(`캐릭터 라이브러리에 공간이 부족합니다. ${itemsToMove.length}개의 이미지를 선택했지만 ${emptySlots}개의 슬롯만 남아있습니다.`);
            return;
        }

        const newLibrary = [...characterLibrary];
        
        let movedCount = 0;
        for (let i = 0; i < newLibrary.length && movedCount < itemsToMove.length; i++) {
            if (newLibrary[i] === null) {
                const itemToMove = itemsToMove[movedCount];
                const newCharacter: Character = {
                    id: crypto.randomUUID(),
                    image: itemToMove.image,
                    name: itemToMove.characterData?.name || `캐릭터 ${i + 1}`,
                    age: itemToMove.characterData?.age || '',
                    personality: itemToMove.characterData?.personality || '',
                    outfit: itemToMove.characterData?.outfit || ''
                };
                newLibrary[i] = newCharacter;
                movedCount++;
            }
        }
        
        setCharacterLibrary(newLibrary);
        setGeneratedItems(prev => prev.filter(item => !selectedItemIds.has(item.id)));
        toggleCharacterSelectionMode();
    };

    const handleDeleteLibraryImage = (indexToDelete: number) => {
        setConfirmationConfig({
            title: "캐릭터 삭제",
            message: "이 캐릭터를 라이브러리에서 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
            onConfirm: () => {
                setCharacterLibrary(prevLibrary => 
                    prevLibrary.map((char, index) => index === indexToDelete ? null : char)
                );
            }
        });
    };

    const handleDeleteGeneratedItem = (id: string) => {
        setConfirmationConfig({
            title: "항목 삭제",
            message: "이 항목을 영구적으로 삭제하시겠습니까?",
            onConfirm: () => {
                setGeneratedItems(prev => prev.filter(item => item.id !== id));
            }
        });
    };

    const isBusy = isLoading || !!regeneratingImageId || isCreatingCharacter;
    const canGenerate = activeCharacters.some(c => c !== null) && sceneDescription.trim().length > 0 && !isBusy;

    return (
        <div className="h-screen bg-gray-900 text-gray-200 flex flex-col p-4">
            {/* Mode Toggle Header */}
            <div className="w-full max-w-screen-3xl mx-auto mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAppMode('image')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                            appMode === 'image'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        <ImageModeIcon className="w-5 h-5" />
                        이미지 생성
                    </button>
                    <button
                        onClick={() => currentScenario ? setAppMode('scenario') : setIsScenarioModalOpen(true)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                            appMode === 'scenario'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        <FilmIcon className="w-5 h-5" />
                        시나리오 모드
                    </button>
                </div>
                {appMode === 'image' && (
                    <button
                        onClick={() => setIsScenarioModalOpen(true)}
                        disabled={isGeneratingScenario}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50"
                    >
                        <SparklesIcon className="w-5 h-5" />
                        새 시나리오 생성
                    </button>
                )}
            </div>

            <main className="w-full max-w-screen-3xl mx-auto flex-grow grid grid-cols-1 lg:grid-cols-10 gap-4 min-h-0">
                {/* Scenario Mode View */}
                {appMode === 'scenario' && currentScenario ? (
                    <>
                        {/* Left Panel - Character Library (narrower in scenario mode) */}
                        <section className="w-full lg:col-span-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700 flex flex-col gap-4 overflow-y-auto">
                            <div>
                                <h3 className="text-lg font-bold text-purple-300 mb-2">캐릭터 라이브러리</h3>
                                <p className="text-xs text-gray-500 mb-3">시나리오의 등장인물 이미지를 등록하세요. 이미지 생성 시 참조됩니다.</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {characterLibrary.map((char, i) => {
                                        const fileInputId = `scenario-library-upload-${i}`;
                                        return (
                                            <div key={i} className="flex flex-col gap-2">
                                                <div className="relative aspect-video w-full bg-gray-800 border-2 border-dashed border-gray-600 rounded-xl flex items-center justify-center group">
                                                    <input
                                                        type="file"
                                                        id={fileInputId}
                                                        accept="image/*"
                                                        onChange={(e) => handleLibraryFileUpload(e, i)}
                                                        className="hidden"
                                                    />
                                                    {char ? (
                                                        <>
                                                            <img
                                                                src={`data:${char.image.mimeType};base64,${char.image.data}`}
                                                                alt={char.name}
                                                                className="object-cover w-full h-full rounded-lg"
                                                            />
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => handleActivateCharacter(i)}
                                                                    className="p-2 bg-indigo-600 rounded-full text-white hover:bg-indigo-700"
                                                                    title="활성화"
                                                                >
                                                                    <PlusCircleIcon className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteLibraryImage(i)}
                                                                    className="p-2 bg-red-600 rounded-full text-white hover:bg-red-700"
                                                                    title="삭제"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <label htmlFor={fileInputId} className="cursor-pointer text-center text-gray-500 hover:text-purple-400">
                                                            <div className="text-2xl mx-auto">+</div>
                                                            <p className="text-xs">업로드</p>
                                                        </label>
                                                    )}
                                                </div>
                                                {char && <span className="text-xs text-gray-400 truncate text-center">{char.name}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-purple-300 mb-2">활성화된 캐릭터</h3>
                                <div className="flex flex-wrap gap-2">
                                    {activeCharacters.filter(c => c !== null).length === 0 ? (
                                        <p className="text-xs text-gray-500">라이브러리에서 캐릭터를 활성화하세요</p>
                                    ) : (
                                        activeCharacters.map((char, i) => char && (
                                            <div key={i} className="relative">
                                                <img
                                                    src={`data:${char.image.mimeType};base64,${char.image.data}`}
                                                    alt={char.name}
                                                    className="w-12 h-12 object-cover rounded-lg border-2 border-purple-500"
                                                />
                                                <button
                                                    onClick={() => handleDeactivateCharacter(i)}
                                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center"
                                                >
                                                    x
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="mt-auto">
                                <h3 className="text-sm font-bold text-purple-300 mb-2">이미지 비율</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setAspectRatio('16:9')} className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-colors ${aspectRatio === '16:9' ? 'bg-purple-600 ring-2 ring-purple-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                        <AspectRatioHorizontalIcon className="w-5 h-5"/>
                                        <span className="text-sm">16:9</span>
                                    </button>
                                    <button onClick={() => setAspectRatio('9:16')} className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-colors ${aspectRatio === '9:16' ? 'bg-purple-600 ring-2 ring-purple-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                        <AspectRatioVerticalIcon className="w-5 h-5"/>
                                        <span className="text-sm">9:16</span>
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Scenario Editor (takes most of the space) */}
                        <section className="w-full lg:col-span-7 flex flex-col min-h-0">
                            <ScenarioEditor
                                scenario={currentScenario}
                                onUpdateScenario={setCurrentScenario}
                                onRegenerateScene={handleRegenerateScene}
                                onGenerateSceneImage={handleGenerateSceneImage}
                                onGenerateAllImages={handleGenerateAllSceneImages}
                                onSaveScenario={handleSaveScenario}
                                onLoadScenario={handleLoadScenario}
                                onClose={handleCloseScenarioEditor}
                                regeneratingSceneId={regeneratingSceneId}
                                generatingImageSceneId={generatingImageSceneId}
                                isGeneratingAllImages={isGeneratingAllImages}
                            />
                        </section>
                    </>
                ) : (
                /* Image Mode View (Original Layout) */
                <>
                <section className="w-full lg:col-span-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700 flex flex-col gap-4 overflow-y-auto">
                     
                    <div>
                        <h3 className="text-lg font-bold text-indigo-300 mb-2">Step 0: 이미지 비율 선택</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setAspectRatio('16:9')} disabled={isBusy} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg transition-colors ${aspectRatio === '16:9' ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>
                                <AspectRatioHorizontalIcon className="w-8 h-8"/>
                                <span className="font-semibold">16:9 (가로형)</span>
                            </button>
                            <button onClick={() => setAspectRatio('9:16')} disabled={isBusy} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg transition-colors ${aspectRatio === '9:16' ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>
                                <AspectRatioVerticalIcon className="w-8 h-8"/>
                                <span className="font-semibold">9:16 (세로형)</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold text-indigo-300">Step 1: 캐릭터 라이브러리</h3>
                             <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsCharacterModalOpen(true)}
                                    disabled={isBusy}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-900/50 rounded-full hover:bg-indigo-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <IdIcon className="w-4 h-4" />
                                    <span>등장인물 생성</span>
                                </button>
                             </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                             {characterLibrary.map((char, i) => {
                                 const fileInputId = `library-upload-${i}`;
                                 return (
                                     <div key={i} className="flex flex-col gap-2">
                                         <div className="relative aspect-video w-full bg-gray-800 border-2 border-dashed border-gray-600 rounded-xl flex items-center justify-center group">
                                             <input
                                                 type="file"
                                                 id={fileInputId}
                                                 accept="image/*"
                                                 onChange={(e) => handleLibraryFileUpload(e, i)}
                                                 className="hidden"
                                                 disabled={isBusy}
                                             />
                                             {char ? (
                                                 <>
                                                     <img 
                                                         src={`data:${char.image.mimeType};base64,${char.image.data}`} 
                                                         alt={char.name}
                                                         className="object-cover w-full h-full rounded-lg"
                                                     />
                                                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                         <button
                                                             onClick={(e) => { e.stopPropagation(); setModalItem({type: 'image', id: `lib-${i}`, prompt: 'Library image', image: char.image, aspectRatio: '16:9'}); }}
                                                             className="p-2 bg-gray-700 rounded-full text-white hover:bg-indigo-600"
                                                             aria-label="Zoom in"
                                                             title="확대"
                                                         >
                                                             <MagnifyingGlassPlusIcon className="w-4 h-4" />
                                                         </button>
                                                          <button
                                                            onClick={(e) => { e.stopPropagation(); handleOpenSheetModal(char); }}
                                                            className="p-2 bg-gray-700 rounded-full text-white hover:bg-indigo-600"
                                                            aria-label="Edit character sheet"
                                                            title="정보 수정"
                                                        >
                                                            <PencilIcon className="w-4 h-4" />
                                                        </button>
                                                         <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteLibraryImage(i); }}
                                                            className="p-2 bg-red-800 rounded-full text-white hover:bg-red-600"
                                                            aria-label="Delete image"
                                                            title="삭제"
                                                            disabled={isBusy}
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                     </div>
                                                 </>
                                             ) : (
                                                 <label htmlFor={fileInputId} className={`cursor-pointer text-center text-gray-500 hover:text-indigo-400 ${isBusy ? 'cursor-not-allowed opacity-50' : ''}`}>
                                                     <div className="text-2xl sm:text-4xl mx-auto">📤</div>
                                                     <p className="mt-1 text-xs">클릭하여 업로드</p>
                                                 </label>
                                             )}
                                         </div>
                                         {char && (
                                            <div className='flex items-center gap-1'>
                                               <span className='text-xs text-gray-400 truncate flex-grow text-center'>{char.name}</span>
                                               <button
                                                  onClick={() => handleActivateCharacter(i)}
                                                  className="flex-shrink-0 flex items-center justify-center gap-1 p-1 text-xs font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                                  disabled={isBusy}
                                                  title='활성화'
                                              >
                                                  <PlusCircleIcon className="w-4 h-4" />
                                              </button>
                                            </div>
                                         )}
                                     </div>
                                 );
                             })}
                        </div>
                         <p className="text-xs text-gray-500 mt-2 text-center">라이브러리 캐릭터의 '+' 버튼을 눌러 아래 슬롯에 등록하세요.</p>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-indigo-300 mb-2">Step 2: 캐릭터 참조 이미지 (활성화됨)</h3>
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {activeCharacters.map((char, i) => (
                                <div key={i} className="relative aspect-video w-full bg-gray-800 border-2 border-dashed border-gray-600 rounded-xl flex items-center justify-center group">
                                    {char ? (
                                        <>
                                            <img 
                                                src={`data:${char.image.mimeType};base64,${char.image.data}`} 
                                                alt={`Active character ${i+1}`}
                                                className="object-cover w-full h-full rounded-lg cursor-pointer"
                                                onClick={() => setModalItem({ type: 'image', id: `active-${i}`, prompt: char.name, image: char.image, aspectRatio: '16:9' })}
                                            />
                                            <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-center">
                                                <p className="text-white text-xs truncate font-bold">{char.name}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDeactivateCharacter(i)}
                                                disabled={isBusy}
                                                className="absolute top-1 right-1 p-1.5 bg-black bg-opacity-60 rounded-full text-white hover:bg-opacity-80 transition-opacity"
                                                aria-label={`Deactivate character ${i + 1}`}
                                            >
                                                <span className='text-xs'>❌</span>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="text-center text-xs text-gray-500">
                                            활성화된<br/>캐릭터
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-lg font-bold text-indigo-300 mb-2">Step 3: Cinematic Look</h3>
                        <div className="p-3 bg-gray-900/50 rounded-md space-y-4">
                            {Object.entries(cinematicLooksData).map(([category, looks]) => (
                                <div key={category}>
                                    <h4 className="text-sm font-semibold text-gray-400 mb-2">{category}</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {looks.map(look => (
                                            <button
                                                key={look.title}
                                                title={look.description}
                                                onClick={() => handleToggleFilter(look.title)}
                                                disabled={isBusy || (activeFilters.length >= 3 && !activeFilters.some(f => f.title === look.title))}
                                                className={`px-2 py-1 text-xs rounded-md transition-all ${
                                                    activeFilters.some(f => f.title === look.title)
                                                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                                                        : 'bg-gray-700 hover:bg-gray-600'
                                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                            >
                                                {look.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {activeFilters.length > 0 && (
                                <div className="border-t border-gray-700 pt-3 space-y-3">
                                    <h4 className="text-sm font-semibold text-gray-400">활성화된 필터 (최대 3개)</h4>
                                    {activeFilters.map(filter => (
                                        <div key={filter.title} className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-indigo-300 flex-shrink-0 w-28 truncate" title={filter.title}>{filter.title}</span>
                                            <input
                                                type="range"
                                                min="10"
                                                max="100"
                                                step="10"
                                                value={filter.intensity}
                                                onChange={(e) => handleIntensityChange(filter.title, parseInt(e.target.value, 10))}
                                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                disabled={isBusy}
                                            />
                                            <span className="text-xs text-gray-400 w-8 text-right">{filter.intensity}%</span>
                                            <button onClick={() => handleRemoveFilter(filter.title)} disabled={isBusy} className="text-gray-500 hover:text-red-400">
                                                <ClearIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>


                    <div className="flex flex-col gap-4 mt-auto">
                        <div>
                            <h3 className="text-lg font-bold text-indigo-300 mb-2">Step 4: 이미지 생성 설정</h3>
                             <div className="p-3 bg-gray-900/50 rounded-md space-y-3">
                                <div>
                                    <label htmlFor="scene-description" className="text-sm font-medium text-gray-300 mb-1 block">장면 설명:</label>
                                    <textarea
                                        id="scene-description"
                                        value={sceneDescription}
                                        onChange={(e) => setSceneDescription(e.target.value)}
                                        placeholder="캐릭터들이 오래된 도서관에서 서로를 마주보며 미소 짓는다 (영어로)"
                                        className="w-full min-h-[80px] p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:opacity-50 text-sm"
                                        disabled={isBusy}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="prompt-camera" className="text-sm font-medium text-gray-300 mb-1 block">카메라/구도:</label>
                                        <select
                                            id="prompt-camera"
                                            value={promptCamera}
                                            onChange={(e) => setPromptCamera(e.target.value)}
                                            disabled={isBusy}
                                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors text-sm"
                                        >
                                            <option value="Default">기본</option>
                                            <option value="Close-up shot">클로즈업 샷</option>
                                            <option value="Medium shot">미디엄 샷</option>
                                            <option value="Full shot">풀 샷</option>
                                            <option value="Low angle shot">로우앵글 샷</option>
                                            <option value="High angle shot">하이앵글 샷</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-300 mb-1 block">생성 개수:</label>
                                        <div className="flex gap-1.5 h-[38px] items-center">
                                            {([1, 2, 3, 4, 5] as const).map(num => (
                                                <button key={num} onClick={() => setNumberOfImages(num)} disabled={isBusy} className={`w-full h-full text-xs rounded-md transition-colors flex items-center justify-center gap-1 ${numberOfImages === num ? 'bg-indigo-600 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                         <button
                            onClick={handleGenerate}
                            disabled={!canGenerate}
                            className="w-full p-3 text-base font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-500 hover:to-purple-500 transition-all disabled:from-gray-600 disabled:to-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? '생성 중...' : '이미지 생성'}
                        </button>
                    </div>
                </section>

                <section className="w-full lg:col-span-3 flex flex-col min-h-0">
                   <ResultDisplay
                        isLoading={isLoading}
                        error={error}
                        items={generatedItems}
                        onItemClick={setModalItem}
                        onRegenerateClick={handleOpenRegenModal}
                        regeneratingImageId={regeneratingImageId}
                        onItemDragStart={(e, itemId) => handleItemDragStart(e, { itemId, source: { type: 'results', id: 'results' } })}
                        onDrop={(e, targetId) => handleDrop({ type: 'results', id: 'results' }, e, targetId)}
                        onDeleteItem={handleDeleteGeneratedItem}
                        isCharacterSelectionMode={isCharacterSelectionMode}
                        selectedItemIds={selectedItemIds}
                        onToggleCharacterSelection={toggleCharacterSelectionMode}
                        onItemSelection={handleItemSelection}
                        onConfirmSelection={confirmCharacterSelection}
                    />
                </section>
                
                <section className="w-full lg:col-span-4 flex flex-col min-h-0">
                    <ChapterDisplay
                        chapters={chapters}
                        onAddChapter={handleAddChapter}
                        onDeleteChapter={handleDeleteChapter}
                        onRenameChapter={handleRenameChapter}
                        onItemClick={setModalItem}
                        onRegenerateClick={handleOpenRegenModal}
                        regeneratingImageId={regeneratingImageId}
                        onItemDragStart={handleItemDragStart}
                        onDrop={handleDrop}
                        onRemoveItemFromChapter={handleRemoveItemFromChapter}
                    />
                </section>
                </>
                )}
            </main>

            {/* Global Modals */}
            {modalItem && <ItemModal item={modalItem} onClose={() => setModalItem(null)} />}
            {confirmationConfig && (
                <ConfirmationModal
                    config={confirmationConfig}
                    onClose={() => setConfirmationConfig(null)}
                />
            )}
            <RegenerationModal
                isOpen={regenModalState.isOpen}
                onClose={handleCloseRegenModal}
                prompt={regenModalState.prompt}
                onPromptChange={(p) => setRegenModalState(s => ({...s, prompt: p}))}
                onSubmit={handleEditImage}
                isLoading={regeneratingImageId !== null}
            />
            <CharacterCreationModal
                isOpen={isCharacterModalOpen}
                onClose={() => setIsCharacterModalOpen(false)}
                onSubmit={handleCreateCharacter}
                isLoading={isCreatingCharacter}
            />
            {sheetModalState.isOpen && sheetModalState.character && (
                <CharacterSheetModal
                    character={sheetModalState.character}
                    onSave={handleSaveCharacterSheet}
                    onClose={() => setSheetModalState({ isOpen: false, character: null })}
                />
            )}
            <ScenarioGenerator
                isOpen={isScenarioModalOpen}
                onClose={() => setIsScenarioModalOpen(false)}
                onGenerate={handleGenerateScenario}
                isLoading={isGeneratingScenario}
            />
        </div>
    );
};

export default App;