'use client';

import { useEffect, useState } from 'react';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';

/**
 * Turns notifications on for this device.
 *
 * Permission is asked for only when the salon presses the button. A panel that
 * asks the moment it loads is a panel people press "Block" on — and a blocked
 * permission cannot be asked for a second time, so that one reflex costs the
 * salon notifications permanently.
 */

const COPY: Record<PushState, { title: string; body: string }> = {
    on: {
        title: 'Avisos activados',
        body: 'Te avisamos en este dispositivo cada vez que alguien reserve.',
    },
    off: {
        title: 'Avísame de las citas nuevas',
        body: 'Te llega un aviso aunque tengas el panel cerrado.',
    },
    denied: {
        title: 'Avisos bloqueados',
        body: 'Los bloqueaste en este navegador. Puedes permitirlos desde el candado de la barra de direcciones.',
    },
    unsupported: {
        title: 'Avisos no disponibles',
        body: 'Este navegador no admite notificaciones. Prueba desde Chrome en tu teléfono.',
    },
    unconfigured: {
        title: 'Avisos no disponibles',
        body: 'Todavía no están configurados en este servidor.',
    },
};

export function PushToggle() {
    const [state, setState] = useState<PushState | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void pushState().then(setState);
    }, []);

    // Nothing to offer, and saying so would only add noise to the page.
    if (state === null || state === 'unconfigured') return null;

    const toggle = async () => {
        setBusy(true);
        try {
            setState(state === 'on' ? await disablePush() : await enablePush());
        } catch {
            setState('off');
        } finally {
            setBusy(false);
        }
    };

    const copy = COPY[state];
    const actionable = state === 'on' || state === 'off';

    return (
        <div className="sheet flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
                <span
                    className={`material-symbol mt-0.5 text-xl ${
                        state === 'on' ? 'text-success' : 'text-text-muted'
                    }`}
                    aria-hidden="true"
                >
                    {state === 'on' ? 'notifications_active' : 'notifications'}
                </span>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-strong">{copy.title}</p>
                    <p className="t-meta mt-0.5 max-w-md">{copy.body}</p>
                </div>
            </div>

            {actionable && (
                <button
                    type="button"
                    role="switch"
                    aria-checked={state === 'on'}
                    aria-label="Avisos de citas nuevas"
                    disabled={busy}
                    onClick={toggle}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                        state === 'on' ? 'bg-success' : 'bg-line'
                    }`}
                >
                    <span
                        className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${
                            state === 'on' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            )}
        </div>
    );
}
