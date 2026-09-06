'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/api';

/**
 * Diabolical's own panel.
 *
 * Deliberately its own shell rather than a section of the salon panel: this is
 * a different product for a different person, and the salon's branding — which
 * changes per tenant — has no business colouring the screen where we manage
 * every tenant at once.
 *
 * Access is decided by the server. The panel asks once and shows nothing until
 * it answers; a client-side role check would be a suggestion, not a gate.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        return onAuthStateChanged(auth, async user => {
            if (!user) {
                router.replace('/login');
                return;
            }
            try {
                const session = await api.platform.session();
                setEmail(session.email);
                setState('allowed');
            } catch {
                setState('denied');
            }
        });
    }, [router]);

    if (state === 'checking') {
        return (
            <output className="grid min-h-dvh place-items-center bg-[#14100E] text-[#C8BDB4]">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
                    <p className="text-sm">Comprobando tu acceso…</p>
                </div>
            </output>
        );
    }

    if (state === 'denied') {
        return (
            <div className="grid min-h-dvh place-items-center bg-[#14100E] px-6 text-center text-[#C8BDB4]">
                <div className="max-w-sm space-y-4">
                    <h1 className="font-display text-3xl italic text-white">Sin acceso</h1>
                    <p className="text-sm">
                        Esta cuenta no administra la plataforma. Si debería, pide que te añadan.
                    </p>
                    <button
                        onClick={() => signOut(auth)}
                        className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-white transition-colors hover:bg-white/10"
                    >
                        Cerrar sesión
                    </button>
                </div>
            </div>
        );
    }

    return (
        // Fixed rather than in flow, for the same reason as the salon panel: an
        // in-flow full-height shell rides up with any stray document scroll.
        <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#14100E] text-[#C8BDB4]">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-6 py-4 sm:px-10">
                <div className="flex items-baseline gap-3">
                    <span className="font-display text-xl italic text-white">Diabolical</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                        Plataforma
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="hidden text-xs text-white/50 sm:inline">{email}</span>
                    <button
                        onClick={() => signOut(auth)}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 transition-colors hover:bg-white/10"
                    >
                        Salir
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto overscroll-contain px-6 py-8 sm:px-10">
                <div className="mx-auto w-full max-w-[1180px]">{children}</div>
            </main>
        </div>
    );
}
