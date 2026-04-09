'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useTenant } from '@/lib/tenant-context';
import {
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function ProfilePage() {
    const { tenantId } = useTenant();
    const [tab, setTab] = useState<'info' | 'password' | 'horarios' | 'fidelizacion'>('info');

    const [salonName, setSalonName] = useState('');
    const [tagline, setTagline] = useState('');
    const [currentBranding, setCurrentBranding] = useState<any>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [weeklySchedule, setWeeklySchedule] = useState<{ day: number; active: boolean; start: string; end: string }[]>([]);
    const [currentSettings, setCurrentSettings] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const logoRef = useRef<HTMLInputElement>(null);

    // Loyalty program state
    const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
    const [loyaltyVisits, setLoyaltyVisits] = useState(5);
    const [loyaltyRewardType, setLoyaltyRewardType] = useState<'discount' | 'free_service'>('discount');
    const [loyaltyDiscountValue, setLoyaltyDiscountValue] = useState(10);
    const [loyaltySaving, setLoyaltySaving] = useState(false);
    const [loyaltyMsg, setLoyaltyMsg] = useState('');

    // Password
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMsg, setPwMsg] = useState('');
    const [pwError, setPwError] = useState('');

    // Current user info
    const user = auth.currentUser;

    useEffect(() => {
        if (!tenantId) return;
        api.getTenant(tenantId).then(tenant => {
            if (tenant) {
                setSalonName(tenant.name || '');
                setTagline(tenant.branding?.tagline || '');
                setLogoPreview(tenant.branding?.logo_url || null);
                setCurrentBranding(tenant.branding);
                setCurrentSettings(tenant.settings);
                
                // Initialize schedule
                const defaultSchedule = [
                    { day: 1, active: true, start: '09:00', end: '20:00' },
                    { day: 2, active: true, start: '09:00', end: '20:00' },
                    { day: 3, active: true, start: '09:00', end: '20:00' },
                    { day: 4, active: true, start: '09:00', end: '20:00' },
                    { day: 5, active: true, start: '09:00', end: '20:00' },
                    { day: 6, active: true, start: '09:00', end: '15:00' },
                    { day: 0, active: false, start: '09:00', end: '09:00' },
                ];
                setWeeklySchedule(tenant.settings?.weekly_schedule || defaultSchedule);

                // Initialize loyalty settings from saved data
                const loyalty = tenant.settings?.loyalty;
                if (loyalty) {
                    setLoyaltyEnabled(loyalty.enabled ?? false);
                    setLoyaltyVisits(loyalty.visits_required ?? 5);
                    setLoyaltyRewardType(loyalty.reward_type ?? 'discount');
                    setLoyaltyDiscountValue(loyalty.discount_value ?? 10);
                }
            }
        });
    }, [tenantId]);

    const handleSaveInfo = async () => {
        if (!tenantId) return;
        setSaving(true);
        setSaveMsg('');
        try {
            let finalLogoUrl = logoPreview || '';
            if (logoFile) {
                finalLogoUrl = await api.uploadImage(tenantId, 'branding', logoFile);
                setLogoPreview(finalLogoUrl);
            }

            const updatedBranding: any = currentBranding
                ? { ...currentBranding, logo_url: finalLogoUrl, tagline }
                : { logo_url: finalLogoUrl, tagline, primary_color: '#C97794', secondary_color: '#F8D2D8' };

            const updatedSettings: any = {
                ...(currentSettings || { currency: 'MXN', timezone: 'America/Mexico_City' }),
                weekly_schedule: weeklySchedule
            };

            await api.updateTenant(tenantId, {
                name: salonName,
                branding: updatedBranding,
                settings: updatedSettings
            });
            
            setCurrentBranding(updatedBranding);
            setCurrentSettings(updatedSettings);

            // Notify the admin layout sidebar to update immediately (no page reload needed)
            window.dispatchEvent(new CustomEvent('tenant-updated', {
                detail: { name: salonName, logoUrl: finalLogoUrl, tagline }
            }));

            setSaveMsg('¡Información actualizada con éxito!');
        } catch (e: unknown) {
            setSaveMsg((e as Error).message || 'Error al guardar. Intenta de nuevo.');
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMsg(''), 3000);
        }
    };

    const handleChangePassword = async () => {
        setPwError('');
        setPwMsg('');
        if (!newPassword || !currentPassword) {
            setPwError('Por favor llena todos los campos.');
            return;
        }
        if (newPassword.length < 6) {
            setPwError('La nueva contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwError('Las contraseñas no coinciden.');
            return;
        }
        if (!user || !user.email) {
            setPwError('No hay sesión activa.');
            return;
        }
        setPwSaving(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            setPwMsg('¡Contraseña actualizada con éxito!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (e: unknown) {
            const firebaseError = e as { code?: string; message?: string };
            if (firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
                setPwError('La contraseña actual es incorrecta.');
            } else {
                setPwError(firebaseError.message || 'Error al cambiar la contraseña.');
            }
        } finally {
            setPwSaving(false);
            setTimeout(() => setPwMsg(''), 3000);
        }
    };

    const handleSaveLoyalty = async () => {
        if (!tenantId) return;
        setLoyaltySaving(true);
        setLoyaltyMsg('');
        try {
            const loyaltySettings = {
                enabled: loyaltyEnabled,
                visits_required: loyaltyVisits,
                reward_type: loyaltyRewardType,
                discount_value: loyaltyRewardType === 'discount' ? loyaltyDiscountValue : null,
            };
            const updatedSettings: any = {
                ...(currentSettings || { currency: 'MXN', timezone: 'America/Mexico_City' }),
                loyalty: loyaltySettings,
            };
            await api.updateTenant(tenantId, { settings: updatedSettings });
            setCurrentSettings(updatedSettings);
            setLoyaltyMsg('¡Programa de lealtad guardado con éxito!');
        } catch (e: unknown) {
            setLoyaltyMsg((e as Error).message || 'Error al guardar. Intenta de nuevo.');
        } finally {
            setLoyaltySaving(false);
            setTimeout(() => setLoyaltyMsg(''), 3000);
        }
    };

    return (
        <div className="min-h-full pb-24" style={{ background: 'var(--cream)' }}>
            {/* Header */}
            <div className="px-6 pt-8 pb-6">
                <p className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase mb-2 font-display italic font-medium">Administración</p>
                <h1 className="font-display text-4xl font-light italic tracking-tight text-aesthetic-taupe">Mi Perfil</h1>
            </div>

            {/* Avatar section */}
            <div className="px-6 mb-8">
                <Card variant="white" className="flex items-center gap-5 p-6">
                    <div className="size-24 rounded-full bg-aesthetic-soft-pink border-4 border-white shadow-soft flex items-center justify-center text-aesthetic-taupe text-4xl font-display italic flex-shrink-0 overflow-hidden ring-1 ring-aesthetic-accent/50">
                        {logoPreview ? (
                            <img src={api.getPublicUrl(logoPreview)} alt="Logo" className="w-full h-full object-cover" />
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
                    {( [['info', 'Negocio', 'storefront'], ['horarios', 'Horarios', 'schedule'], ['password', 'Seguridad', 'shield'], ['fidelizacion', 'Fidelización', 'card_giftcard']] as const).map(([id, label, icon]) => (
                        <button
                            key={id}
                            onClick={() => setTab(id as typeof tab)}
                            className={`flex flex-1 items-center justify-center gap-2 py-3.5 px-6 rounded-[1.5rem] text-[10px] tracking-[0.2em] uppercase font-bold transition-all whitespace-nowrap ${tab === id ? 'bg-white text-aesthetic-pink shadow-md' : 'text-aesthetic-muted hover:text-aesthetic-taupe hover:bg-white/30'}`}
                        >
                            <span className="material-symbol text-base">{icon}</span>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Tabs */}
            <div className="px-6">
                {tab === 'info' && (
                    <div className="space-y-6 animate-fade-in">
                        <Card variant="white" className="p-8 border-none shadow-soft overflow-hidden">
                            <h3 className="font-display text-2xl italic text-aesthetic-taupe mb-8">Información del Salón</h3>
                            
                            <div className="space-y-8">
                                <div className="flex flex-col items-center">
                                    <div className="relative cursor-pointer group mb-4" onClick={() => logoRef.current?.click()}>
                                        <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-soft flex items-center justify-center bg-aesthetic-cream/40 transition-transform group-hover:scale-105 duration-500 ring-2 ring-aesthetic-pink/20">
                                            {logoPreview ? (
                                                <img src={api.getPublicUrl(logoPreview)} alt="logo" className="w-full h-full object-cover" />
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

                                <Button
                                    variant="primary"
                                    className="w-full h-14 mt-4"
                                    onClick={handleSaveInfo}
                                    isLoading={saving}
                                >
                                    Guardar Configuración
                                </Button>

                                {saveMsg && (
                                    <p className={`text-center text-[10px] font-bold uppercase tracking-widest animate-fade-in ${saveMsg.includes('éxito') ? 'text-green-500' : 'text-red-500'}`}>
                                        {saveMsg}
                                    </p>
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {tab === 'horarios' && (
                    <div className="space-y-6 animate-fade-in">
                        <Card variant="white" className="p-8 border-none shadow-soft">
                            <h3 className="font-display text-2xl italic text-aesthetic-taupe mb-2">Horarios de Atención</h3>
                            <p className="text-[11px] text-aesthetic-muted mb-8 leading-relaxed uppercase tracking-[0.15em] font-bold italic opacity-70">
                                Define tus horas de operación para el booking dinámico.
                            </p>

                            <div className="space-y-3">
                                {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((dayName, idx) => {
                                    const sched = weeklySchedule.find(s => s.day === idx) || { day: idx, active: false, start: '09:00', end: '18:00' };
                                    return (
                                        <div key={idx} className={`p-5 rounded-[2rem] border-2 transition-all duration-500 ${sched.active ? 'bg-aesthetic-cream/30 border-aesthetic-pink/20 shadow-sm' : 'bg-gray-50/50 border-gray-100/50 opacity-40 grayscale-[0.5]'}`}>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-4">
                                                    <button 
                                                        onClick={() => {
                                                            const newSched = [...weeklySchedule];
                                                            const i = newSched.findIndex(s => s.day === idx);
                                                            if (i >= 0) newSched[i].active = !newSched[i].active;
                                                            else newSched.push({ day: idx, active: true, start: '09:00', end: '18:00' });
                                                            setWeeklySchedule(newSched);
                                                        }}
                                                        className={`size-7 rounded-full flex items-center justify-center transition-all duration-300 ${sched.active ? 'bg-aesthetic-pink text-white shadow-mid' : 'bg-gray-200 text-gray-400'}`}
                                                    >
                                                        {sched.active ? <span className="material-symbol text-base font-bold">check</span> : <span className="material-symbol text-base font-bold">close</span>}
                                                    </button>
                                                    <span className={`text-xs font-bold uppercase tracking-widest ${sched.active ? 'text-aesthetic-taupe' : 'text-gray-400'}`}>{dayName}</span>
                                                </div>
                                                {sched.active && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-full">
                                                        <div className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                                                        <span className="text-[9px] text-green-600 font-bold uppercase tracking-widest">Activo</span>
                                                    </div>
                                                )}
                                            </div>

                                            {sched.active && (
                                                <div className="flex items-center gap-4 pl-11 animate-fade-in">
                                                    <div className="flex-1 relative">
                                                        <span className="absolute -top-6 left-1 text-[8px] uppercase tracking-widest text-aesthetic-muted font-bold">Inicio</span>
                                                        <input 
                                                            type="time" 
                                                            value={sched.start}
                                                            onChange={(e) => {
                                                                const newSched = [...weeklySchedule];
                                                                const i = newSched.findIndex(s => s.day === idx);
                                                                newSched[i].start = e.target.value;
                                                                setWeeklySchedule(newSched);
                                                            }}
                                                            className="w-full bg-white border-none rounded-2xl px-4 py-3 text-xs font-bold text-aesthetic-taupe shadow-sm focus:ring-2 focus:ring-aesthetic-pink/20 outline-none" 
                                                        />
                                                    </div>
                                                    <div className="pt-2 text-aesthetic-muted opacity-30">
                                                        <span className="material-symbol text-lg">arrow_forward</span>
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <span className="absolute -top-6 left-1 text-[8px] uppercase tracking-widest text-aesthetic-muted font-bold">Cierre</span>
                                                        <input 
                                                            type="time" 
                                                            value={sched.end}
                                                            onChange={(e) => {
                                                                const newSched = [...weeklySchedule];
                                                                const i = newSched.findIndex(s => s.day === idx);
                                                                newSched[i].end = e.target.value;
                                                                setWeeklySchedule(newSched);
                                                            }}
                                                            className="w-full bg-white border-none rounded-2xl px-4 py-3 text-xs font-bold text-aesthetic-taupe shadow-sm focus:ring-2 focus:ring-aesthetic-pink/20 outline-none" 
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <Button variant="primary" className="w-full h-14 mt-10" onClick={handleSaveInfo} isLoading={saving}>
                                Actualizar Todos los Horarios
                            </Button>
                        </Card>
                    </div>
                )}

                {tab === 'password' && (
                    <div className="space-y-6 animate-fade-in">
                        <Card variant="white" className="p-8 border-none shadow-soft">
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

                                {pwMsg && (
                                    <p className="text-center text-[10px] font-bold uppercase tracking-widest animate-fade-in text-green-500">
                                        {pwMsg}
                                    </p>
                                )}
                                {pwError && (
                                    <p className="text-center text-[10px] font-bold uppercase tracking-widest animate-fade-in text-red-500">
                                        {pwError}
                                    </p>
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {tab === 'fidelizacion' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Section heading */}
                        <div>
                            <h2 className="font-display text-2xl italic text-aesthetic-taupe">Programa de Lealtad</h2>
                            <p className="text-[11px] text-aesthetic-muted mt-1 uppercase tracking-[0.15em] font-bold italic opacity-70">
                                Configura las recompensas para tus clientes frecuentes.
                            </p>
                        </div>

                        <Card variant="white" className="p-8 border-none shadow-soft">
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
                                        {loyaltyMsg && (
                                            <p className={`text-center text-[10px] font-bold uppercase tracking-widest animate-fade-in mt-3 ${
                                                loyaltyMsg.includes('éxito') ? 'text-green-500' : 'text-red-500'
                                            }`}>
                                                {loyaltyMsg}
                                            </p>
                                        )}
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
