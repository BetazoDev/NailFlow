'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api, ApiError } from '@/lib/api';
import { authErrorMessage } from '@/lib/auth-errors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * First-run sign-up: creates the account *and* claims the salon on this domain.
 *
 * Previously it only created a Firebase user, so the new owner landed in an
 * admin panel that belonged to nobody — no salon, no staff record, no access.
 */
export default function SignupPage() {
    const router = useRouter();
    const [salonName, setSalonName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSignup = async (event: React.FormEvent) => {
        event.preventDefault();

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setLoading(true);
        setError('');

        let created = false;

        try {
            await createUserWithEmailAndPassword(auth, email.trim(), password);
            created = true;
            await api.claimTenant(salonName.trim());
            router.replace('/admin');
        } catch (caught) {
            // If the account exists but the salon is already claimed, roll the
            // account back — leaving an orphaned login the user cannot use
            // anywhere is worse than asking them to sign in instead.
            if (created && auth.currentUser) {
                await deleteUser(auth.currentUser).catch(() => {});
            }

            setError(
                caught instanceof ApiError ? caught.message : authErrorMessage(caught)
            );
            setLoading(false);
        }
    };

    return (
        <main className="flex min-h-dvh flex-col justify-center bg-surface px-6 py-12">
            <div className="mx-auto w-full max-w-md">
                <div className="rounded-3xl border border-line bg-surface-raised p-8 shadow-soft">
                    <div className="mb-8 text-center">
                        <h1 className="mb-2 font-display text-3xl font-semibold text-text-strong">
                            Crea tu salón
                        </h1>
                        <p className="text-sm text-text-muted">
                            Serás la propietaria de este espacio en NailFlow.
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

                    <form onSubmit={handleSignup} className="space-y-5">
                        <Input
                            label="Nombre del salón"
                            required
                            value={salonName}
                            onChange={event => setSalonName(event.target.value)}
                            placeholder="Ana Nails Studio"
                            helperText="Es lo que verán tus clientas al reservar."
                        />

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
                            autoComplete="new-password"
                            required
                            minLength={6}
                            value={password}
                            onChange={event => setPassword(event.target.value)}
                            placeholder="••••••••"
                            helperText="Mínimo 6 caracteres."
                        />

                        <Button type="submit" size="lg" isLoading={loading} loadingLabel="Creando…" className="w-full">
                            Crear cuenta
                        </Button>
                    </form>
                </div>

                <p className="mt-6 text-center text-sm text-text-muted">
                    ¿Ya tienes cuenta?{' '}
                    <Link href="/login" className="font-bold text-brand hover:underline">
                        Inicia sesión
                    </Link>
                </p>
            </div>
        </main>
    );
}
