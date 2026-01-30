import React, { useState, useEffect } from 'react';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TabNavigation, TabNavigationCompact } from './components/common/TabNavigation';
import { ScenarioTab } from './components/scenario/ScenarioTab';
import { VideoTab } from './components/video/VideoTab';
import AdTab from './components/ad/AdTab';
import { GeneratedItem, ImageData, Chapter, DragItem, Character, Scenario, ScenarioConfig, Scene, AppMode, IMAGE_STYLE_OPTIONS, ImageStyle } from './types';
import { generateImages, generateCharacterPortraits, editImage, extractCharacterData, generateScenario, regenerateScene, generateSceneImage } from './services/geminiService';
import { ResultDisplay } from './components/ResultDisplay';
import { IdIcon, LayersIcon, SparklesIcon, MagnifyingGlassPlusIcon, PlusCircleIcon, CheckCircleIcon, TrashIcon, ClearIcon, PencilIcon, AspectRatioHorizontalIcon, AspectRatioVerticalIcon } from './components/Icons';
import { ChapterDisplay } from './components/ChapterDisplay';
import { ScenarioGenerator } from './components/ScenarioGenerator';
import { ScenarioEditor } from './components/ScenarioEditor';
import LoginModal from './components/LoginModal';
import SettingsModal from './components/SettingsModal';
import ApiKeyRequiredModal from './components/ApiKeyRequiredModal';
import AdminDashboard from './components/AdminDashboard';
import WelcomeModal from './components/WelcomeModal';
import FloatingHelpButton from './components/FloatingHelpButton';

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

// 프로젝트 설정 드롭다운
const ProjectSettingsDropdown: React.FC = () => {
    const { imageStyle, setImageStyle, aspectRatio, setAspectRatio } = useProject();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const currentStyle = IMAGE_STYLE_OPTIONS.find(s => s.value === imageStyle);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg text-sm text-gray-300 transition-colors"
                title="프로젝트 설정"
            >
                <span className="text-base">{currentStyle?.emoji}</span>
                <span className="hidden sm:inline">{currentStyle?.label}</span>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 p-3">
                    <div className="mb-2">
                        <p className="text-xs font-medium text-gray-400 mb-2">이미지 스타일</p>
                        <div className="grid grid-cols-2 gap-1.5">
                            {IMAGE_STYLE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        setImageStyle(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
                                        imageStyle === option.value
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                                >
                                    <span>{option.emoji}</span>
                                    <span>{option.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="pt-2 border-t border-gray-700">
                        <p className="text-xs font-medium text-gray-400 mb-2">화면 비율</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setAspectRatio('16:9')}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
                                    aspectRatio === '16:9'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                <AspectRatioHorizontalIcon className="w-4 h-4" />
                                <span>16:9</span>
                            </button>
                            <button
                                onClick={() => setAspectRatio('9:16')}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
                                    aspectRatio === '9:16'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                <AspectRatioVerticalIcon className="w-4 h-4" />
                                <span>9:16</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// 인증 버튼 컴포넌트
const AuthButton: React.FC = () => {
    const { isAuthenticated, user, logout, openLoginModal, openSettingsModal, hasApiKey, isAdmin } = useAuth();
    const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);

    if (isAuthenticated) {
        return (
            <>
                <div className="flex items-center gap-2">
                    {/* 사용자 이메일 표시 */}
                    <span className="hidden md:inline text-xs text-gray-400 truncate max-w-[120px]" title={user?.email}>
                        {user?.email}
                    </span>
                    {/* 어드민 배지 및 관리 버튼 */}
                    {isAdmin && (
                        <button
                            onClick={() => setIsAdminDashboardOpen(true)}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-600/30 hover:bg-purple-600/50 rounded text-xs text-purple-300 transition-colors"
                            title="사용자 관리"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                            </svg>
                            <span>관리자</span>
                        </button>
                    )}
                    {/* API 키 상태 표시 (어드민은 서버 API 키 사용하므로 표시하지 않음) */}
                    {!hasApiKey && !isAdmin && (
                        <button
                            onClick={openSettingsModal}
                            className="flex items-center gap-1 px-2 py-1 bg-yellow-600/30 hover:bg-yellow-600/50 rounded text-xs text-yellow-400 transition-colors"
                            title="API 키를 설정해 주세요"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>API 키 필요</span>
                        </button>
                    )}
                    <button
                        onClick={openSettingsModal}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg text-sm text-gray-300 transition-colors"
                        title="AI 모델 설정"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="hidden sm:inline">설정</span>
                    </button>
                    <button
                        onClick={logout}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-800/50 hover:bg-red-600/50 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
                        title="로그아웃"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
                {/* 관리자 대시보드 모달 */}
                <AdminDashboard
                    isOpen={isAdminDashboardOpen}
                    onClose={() => setIsAdminDashboardOpen(false)}
                />
            </>
        );
    }

    return (
        <button
            onClick={openLoginModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/80 hover:bg-blue-500 rounded-lg text-sm text-white transition-colors"
            title="로그인 / 회원가입"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="hidden sm:inline">로그인</span>
        </button>
    );
};

// 글로벌 모달 컴포넌트 (AuthContext 상태 사용)
const GlobalModals: React.FC = () => {
    const {
        isLoginModalOpen,
        closeLoginModal,
        isSettingsModalOpen,
        closeSettingsModal
    } = useAuth();

    return (
        <>
            <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
            <SettingsModal isOpen={isSettingsModalOpen} onClose={closeSettingsModal} />
        </>
    );
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

    // 첫 방문 환영 모달 상태
    const [showWelcome, setShowWelcome] = useState(() => {
        if (typeof window === 'undefined') return false;
        return !localStorage.getItem('s2v_has_seen_welcome');
    });

    // 탭별 콘텐츠 렌더링
    const renderTabContent = () => {
        switch (currentTab) {
            case 'scenario':
                return <ScenarioTab />;
            case 'ad':
                return <AdTab />;
            case 'video':
                return <VideoTab />;
            default:
                return <ScenarioTab />;
        }
    };

    return (
        <div className="h-screen bg-gray-900 text-gray-200 flex flex-col">
            {/* 헤더: 탭 네비게이션 + 설정 */}
            <header className="flex items-center justify-between px-2 sm:px-4 py-2 border-b border-gray-800">
                {/* 모바일에서는 Compact, 데스크탑에서는 Full 네비게이션 */}
                <div className="sm:hidden">
                    <TabNavigationCompact currentTab={currentTab} onTabChange={setCurrentTab} />
                </div>
                <div className="hidden sm:block">
                    <TabNavigation currentTab={currentTab} onTabChange={setCurrentTab} />
                </div>
                <div className="flex items-center gap-2">
                    <ProjectSettingsDropdown />
                    <AuthButton />
                </div>
            </header>

            {/* 메인 콘텐츠 영역 */}
            <main className="flex-grow overflow-hidden p-2 sm:p-4">
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

            {/* 인증 관련 글로벌 모달 */}
            <GlobalModals />

            {/* 첫 방문 환영 모달 */}
            {showWelcome && (
                <WelcomeModal
                    onClose={() => {
                        localStorage.setItem('s2v_has_seen_welcome', 'true');
                        setShowWelcome(false);
                    }}
                />
            )}

            {/* 플로팅 도움말 버튼 */}
            <FloatingHelpButton />
        </div>
    );
};

// 앱 루트 - AuthProvider + ProjectProvider로 래핑
const App: React.FC = () => {
    return (
        <AuthProvider>
            <ProjectProvider>
                <AppContent />
            </ProjectProvider>
        </AuthProvider>
    );
};

export default App;
