'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (!email || !password) {
                throw new Error('Ingresa correo y contraseña');
            }
            if (password.length < 6) {
                throw new Error('La contraseña debe tener al menos 6 caracteres');
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Set session
            document.cookie = `mock_auth_token=uid_${userCredential.user.uid}; path=/`;
            localStorage.setItem('mock_role', 'owner');

            router.push('/admin');
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Error al crear cuenta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex text-charcoal flex-col justify-center sm:py-12 bg-cream relative">
            <div className="p-10 xs:p-0 mx-auto md:w-full md:max-w-md">
                <div className="bg-white shadow w-full rounded-2xl border border-cream-dark p-8 mb-6">
                    <div className="text-center mb-8">
                        <h1 className="font-serif text-3xl font-semibold mb-2">Crea tu cuenta</h1>
                        <p className="text-nf-gray text-sm font-medium">Administrador NailFlow</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold mb-2">Correo Electrónico</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-14 px-5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-pink focus:bg-white outline-none"
                                placeholder="tu@correo.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2">Contraseña</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-14 px-5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-pink focus:bg-white outline-none"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-gradient w-full py-4 rounded-2xl text-white font-bold"
                        >
                            {loading ? 'Creando...' : 'Crear Cuenta'}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm">
                        <p className="text-nf-gray font-medium">
                            ¿Ya tienes cuenta? <Link href="/login" className="text-pink font-bold">Inicia Sesión</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
