'use client';

import { useRef, useState } from 'react';

interface ImageUploadStepProps {
    localPreviews: string[];
    pendingFiles: File[];
    onFilesChange: (files: File[], previews: string[]) => void;
    onNext: () => void;
    onBack: () => void;
    staffName?: string;
}

export default function ImageUploadStep({
    localPreviews, pendingFiles, onFilesChange, onNext, onBack, staffName = 'Ana'
}: ImageUploadStepProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const addFiles = (fileList: FileList | null) => {
        if (!fileList) return;
        const newFiles: File[] = [];
        const newPreviews: string[] = [];
        for (const file of Array.from(fileList)) {
            if (!file.type.startsWith('image/')) continue;
            newFiles.push(file);
            newPreviews.push(URL.createObjectURL(file));
        }
        // Max 6 files per spec
        const combined = [...pendingFiles, ...newFiles].slice(0, 6);
        const combinedPreviews = [...localPreviews, ...newPreviews].slice(0, 6);
        onFilesChange(combined, combinedPreviews);
    };

    const removeImage = (idx: number) => {
        URL.revokeObjectURL(localPreviews[idx]);
        onFilesChange(pendingFiles.filter((_, i) => i !== idx), localPreviews.filter((_, i) => i !== idx));
    };

    return (
        <div className="flex flex-col h-full relative" style={{ background: 'var(--cream)' }}>
            {/* Header: Sticky at the top */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-cream-dark/30 shadow-sm">
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <button onClick={onBack} className="flex items-center gap-2 text-nf-gray text-xs font-bold uppercase tracking-widest hover:text-pink transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:bg-pink-pale transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </div>
                    </button>
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink opacity-20" />
                        <div className="w-2 h-2 rounded-full bg-pink" />
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="w-2 h-2 rounded-full bg-cream-dark opacity-30" />
                        ))}
                    </div>
                </div>

                <div className="px-6 pt-4 pb-4">
                    <p className="text-[10px] tracking-[0.2em] text-nf-gray uppercase font-bold mb-1">Paso 4: Inspiración</p>
                    <h1 className="font-serif text-3xl text-charcoal leading-tight">
                        Tu <span className="text-pink">visión</span> creativa
                    </h1>
                </div>
            </div>

            {/* Scrollable content areas */}
            <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
                {/* Upload Zone */}
                <div className="px-6 pt-8 pb-10 stagger-children">
                    <div
                        className={`border-[3px] border-dashed rounded-[2.5rem] flex flex-col items-center justify-center py-16 cursor-pointer transition-all duration-500 transform
                            ${dragging ? 'border-pink bg-pink-pale shadow-2xl scale-[1.02]' : 'border-pink-light/30 hover:border-pink/40 bg-white/80 hover:bg-white shadow-xl hover:shadow-2xl'}
                        `}
                        onClick={() => fileRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                    >
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner animate-pulse-subtle" style={{ background: 'var(--pink-pale)' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="1.5">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                <circle cx="12" cy="13" r="4" />
                            </svg>
                        </div>
                        <p className="text-charcoal font-serif text-xl font-bold">Añadir referencias</p>
                        <p className="text-nf-gray text-[10px] font-bold uppercase tracking-widest mt-2 opacity-60">JPG, PNG • Máximo 6 fotos</p>
                        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
                    </div>

                    <div className="mt-8 p-6 rounded-[2rem] bg-charcoal/5 border border-charcoal/5 flex gap-4 items-start">
                        <span className="text-2xl">💡</span>
                        <p className="text-[11px] text-nf-gray leading-relaxed font-medium uppercase tracking-wider">
                            Sube fotos de diseños que te gusten para que {staffName} pueda prepararse mejor para tu cita. Las fotos se enviarán junto con tu reserva.
                        </p>
                    </div>

                    {/* Selected Photos */}
                    {localPreviews.length > 0 && (
                        <div className="pt-10 animate-fade-in">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-serif text-lg text-charcoal">Seleccionadas</h3>
                                <span className="text-[10px] font-bold text-pink uppercase tracking-[0.2em] bg-pink-pale px-3 py-1 rounded-full border border-pink-light/20">
                                    {localPreviews.length} de 6
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {localPreviews.map((url, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden shadow-lg group hover:scale-105 transition-transform">
                                        <img src={url} alt={`ref ${idx + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removeImage(idx)}
                                            className="absolute inset-0 bg-charcoal/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-white text-charcoal flex items-center justify-center shadow-lg">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                            </div>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* CTA: Sticky at the bottom */}
            <div className="sticky bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-xl border-t border-cream-dark/50 z-40 transition-all duration-300">
                <button
                    onClick={onNext}
                    className="w-full max-w-lg mx-auto py-5 rounded-full text-base font-serif flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl btn-gradient text-white"
                >
                    {localPreviews.length > 0 ? 'Ver Resumen' : 'Continuar sin fotos'}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
