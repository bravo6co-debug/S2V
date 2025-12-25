import React, { useState, useEffect } from 'react';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { TabNavigation } from './components/common/TabNavigation';
import { AssetTab } from './components/character/AssetTab';
import { ScenarioTab } from './components/scenario/ScenarioTab';
import { VideoTab } from './components/video/VideoTab';
import { GeneratedItem, ImageData, Chapter, DragItem, Character, Scenario, ScenarioConfig, Scene, AppMode } from './types';
import { generateImages, generateCharacterPortraits, editImage, extractCharacterData, generateScenario, regenerateScene, generateSceneImage } from './services/geminiService';
import { ResultDisplay } from './components/ResultDisplay';
import { IdIcon, LayersIcon, SparklesIcon, MagnifyingGlassPlusIcon, PlusCircleIcon, CheckCircleIcon, TrashIcon, ClearIcon, PencilIcon, AspectRatioHorizontalIcon, AspectRatioVerticalIcon } from './components/Icons';
import { ChapterDisplay } from './components/ChapterDisplay';
import { ScenarioGenerator } from './components/ScenarioGenerator';
import { ScenarioEditor } from './components/ScenarioEditor';

// 줌/확대 이미지 모달
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
                    <ClearIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

// 확인 모달
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

// 에러 메시지 변환
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
    if (message.includes('Scenario generation failed')) {
        return '오류: 시나리오 생성에 실패했습니다. 주제를 더 구체적으로 작성하거나, 잠시 후 다시 시도해 주세요.';
    }
    return message;
};

// 메인 앱 콘텐츠 (ProjectContext 사용)
const AppContent: React.FC = () => {
    const { currentTab, setCurrentTab } = useProject();
    const [modalItem, setModalItem] = useState<GeneratedItem | null>(null);
    const [confirmationConfig, setConfirmationConfig] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    // 탭별 콘텐츠 렌더링
    const renderTabContent = () => {
        switch (currentTab) {
            case 'assets':
                return <AssetTab />;
            case 'scenario':
                return <ScenarioTab />;
            case 'video':
                return <VideoTab />;
            default:
                return <AssetTab />;
        }
    };

    return (
        <div className="h-screen bg-gray-900 text-gray-200 flex flex-col">
            {/* 탭 네비게이션 */}
            <TabNavigation currentTab={currentTab} onTabChange={setCurrentTab} />

            {/* 메인 콘텐츠 영역 */}
            <main className="flex-grow overflow-hidden p-4">
                <div className="h-full w-full max-w-screen-2xl mx-auto">
                    {renderTabContent()}
                </div>
            </main>

            {/* 글로벌 모달 */}
            {modalItem && <ItemModal item={modalItem} onClose={() => setModalItem(null)} />}
            {confirmationConfig && (
                <ConfirmationModal
                    config={confirmationConfig}
                    onClose={() => setConfirmationConfig(null)}
                />
            )}
        </div>
    );
};

// 앱 루트 - ProjectProvider로 래핑
const App: React.FC = () => {
    return (
        <ProjectProvider>
            <AppContent />
        </ProjectProvider>
    );
};

export default App;
