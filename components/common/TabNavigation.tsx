import React from 'react';
import { AppMode } from '../../types';

interface TabConfig {
  mode: AppMode;
  label: string;
  icon: React.ReactNode;
  activeColor: string;
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

const TABS: TabConfig[] = [
  {
    mode: 'scenario',
    label: '시나리오',
    icon: <ScenarioIcon className="w-5 h-5" />,
    activeColor: 'from-purple-600 to-indigo-600',
  },
  {
    mode: 'ad',
    label: '광고',
    icon: <AdIcon className="w-5 h-5" />,
    activeColor: 'from-orange-500 to-red-600',
  },
  {
    mode: 'video',
    label: '영상 제작',
    icon: <VideoIcon className="w-5 h-5" />,
    activeColor: 'from-pink-600 to-purple-600',
  },
];

export const TabNavigation: React.FC<TabNavigationProps> = ({
  currentTab,
  onTabChange,
  disabled = false,
}) => {
  return (
    <nav className="flex items-center gap-1 p-1 bg-gray-800/50 rounded-xl">
      {TABS.map((tab) => {
        const isActive = currentTab === tab.mode;

        return (
          <button
            key={tab.mode}
            onClick={() => onTabChange(tab.mode)}
            disabled={disabled}
            className={`
              relative flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg font-medium
              transition-all duration-200 ease-in-out
              ${isActive
                ? `bg-gradient-to-r ${tab.activeColor} text-white shadow-lg`
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.icon}
            <span className="text-sm">{tab.label}</span>

            {/* Active indicator dot */}
            {isActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-lg" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

// Compact version for smaller screens
export const TabNavigationCompact: React.FC<TabNavigationProps> = ({
  currentTab,
  onTabChange,
  disabled = false,
}) => {
  return (
    <nav className="flex items-center gap-0.5 p-0.5 bg-gray-800/50 rounded-lg">
      {TABS.map((tab) => {
        const isActive = currentTab === tab.mode;

        return (
          <button
            key={tab.mode}
            onClick={() => onTabChange(tab.mode)}
            disabled={disabled}
            title={tab.label}
            className={`
              relative flex items-center justify-center min-h-[44px] min-w-[44px] p-2 rounded-md
              transition-all duration-200 ease-in-out
              ${isActive
                ? `bg-gradient-to-r ${tab.activeColor} text-white`
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.label}
          >
            {tab.icon}
          </button>
        );
      })}
    </nav>
  );
};

export default TabNavigation;
