'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session-context';
import { applyBranding, clearBrandingPreview } from '@/lib/theme';
import { Feedback, type FeedbackState } from '@/components/admin/Feedback';
import { GatewayPanel } from '@/components/admin/GatewayPanel';
import { SharePanel } from '@/components/admin/SharePanel';
import { DEFAULT_PALETTE_ID, DEFAULT_TYPOGRAPHY_ID, PALETTES, TYPOGRAPHY, WEEKDAYS } from '@/lib/constants';
import type { DaySchedule, SocialLinks, TenantBranding, TenantSettings } from '@/lib/types';
import {
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

/** Sensible opening hours for a salon that has not configured any yet. */
const DEFAULT_SCHEDULE: DaySchedule[] = [
    { day: 1, active: true, start: '09:00', end: '20:00' },
    { day: 2, active: true, start: '09:00', end: '20:00' },
    { day: 3, active: true, start: '09:00', end: '20:00' },
    { day: 4, active: true, start: '09:00', end: '20:00' },
    { day: 5, active: true, start: '09:00', end: '20:00' },
    { day: 6, active: true, start: '09:00', end: '15:00' },
    { day: 0, active: false, start: '09:00', end: '09:00' },
];

/** Handles, not URLs: she types what she knows and we build the link. */
const SOCIAL_FIELDS = [
    { key: 'instagram', label: 'Instagram', icon: 'photo_camera', placeholder: 'tusalon' },
    { key: 'tiktok', label: 'TikTok', icon: 'music_note', placeholder: 'tusalon' },
    { key: 'facebook', label: 'Facebook', icon: 'thumb_up', placeholder: 'tusalon' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'chat', placeholder: '+52 55 1234 5678' },
    { key: 'website', label: 'Sitio web', icon: 'language', placeholder: 'https://…' },
] as const satisfies readonly { key: keyof SocialLinks; label: string; icon: string; placeholder: string }[];

const TABS = [
    ['info', 'Negocio', 'storefront'],
    ['apariencia', 'Apariencia', 'palette'],
    ['horarios', 'Horarios', 'schedule'],
    ['compartir', 'Comparte', 'qr_code_2'],
    ['cobros', 'Cobros', 'payments'],
    ['fidelizacion', 'Fidelización', 'card_giftcard'],
    ['password', 'Seguridad', 'shield'],
] as const;

export default function ProfilePage() {
    const { tenant, refresh } = useSession();
    const [tab, setTab] = useState<(typeof TABS)[number][0]>('info');

    const [salonName, setSalonName] = useState('');
    const [tagline, setTagline] = useState('');
    const [description, setDescription] = useState('');
    const [social, setSocial] = useState<SocialLinks>({});
    const [currentBranding, setCurrentBranding] = useState<TenantBranding>({});
    const [paletteId, setPaletteId] = useState(DEFAULT_PALETTE_ID);
    const [typographyId, setTypographyId] = useState(DEFAULT_TYPOGRAPHY_ID);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([]);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<FeedbackState | null>(null);
    const logoRef = useRef<HTMLInputElement>(null);

    // Loyalty program state
    const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
    const [loyaltyVisits, setLoyaltyVisits] = useState(5);
    const [loyaltyRewardType, setLoyaltyRewardType] = useState<'discount' | 'free_service'>('discount');
    const [loyaltyDiscountValue, setLoyaltyDiscountValue] = useState(10);
    const [loyaltySaving, setLoyaltySaving] = useState(false);
    const [loyaltyMsg, setLoyaltyMsg] = useState<FeedbackState | null>(null);

    // Password
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMsg, setPwMsg] = useState<FeedbackState | null>(null);


    // Current user info
    const user = auth.currentUser;

    useEffect(() => {
        if (!tenant) return;

        setSalonName(tenant.name ?? '');
        setTagline(tenant.branding?.tagline ?? '');
        setDescription(tenant.settings?.description ?? '');
        setSocial(tenant.settings?.social ?? {});
        setLogoPreview(tenant.branding?.logo_url ?? null);
        setCurrentBranding(tenant.branding ?? {});
        setPaletteId(tenant.branding?.palette_id ?? DEFAULT_PALETTE_ID);
        setTypographyId(tenant.branding?.typography ?? DEFAULT_TYPOGRAPHY_ID);
        setWeeklySchedule(tenant.settings?.weekly_schedule ?? DEFAULT_SCHEDULE);

        const loyalty = tenant.settings?.loyalty;
        if (loyalty) {
            setLoyaltyEnabled(loyalty.enabled);
            setLoyaltyVisits(loyalty.visits_required);
            setLoyaltyRewardType(loyalty.reward_type);
            setLoyaltyDiscountValue(loyalty.discount_value ?? 10);
        }
    }, [tenant]);

    /** Preview the palette live while the owner is choosing. */
    useEffect(() => {
        applyBranding({ ...currentBranding, palette_id: paletteId, typography: typographyId });
    }, [currentBranding, paletteId, typographyId]);

    /**
     * Discard an unsaved preview when the page goes away.
     *
     * This is deliberately a separate effect with no dependencies. Returning the
     * cleanup from the preview effect above ran it on *every* palette click —
     * React runs a cleanup before each re-run, not only on unmount — so each
     * selection briefly repainted the stored palette before the new one.
     *
     * The stored branding is read through a ref so this effect never re-runs.
     */
    const storedBranding = useRef(tenant?.branding);
    storedBranding.current = tenant?.branding;

    useEffect(() => {
        return () => {
            clearBrandingPreview();
            applyBranding(storedBranding.current);
        };
    }, []);

    /**
     * One save path for every section of this page.
     *
     * `PUT /api/tenant` merges the JSON it receives, so sending only the keys
     * that changed no longer risks wiping the rest of the branding object.
     */
    const save = async (
        patch: { name?: string; branding?: TenantBranding; settings?: TenantSettings },
        onMessage: (state: FeedbackState | null) => void
    ) => {
        try {
            const updated = await api.updateTenant(patch);
            setCurrentBranding(updated.branding ?? {});
            await refresh();
            onMessage({ tone: 'success', message: 'Guardado' });
        } catch (caught) {
            onMessage({
                tone: 'error',
                message: caught instanceof ApiError ? caught.message : 'Error al guardar. Intenta de nuevo.',
            });
        } finally {
            setTimeout(() => onMessage(null), 4000);
        }
    };

    const handleSaveInfo = async () => {
        setSaving(true);
        setSaveMsg(null);
        try {
            let logoUrl = logoPreview;
            if (logoFile) {
                logoUrl = await api.uploadImage(logoFile, 'branding');
                setLogoPreview(logoUrl);
                setLogoFile(null);
            }

            await save(
                {
                    name: salonName.trim(),
                    branding: { logo_url: logoUrl ?? undefined, tagline: tagline.trim() },
                    settings: {
                        description: description.trim(),
                        // Blank handles are dropped rather than stored empty, so
                        // the booking page can simply show what is present.
                        social: Object.fromEntries(
                            Object.entries(social)
                                .map(([key, value]) => [key, value?.trim() ?? ''])
                                .filter(([, value]) => value)
                        ),
                    },
                },
                setSaveMsg
            );
        } catch (caught) {
            setSaveMsg({
                tone: 'error',
                message: caught instanceof ApiError ? caught.message : 'No pudimos subir el logo.',
            });
            setTimeout(() => setSaveMsg(null), 4000);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAppearance = async () => {
        setSaving(true);
        setSaveMsg(null);
        await save({ branding: { palette_id: paletteId, typography: typographyId } }, setSaveMsg);
        setSaving(false);
    };

    const handleSaveSchedule = async () => {
        const invalid = weeklySchedule.find(day => day.active && day.start >= day.end);
        if (invalid) {
            const label = WEEKDAYS.find(day => day.day === invalid.day)?.label ?? 'Un día';
            setSaveMsg({
                tone: 'error',
                message: `${label}: la hora de cierre debe ser posterior a la de apertura.`,
            });
            setTimeout(() => setSaveMsg(null), 4000);
            return;
        }

        setSaving(true);
        setSaveMsg(null);
        await save({ settings: { weekly_schedule: weeklySchedule } }, setSaveMsg);
        setSaving(false);
    };

    const handleChangePassword = async () => {
        setPwMsg(null);
        if (!newPassword || !currentPassword) {
            setPwMsg({ tone: 'error', message: 'Por favor llena todos los campos.' });
            return;
        }
        if (newPassword.length < 6) {
            setPwMsg({ tone: 'error', message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwMsg({ tone: 'error', message: 'Las contraseñas no coinciden.' });
            return;
        }
        if (!user || !user.email) {
            setPwMsg({ tone: 'error', message: 'No hay sesión activa.' });
            return;
        }
        setPwSaving(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            setPwMsg({ tone: 'success', message: 'Contraseña actualizada' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (e: unknown) {
            const firebaseError = e as { code?: string; message?: string };
            if (firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
                setPwMsg({ tone: 'error', message: 'La contraseña actual es incorrecta.' });
            } else {
                setPwMsg({ tone: 'error', message: 'No pudimos cambiar la contraseña.' });
            }
        } finally {
            setPwSaving(false);
            setTimeout(() => setPwMsg(null), 4000);
        }
    };

    /**
     * Updates one weekday immutably, inserting it if the salon had never
     * configured that day. The previous version mutated the array in place and
     * indexed with `findIndex`, so editing a day that was not yet in the list
     * wrote to `undefined`.
     */
    const updateDay = (day: number, patch: Partial<DaySchedule>) => {
        setWeeklySchedule(current => {
            const existing = current.find(entry => entry.day === day);
            const base: DaySchedule =
                existing ?? { day: day as DaySchedule['day'], active: false, start: '09:00', end: '18:00' };
            const updated = { ...base, ...patch };

            return existing
                ? current.map(entry => (entry.day === day ? updated : entry))
                : [...current, updated];
        });
    };

    const handleSaveLoyalty = async () => {
        setLoyaltySaving(true);
        setLoyaltyMsg(null);
        await save(
            {
                settings: {
                    loyalty: {
                        enabled: loyaltyEnabled,
                        visits_required: loyaltyVisits,
                        reward_type: loyaltyRewardType,
                        // Omitted rather than null: the field only means something
                        // for a percentage reward.
                        ...(loyaltyRewardType === 'discount' ? { discount_value: loyaltyDiscountValue } : {}),
                    },
                },
            },
            setLoyaltyMsg
        );
        setLoyaltySaving(false);
    };

    return (
        <div className="min-h-full pb-24">
            {/* Header */}
            <div className="px-6 pt-8 pb-6">
                <p className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase mb-2 font-display italic font-medium">Administración</p>
                <h1 className="font-display text-4xl font-light italic tracking-tight text-aesthetic-taupe">Mi Perfil</h1>
            </div>

            {/* Avatar section */}
            <div className="px-6 mb-8">
                <Card variant="raised" className="flex items-center gap-5 p-6">
                    <div className="size-24 rounded-full bg-aesthetic-soft-pink border-4 border-white shadow-soft flex items-center justify-center text-aesthetic-taupe text-4xl font-display italic flex-shrink-0 overflow-hidden ring-1 ring-aesthetic-accent/50">
                        {logoPreview ? (
                            <img
                                src={logoPreview.startsWith('blob:') ? logoPreview : api.getImageUrl(logoPreview)}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            user?.email?.charAt(0).toUpperCase() || '✨'
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-display text-lg italic text-aesthetic-taupe truncate">{user?.email || 'Sin sesión'}</p>
                        <p className="text-[10px] tracking-[0.15em] text-aesthetic-muted uppercase mt-1">Administrador</p>
                    </div>
                </Card>
            </div>

            {/* Tabs */}
            <div className="px-6 mb-8">
                <div className="flex gap-2 bg-aesthetic-cream/60 backdrop-blur-sm rounded-[2rem] p-1.5 border border-white/50 shadow-inner overflow-x-auto scrollbar-hide">
                    {TABS.map(([id, label, icon]) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            aria-pressed={tab === id}
                            className={`flex flex-1 items-center justify-center gap-2 py-3.5 px-6 rounded-[1.5rem] text-[10px] tracking-[0.2em] uppercase font-bold transition-all whitespace-nowrap ${tab === id ? 'bg-white text-aesthetic-pink shadow-md' : 'text-aesthetic-muted hover:text-aesthetic-taupe hover:bg-white/30'}`}
                        >
                            <span className="material-symbol text-base" aria-hidden="true">{icon}</span>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Tabs */}
            <div className="px-6">
                {tab === 'info' && (
                    <div className="space-y-6 animate-fade-in">
                        <Card variant="raised" className="p-8 border-none shadow-soft overflow-hidden">
                            <h3 className="font-display text-2xl italic text-aesthetic-taupe mb-8">Información del Salón</h3>
                            
                            <div className="space-y-8">
                                <div className="flex flex-col items-center">
                                    <div className="relative cursor-pointer group mb-4" onClick={() => logoRef.current?.click()}>
                                        <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-soft flex items-center justify-center bg-aesthetic-cream/40 transition-transform group-hover:scale-105 duration-500 ring-2 ring-aesthetic-pink/20">
                                            {logoPreview ? (
                                                <img
                                                    src={logoPreview.startsWith('blob:') ? logoPreview : api.getImageUrl(logoPreview)}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="material-symbol text-4xl text-aesthetic-accent/40">add_photo_alternate</span>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 size-9 rounded-full bg-aesthetic-pink text-white flex items-center justify-center shadow-lg border-2 border-white group-hover:scale-110 transition-transform">
                                            <span className="material-symbol text-lg">edit</span>
                                        </div>
                                        <input
                                            type="file"
                                            ref={logoRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setLogoFile(file);
                                                    setLogoPreview(URL.createObjectURL(file));
                                                }
                                            }}
                                        />
                                    </div>
                                    <p className="text-[10px] tracking-[0.2em] text-aesthetic-muted uppercase font-bold">Logotipo Principal</p>
                                </div>

                                <Input
                                    label="Nombre del Salón"
                                    value={salonName}
                                    onChange={(e) => setSalonName(e.target.value)}
                                    leftIcon="storefront"
                                />

                                <Input
                                    label="Nota de Bienvenida"
                                    value={tagline}
                                    onChange={(e) => setTagline(e.target.value)}
                                    leftIcon="auto_awesome"
                                />

                                <div>
                                    <label
                                        htmlFor="salon-description"
                                        className="t-label mb-2 block"
                                    >
                                        Sobre tu salón
                                    </label>
                                    <textarea
                                        id="salon-description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={4}
                                        maxLength={1200}
                                        placeholder="Cuéntale a tus clientas qué haces y qué te distingue."
                                        className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-text-strong placeholder:text-text-subtle"
                                    />
                                    <p className="t-meta mt-1.5">
                                        Aparece arriba de tu página de reservas.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <p className="t-label">Tus redes</p>
                                    {SOCIAL_FIELDS.map(({ key, label, icon, placeholder }) => (
                                        <Input
                                            key={key}
                                            label={label}
                                            leftIcon={icon}
                                            placeholder={placeholder}
                                            value={social[key] ?? ''}
                                            onChange={(e) =>
                                                setSocial(current => ({
                                                    ...current,
                                                    [key]: e.target.value,
                                                }))
                                            }
                                        />
                                    ))}
                                </div>

                                <Button
                                    variant="primary"
                                    className="w-full h-14 mt-4"
                                    onClick={handleSaveInfo}
                                    isLoading={saving}
                                >
                                    Guardar Configuración
                                </Button>

                                <Feedback state={saveMsg} />
                            </div>
                        </Card>
                    </div>
                )}

                {tab === 'apariencia' && (
                    <div className="space-y-6 animate-fade-in">
                        <Card variant="raised" className="p-8 border-none shadow-soft">
                            <h3 className="mb-2 font-display text-2xl italic text-aesthetic-taupe">Apariencia</h3>
                            <p className="mb-8 text-[11px] uppercase tracking-[0.15em] text-aesthetic-muted opacity-70">
                                Se aplica a tu página de reservas y a este panel.
                            </p>

                            <fieldset className="mb-10">
                                <legend className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-aesthetic-muted">
                                    Paleta
                                </legend>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {PALETTES.map(palette => (
                                        <label
                                            key={palette.id}
                                            className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition-all ${
                                                paletteId === palette.id
                                                    ? 'border-aesthetic-pink shadow-soft'
                                                    : 'border-transparent bg-surface-sunken/40 hover:border-aesthetic-accent'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="palette"
                                                value={palette.id}
                                                checked={paletteId === palette.id}
                                                onChange={() => setPaletteId(palette.id)}
                                                className="sr-only"
                                            />
                                            <span className="flex shrink-0 gap-1" aria-hidden="true">
                                                {palette.swatches.map(color => (
                                                    <span
                                                        key={color}
                                                        className="size-6 rounded-full border border-white shadow-sm"
                                                        style={{ background: color }}
                                                    />
                                                ))}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-sm font-semibold text-aesthetic-taupe">
                                                    {palette.name}
                                                </span>
                                                <span className="block text-[11px] leading-snug text-aesthetic-muted">
                                                    {palette.description}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            <fieldset className="mb-8">
                                <legend className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-aesthetic-muted">
                                    Tipografía
                                </legend>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {TYPOGRAPHY.map(option => (
                                        <label
                                            key={option.id}
                                            className={`cursor-pointer rounded-2xl border-2 p-4 text-center transition-all ${
                                                typographyId === option.id
                                                    ? 'border-aesthetic-pink shadow-soft'
                                                    : 'border-transparent bg-surface-sunken/40 hover:border-aesthetic-accent'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="typography"
                                                value={option.id}
                                                checked={typographyId === option.id}
                                                onChange={() => setTypographyId(option.id)}
                                                className="sr-only"
                                            />
                                            <span className="block text-2xl text-aesthetic-taupe" style={{ fontFamily: option.display }}>
                                                Aa
                                            </span>
                                            <span className="mt-2 block text-xs font-semibold text-aesthetic-taupe">
                                                {option.label}
                                            </span>
                                            <span className="mt-0.5 block text-[10px] leading-snug text-aesthetic-muted">
                                                {option.description}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            <Button className="h-14 w-full" onClick={handleSaveAppearance} isLoading={saving}>
                                Guardar apariencia
                            </Button>

                            <Feedback state={saveMsg} />
                        </Card>
                    </div>
                )}

                {tab === 'horarios' && (
                    <div className="space-y-6 animate-fade-in">
                        <Card variant="raised" className="p-8 border-none shadow-soft">
                            <h3 className="font-display text-2xl italic text-aesthetic-taupe mb-2">Horarios de Atención</h3>
                            <p className="text-[11px] text-aesthetic-muted mb-8 leading-relaxed uppercase tracking-[0.15em] font-bold italic opacity-70">
                                Define tus horas de operación para el booking dinámico.
                            </p>

                            <div className="space-y-3">
                                {WEEKDAYS.map(({ day: idx, label: dayName }) => {
                                    const sched = weeklySchedule.find(entry => entry.day === idx)
                                        ?? { day: idx, active: false, start: '09:00', end: '18:00' };
                                    const invalid = sched.active && sched.start >= sched.end;

                                    return (
                                        <div key={idx} className={`p-5 rounded-[2rem] border-2 transition-all duration-500 ${sched.active ? 'bg-aesthetic-cream/30 border-aesthetic-pink/20 shadow-sm' : 'bg-gray-50/50 border-gray-100/50 opacity-40 grayscale-[0.5]'}`}>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-4">
                                                    <button 
                                                        onClick={() => updateDay(idx, { active: !sched.active })}
                                                        role="switch"
                                                        aria-checked={sched.active}
                                                        aria-label={`${dayName}: ${sched.active ? 'abierto' : 'cerrado'}`}
                                                        className={`size-7 rounded-full flex items-center justify-center transition-all duration-300 ${sched.active ? 'bg-aesthetic-pink text-white shadow-soft' : 'bg-surface-sunken text-text-subtle'}`}
                                                    >
                                                        <span className="material-symbol text-base font-bold" aria-hidden="true">{sched.active ? 'check' : 'close'}</span>
                                                    </button>
                                                    <span className={`text-xs font-bold uppercase tracking-widest ${sched.active ? 'text-aesthetic-taupe' : 'text-gray-400'}`}>{dayName}</span>
                                                </div>
                                                {sched.active && (
                                                    <span className="status-pill" data-status="completed">Abierto</span>
                                                )}
                                            </div>

                                            {sched.active && (
                                                <div className="flex items-center gap-4 pl-11 animate-fade-in">
                                                    <div className="flex-1 relative">
                                                        <span className="absolute -top-6 left-1 text-[8px] uppercase tracking-widest text-aesthetic-muted font-bold">Inicio</span>
                                                        <input 
                                                            type="time" 
                                                            value={sched.start}
                                                            onChange={e => updateDay(idx, { start: e.target.value })}
                                                            aria-label={`Hora de apertura, ${dayName}`}
                                                            aria-invalid={invalid || undefined}
                                                            className="w-full bg-white border-none rounded-2xl px-4 py-3 text-xs font-bold text-aesthetic-taupe shadow-sm focus:ring-2 focus:ring-aesthetic-pink/20 outline-none" 
                                                        />
                                                    </div>
                                                    <div className="pt-2 text-aesthetic-muted opacity-30">
                                                        <span className="material-symbol text-lg" aria-hidden="true">arrow_forward</span>
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <span className="absolute -top-6 left-1 text-[8px] uppercase tracking-widest text-aesthetic-muted font-bold">Cierre</span>
                                                        <input 
                                                            type="time" 
                                                            value={sched.end}
                                                            onChange={e => updateDay(idx, { end: e.target.value })}
                                                            aria-label={`Hora de cierre, ${dayName}`}
                                                            aria-invalid={invalid || undefined}
                                                            className="w-full bg-white border-none rounded-2xl px-4 py-3 text-xs font-bold text-aesthetic-taupe shadow-sm focus:ring-2 focus:ring-aesthetic-pink/20 outline-none" 
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {invalid && (
                                                <p role="alert" className="mt-3 pl-11 text-[11px] text-danger">
                                                    El cierre debe ser posterior a la apertura.
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <Button className="mt-10 h-14 w-full" onClick={handleSaveSchedule} isLoading={saving}>
                                Guardar horarios
                            </Button>

                            <Feedback state={saveMsg} />
                        </Card>
                    </div>
                )}

                {tab === 'password' && (
                    <div className="space-y-6 animate-fade-in">
                        <Card variant="raised" className="p-8 border-none shadow-soft">
                            <h3 className="font-display text-2xl italic text-aesthetic-taupe mb-8">Cambiar Contraseña</h3>
                            
                            <div className="space-y-6">
                                <Input
                                    label="Contraseña Actual"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    leftIcon="lock_open"
                                />

                                <Input
                                    label="Nueva Contraseña"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    leftIcon="lock"
                                />

                                <Input
                                    label="Confirmar Nueva Contraseña"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    leftIcon="lock_reset"
                                />

                                <Button
                                    variant="primary"
                                    className="w-full h-14 mt-4 py-5 font-display italic text-lg"
                                    onClick={handleChangePassword}
                                    isLoading={pwSaving}
                                >
                                    Guardar Nueva Contraseña
                                </Button>

                                <Feedback state={pwMsg} />
                                
                            </div>
                        </Card>
                    </div>
                )}

                {tab === 'compartir' && <SharePanel domain={tenant?.domain} />}

                {tab === 'cobros' && <GatewayPanel />}

                {tab === 'fidelizacion' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Section heading */}
                        <div>
                            <h2 className="font-display text-2xl italic text-aesthetic-taupe">Programa de Lealtad</h2>
                            <p className="text-[11px] text-aesthetic-muted mt-1 uppercase tracking-[0.15em] font-bold italic opacity-70">
                                Configura las recompensas para tus clientes frecuentes.
                            </p>
                        </div>

                        <Card variant="raised" className="p-8 border-none shadow-soft">
                            {/* Toggle header */}
                            <div className="flex items-center justify-between gap-4 pb-6 border-b border-aesthetic-cream/60">
                                <div>
                                    <p className="text-sm font-bold text-aesthetic-taupe tracking-wide">Activar Programa de Clientes Frecuentes</p>
                                    <p className="text-[10px] text-aesthetic-muted mt-0.5 uppercase tracking-[0.1em]">
                                        {loyaltyEnabled ? 'El programa está activo' : 'Activa el programa para configurarlo'}
                                    </p>
                                </div>
                                {/* iOS-style Toggle */}
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={loyaltyEnabled}
                                    onClick={() => setLoyaltyEnabled(v => !v)}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-aesthetic-pink/30 flex-shrink-0 ${
                                        loyaltyEnabled ? 'bg-aesthetic-pink' : 'bg-gray-200'
                                    }`}
                                >
                                    <span
                                        className={`inline-block size-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                                            loyaltyEnabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Conditional form */}
                            {loyaltyEnabled && (
                                <div className="pt-6 space-y-8 animate-fade-in">

                                    {/* Visits required */}
                                    <div className="space-y-2">
                                        <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-aesthetic-taupe">
                                            Visitas requeridas para recompensa
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <div className="relative flex-1">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbol text-base text-aesthetic-muted">counter_1</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={50}
                                                    value={loyaltyVisits}
                                                    onChange={e => setLoyaltyVisits(Math.max(1, Number(e.target.value)))}
                                                    placeholder="5"
                                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-3.5 text-sm font-bold text-aesthetic-taupe shadow-sm focus:ring-2 focus:ring-aesthetic-pink/20 focus:bg-white focus:border-aesthetic-pink/30 outline-none transition-all"
                                                />
                                            </div>
                                            {/* Stepper helpers */}
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setLoyaltyVisits(v => Math.min(50, v + 1))}
                                                    className="size-8 rounded-full bg-aesthetic-cream hover:bg-aesthetic-soft-pink flex items-center justify-center transition-colors"
                                                >
                                                    <span className="material-symbol text-sm text-aesthetic-taupe">add</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLoyaltyVisits(v => Math.max(1, v - 1))}
                                                    className="size-8 rounded-full bg-aesthetic-cream hover:bg-aesthetic-soft-pink flex items-center justify-center transition-colors"
                                                >
                                                    <span className="material-symbol text-sm text-aesthetic-taupe">remove</span>
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[9px] text-aesthetic-muted uppercase tracking-widest pl-1">Número de citas completadas para desbloquear la recompensa</p>
                                    </div>

                                    {/* Reward type */}
                                    <div className="space-y-2">
                                        <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-aesthetic-taupe">
                                            Tipo de Recompensa
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbol text-base text-aesthetic-muted">card_giftcard</span>
                                            <select
                                                value={loyaltyRewardType}
                                                onChange={e => setLoyaltyRewardType(e.target.value as 'discount' | 'free_service')}
                                                className="w-full appearance-none bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-10 py-3.5 text-sm font-bold text-aesthetic-taupe shadow-sm focus:ring-2 focus:ring-aesthetic-pink/20 focus:bg-white focus:border-aesthetic-pink/30 outline-none transition-all cursor-pointer"
                                            >
                                                <option value="discount">Porcentaje de Descuento</option>
                                                <option value="free_service">Servicio Gratis</option>
                                            </select>
                                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 material-symbol text-base text-aesthetic-muted">expand_more</span>
                                        </div>
                                    </div>

                                    {/* Discount value — only when discount type is selected */}
                                    {loyaltyRewardType === 'discount' && (
                                        <div className="space-y-2 animate-fade-in">
                                            <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-aesthetic-taupe">
                                                Valor del Descuento
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbol text-base text-aesthetic-muted">percent</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={100}
                                                    value={loyaltyDiscountValue}
                                                    onChange={e => setLoyaltyDiscountValue(Math.min(100, Math.max(1, Number(e.target.value))))}
                                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-12 py-3.5 text-sm font-bold text-aesthetic-taupe shadow-sm focus:ring-2 focus:ring-aesthetic-pink/20 focus:bg-white focus:border-aesthetic-pink/30 outline-none transition-all"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-aesthetic-pink">%</span>
                                            </div>
                                            <p className="text-[9px] text-aesthetic-muted uppercase tracking-widest pl-1">Porcentaje de descuento aplicado a la cita de recompensa</p>
                                        </div>
                                    )}

                                    {/* Save button */}
                                    <div className="pt-2">
                                        <Button
                                            variant="primary"
                                            className="w-full h-14"
                                            onClick={handleSaveLoyalty}
                                            isLoading={loyaltySaving}
                                        >
                                            Guardar Configuración
                                        </Button>
                                        <Feedback state={loyaltyMsg} />
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
