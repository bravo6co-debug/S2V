

import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { Chapter, GeneratedItem, DragItem } from '../types';
import { PlusCircleIcon, TrashIcon, ArrowUpCircleIcon, MagnifyingGlassPlusIcon, DownloadIcon } from './Icons';

interface ChapterDisplayProps {
    chapters: Chapter[];
    onAddChapter: () => void;
    onDeleteChapter: (id: string) => void;
    onRenameChapter: (id: string, newName: string) => void;
    onItemClick: (item: GeneratedItem) => void;
    onRegenerateClick: (id: string) => void;
    regeneratingImageId: string | null;
    onItemDragStart: (e: React.DragEvent, dragItem: DragItem) => void;
    onDrop: (destination: { type: 'chapter', id: string }, e: React.DragEvent, targetId: string | null) => void;
    onRemoveItemFromChapter: (itemId: string, chapterId: string) => void;
}

interface ChapterItemProps {
    chapter: Chapter;
    onDeleteChapter: (id: string) => void;
    onRenameChapter: (id: string, newName: string) => void;
    onItemClick: (item: GeneratedItem) => void;
    onItemDragStart: (e: React.DragEvent, dragItem: DragItem) => void;
    onDrop: (destination: { type: 'chapter', id: string }, e: React.DragEvent, targetId: string | null) => void;
    onScrollToTop: () => void;
    onRemoveItemFromChapter: (itemId: string, chapterId: string) => void;
}

interface ChapterItemCardProps {
    item: GeneratedItem;
    onItemClick: () => void;
    onItemDragStart: (e: React.DragEvent) => void;
    onRemove: () => void;
}

const ChapterItemCard: React.FC<ChapterItemCardProps> = ({ item, onItemClick, onItemDragStart, onRemove }) => {
    const imageUrl = `data:${item.image.mimeType};base64,${item.image.data}`;

    const downloadUrl = imageUrl;
    const fileExtension = item.image.mimeType.split('/')[1] || 'png';
        
    return (
        <div
            data-item-id={item.id}
            className={`relative group ${item.aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'} bg-gray-800 rounded-md overflow-hidden cursor-grab`}
            draggable
            onDragStart={onItemDragStart}
            onDragEnd={(e) => (e.target as HTMLElement).style.opacity = '1'}
            onClick={onItemClick}
        >
            <img
                src={imageUrl}
                alt={item.prompt}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                draggable={false}
            />
             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                 <div className="z-10 flex items-center justify-center gap-1.5">
                    <button
                        onClick={(e) => { e.stopPropagation(); onItemClick(); }}
                        className="p-2 bg-gray-700 rounded-full text-white hover:bg-indigo-600"
                        aria-label="Zoom in"
                        title="확대"
                    >
                        <MagnifyingGlassPlusIcon className="w-4 h-4" />
                    </button>
                    <a
                        href={downloadUrl}
                        download={`item-${item.id.slice(0, 6)}.${fileExtension}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 bg-gray-700 rounded-full text-white hover:bg-indigo-600"
                        aria-label="Download item"
                        title="다운로드"
                    >
                        <DownloadIcon className="w-4 h-4" />
                    </a>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="p-2 bg-red-800 rounded-full text-white hover:bg-red-600"
                        aria-label="Remove from chapter"
                        title="챕터에서 제외"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

const ChapterItem = React.forwardRef<HTMLDivElement, ChapterItemProps>((
    { chapter, onDeleteChapter, onRenameChapter, onItemClick, onItemDragStart, onDrop, onScrollToTop, onRemoveItemFromChapter },
    ref
) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(chapter.name);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isZipping, setIsZipping] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
    };

    const handleNameSubmit = () => {
        if (name.trim()) {
            onRenameChapter(chapter.id, name.trim());
        } else {
            setName(chapter.name); // Revert if empty
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleNameSubmit();
        if (e.key === 'Escape') {
            setName(chapter.name);
            setIsEditing(false);
        }
    };
    
    const handleDownloadAll = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const imageItems = chapter.items;
        if (imageItems.length === 0 || isZipping) return;

        setIsZipping(true);
        try {
            const zip = new JSZip();

            imageItems.forEach((item) => {
                const fileExtension = item.image.mimeType.split('/')[1] || 'png';
                const fileName = `image-${item.id.slice(0, 8)}.${fileExtension}`;
                zip.file(fileName, item.image.data, { base64: true });
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `${chapter.name}.zip`;
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
    
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDeleteChapter(chapter.id);
    };
    
    const handleScrollToTopClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onScrollToTop();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const targetCard = (e.target as HTMLElement).closest(`[data-item-id]`);
        const targetId = targetCard ? targetCard.getAttribute('data-item-id') : null;
        onDrop({ type: 'chapter', id: chapter.id }, e, targetId);
    }

    const dropZoneClasses = isDragOver
        ? 'border-indigo-500 bg-indigo-900/20'
        : 'border-gray-700';

    return (
        <div ref={ref} className={`bg-gray-800/60 rounded-lg p-3 flex flex-col gap-3 border transition-colors ${dropZoneClasses}`}
             onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
             onDragLeave={() => setIsDragOver(false)}
             onDrop={handleDrop}
        >
            <div className="flex items-center justify-between gap-2">
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={handleNameChange}
                        onBlur={handleNameSubmit}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-gray-600 text-white text-sm font-bold rounded px-2 py-0.5"
                    />
                ) : (
                    <h4 onDoubleClick={() => setIsEditing(true)} title="더블클릭하여 이름 변경" className="text-sm font-bold text-gray-200 truncate cursor-pointer">
                        {chapter.name}
                    </h4>
                )}
                <div className="flex items-center gap-1 flex-shrink-0">
                     <button 
                        onClick={handleDownloadAll} 
                        disabled={isZipping || chapter.items.length === 0} 
                        title="챕터 이미지 .zip 저장" 
                        className="text-gray-500 hover:text-indigo-400 p-1 rounded-full disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isZipping ? 
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            : <DownloadIcon className="w-4 h-4" />
                        }
                    </button>
                    <button onClick={handleScrollToTopClick} title="맨 위로 스크롤" className="text-gray-500 hover:text-indigo-400 p-1 rounded-full">
                        <ArrowUpCircleIcon className="w-4 h-4" />
                    </button>
                    <button onClick={handleDelete} title="챕터 삭제" className="text-gray-500 hover:text-red-400 p-1 rounded-full">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
            {chapter.items.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                    {chapter.items.map(item =>
                        <ChapterItemCard
                            key={item.id}
                            item={item}
                            onItemClick={() => onItemClick(item)}
                            onItemDragStart={(e) => onItemDragStart(e, { itemId: item.id, source: { type: 'chapter', id: chapter.id } })}
                            onRemove={() => onRemoveItemFromChapter(item.id, chapter.id)}
                        />
                    )}
                </div>
            ) : (
                 <div className="flex items-center justify-center text-center h-20 text-xs text-gray-500 rounded-lg border-2 border-dashed border-gray-600">
                    <p>항목을<br/>이곳으로 드롭하세요</p>
                </div>
            )}
        </div>
    )

});

export const ChapterDisplay: React.FC<ChapterDisplayProps> = (props) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const chapterRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const handleScrollToChapter = (id: string) => {
        chapterRefs.current[id]?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleScrollToTop = () => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="w-full h-full bg-gray-900/50 rounded-xl border border-gray-700 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <h3 className="text-xl font-bold text-indigo-300">챕터</h3>
                <button onClick={props.onAddChapter} className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-gray-200 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors">
                    <PlusCircleIcon className="w-4 h-4"/>
                    <span>챕터 추가</span>
                </button>
            </div>
             {props.chapters.length > 1 && (
                <div className="flex-shrink-0 mb-4 pb-2 border-b border-gray-700">
                    <p className="text-xs text-gray-400 mb-2">빠른 이동:</p>
                    <div className="flex flex-wrap gap-2">
                        {props.chapters.map(chapter => (
                            <button
                                key={chapter.id}
                                onClick={() => handleScrollToChapter(chapter.id)}
                                className="px-2 py-1 text-xs font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-indigo-600 transition-colors"
                            >
                                {chapter.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div ref={scrollContainerRef} className="flex-grow overflow-y-auto pr-2 space-y-4">
                {props.chapters.length > 0 ? (
                    props.chapters.map(chapter => 
                        <ChapterItem 
                            key={chapter.id} 
                            ref={el => { chapterRefs.current[chapter.id] = el; }}
                            chapter={chapter} 
                            onDeleteChapter={props.onDeleteChapter}
                            onRenameChapter={props.onRenameChapter}
                            onItemClick={props.onItemClick}
                            onItemDragStart={props.onItemDragStart}
                            onDrop={props.onDrop}
                            onScrollToTop={handleScrollToTop}
                            onRemoveItemFromChapter={props.onRemoveItemFromChapter}
                        />)
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 text-center">
                        '챕터 추가'를 눌러<br/>
                        새로운 챕터를 만드세요.
                    </div>
                )}
            </div>
        </div>
    );
};