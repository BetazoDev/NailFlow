'use client';

import { useEffect, useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/api';

/**
 * Where an owner lands on her way somewhere else. Two arrivals, two jobs.
 *
 * Firebase will only return someone to a domain it has been told about, and
 * that list takes no wildcards — so authorising every salon's subdomain would
 * mean one manual step per salon, which is the thing running them all on one
 * deployment is meant to avoid. One domain is authorised, and it lands here.
 *
 *   - With `?salon=`, this is the account domain: she has just set her
 *     password and needs forwarding to her own panel.
 *   - With `#t=`, this is *her* domain: she signed in with Google over there
 *     and is carrying a code that signs her in over here.
 *
 * The second exists because a Firebase session belongs to the origin that
 * created it. Google can only run on the account domain; her panel is on hers.
 * Nothing crosses that gap by itself.
 */

/** A hostname: dot-separated labels, nothing that could carry a scheme or path. */
const HOSTNAME = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export default function EntrarPage() {
    const [problem, setProblem] = useState<string | null>(null);
    const [working, setWorking] = useState('Llevándote a tu salón…');

    useEffect(() => {
        /*
         * The code arrives in the fragment, which is the only part of a URL a
         * browser keeps to itself — not sent with the request, not in the
         * Referer, so never in anyone's access log.
         *
         * It is wiped from the address bar before anything else happens.
         * Redeeming already destroys it server-side, but a used code sitting in
         * her history is still something to hand someone by accident, and the
         * page may yet fail and stay open.
         */
        const fragment = window.location.hash.replace(/^#/, '');
        const code = new URLSearchParams(fragment).get('t');

        if (code) {
            window.history.replaceState(null, '', window.location.pathname);
            setWorking('Entrando…');

            void (async () => {
                try {
                    const { token } = await api.auth.redeem(code);
                    await signInWithCustomToken(auth, token);
                    window.location.replace('/admin');
                } catch {
                    // Used, expired, or tampered with — the API does not say
                    // which, and neither does this. Any of them is fixed by
                    // signing in again.
                    setProblem('Ese enlace ya no sirve. Vuelve a entrar con Google.');
                }
            })();
            return;
        }

        /*
         * The salon travels in the query string. It is validated against the
         * shape a hostname actually has before being used, so this page can
         * only ever forward to a host, never to an arbitrary URL someone put
         * in the link.
         */
        const salon = new URLSearchParams(window.location.search).get('salon')?.trim() ?? '';

        if (!salon || !HOSTNAME.test(salon)) {
            setProblem('Este enlace no dice a qué salón pertenece.');
            return;
        }

        window.location.replace(`https://${salon}/login`);
    }, []);

    return (
        <main className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
            {problem ? (
                <div className="max-w-sm space-y-3">
                    <h1 className="font-display text-2xl italic text-text-strong">
                        No pudimos llevarte
                    </h1>
                    <p className="text-sm text-text-muted">{problem}</p>
                    <p className="text-sm text-text-muted">
                        Pídenos otro y lo enviamos enseguida.
                    </p>
                </div>
            ) : (
                <output className="flex flex-col items-center gap-4">
                    <div className="size-8 animate-spin rounded-full border-2 border-brand-soft border-t-brand" />
                    <p className="text-sm text-text-muted">{working}</p>
                </output>
            )}
        </main>
    );
}
