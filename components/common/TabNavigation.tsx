import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { AppMode } from '../../types';

const ManualModal = lazy(() => import('../ManualModal').then(m => ({ default: m.ManualModal })));

interface TabConfig {
  mode: AppMode;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  activeColor: string;
  activeBg: string;
}

interface TabNavigationProps {
  currentTab: AppMode;
  onTabChange: (tab: AppMode) => void;
  disabled?: boolean;
}

// Icons
const ScenarioIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
  </svg>
);

const VideoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const AdIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
  </svg>
);

const FoodVideoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 8h1a4 4 0 010 8h-1" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </svg>
);

const LongformIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 13l4-2-4-2v4z" />
  </svg>
);

const ClipIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 3v18M17 3v18M2 9h20M2 15h20" />
  </svg>
);

const YouTubeSearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9l4 2.5-4 2.5V9z" fill="currentColor" stroke="none" />
  </svg>
);

// 탭 순서: 시나리오 → 영상제작 → 롱폼 → 음식영상 → 광고 → 클립
const TABS: TabConfig[] = [
  {
    mode: 'scenario',
    label: '시나리오',
    shortLabel: '시나리오',
    icon: <ScenarioIcon className="w-4 h-4" />,
    activeColor: 'text-purple-300',
    activeBg: 'bg-purple-500/20 border-purple-500/50',
  },
  {
    mode: 'video',
    label: '영상 제작',
    shortLabel: '영상',
    icon: <VideoIcon className="w-4 h-4" />,
    activeColor: 'text-pink-300',
    activeBg: 'bg-pink-500/20 border-pink-500/50',
  },
  {
    mode: 'longform',
    label: '롱폼',
    shortLabel: '롱폼',
    icon: <LongformIcon className="w-4 h-4" />,
    activeColor: 'text-teal-300',
    activeBg: 'bg-teal-500/20 border-teal-500/50',
  },
  {
    mode: 'foodvideo',
    label: '음식 영상',
    shortLabel: '음식',
    icon: <FoodVideoIcon className="w-4 h-4" />,
    activeColor: 'text-amber-300',
    activeBg: 'bg-amber-500/20 border-amber-500/50',
  },
  {
    mode: 'ad',
    label: '광고',
    shortLabel: '광고',
    icon: <AdIcon className="w-4 h-4" />,
    activeColor: 'text-orange-300',
    activeBg: 'bg-orange-500/20 border-orange-500/50',
  },
  {
    mode: 'clip',
    label: '클립',
    shortLabel: '클립',
    icon: <ClipIcon className="w-4 h-4" />,
    activeColor: 'text-cyan-300',
    activeBg: 'bg-cyan-500/20 border-cyan-500/50',
  },
];

const YOUTUBE_SEARCH_URL = 'https://youtube-search-tau-wine.vercel.app/';
const PAD_URL = 'https://pad.onsajang.life/';

const PadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const MoreIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

// ─── 데스크탑: 아이콘 + 풀 라벨 + YT검색 ─────────────────
export const TabNavigation: React.FC<TabNavigationProps> = ({
  currentTab,
  onTabChange,
  disabled = false,
}) => {
  return (
    <nav className="flex items-center gap-1 p-1 bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/40">
      {TABS.map((tab) => {
        const isActive = currentTab === tab.mode;
        return (
          <button
            key={tab.mode}
            onClick={() => onTabChange(tab.mode)}
            disabled={disabled}
            className={`
              relative flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium
              transition-all duration-200 ease-out
              ${isActive
                ? `${tab.activeBg} ${tab.activeColor} border shadow-sm`
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 border border-transparent'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.icon}
            <span className="text-sm whitespace-nowrap">{tab.label}</span>
          </button>
        );
      })}

      {/* 구분선 */}
      <div className="w-px h-5 bg-gray-700/60 mx-1" />

      {/* 외부 링크 */}
      <a
        href={YOUTUBE_SEARCH_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent transition-all duration-200 ease-out"
        title="YouTube 채널검색"
      >
        <YouTubeSearchIcon className="w-4 h-4" />
        <span className="text-sm whitespace-nowrap">YT검색</span>
      </a>
      <a
        href={PAD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent transition-all duration-200 ease-out"
        title="상세페이지 협업"
      >
        <PadIcon className="w-4 h-4" />
        <span className="text-sm whitespace-nowrap">상페자동화</span>
      </a>
    </nav>
  );
};

// ─── 모바일 하단 고정 네비 ────────────────────────────
export const MobileBottomNav: React.FC<TabNavigationProps> = ({
  currentTab,
  onTabChange,
  disabled = false,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md border-t border-gray-700/60 pb-[env(safe-area-inset-bottom)] sm:hidden">
      <div className="flex items-stretch justify-around px-1 py-1">
        {TABS.map((tab) => {
          const isActive = currentTab === tab.mode;
          return (
            <button
              key={tab.mode}
              onClick={() => onTabChange(tab.mode)}
              disabled={disabled}
              className={`
                flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg
                transition-all duration-150 ease-out min-w-0
                ${isActive
                  ? `${tab.activeColor}`
                  : 'text-gray-500'
                }
                disabled:opacity-50
              `}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
            >
              <span className={`transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
                {tab.icon}
              </span>
              <span className={`text-[10px] leading-tight font-medium truncate ${isActive ? '' : 'opacity-70'}`}>
                {tab.shortLabel}
              </span>
              {isActive && (
                <span className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-0.5 bg-current rounded-full" />
              )}
            </button>
          );
        })}

        {/* 더보기 */}
        <div ref={moreRef} className="relative flex-1 min-w-0">
          <button
            onClick={() => setMoreOpen(prev => !prev)}
            className={`
              flex flex-col items-center justify-center gap-0.5 w-full py-1.5 rounded-lg
              transition-all duration-150 ease-out
              ${moreOpen ? 'text-gray-200' : 'text-gray-500'}
            `}
            aria-label="더보기"
          >
            <MoreIcon className="w-4 h-4" />
            <span className="text-[10px] leading-tight font-medium opacity-70">더보기</span>
          </button>

          {moreOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-44 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
              <a
                href={YOUTUBE_SEARCH_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2.5 px-4 py-3 text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <YouTubeSearchIcon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">YT 채널검색</span>
              </a>
              <div className="h-px bg-gray-700/60" />
              <a
                href={PAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2.5 px-4 py-3 text-gray-300 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
              >
                <PadIcon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">상페자동화</span>
              </a>
              <div className="h-px bg-gray-700/60" />
              <button
                onClick={() => { setIsManualOpen(true); setMoreOpen(false); }}
                className="flex items-center gap-2.5 px-4 py-3 w-full text-gray-300 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">사용설명서</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 사용설명서 모달 */}
      {isManualOpen && (
        <Suspense fallback={null}>
          <ManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
        </Suspense>
      )}
    </nav>
  );
};

// ─── 하위호환 (사용 안 함, App.tsx에서 제거 예정) ──────────
export const TabNavigationCompact: React.FC<TabNavigationProps> = MobileBottomNav;

export default TabNavigation;
