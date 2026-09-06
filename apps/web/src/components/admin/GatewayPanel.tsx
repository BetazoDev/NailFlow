'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type GatewayAccount, type GatewayState } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Feedback, type FeedbackState } from '@/components/admin/Feedback';

/**
 * Where the salon connects the account her clients pay into.
 *
 * The whole point of this screen is that the money is hers: every deposit is
 * charged against the account connected here and settles in her balance, never
 * in ours. Nothing on this page ever shows a credential — the server does not
 * return them, only whether a connection exists and whether it can take money.
 */

const PROVIDERS = {
    mercadopago: { label: 'Mercado Pago', blurb: 'Lo habitual en México y Latinoamérica.' },
    stripe: { label: 'Stripe', blurb: 'Verificación y alta guiadas por Stripe.' },
} as const;

export function GatewayPanel() {
    const [state, setState] = useState<GatewayState | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<'mercadopago' | 'stripe' | 'refresh' | 'secret' | null>(null);
    const [message, setMessage] = useState<FeedbackState | null>(null);
    const [secret, setSecret] = useState('');

    const load = useCallback(async () => {
        try {
            setState(await api.getGateway());
        } catch {
            setMessage({ tone: 'error', message: 'No pudimos leer tu configuración de cobros.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    /**
     * The owner comes back from Mercado Pago or Stripe with the outcome in the
     * URL. Reading it here is what turns the round trip into feedback instead
     * of a silently unchanged screen.
     */
    useEffect(() => {
        const outcome = new URLSearchParams(window.location.search).get('gateway');
        if (!outcome) return;

        if (outcome === 'connected') {
            setMessage({ tone: 'success', message: 'Cuenta conectada' });
            void load();
        } else if (outcome === 'error') {
            setMessage({ tone: 'error', message: 'No se pudo completar la conexión.' });
        }

        // Clear it so a reload does not replay the same message.
        const url = new URL(window.location.href);
        url.searchParams.delete('gateway');
        window.history.replaceState({}, '', url);
    }, [load]);

    const connect = async (provider: 'mercadopago' | 'stripe') => {
        setBusy(provider);
        setMessage(null);
        try {
            const { url } =
                provider === 'mercadopago'
                    ? await api.connectMercadoPago()
                    : await api.connectStripe();
            window.location.href = url;
        } catch (caught) {
            setMessage({
                tone: 'error',
                message:
                    caught instanceof ApiError
                        ? caught.message
                        : 'No pudimos iniciar la conexión.',
            });
            setBusy(null);
        }
    };

    const saveSecret = async () => {
        setBusy('secret');
        try {
            const account = await api.setMercadoPagoWebhookSecret(secret.trim());
            setState(current => (current ? { ...current, account } : current));
            setSecret('');
            setMessage({ tone: 'success', message: 'Clave guardada' });
        } catch (caught) {
            setMessage({
                tone: 'error',
                message: caught instanceof ApiError ? caught.message : 'No pudimos guardarla.',
            });
        } finally {
            setBusy(null);
        }
    };

    const refreshStripe = async () => {
        setBusy('refresh');
        try {
            const account = await api.refreshStripe();
            setState(current => (current ? { ...current, account } : current));
            setMessage(
                account.chargesEnabled
                    ? { tone: 'success', message: 'Ya puedes recibir pagos' }
                    : { tone: 'error', message: 'Stripe aún no ha terminado de verificarte.' }
            );
        } catch {
            setMessage({ tone: 'error', message: 'No pudimos consultar a Stripe.' });
        } finally {
            setBusy(null);
        }
    };

    const disconnect = async () => {
        setBusy('refresh');
        try {
            await api.disconnectGateway();
            setState(current => (current ? { ...current, account: null } : current));
            setMessage({ tone: 'success', message: 'Cuenta desconectada' });
        } catch {
            setMessage({ tone: 'error', message: 'No pudimos desconectarla.' });
        } finally {
            setBusy(null);
        }
    };

    if (loading) {
        return <div className="skeleton h-48 rounded-[1.5rem]" aria-label="Cargando cobros" />;
    }

    const account = state?.account ?? null;
    const nothingAvailable = !state?.available.mercadopago && !state?.available.stripe;

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="t-title">Cobros</h2>
                <p className="t-label mt-1 opacity-70">
                    El anticipo de cada cita llega directo a tu cuenta.
                </p>
            </div>

            <Feedback state={message} />

            {account ? (
                <ConnectedAccount
                    account={account}
                    secret={secret}
                    onSecretChange={setSecret}
                    onSaveSecret={saveSecret}
                    onRefresh={refreshStripe}
                    onDisconnect={disconnect}
                    busy={busy}
                />
            ) : nothingAvailable ? (
                <Card variant="raised" className="p-8 border-none shadow-soft">
                    <p className="t-body">
                        Todavía no hay ninguna pasarela disponible en este servidor. Escríbenos
                        y la dejamos lista.
                    </p>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {(['mercadopago', 'stripe'] as const)
                        .filter(provider => state?.available[provider])
                        .map(provider => (
                            <Card
                                key={provider}
                                variant="raised"
                                className="flex flex-col gap-4 p-7 border-none shadow-soft"
                            >
                                <div>
                                    <p className="text-base font-bold text-text-strong">
                                        {PROVIDERS[provider].label}
                                    </p>
                                    <p className="t-meta mt-1">{PROVIDERS[provider].blurb}</p>
                                </div>
                                <Button
                                    variant="primary"
                                    className="mt-auto h-12"
                                    isLoading={busy === provider}
                                    onClick={() => connect(provider)}
                                >
                                    Conectar
                                </Button>
                            </Card>
                        ))}
                </div>
            )}
        </div>
    );
}

function ConnectedAccount({
    account,
    secret,
    onSecretChange,
    onSaveSecret,
    onRefresh,
    onDisconnect,
    busy,
}: {
    account: GatewayAccount;
    secret: string;
    onSecretChange: (value: string) => void;
    onSaveSecret: () => void;
    onRefresh: () => void;
    onDisconnect: () => void;
    busy: string | null;
}) {
    // Mercado Pago needs her signing secret before any payment of hers can be
    // trusted, so a connection without it is not finished.
    const needsSecret = account.provider === 'mercadopago' && !account.webhookSecretSet;
    const ready = account.chargesEnabled && !needsSecret;

    return (
        <Card variant="raised" className="p-8 border-none shadow-soft space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-base font-bold text-text-strong">
                        {PROVIDERS[account.provider].label}
                    </p>
                    {account.connectedAt && (
                        <p className="t-meta mt-1">
                            Conectada el{' '}
                            {new Date(account.connectedAt).toLocaleDateString('es-MX', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                            })}
                        </p>
                    )}
                </div>

                <span
                    className={`status-pill ${ready ? 'text-success' : 'text-warning'}`}
                    aria-label={ready ? 'Lista para cobrar' : 'Conexión sin terminar'}
                >
                    <span className="material-symbol text-base" aria-hidden="true">
                        {ready ? 'check_circle' : 'schedule'}
                    </span>
                    {ready ? 'Lista para cobrar' : 'Falta un paso'}
                </span>
            </div>

            {needsSecret && (
                <div className="rounded-2xl border border-warning/30 bg-warning/10 p-5 space-y-3">
                    <p className="text-sm text-text-strong">
                        Falta tu clave secreta de notificaciones. Sin ella no podemos comprobar
                        que un pago es de verdad, y ninguna cita se confirmará sola.
                    </p>
                    <p className="t-meta">
                        La encuentras en tu panel de Mercado Pago, en Tus integraciones →
                        Webhooks → Clave secreta.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                            type="password"
                            value={secret}
                            onChange={event => onSecretChange(event.target.value)}
                            placeholder="Pega aquí tu clave secreta"
                            aria-label="Clave secreta de notificaciones"
                            className="h-12 flex-1 rounded-xl border border-line bg-surface px-4 text-sm text-text-strong"
                        />
                        <Button
                            variant="primary"
                            className="h-12"
                            isLoading={busy === 'secret'}
                            onClick={onSaveSecret}
                        >
                            Guardar
                        </Button>
                    </div>
                </div>
            )}

            {account.provider === 'stripe' && !account.chargesEnabled && (
                <div className="rounded-2xl border border-warning/30 bg-warning/10 p-5 space-y-3">
                    <p className="text-sm text-text-strong">
                        Stripe todavía está verificando tu cuenta. Cuando termine podrás cobrar
                        en línea.
                    </p>
                    <Button
                        variant="secondary"
                        className="h-11"
                        isLoading={busy === 'refresh'}
                        onClick={onRefresh}
                    >
                        Comprobar de nuevo
                    </Button>
                </div>
            )}

            <div className="rule" />

            <div className="flex items-center justify-between gap-4">
                <p className="t-meta max-w-md">
                    Desconectar no borra tus citas ni tus cobros anteriores, pero dejarás de
                    aceptar anticipos en línea.
                </p>
                <Button
                    variant="ghost"
                    className="h-11 shrink-0 text-danger"
                    isLoading={busy === 'refresh'}
                    onClick={onDisconnect}
                >
                    Desconectar
                </Button>
            </div>
        </Card>
    );
}
