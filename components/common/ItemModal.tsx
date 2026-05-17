import React, { useState, useEffect, useRef } from 'react';
import type { GeneratedItem } from '../../types';
import { ClearIcon } from '../Icons';

interface ItemModalProps {
  item: GeneratedItem;
  onClose: () => void;
}

/**
 * 이미지 확대 모달 — 줌(2.5배) + 키보드 패닝(ArrowKeys) + 마우스 드래그 지원
 */
export const ItemModal: React.FC<ItemModalProps> = ({ item, onClose }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ clientX: 0, clientY: 0, positionX: 0, positionY: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const wasDragged = useRef(false);
  const scale = 2.5;

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose]);

  useEffect(() => {
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

  const handleMouseUp = () => setIsDragging(false);

  const handleClick = () => {
    if (wasDragged.current) return;
    setIsZoomed(prev => {
      if (prev) setPosition({ x: 0, y: 0 });
      return !prev;
    });
  };

  const handleMouseLeave = () => setIsDragging(false);

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
