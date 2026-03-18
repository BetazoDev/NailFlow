'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface LightboxProps {
    images: string[];
    initialIndex: number;
    onClose: () => void;
}

export default function Lightbox({ images, initialIndex, onClose }: LightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') setCurrentIndex(prev => (prev + 1) % images.length);
            if (e.key === 'ArrowLeft') setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, images.length]);

    if (!images.length) return null;

    return createPortal(
        <div 
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            {/* Close button */}
            <button 
                className="absolute top-8 right-8 size-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all z-10"
                onClick={onClose}
            >
                <span className="material-symbol text-2xl font-light">close</span>
            </button>

            {/* Main image */}
            <div className="relative max-w-5xl w-full aspect-square md:aspect-auto md:h-[80vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
                <img 
                    src={images[currentIndex]} 
                    alt={`ref-${currentIndex}`}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-scale-in"
                />

                {/* Navigation */}
                {images.length > 1 && (
                    <>
                        <button 
                            className="absolute left-4 top-1/2 -translate-y-1/2 size-14 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10"
                            onClick={() => setCurrentIndex(prev => (prev - 1 + images.length) % images.length)}
                        >
                            <span className="material-symbol text-3xl font-light">chevron_left</span>
                        </button>
                        <button 
                            className="absolute right-4 top-1/2 -translate-y-1/2 size-14 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10"
                            onClick={() => setCurrentIndex(prev => (prev + 1) % images.length)}
                        >
                            <span className="material-symbol text-3xl font-light">chevron_right</span>
                        </button>
                    </>
                )}
            </div>

            {/* Thumbnails / Counter */}
            <div className="absolute bottom-8 text-white/60 text-xs font-bold tracking-[0.3em] uppercase">
                {currentIndex + 1} / {images.length}
            </div>
        </div>,
        document.body
    );
}
