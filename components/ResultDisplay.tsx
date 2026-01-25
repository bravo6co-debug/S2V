
import React, { useState } from 'react';
import JSZip from 'jszip';
import { GeneratedItem, DragItem } from '../types';
import { DownloadIcon, SparklesIcon, IdIcon, CheckCircleIcon, TrashIcon } from './Icons';

interface ResultDisplayProps {
    isLoading: boolean;
    error: string | null;
    items: GeneratedItem[] | null;
    onItemClick: (item: GeneratedItem) => void;
    onRegenerateClick: (id: string) => void;
    regeneratingImageId: string | null;
    onItemDragStart: (e: React.DragEvent, itemId: string) => void;
    onDrop: (e: React.DragEvent, targetId: string | null) => void;
    onDeleteItem: (id: string) => void;
    // Character Selection Props
    isCharacterSelectionMode: boolean;
    selectedItemIds: Set<string>;
    onToggleCharacterSelection: () => void;
    onItemSelection: (itemId: string) => void;
    onConfirmSelection: () => void;
}

const LoadingState: React.FC = () => (
    <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center gap-4 text-indigo-400 rounded-xl">
        <svg className="animate-spin h-10 w-10 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg text-center">이미지를 생성 중입니다...</p>
    </div>
);


const ItemCard: React.FC<{
    item: GeneratedItem;
    onItemClick: (item: GeneratedItem) => void;
    onRegenerate: () => void;
    isRegenerating: boolean;
    onDragStart: (e: React.DragEvent) => void;
    isSelectionMode: boolean;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
}> = ({ item, onItemClick, onRegenerate, isRegenerating, onDragStart, isSelectionMode, isSelected, onSelect, onDelete }) => {

    const handleCardClick = () => {
        if (isSelectionMode) {
            onSelect();
        } else {
            onItemClick(item);
        }
    }

    const imageUrl = `data:${item.image.mimeType};base64,${item.image.data}`;

    return (
        <div
            data-item-id={item.id}
            className={`relative group bg-gray-800 rounded-xl border border-gray-700 overflow-hidden transition-all duration-300 ${item.aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'} ${!isSelectionMode ? 'hover:shadow-lg hover:shadow-indigo-900/50 cursor-grab' : 'cursor-pointer'}`}
            draggable={!isSelectionMode}
            onDragStart={onDragStart}
            onDragEnd={(e) => (e.currentTarget.style.opacity = "1")}
            onClick={handleCardClick}
        >
            <img
                src={imageUrl}
                alt={item.prompt}
                className="w-full h-full object-cover"
                draggable={false}
            />
            {isRegenerating && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <svg className="animate-spin h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            )}
            {!isSelectionMode && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-60 rounded-full text-red-400 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        aria-label="Delete item"
                        title="삭제"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-xs text-gray-300 line-clamp-2 font-mono">{item.prompt}</p>
                        <div className="mt-2 flex items-center gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
                                disabled={isRegenerating}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-yellow-300 bg-yellow-900/50 rounded-full hover:bg-yellow-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <SparklesIcon className="w-3 h-3" />
                                <span>이미지 변경</span>
                            </button>
                            <a
                                href={imageUrl}
                                download={`item-${item.id.slice(0, 6)}.png`}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-200 bg-gray-700/50 rounded-full hover:bg-gray-600/70 transition-colors"
                                aria-label="Download item"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <DownloadIcon className="w-3 h-3" />
                                <span>저장</span>
                            </a>
                        </div>
                    </div>
                </>
            )}
            {isSelectionMode && (
                 <div className={`absolute inset-0 transition-all duration-200 ${isSelected ? 'bg-indigo-700/60 ring-4 ring-indigo-400' : 'bg-black/50 hover:bg-black/30'} rounded-xl`}>
                    <div className="absolute top-3 right-3">
                        {isSelected ? (
                            <CheckCircleIcon className="w-8 h-8 text-indigo-300 bg-gray-900 rounded-full" />
                        ) : (
                            <div className="w-8 h-8 border-2 border-gray-400 bg-gray-900/50 rounded-full" />
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ isLoading, error, items, onItemClick, onRegenerateClick, regeneratingImageId, onItemDragStart, onDrop, onDeleteItem, isCharacterSelectionMode, selectedItemIds, onToggleCharacterSelection, onItemSelection, onConfirmSelection }) => {
    const [isZipping, setIsZipping] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    
    const handleDownloadAll = async () => {
        if (!items || items.length === 0 || isZipping) return;

        setIsZipping(true);
        try {
            const zip = new JSZip();
            
            items.forEach((item) => {
                const fileExtension = item.image.mimeType.split('/')[1] || 'png';
                const fileName = `image-${item.id.slice(0, 8)}.${fileExtension}`;
                zip.file(fileName, item.image.data, { base64: true });
            });

            const zipBlob = await zip.generateAsync({ type: 'blob', compression: "DEFLATE", compressionOptions: { level: 9 } });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = 'ai-illustrations.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (err) {
            console.error("압축 파일 생성에 실패했습니다:", err);
        } finally {
            setIsZipping(false);
        }
    };
    
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (isCharacterSelectionMode) return;
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const targetCard = (e.target as HTMLElement).closest(`[data-item-id]`);
        const targetId = targetCard ? targetCard.getAttribute('data-item-id') : null;
        onDrop(e, targetId);
    };

    const hasItems = items && items.length > 0;
    const dropZoneClasses = isDragOver
        ? 'border-indigo-500 bg-indigo-900/20'
        : 'border-gray-700';

    return (
        <div className={`w-full h-full bg-gray-900/50 rounded-xl border p-4 md:p-6 flex flex-col relative transition-colors ${dropZoneClasses}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="text-xl font-bold text-indigo-300 flex items-center gap-2">
                    ✨ 생성된 결과물
                </h3>
                <div className="flex items-center gap-2">
                    {hasItems && !isCharacterSelectionMode && (
                        <button
                            onClick={onToggleCharacterSelection}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-900/50 rounded-lg hover:bg-indigo-800/70 transition-colors"
                        >
                            <IdIcon className="w-4 h-4" />
                            <span>등장인물 선택</span>
                        </button>
                    )}
                     {isCharacterSelectionMode && (
                        <div className="flex items-center gap-2">
                            <button onClick={onToggleCharacterSelection} className="px-3 py-1.5 text-xs font-medium bg-gray-600 rounded-lg hover:bg-gray-500">취소</button>
                            <button 
                                onClick={onConfirmSelection} 
                                disabled={selectedItemIds.size === 0}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                라이브러리로 이동 ({selectedItemIds.size})
                            </button>
                        </div>
                    )}

                    {hasItems && !isCharacterSelectionMode && (
                        <button
                            onClick={handleDownloadAll}
                            disabled={isZipping}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-wait"
                            aria-label="Download all images as a zip file"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            <span>{isZipping ? '압축 중...' : '이미지 .zip 저장'}</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-2 relative">
                {error && <div className="text-red-400 p-4 rounded-lg bg-red-900/50 mb-4">{error}</div>}
                
                {isCharacterSelectionMode && (
                     <div className="sticky top-0 z-10 p-2 mb-2 text-center text-sm text-indigo-200 bg-indigo-900/80 rounded-lg backdrop-blur-sm">
                        라이브러리에 추가할 캐릭터 이미지를 선택하세요.
                    </div>
                )}
                
                {!hasItems && !isLoading && !isDragOver && (
                    <div className="flex items-center justify-center h-full text-gray-500 py-10">
                        {isCharacterSelectionMode ? "선택할 이미지가 없습니다." : "생성된 결과물이 여기에 표시됩니다."}
                    </div>
                )}

                {isDragOver && (
                     <div className="flex items-center justify-center h-full text-indigo-400 py-10 rounded-lg border-2 border-dashed border-indigo-400">
                        <p>이곳으로 드롭하여 항목 이동 또는 순서 변경</p>
                    </div>
                )}
                
                {hasItems && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {items.map((item) => (
                           <ItemCard
                                key={item.id}
                                item={item}
                                onItemClick={onItemClick}
                                onRegenerate={() => onRegenerateClick(item.id)}
                                isRegenerating={regeneratingImageId === item.id}
                                onDragStart={(e) => onItemDragStart(e, item.id)}
                                isSelectionMode={isCharacterSelectionMode}
                                isSelected={selectedItemIds.has(item.id)}
                                onSelect={() => onItemSelection(item.id)}
                                onDelete={() => onDeleteItem(item.id)}
                            />
                        ))}
                    </div>
                )}
                 {isLoading && <LoadingState />}
            </div>
        </div>
    );
};