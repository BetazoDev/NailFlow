'use client';

import { useEffect, useState } from 'react';

/**
 * Forwards a salon owner from the shared account domain to her own panel.
 *
 * Firebase will only return someone to a domain it has been told about, and
 * that list takes no wildcards — so authorising every salon's subdomain would
 * mean one manual step per salon, which is the thing running them all on one
 * deployment is meant to avoid. One domain is authorised, and it lands here.
 *
 * The salon travels in the query string. It is validated against the shape a
 * hostname actually has before being used, so this page can only ever forward
 * to a host, never to an arbitrary URL someone put in the link.
 */

/** A hostname: dot-separated labels, nothing that could carry a scheme or path. */
const HOSTNAME = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export default function EntrarPage() {
    const [problem, setProblem] = useState<string | null>(null);

    useEffect(() => {
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
                    <p className="text-sm text-text-muted">Llevándote a tu salón…</p>
                </output>
            )}
        </main>
    );
}
