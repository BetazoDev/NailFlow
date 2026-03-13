'use client';

import { useRef, useState } from 'react';

interface ImageUploadStepProps {
    /** Local blob URLs for preview (created from File objects) */
    localPreviews: string[];
    /** The actual File objects to be uploaded later */
    pendingFiles: File[];
    onFilesChange: (files: File[], previews: string[]) => void;
    onNext: () => void;
    onBack: () => void;
    staffName?: string;
    tenantId?: string;
}

export default function ImageUploadStep({
    localPreviews,
    pendingFiles,
    onFilesChange,
    onNext,
    onBack,
    staffName = 'Ana',
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

        const combined = [...pendingFiles, ...newFiles].slice(0, 6);
        const combinedPreviews = [...localPreviews, ...newPreviews].slice(0, 6);
        onFilesChange(combined, combinedPreviews);
    };

    const removeImage = (idx: number) => {
        // Revoke the blob URL to free memory
        URL.revokeObjectURL(localPreviews[idx]);
        const newFiles = pendingFiles.filter((_, i) => i !== idx);
        const newPreviews = localPreviews.filter((_, i) => i !== idx);
        onFilesChange(newFiles, newPreviews);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in-up" style={{ background: 'var(--cream)' }}>
            {/* STICKY HEADER */}
            <div className="flex-none bg-white/80 backdrop-blur-md border-b border-cream-dark/50 z-20">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={onBack} className="w-10 h-10 rounded-full bg-cream flex items-center justify-center text-nf-gray hover:text-pink transition-all border border-cream-dark/50 shadow-sm">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </button>
                        
                        <div className="flex gap-1.5 bg-cream px-3 py-1.5 rounded-full border border-cream-dark/50">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${i === 4 ? 'bg-pink scale-125' : (i < 4 ? 'bg-pink/40' : 'bg-cream-dark opacity-40')}`} />
                            ))}
                        </div>
                        <div className="w-10" />
                    </div>
                    <p className="text-[10px] tracking-[0.25em] text-pink uppercase font-black mb-1">Paso 4: Inspiración</p>
                    <h1 className="font-serif text-3xl lg:text-4xl text-charcoal leading-tight">
                        Tu <span className="text-pink italic">visión</span> creativa
                    </h1>
                </div>
            </div>

            {/* SCROLLABLE UPLOAD AREA */}
            <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
                <div className="max-w-md mx-auto">
                    <div
                        className={`
                            border-[3px] border-dashed rounded-[3rem] flex flex-col items-center justify-center py-16 cursor-pointer transition-all duration-500 transform
                            ${dragging
                                ? 'border-pink bg-pink-pale shadow-2xl scale-[1.02]'
                                : 'border-cream-dark hover:border-pink/40 bg-white/50 hover:bg-white shadow-xl hover:shadow-2xl'}
                        `}
                        onClick={() => fileRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                    >
                        <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner animate-pulse-subtle bg-pink/5 text-pink">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                <circle cx="12" cy="13" r="4" />
                            </svg>
                        </div>
                        <p className="text-charcoal font-black uppercase tracking-[0.2em] text-xs">Subir Referencias</p>
                        <p className="text-nf-gray text-[9px] font-black uppercase tracking-widest mt-2 opacity-40">JPG, PNG • Máx 6 fotos</p>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={e => addFiles(e.target.files)}
                        />
                    </div>

                    <div className="mt-8 p-6 rounded-[2.5rem] bg-white border border-cream-dark/50 shadow-sm flex gap-4 items-center">
                        <div className="w-12 h-12 rounded-2xl bg-charcoal/5 flex items-center justify-center text-2xl">💡</div>
                        <p className="text-[11px] text-nf-gray font-bold uppercase tracking-wider leading-relaxed">
                            Sube diseños que te gusten para que <span className="text-charcoal">{staffName}</span> se prepare mejor.
                        </p>
                    </div>

                    {/* Selected photos */}
                    {localPreviews.length > 0 && (
                        <div className="mt-12 animate-fade-in">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-serif text-xl lg:text-2xl text-charcoal">Seleccionadas</h3>
                                <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] bg-charcoal px-4 py-1.5 rounded-full">
                                    {localPreviews.length} / 6
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {localPreviews.map((url: string, idx: number) => (
                                    <div key={idx} className="relative aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl group border-4 border-white">
                                        <img src={url} alt={`ref ${idx + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removeImage(idx)}
                                            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-red-500 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all shadow-xl active:scale-90"
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* STICKY BOTTOM PANEL */}
            <div className="flex-none p-6 bg-white/90 backdrop-blur-xl border-t border-cream-dark/50 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-xl mx-auto">
                    <button
                        onClick={onNext}
                        className="w-full py-5 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-2xl btn-gradient text-white transform hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        {localPreviews.length > 0 ? 'Confirmar Selección' : 'Continuar sin fotos'}
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
