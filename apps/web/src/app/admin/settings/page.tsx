'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { useTenant } from '@/lib/tenant-context';

import { PALETTES, TYPOGRAPHY } from '@/lib/constants';

export default function SettingsPage() {
    const [selectedPalette, setSelectedPalette] = useState('vintage-rose');
    const [selectedTypo, setSelectedTypo] = useState('serif');
    const [salonName, setSalonName] = useState('Ana Nails Studio');
    const [tagline, setTagline] = useState('Especialista en Manicura Rusa');
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loadingTenant, setLoadingTenant] = useState(true);
    const photoRef = useRef<HTMLInputElement>(null);
    const logoRef = useRef<HTMLInputElement>(null);

    const { tenantId } = useTenant();

    // Load existing tenant config
    useEffect(() => {
        if (!tenantId) return;
        api.getTenantById(tenantId).then(tenant => {
            if (tenant) {
                setSalonName(tenant.name || salonName);
                if (tenant.branding.palette_id) setSelectedPalette(tenant.branding.palette_id);
                if (tenant.branding.typography) setSelectedTypo(tenant.branding.typography);
                if (tenant.branding.photo_url) setPhotoPreview(tenant.branding.photo_url);
                if (tenant.branding.logo_url) setLogoPreview(tenant.branding.logo_url);
                if (tenant.branding.tagline) setTagline(tenant.branding.tagline);
            }
        }).finally(() => setLoadingTenant(false));
    }, [tenantId]);

    // Apply CSS vars live when palette changes
    useEffect(() => {
        const palette = PALETTES.find(p => p.id === selectedPalette);
        if (palette && typeof document !== 'undefined') {
            Object.entries(palette.cssVars).forEach(([key, value]) => {
                document.documentElement.style.setProperty(key, value);
            });
        }
    }, [selectedPalette]);

    // Apply typography live when it changes
    useEffect(() => {
        const typo = TYPOGRAPHY.find(t => t.id === selectedTypo);
        if (typo && typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--font-display', typo.fontDisplay);
            document.documentElement.style.setProperty('--font-sans', typo.fontSans);
        }
    }, [selectedTypo]);

    const handleSave = async () => {
        if (!tenantId) return;
        setSaving(true);
        const palette = PALETTES.find(p => p.id === selectedPalette);
        try {
            let finalPhotoUrl = photoPreview || '';
            let finalLogoUrl = logoPreview || '';

            // Upload new photo if selected
            if (photoFile) {
                finalPhotoUrl = await api.uploadImage(tenantId, 'branding', photoFile);
            }
            // Upload new logo if selected
            if (logoFile) {
                finalLogoUrl = await api.uploadImage(tenantId, 'branding', logoFile);
            }

            await api.updateTenant(tenantId, {
                branding: {
                    primary_color: palette?.primary || '#C97794',
                    secondary_color: palette?.secondary || '#F8D2D8',
                    logo_url: finalLogoUrl,
                    photo_url: finalPhotoUrl,
                    palette_id: selectedPalette,
                    typography: selectedTypo,
                    tagline: tagline,
                },
                name: salonName,
            });
            alert('Ajustes guardados correctamente');
        } catch (error: any) {
            console.error('Error saving settings:', error);
            const errorMsg = error.details || error.message || 'Error desconocido';
            alert('Error al guardar los ajustes: ' + errorMsg);
        }
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const currentPalette = PALETTES.find(p => p.id === selectedPalette) || PALETTES[0];
    const currentTypo = TYPOGRAPHY.find(t => t.id === selectedTypo) || TYPOGRAPHY[0];

    if (loadingTenant) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-aesthetic-accent border-t-aesthetic-pink rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="relative min-h-full pb-24" style={{ background: 'var(--cream)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-8 border-b border-aesthetic-accent/20 bg-aesthetic-cream/50 backdrop-blur-md sticky top-0 z-10 transition-all duration-500">
                <div className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 transition-colors">
                    <span className="material-symbol text-aesthetic-muted font-light">tune</span>
                </div>
                <h1 className="font-display text-xl font-medium tracking-tight text-aesthetic-taupe italic">Ajustes de Marca</h1>
                <button className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 transition-colors">
                    <span className="material-symbol text-aesthetic-muted font-light">more_horiz</span>
                </button>
            </div>

            <div className="px-6 pt-6 space-y-8">
                {/* Visual identity */}
                <div>
                    <p className="text-[10px] tracking-[0.18em] text-nf-gray uppercase mb-4">Identidad Visual</p>
                    <div className="flex gap-8 items-end">
                        {/* Photo */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="relative cursor-pointer" onClick={() => photoRef.current?.click()}>
                                <div className="w-20 h-20 rounded-full overflow-hidden" style={{ background: 'var(--pink-pale)' }}>
                                    {photoPreview ? (
                                        <img src={api.getPublicUrl(photoPreview)} alt="foto" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-3xl font-serif font-semibold" style={{ color: 'var(--charcoal)' }}>A</div>
                                    )}
                                </div>
                                <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center shadow-sm" style={{ background: 'var(--pink)' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                </div>
                            </div>
                            <p className="text-[11px] text-nf-gray">Fotografía</p>
                            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) {
                                    setPhotoPreview(URL.createObjectURL(f));
                                    setPhotoFile(f);
                                }
                            }} />
                        </div>

                        {/* Logo */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="relative cursor-pointer" onClick={() => logoRef.current?.click()}>
                                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-cream-dark flex items-center justify-center" style={{ background: 'white' }}>
                                    {logoPreview ? (
                                        <img src={api.getPublicUrl(logoPreview)} alt="logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-light)" strokeWidth="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                    )}
                                </div>
                                <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center shadow-sm" style={{ background: 'var(--cream-dark)' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--charcoal-light)" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                </div>
                            </div>
                            <p className="text-[11px] text-nf-gray">Logotipo</p>
                            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) {
                                    setLogoPreview(URL.createObjectURL(f));
                                    setLogoFile(f);
                                }
                            }} />
                        </div>

                        {/* Name & tagline inputs */}
                        <div className="flex-1 space-y-2">
                            <input
                                className="w-full bg-transparent border-0 border-b border-cream-dark py-1.5 text-charcoal font-serif text-base focus:outline-none focus:border-pink transition-colors"
                                value={salonName}
                                onChange={e => setSalonName(e.target.value)}
                                placeholder="Nombre del salón"
                            />
                            <input
                                className="w-full bg-transparent border-0 border-b border-cream-dark py-1.5 text-nf-gray text-xs italic focus:outline-none focus:border-pink transition-colors"
                                value={tagline}
                                onChange={e => setTagline(e.target.value)}
                                placeholder="Especialidad / tagline"
                            />
                        </div>
                    </div>
                </div>

                {/* Atmosphere selection */}
                <section>
                    <p className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase mb-6 font-display italic font-medium">Atmósfera & Aura</p>
                    <div className="space-y-4">
                        {PALETTES.map(palette => (
                            <button
                                key={palette.id}
                                onClick={() => setSelectedPalette(palette.id)}
                                className={`w-full flex items-center gap-5 p-5 rounded-3xl border transition-all duration-300 group ${selectedPalette === palette.id
                                    ? 'bg-white border-aesthetic-pink/30 shadow-minimal'
                                    : 'bg-white/40 border-aesthetic-accent hover:border-aesthetic-pink/20'
                                    }`}
                            >
                                {/* Swatches */}
                                <div className="flex -space-x-2 flex-shrink-0">
                                    {palette.colors.map((c, i) => (
                                        <div key={i} className="size-10 rounded-full border-2 border-white shadow-sm" style={{ background: c, zIndex: 10 - i }} />
                                    ))}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <h4 className="font-display italic text-lg text-aesthetic-taupe leading-tight">{palette.name}</h4>
                                    <p className="text-[10px] text-aesthetic-muted/60 font-display italic leading-tight mt-1 truncate">{palette.description}</p>
                                </div>
                                {/* Selection indicator */}
                                <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${selectedPalette === palette.id ? 'border-aesthetic-pink bg-aesthetic-pink text-white' : 'border-aesthetic-accent'}`}>
                                    {selectedPalette === palette.id && <span className="material-symbol text-sm font-bold">check</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Typography */}
                <div>
                    <p className="text-[10px] tracking-[0.18em] text-nf-gray uppercase mb-4">Tipografía</p>
                    <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm">
                        {TYPOGRAPHY.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTypo(t.id)}
                                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                                style={selectedTypo === t.id
                                    ? { background: 'var(--cream)', color: 'var(--charcoal)', boxShadow: 'var(--shadow-sm)' }
                                    : { color: 'var(--gray-light)' }
                                }
                            >
                                {t.id === 'serif' ? <span className="font-serif">{t.label}</span> : t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Preview card */}
                <section>
                    <p className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase mb-6 font-display italic font-medium">Previsualización del Perfil</p>
                    <div className="relative group perspective-1000">
                        <div
                            className="w-full aspect-[4/5] rounded-[3rem] p-8 flex flex-col items-center justify-center text-center shadow-soft transition-all duration-1000 relative overflow-hidden group-hover:shadow-2xl"
                            style={{
                                background: `linear-gradient(135deg, ${currentPalette.secondary}, #fff)`,
                                fontFamily: currentTypo.fontDisplay,
                            }}
                        >
                            {/* Decorative elements */}
                            <div className="absolute top-0 right-0 size-32 opacity-20 bg-gradient-to-bl blur-3xl pointer-events-none" style={{ backgroundColor: currentPalette.primary }} />

                            <div className="relative size-28 mb-8">
                                <div className="absolute inset-0 rounded-full blur-xl opacity-40 animate-pulse" style={{ background: currentPalette.primary }} />
                                <div className="relative size-full rounded-full border-4 border-white shadow-soft overflow-hidden">
                                    {photoPreview ? (
                                        <img src={api.getPublicUrl(photoPreview)} alt="avatar" className="size-full object-cover" />
                                    ) : (
                                        <div className="size-full flex items-center justify-center text-4xl italic bg-aesthetic-cream" style={{ color: currentPalette.accent, fontFamily: currentTypo.fontDisplay }}>{salonName[0] || 'A'}</div>
                                    )}
                                </div>
                            </div>

                            <h3 className="text-3xl italic tracking-tight mb-2 leading-tight" style={{ color: currentPalette.accent, fontFamily: currentTypo.fontDisplay }}>
                                {salonName || 'Tu Salon'}
                            </h3>
                            <p className="text-sm italic tracking-wide opacity-60 mb-8" style={{ color: currentPalette.accent, fontFamily: currentTypo.fontDisplay }}>
                                {tagline || 'Tu especialidad aquí'}
                            </p>

                            <div className="flex gap-4 w-full px-4">
                                <button className="flex-1 py-5 rounded-full text-white text-xs font-bold tracking-[0.2em] uppercase shadow-minimal transition-transform active:scale-95" style={{ background: currentPalette.accent }}>
                                    RESERVAR TURNO
                                </button>
                                <button className="size-14 rounded-full bg-white border flex items-center justify-center shadow-minimal" style={{ borderColor: currentPalette.primary, color: currentPalette.accent }}>
                                    <span className="material-symbol text-xl">share</span>
                                </button>
                            </div>

                            <p className="absolute bottom-8 text-[9px] tracking-[0.3em] uppercase opacity-30 italic" style={{ fontFamily: currentTypo.fontDisplay }}>Powered by NailFlow</p>
                        </div>
                    </div>
                </section>
            </div>

            {/* CTA */}
            <div className="px-6 mt-8 pb-6">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-4 rounded-full text-base font-serif transition-all duration-200 flex items-center justify-center gap-2"
                    style={{ background: saved ? 'var(--pink)' : 'var(--pink-light)', color: 'var(--charcoal)' }}
                >
                    {saving ? (
                        <div className="w-5 h-5 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
                    ) : saved ? (
                        <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                            <span className="text-white">¡Guardado!</span>
                        </>
                    ) : 'Confirmar Cambios'}
                </button>
            </div>
        </div>
    );
}
