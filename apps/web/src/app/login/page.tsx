'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLoginSuccess = (user: any) => {
        // Set cookie so admin layout guard works (static export, no SSR)
        document.cookie = `mock_auth_token=uid_${user.uid}; path=/`;
        localStorage.setItem('mock_role', 'owner');
        router.push('/admin');
        router.refresh();
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (!email || !password) {
                throw new Error('Por favor, ingresa tu correo y contraseña');
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            handleLoginSuccess(userCredential.user);
        } catch (err: any) {
            const code = err?.code;
            if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
                setError('Correo o contraseña incorrectos');
            } else if (code === 'auth/wrong-password') {
                setError('Contraseña incorrecta');
            } else if (code === 'auth/too-many-requests') {
                setError('Demasiados intentos. Intenta más tarde.');
            } else {
                setError(err.message || 'Error al iniciar sesión');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(auth, provider);
            handleLoginSuccess(result.user);
        } catch (err: any) {
            if (err?.code !== 'auth/popup-closed-by-user') {
                setError('Error al iniciar sesión con Google: ' + (err.message || 'Reintenta'));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex text-charcoal flex-col justify-center sm:py-12 bg-cream selection:bg-pink-pale selection:text-charcoal relative">
            <div className="p-10 xs:p-0 mx-auto md:w-full md:max-w-md">
                <div className="bg-white shadow w-full rounded-2xl border border-cream-dark p-8 mb-6">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md bg-gradient-to-br from-pink-light to-coral-light">
                            <span className="text-white font-bold font-serif text-2xl">N</span>
                        </div>
                    </div>
                    <div className="text-center mb-8">
                        <h1 className="font-serif text-3xl font-semibold mb-2">Ingresa a tu cuenta</h1>
                        <p className="text-nf-gray text-sm font-medium">Panel de administración NailFlow</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex gap-3 text-red-600 text-sm">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5 stagger-children">
                        <div>
                            <label className="block text-sm font-semibold mb-2 ml-1 text-charcoal">Correo Electrónico</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-14 px-5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-pink focus:bg-white outline-none transition-all placeholder-gray-400 font-medium text-[15px] shadow-inner"
                                placeholder="tu@correo.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 ml-1 text-charcoal">Contraseña</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-14 px-5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-pink focus:bg-white outline-none transition-all placeholder-gray-400 font-medium text-[15px] shadow-inner"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-gradient w-full py-4 rounded-2xl text-[15px] mt-2 relative overflow-hidden group"
                        >
                            <span className={`transition-opacity ${loading ? 'opacity-0' : 'opacity-100'}`}>
                                Iniciar Sesión
                            </span>
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                </div>
                            )}
                        </button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-cream-dark"></span>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-nf-gray font-semibold tracking-wider">O continuar con</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl bg-white border border-cream-dark hover:bg-gray-50 transition-all font-semibold text-charcoal shadow-sm"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.01.68-2.31 1.14-3.71 1.14-2.86 0-5.27-1.94-6.14-4.55H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.86 14.17c-.22-.66-.35-1.36-.35-2.08s.13-1.42.35-2.08V7.17H2.18C1.43 8.61 1 10.26 1 12s.43 3.39 1.18 4.83l3.68-2.66z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.17l3.68 2.84c.87-2.6 3.28-4.55 6.14-4.55z" fill="#EA4335" />
                        </svg>
                        Google
                    </button>
                </div>
                <div className="flex flex-col items-center gap-4 text-sm mt-6">
                    <p className="text-nf-gray font-medium">
                        ¿No tienes cuenta? <Link href="/signup" className="text-pink font-bold hover:text-coral transition-colors">Regístrate aquí</Link>
                    </p>
                    <p className="text-nf-gray font-medium">
                        ¿Olvidaste tu contraseña? <a href="#" className="text-pink hover:text-coral transition-colors">Recupérala aquí</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
