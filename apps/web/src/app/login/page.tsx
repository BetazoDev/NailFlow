'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { authErrorMessage } from '@/lib/auth-errors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * Sign-in for the salon's admin panel.
 *
 * Signing in no longer writes a `mock_auth_token` cookie or a `mock_role` to
 * localStorage: the panel asks the API who the user is, so the browser cannot
 * grant itself a role.
 */
export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError('');

        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
            router.replace('/admin');
        } catch (caught) {
            setError(authErrorMessage(caught));
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');

        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
            router.replace('/admin');
        } catch (caught) {
            const message = authErrorMessage(caught);
            if (message) setError(message);
            setLoading(false);
        }
    };

    return (
        <main className="flex min-h-dvh flex-col justify-center bg-surface px-6 py-12">
            <div className="mx-auto w-full max-w-md">
                <div className="rounded-3xl border border-line bg-surface-raised p-8 shadow-soft">
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-secondary shadow-md">
                            <span className="font-display text-2xl font-bold text-white">N</span>
                        </div>
                        <h1 className="mb-2 font-display text-3xl font-semibold text-text-strong">
                            Ingresa a tu cuenta
                        </h1>
                        <p className="text-sm text-text-muted">Panel de administración NailFlow</p>
                    </div>

                    {error && (
                        <p
                            role="alert"
                            className="mb-6 flex gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
                        >
                            {error}
                        </p>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <Input
                            label="Correo electrónico"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={event => setEmail(event.target.value)}
                            placeholder="tu@correo.com"
                        />

                        <Input
                            label="Contraseña"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={event => setPassword(event.target.value)}
                            placeholder="••••••••"
                        />

                        <Button type="submit" size="lg" isLoading={loading} loadingLabel="Entrando…" className="w-full">
                            Iniciar sesión
                        </Button>
                    </form>

                    <p className="mt-5 text-center">
                        <Link
                            href="/forgot-password"
                            className="text-xs font-semibold text-text-muted underline-offset-4 hover:text-brand hover:underline"
                        >
                            ¿Olvidaste tu contraseña?
                        </Link>
                    </p>

                    <div className="relative my-8">
                        <span className="absolute inset-0 flex items-center" aria-hidden="true">
                            <span className="w-full border-t border-line" />
                        </span>
                        <span className="relative mx-auto block w-fit bg-surface-raised px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                            O continuar con
                        </span>
                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full"
                        leftIcon={
                            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.01.68-2.31 1.14-3.71 1.14-2.86 0-5.27-1.94-6.14-4.55H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.86 14.17c-.22-.66-.35-1.36-.35-2.08s.13-1.42.35-2.08V7.17H2.18C1.43 8.61 1 10.26 1 12s.43 3.39 1.18 4.83l3.68-2.66z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.17l3.68 2.84c.87-2.6 3.28-4.55 6.14-4.55z" fill="#EA4335" />
                            </svg>
                        }
                    >
                        Google
                    </Button>
                </div>

                <p className="mt-6 text-center text-sm text-text-muted">
                    ¿No tienes cuenta?{' '}
                    <Link href="/signup" className="font-bold text-brand hover:underline">
                        Regístrate aquí
                    </Link>
                </p>
            </div>
        </main>
    );
}
