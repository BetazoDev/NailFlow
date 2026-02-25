'use client';

import { useState, useRef } from 'react';

interface ImageUploadStepProps {
    imagePreview: string | null;
    notes: string;
    onImageChange: (preview: string | null) => void;
    onNotesChange: (notes: string) => void;
    onNext: () => void;
    onBack: () => void;
}

export default function ImageUploadStep({
    imagePreview, notes, onImageChange, onNotesChange, onNext, onBack
}: ImageUploadStepProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            onImageChange(e.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleFile(file);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    return (
        <div className="flex flex-col h-full animate-fade-in-up">
            <div className="px-6 pt-4 pb-2">
                <button onClick={onBack} className="flex items-center gap-1 text-nf-gray text-sm mb-3 hover:text-charcoal transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    Atrás
                </button>
                <h2 className="font-serif text-2xl font-semibold text-charcoal mb-1">Diseño de referencia</h2>
                <p className="text-sm text-nf-gray">Sube una imagen del diseño que te gustaría (opcional)</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Upload area */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`
            relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300
            ${isDragging ? 'border-pink bg-pink-pale scale-[1.02]' : 'border-cream-dark hover:border-pink-light hover:bg-pink-pale/30'}
            ${imagePreview ? 'p-2' : 'p-8'}
          `}
                >
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileInput}
                    />

                    {imagePreview ? (
                        <div className="relative">
                            <img
                                src={imagePreview}
                                alt="Diseño de referencia"
                                className="w-full h-48 object-cover rounded-xl"
                            />
                            <button
                                onClick={(e) => { e.stopPropagation(); onImageChange(null); }}
                                className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--charcoal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--pink-pale), var(--coral-light))' }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <path d="M21 15l-5-5L5 21" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-charcoal">Toca para subir una imagen</p>
                                <p className="text-xs text-nf-gray mt-1">o arrastra y suelta aquí</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">Notas adicionales</label>
                    <textarea
                        value={notes}
                        onChange={(e) => onNotesChange(e.target.value)}
                        placeholder="Describe detalles del diseño, colores preferidos, etc."
                        rows={3}
                        className="input-field resize-none"
                    />
                </div>
            </div>

            <div className="p-6">
                <button onClick={onNext} className="btn-gradient w-full py-4 rounded-2xl text-base">
                    Continuar
                </button>
                <button onClick={onNext} className="w-full text-center text-sm text-nf-gray mt-3 hover:text-charcoal transition-colors">
                    Omitir este paso
                </button>
            </div>
        </div>
    );
}
