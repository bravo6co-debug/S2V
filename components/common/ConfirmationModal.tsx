import React, { useEffect } from 'react';
import { TrashIcon } from '../Icons';

interface ConfirmationModalProps {
  config: { title: string; message: string; onConfirm: () => void };
  onClose: () => void;
}

/**
 * 삭제/위험 액션 확인 모달 — ESC로 닫기 지원
 */
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ config, onClose }) => {
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
