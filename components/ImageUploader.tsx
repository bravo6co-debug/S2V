import React, { useState, useRef, useEffect } from 'react';
import { ImageData } from '../types';
import { DownloadIcon } from './Icons';

interface ImageUploaderProps {
    title: string;
    onImageChange: (imageData: ImageData | null) => void;
    isDisabled: boolean;
    value?: ImageData | null;
    onImageClick?: (src: string) => void;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const ImageUploader: React.FC<ImageUploaderProps> = ({ title, onImageChange, isDisabled, value = null, onImageClick }) => {
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (value) {
            const dataUrl = `data:${value.mimeType};base64,${value.data}`;
            if (dataUrl !== imagePreview) {
                setImagePreview(dataUrl);
            }
        } else {
            if (imagePreview !== null) {
                setImagePreview(null);
            }
        }
    }, [value, imagePreview]);


    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const dataUrl = await fileToDataUrl(file);
            const base64Data = dataUrl.split(',')[1];
            setImagePreview(dataUrl);
            onImageChange({ mimeType: file.type, data: base64Data });
        }
    };

    const handleClearImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setImagePreview(null);
        onImageChange(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleContainerClick = () => {
        if (isDisabled) return;

        if (imagePreview && onImageClick) {
            onImageClick(imagePreview);
        } else if (!imagePreview) {
            // Only trigger file input if no image is present
            fileInputRef.current?.click();
        }
    };

    const getDynamicClasses = () => {
        if (isDisabled) {
            return 'cursor-not-allowed opacity-60';
        }
        if (imagePreview) {
            return 'cursor-zoom-in hover:border-indigo-500';
        }
        return 'cursor-pointer hover:border-indigo-500 hover:bg-gray-700';
    };

    return (
        <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-gray-400 text-center">{title}</h3>
            <div
                onClick={handleContainerClick}
                className={`relative aspect-square w-full bg-gray-800 border-2 border-dashed border-gray-600 rounded-xl flex items-center justify-center transition-all duration-300 ease-in-out group ${getDynamicClasses()}`}
            >
                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isDisabled}
                />
                {imagePreview ? (
                    <>
                        <img src={imagePreview} alt="Preview" className="object-contain w-full h-full rounded-lg" />
                        <button
                            onClick={handleClearImage}
                            disabled={isDisabled}
                            className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-60 rounded-full text-white hover:bg-opacity-80 transition-opacity disabled:opacity-50"
                            aria-label="Clear image"
                        >
                            <span>❌</span>
                        </button>
                        <a
                            href={imagePreview}
                            download={`reference-image.png`}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-2 right-2 p-1.5 bg-black bg-opacity-60 rounded-full text-white hover:bg-opacity-80 transition-opacity"
                            aria-label="Download reference image"
                        >
                            <DownloadIcon className="w-4 h-4" />
                        </a>
                    </>
                ) : (
                    <div className="text-center text-gray-500 group-hover:text-indigo-400">
                        <div className="text-4xl mx-auto">📤</div>
                        <p className="mt-1 text-xs">클릭하여 업로드</p>
                    </div>
                )}
            </div>
        </div>
    );
};