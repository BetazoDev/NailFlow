'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useTenant } from '@/lib/tenant-context';
import {
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    getAuth
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function ProfilePage() {
    const { tenantId } = useTenant();
    const [tab, setTab] = useState<'info' | 'password'>('info');

    // Tenant Info
    const [salonName, setSalonName] = useState('');
    const [tagline, setTagline] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

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
            }
        });
    }, [tenantId]);

    const handleSaveInfo = async () => {
        if (!tenantId) return;
        setSaving(true);
        setSaveMsg('');
        try {
            await api.updateTenant(tenantId, { name: salonName });
            setSaveMsg('¡Información actualizada con éxito!');
        } catch (e) {
            setSaveMsg('Error al guardar. Intenta de nuevo.');
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
        } catch (e: any) {
            if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
                setPwError('La contraseña actual es incorrecta.');
            } else {
                setPwError(e.message || 'Error al cambiar la contraseña.');
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
                <div className="flex items-center gap-5 bg-white rounded-[2rem] p-6 border border-aesthetic-accent shadow-minimal">
                    <div className="size-16 rounded-full bg-aesthetic-soft-pink border-2 border-aesthetic-pink/30 flex items-center justify-center text-aesthetic-taupe text-2xl font-display italic flex-shrink-0">
                        {user?.email?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-display text-lg italic text-aesthetic-taupe truncate">{user?.email || 'Sin sesión'}</p>
                        <p className="text-[10px] tracking-[0.15em] text-aesthetic-muted uppercase mt-1">Administrador</p>
                    </div>
                </div>
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
                    <div className="bg-white rounded-[2rem] p-8 border border-aesthetic-accent shadow-minimal space-y-6">
                        <div className="space-y-2">
                            <label className="font-display text-xs italic text-aesthetic-muted tracking-wider ml-1">Nombre del salón</label>
                            <input
                                value={salonName}
                                onChange={e => setSalonName(e.target.value)}
                                className="w-full bg-aesthetic-cream/40 border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/40 rounded-2xl p-4 font-display italic text-aesthetic-taupe"
                                placeholder="Ej. Nails by Ana"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="font-display text-xs italic text-aesthetic-muted tracking-wider ml-1">Tagline / Eslogan</label>
                            <input
                                value={tagline}
                                onChange={e => setTagline(e.target.value)}
                                className="w-full bg-aesthetic-cream/40 border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/40 rounded-2xl p-4 font-display italic text-aesthetic-taupe"
                                placeholder="Ej. Tu belleza, nuestra pasión"
                            />
                        </div>

                        {saveMsg && (
                            <div className={`p-4 rounded-2xl text-sm text-center ${saveMsg.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-[#88C999]'}`}>
                                {saveMsg}
                            </div>
                        )}

                        <button
                            onClick={handleSaveInfo}
                            disabled={saving}
                            className="w-full bg-aesthetic-pink text-white py-4 rounded-2xl font-bold text-[11px] tracking-[0.2em] uppercase transition-all hover:bg-aesthetic-taupe active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Guardar Cambios'}
                        </button>
                    </div>
                )}

                {tab === 'password' && (
                    <div className="bg-white rounded-[2rem] p-8 border border-aesthetic-accent shadow-minimal space-y-6">
                        <div className="space-y-2">
                            <label className="font-display text-xs italic text-aesthetic-muted tracking-wider ml-1">Contraseña actual</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                className="w-full bg-aesthetic-cream/40 border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/40 rounded-2xl p-4 font-display italic text-aesthetic-taupe"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="font-display text-xs italic text-aesthetic-muted tracking-wider ml-1">Nueva contraseña</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full bg-aesthetic-cream/40 border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/40 rounded-2xl p-4 font-display italic text-aesthetic-taupe"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="font-display text-xs italic text-aesthetic-muted tracking-wider ml-1">Confirmar nueva contraseña</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full bg-aesthetic-cream/40 border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/40 rounded-2xl p-4 font-display italic text-aesthetic-taupe"
                                placeholder="••••••••"
                            />
                        </div>

                        {pwError && (
                            <div className="p-4 rounded-2xl text-sm text-center bg-red-50 text-red-600">{pwError}</div>
                        )}
                        {pwMsg && (
                            <div className="p-4 rounded-2xl text-sm text-center bg-green-50 text-[#88C999]">{pwMsg}</div>
                        )}

                        <button
                            onClick={handleChangePassword}
                            disabled={pwSaving}
                            className="w-full bg-aesthetic-taupe text-white py-4 rounded-2xl font-bold text-[11px] tracking-[0.2em] uppercase transition-all hover:bg-black active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {pwSaving ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Cambiar Contraseña'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
