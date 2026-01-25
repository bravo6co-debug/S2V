
import React from 'react';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

export const ActionButton: React.FC<ActionButtonProps> = ({ children, ...props }) => {
    return (
        <button
            {...props}
            className="w-full text-left p-3 text-sm font-medium text-gray-200 bg-gray-700 rounded-lg hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 transition-colors disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {children}
        </button>
    );
};
