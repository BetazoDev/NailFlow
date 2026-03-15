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
    const [tab, setTab] = useState<'info' | 'password'>('info');

    // Tenant Info
    const [salonName, setSalonName] = useState('');
    const [tagline, setTagline] = useState('');
    const [currentBranding, setCurrentBranding] = useState<Record<string, unknown> | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const logoRef = useRef<HTMLInputElement>(null);

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

            await api.updateTenant(tenantId, {
                name: salonName,
                branding: updatedBranding
            });
            setCurrentBranding(updatedBranding);

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
                    <div className="size-16 rounded-full bg-aesthetic-soft-pink border-2 border-aesthetic-pink/30 flex items-center justify-center text-aesthetic-taupe text-2xl font-display italic flex-shrink-0">
                        {user?.email?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-display text-lg italic text-aesthetic-taupe truncate">{user?.email || 'Sin sesión'}</p>
                        <p className="text-[10px] tracking-[0.15em] text-aesthetic-muted uppercase mt-1">Administrador</p>
                    </div>
                </Card>
            </div>

            {/* Tabs */}
            <div className="px-6 mb-6">
                <div className="flex gap-1 bg-aesthetic-cream rounded-full p-1">
                    {([['info', 'Información del Negocio'], ['password', 'Cambiar Contraseña']] as const).map(([id, label]) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={`flex-1 py-2 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase transition-all duration-200 ${tab === id ? 'bg-white shadow-sm text-aesthetic-taupe' : 'text-aesthetic-muted/60'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="px-6">
                {tab === 'info' && (
                    <Card variant="white" className="p-8 space-y-6">
                        <div className="space-y-4">
                            <label className="font-display text-xs italic text-aesthetic-muted tracking-wider ml-1">Logotipo del negocio</label>
                            <div className="flex items-center gap-6">
                                <div className="relative cursor-pointer group" onClick={() => logoRef.current?.click()}>
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-aesthetic-accent/50 flex items-center justify-center bg-aesthetic-cream/40 transition-transform group-hover:scale-105 duration-500">
                                        {logoPreview ? (
                                            <img src={api.getPublicUrl(logoPreview)} alt="logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="material-symbol text-3xl text-aesthetic-muted">image</span>
                                        )}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 size-8 bg-aesthetic-pink rounded-full flex items-center justify-center border-2 border-white shadow-soft text-white">
                                        <span className="material-symbol text-sm">photo_camera</span>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-aesthetic-muted/80 leading-relaxed mb-2">
                                        Sube el logotipo de tu salón para que aparezca en tu agenda pública y en la página de reservas.
                                    </p>
                                    <p className="text-[9px] font-bold text-aesthetic-pink tracking-widest uppercase">
                                        JPG, PNG. max 2MB.
                                    </p>
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={logoRef}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setLogoFile(e.target.files[0]);
                                        setLogoPreview(URL.createObjectURL(e.target.files[0]));
                                    }
                                }}
                            />
                        </div>

                        <Input 
                            label="Nombre del salón"
                            value={salonName}
                            onChange={e => setSalonName(e.target.value)}
                            placeholder="Ej. Nails by Ana"
                            leftIcon="storefront"
                        />

                        <Input 
                            label="Tagline / Eslogan"
                            value={tagline}
                            onChange={e => setTagline(e.target.value)}
                            placeholder="Ej. Tu belleza, nuestra pasión"
                            leftIcon="auto_awesome"
                        />

                        {saveMsg && (
                            <div className={`p-4 rounded-2xl text-sm text-center ${saveMsg.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-[#88C999]'}`}>
                                {saveMsg}
                            </div>
                        )}

                        <Button
                            onClick={handleSaveInfo}
                            isLoading={saving}
                            className="w-full h-14"
                        >
                            Guardar Cambios
                        </Button>
                    </Card>
                )}

                {tab === 'password' && (
                    <Card variant="white" className="p-8 space-y-6">
                        <Input 
                            label="Contraseña actual"
                            type="password"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            placeholder="••••••••"
                            leftIcon="lock_open"
                        />
                        <Input 
                            label="Nueva contraseña"
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            leftIcon="lock"
                        />
                        <Input 
                            label="Confirmar nueva contraseña"
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            leftIcon="lock_reset"
                        />

                        {pwError && (
                            <div className="p-4 rounded-2xl text-sm text-center bg-red-50 text-red-600">{pwError}</div>
                        )}
                        {pwMsg && (
                            <div className="p-4 rounded-2xl text-sm text-center bg-green-50 text-[#88C999]">{pwMsg}</div>
                        )}

                        <Button
                            onClick={handleChangePassword}
                            isLoading={pwSaving}
                            variant="primary"
                            className="w-full h-14"
                        >
                            Cambiar Contraseña
                        </Button>
                    </Card>
                )}
            </div>
        </div>
    );
}
