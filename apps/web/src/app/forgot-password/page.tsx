'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendPasswordResetEmail, type ActionCodeSettings } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { authErrorMessage } from '@/lib/auth-errors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * Password recovery.
 *
 * Firebase hosts the page where the new password is actually set; this screen
 * only asks for the address and triggers the email.
 */
export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [error, setError] = useState('');

    /**
     * Brings the salon owner back to their own login page after resetting,
     * instead of leaving them on Firebase's generic confirmation.
     *
     * The domain must be listed under Firebase Auth → Settings → Authorized
     * domains. If it is not, Firebase rejects the continue URL, so we fall back
     * to a plain send rather than failing the whole recovery.
     */
    async function sendResetEmail(address: string): Promise<void> {
        const settings: ActionCodeSettings = {
            url: `${window.location.origin}/login`,
            handleCodeInApp: false,
        };

        try {
            await sendPasswordResetEmail(auth, address, settings);
        } catch (caught) {
            const code =
                typeof caught === 'object' && caught !== null && 'code' in caught
                    ? String((caught as { code: unknown }).code)
                    : '';

            if (code === 'auth/unauthorized-continue-uri' || code === 'auth/invalid-continue-uri') {
                await sendPasswordResetEmail(auth, address);
                return;
            }
            throw caught;
        }
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const address = email.trim();
        if (!address) return;

        setStatus('sending');
        setError('');

        try {
            await sendResetEmail(address);
            setStatus('sent');
        } catch (caught) {
            const code =
                typeof caught === 'object' && caught !== null && 'code' in caught
                    ? String((caught as { code: unknown }).code)
                    : '';

            // An unknown address gets the same answer as a known one. Saying
            // "no existe esa cuenta" would let anyone check which emails are
            // registered, one guess at a time.
            if (code === 'auth/user-not-found') {
                setStatus('sent');
                return;
            }

            setError(authErrorMessage(caught));
            setStatus('idle');
        }
    };

    if (status === 'sent') {
        return (
            <main className="flex min-h-dvh flex-col justify-center bg-surface px-6 py-12">
                <div className="mx-auto w-full max-w-md">
                    <div className="rounded-3xl border border-line bg-surface-raised p-8 text-center shadow-soft">
                        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-brand-tint">
                            <span className="material-symbol text-3xl text-brand" aria-hidden="true">
                                mark_email_read
                            </span>
                        </div>

                        <h1 className="mb-3 font-display text-2xl font-semibold text-text-strong">
                            Revisa tu correo
                        </h1>
                        <p className="mb-2 text-sm leading-relaxed text-text-muted">
                            Si <strong className="text-text-strong">{email.trim()}</strong> tiene una
                            cuenta, le acabamos de enviar un enlace para crear una contraseña nueva.
                        </p>
                        <p className="mb-8 text-xs text-text-subtle">
                            El enlace caduca en una hora. Si no lo ves, mira en spam.
                        </p>

                        <div className="space-y-3">
                            <Link
                                href="/login"
                                className="btn-gradient flex w-full items-center justify-center py-4 text-sm"
                            >
                                Volver a iniciar sesión
                            </Link>
                            <button
                                onClick={() => setStatus('idle')}
                                className="w-full py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted underline-offset-4 hover:underline"
                            >
                                Usar otro correo
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="flex min-h-dvh flex-col justify-center bg-surface px-6 py-12">
            <div className="mx-auto w-full max-w-md">
                <div className="rounded-3xl border border-line bg-surface-raised p-8 shadow-soft">
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-brand-tint">
                            <span className="material-symbol text-3xl text-brand" aria-hidden="true">
                                lock_reset
                            </span>
                        </div>
                        <h1 className="mb-2 font-display text-3xl font-semibold text-text-strong">
                            Recupera tu acceso
                        </h1>
                        <p className="text-sm text-text-muted">
                            Dinos tu correo y te enviamos un enlace para crear una contraseña nueva.
                        </p>
                    </div>

                    {error && (
                        <p
                            role="alert"
                            className="mb-6 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
                        >
                            {error}
                        </p>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            label="Correo electrónico"
                            type="email"
                            autoComplete="email"
                            required
                            autoFocus
                            value={email}
                            onChange={event => setEmail(event.target.value)}
                            placeholder="tu@correo.com"
                        />

                        <Button
                            type="submit"
                            size="lg"
                            isLoading={status === 'sending'}
                            loadingLabel="Enviando…"
                            className="w-full"
                        >
                            Enviar enlace
                        </Button>
                    </form>
                </div>

                <p className="mt-6 text-center text-sm text-text-muted">
                    ¿Ya la recordaste?{' '}
                    <Link href="/login" className="font-bold text-brand hover:underline">
                        Inicia sesión
                    </Link>
                </p>
            </div>
        </main>
    );
}
