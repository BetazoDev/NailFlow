'use client';

import { useCallback, useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/api';
import { authErrorMessage } from '@/lib/auth-errors';
import { Button } from '@/components/ui/Button';

/**
 * Where "Continue with Google" actually happens, on behalf of a salon's page.
 *
 * Google will only run on a domain Firebase has been told about, and that list
 * takes no wildcards — so it cannot run on bella.example.com, and never will.
 * But the owner wants her button on her own site, not a trip to somewhere else
 * and back.
 *
 * So this page runs in a small window her page opens. Google happens here, on
 * the one authorised domain; the code comes back to her page over postMessage;
 * this window closes. Her tab never navigates, and she never sees a domain
 * that is not hers.
 *
 * The alternative Firebase documents for this — signInWithRedirect — is the
 * one broken by browsers that partition third-party storage. A popup is the
 * flow that still works everywhere, which is why the awkward shape is the
 * right one.
 */

/** What the opener is told, shaped so it cannot be confused with anything else. */
const MESSAGE = 'nailflow:handoff';

type State =
    | { step: 'working'; detail: string }
    | { step: 'click' }
    | { step: 'failed'; detail: string };

export default function PuentePage() {
    const [state, setState] = useState<State>({ step: 'working', detail: 'Abriendo Google…' });

    /**
     * Hands the code to the page that opened this window, and to nobody else.
     *
     * Two things make that true, and both are necessary:
     *
     *   - The origin is checked against the salons this user actually owns,
     *     which the API has just told us. Without it, anyone could open this
     *     window pointed at their own site and collect a code that signs them
     *     in as whoever happened to be at the keyboard.
     *   - postMessage names that origin explicitly. Passing "*" would deliver
     *     the code to whatever document happens to be there, which on a
     *     redirected opener is not the one we checked.
     */
    const finish = useCallback(async (wanted: string) => {
        setState({ step: 'working', detail: 'Buscando tu salón…' });

        const { salons } = await api.auth.handoff();
        const mine = salons.find(salon => `https://${salon.domain}` === wanted);

        if (!mine) {
            setState({
                step: 'failed',
                detail: 'Esta cuenta de Google no administra ese salón.',
            });
            return;
        }

        window.opener?.postMessage({ type: MESSAGE, code: mine.code }, wanted);
        setState({ step: 'working', detail: 'Listo, entrando…' });
        window.close();
    }, []);

    const run = useCallback(
        async (wanted: string) => {
            try {
                await signInWithPopup(auth, new GoogleAuthProvider());
                await finish(wanted);
            } catch (caught) {
                const code =
                    typeof caught === 'object' && caught !== null && 'code' in caught
                        ? String((caught as { code: unknown }).code)
                        : '';

                /*
                 * A window opened by a click does not inherit the permission
                 * to open another one, so this first attempt is often blocked.
                 * That is expected, not an error: the button below carries a
                 * click of its own, and most browsers never get this far.
                 */
                if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
                    setState({ step: 'click' });
                    return;
                }

                setState({
                    step: 'failed',
                    detail: authErrorMessage(caught) || 'No pudimos completar el acceso.',
                });
            }
        },
        [finish]
    );

    useEffect(() => {
        const wanted = new URLSearchParams(window.location.search).get('o')?.trim() ?? '';

        // Shape only. Whether it is *hers* is decided in `finish`, against the
        // list the API returns — this just refuses anything that is not a
        // plain https origin before it reaches postMessage.
        if (!/^https:\/\/[a-z0-9.-]+$/i.test(wanted)) {
            setState({ step: 'failed', detail: 'Este enlace no dice a qué salón volver.' });
            return;
        }

        if (!window.opener) {
            setState({
                step: 'failed',
                detail: 'Esta ventana se abre desde el panel de tu salón.',
            });
            return;
        }

        /*
         * If she is already signed in here — a second salon, or a second try —
         * there is nothing to ask Google. Going straight to the code spares
         * her a window she has already been through once.
         */
        const stop = onAuthStateChanged(auth, user => {
            stop();
            if (user) {
                void finish(wanted).catch(() =>
                    setState({ step: 'failed', detail: 'No pudimos completar el acceso.' })
                );
            } else {
                void run(wanted);
            }
        });
    }, [finish, run]);

    const retry = () => {
        const wanted = new URLSearchParams(window.location.search).get('o') ?? '';
        setState({ step: 'working', detail: 'Abriendo Google…' });
        void run(wanted);
    };

    return (
        <main className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
            {state.step === 'failed' ? (
                <div className="max-w-sm space-y-3">
                    <h1 className="font-display text-2xl italic text-text-strong">
                        No pudimos entrar
                    </h1>
                    <p className="text-sm text-text-muted">{state.detail}</p>
                </div>
            ) : state.step === 'click' ? (
                <div className="max-w-sm space-y-5">
                    <p className="text-sm text-text-muted">
                        Tu navegador necesita que lo confirmes.
                    </p>
                    <Button type="button" size="lg" onClick={retry}>
                        Continuar con Google
                    </Button>
                </div>
            ) : (
                <output className="flex flex-col items-center gap-4">
                    <div className="size-8 animate-spin rounded-full border-2 border-brand-soft border-t-brand" />
                    <p className="text-sm text-text-muted">{state.detail}</p>
                </output>
            )}
        </main>
    );
}
