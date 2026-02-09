import React, { useState } from 'react';
import { ManualModal } from './ManualModal';

export const FloatingHelpButton: React.FC = () => {
    const [isManualOpen, setIsManualOpen] = useState(false);

    return (
        <>
            {/* Floating Help Button */}
            <button
                onClick={() => setIsManualOpen(true)}
                className="fixed bottom-6 right-6 z-[55] w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hidden sm:flex items-center justify-center group"
                title="도움말"
                aria-label="도움말 열기"
            >
                <svg
                    className="w-6 h-6 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            </button>

            {/* Manual Modal */}
            <ManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
        </>
    );
};

export default FloatingHelpButton;
