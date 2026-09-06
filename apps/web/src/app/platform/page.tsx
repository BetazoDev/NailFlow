'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, type NewSalon, type PlatformSalon } from '@/lib/api';
import { slugify } from '@/lib/format';

/**
 * Every salon Diabolical runs, and the two facts that decide whether each one
 * actually works: can its owner sign in, and can it take money.
 *
 * A salon that exists but cannot charge is the failure mode worth catching
 * early, so it is visible in the list rather than two clicks away.
 */

const SUBSCRIPTION_LABEL: Record<string, string> = {
    active: 'Al corriente',
    trial: 'En prueba',
    cancelled: 'Cancelada',
};

const SUBSCRIPTION_TONE: Record<string, string> = {
    active: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
    trial: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
    cancelled: 'text-rose-300 border-rose-400/30 bg-rose-400/10',
};

export default function PlatformPage() {
    const [salons, setSalons] = useState<PlatformSalon[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState<PlatformSalon | null>(null);

    const load = useCallback(async () => {
        try {
            setSalons(await api.platform.salons());
        } catch (caught) {
            setError(
                caught instanceof ApiError ? caught.message : 'No pudimos cargar los salones.'
            );
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const counts = useMemo(() => {
        const list = salons ?? [];
        return {
            total: list.length,
            charging: list.filter(s => s.gateway?.chargesEnabled).length,
            stalled: list.filter(s => !s.gateway || !s.gateway.chargesEnabled).length,
        };
    }, [salons]);

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-3xl italic text-white">Salones</h1>
                    {salons && (
                        <p className="mt-1 text-sm text-white/50">
                            {counts.total} en total · {counts.charging} cobrando ·{' '}
                            {counts.stalled} sin cobros
                        </p>
                    )}
                </div>
                <button
                    onClick={() => setCreating(true)}
                    className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#14100E] transition-opacity hover:opacity-90"
                >
                    Dar de alta un salón
                </button>
            </div>

            {error && (
                <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                </p>
            )}

            {!salons ? (
                <div className="h-64 animate-pulse rounded-2xl bg-white/5" aria-label="Cargando" />
            ) : salons.length === 0 ? (
                <div className="rounded-2xl border border-white/10 p-12 text-center">
                    <p className="text-white/70">Todavía no has dado de alta ningún salón.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead>
                            <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
                                <th className="p-4 text-left font-semibold">Salón</th>
                                <th className="p-4 text-left font-semibold">Dueña</th>
                                <th className="p-4 text-left font-semibold">Cobros</th>
                                <th className="p-4 text-left font-semibold">Suscripción</th>
                                <th className="p-4 text-right font-semibold">Citas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {salons.map(salon => (
                                <tr
                                    key={salon.id}
                                    onClick={() => setSelected(salon)}
                                    className="cursor-pointer border-b border-white/5 transition-colors last:border-none hover:bg-white/5"
                                >
                                    <td className="p-4">
                                        <p className="font-medium text-white">
                                            {salon.name ?? 'Sin nombre'}
                                        </p>
                                        <p className="mt-0.5 font-mono text-xs text-white/40">
                                            {salon.domain}
                                        </p>
                                    </td>
                                    <td className="p-4">
                                        <p className="text-white/80">{salon.owner_name ?? '—'}</p>
                                        <p className="mt-0.5 text-xs text-white/40">
                                            {salon.owner_email ?? 'sin correo'}
                                        </p>
                                    </td>
                                    <td className="p-4">
                                        <GatewayBadge salon={salon} />
                                    </td>
                                    <td className="p-4">
                                        <span
                                            className={`inline-block rounded-full border px-2.5 py-1 text-[11px] ${
                                                SUBSCRIPTION_TONE[salon.subscription?.status ?? 'trial']
                                            }`}
                                        >
                                            {SUBSCRIPTION_LABEL[salon.subscription?.status ?? 'trial']}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right tabular-nums text-white/70">
                                        {salon.appointments ?? 0}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {creating && (
                <NewSalonDrawer
                    onClose={() => setCreating(false)}
                    onCreated={() => {
                        setCreating(false);
                        void load();
                    }}
                />
            )}

            {selected && (
                <SalonDrawer
                    salon={selected}
                    onClose={() => setSelected(null)}
                    onChanged={() => void load()}
                />
            )}
        </div>
    );
}

/**
 * Why a salon cannot charge, not just that it cannot.
 *
 * "Sin conectar" and "falta su clave" need different phone calls, so collapsing
 * them into one red dot would hide the only useful part.
 */
function GatewayBadge({ salon }: { salon: PlatformSalon }) {
    if (!salon.gateway) {
        return <span className="text-xs text-white/40">Sin conectar</span>;
    }

    const provider = salon.gateway.provider === 'stripe' ? 'Stripe' : 'Mercado Pago';

    if (!salon.gateway.chargesEnabled) {
        return (
            <span className="text-xs text-amber-300">{provider} · sin verificar</span>
        );
    }

    if (salon.gateway.provider === 'mercadopago' && !salon.gateway.webhookSecretSet) {
        return <span className="text-xs text-amber-300">{provider} · falta su clave</span>;
    }

    return <span className="text-xs text-emerald-300">{provider} · cobrando</span>;
}

// ── Alta ─────────────────────────────────────────────────────────────────────

const EMPTY: NewSalon = {
    domain: '',
    name: '',
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    owner_whatsapp: '',
    notes: '',
};

function NewSalonDrawer({
    onClose,
    onCreated,
}: {
    onClose: () => void;
    onCreated: () => void;
}) {
    const [form, setForm] = useState<NewSalon>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [invite, setInvite] = useState<string | null>(null);
    const [domainTouched, setDomainTouched] = useState(false);

    const set = <K extends keyof NewSalon>(field: K, value: NewSalon[K]) =>
        setForm(current => ({ ...current, [field]: value }));

    /**
     * The domain follows the salon's name until it is edited by hand.
     * Multi-tenancy resolves from this value, so getting it right matters more
     * than anything else on the form — and typing it twice invites a typo.
     */
    const suggested = form.name && !domainTouched ? `${slugify(form.name)}.nailflow.app` : '';
    const domain = domainTouched ? form.domain : suggested;

    const submit = async () => {
        setSaving(true);
        setError(null);
        try {
            const created = await api.platform.createSalon({ ...form, domain });
            setInvite(created.invite);
            if (!created.invite) onCreated();
        } catch (caught) {
            setError(
                caught instanceof ApiError ? caught.message : 'No pudimos crear el salón.'
            );
        } finally {
            setSaving(false);
        }
    };

    if (invite) {
        return (
            <Drawer title="Salón creado" onClose={onCreated}>
                <p className="text-sm text-white/70">
                    Envíale este enlace a la dueña para que elija su contraseña. No lo sabemos
                    nosotros ni queda guardado: es de un solo uso y caduca.
                </p>
                <textarea
                    readOnly
                    value={invite}
                    onFocus={event => event.currentTarget.select()}
                    rows={4}
                    className="w-full rounded-xl border border-white/15 bg-black/30 p-4 font-mono text-xs text-white/80"
                />
                <button
                    onClick={() => void navigator.clipboard.writeText(invite)}
                    className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#14100E]"
                >
                    Copiar enlace
                </button>
            </Drawer>
        );
    }

    return (
        <Drawer title="Nuevo salón" onClose={onClose}>
            <Field label="Nombre del salón">
                <input
                    value={form.name}
                    onChange={event => set('name', event.target.value)}
                    className={inputClass}
                    placeholder="Bella Nails"
                />
            </Field>

            <Field
                label="Dominio"
                hint="Es de donde el sistema reconoce al salón. Se rellena solo desde el nombre."
            >
                <input
                    value={domain}
                    onChange={event => {
                        setDomainTouched(true);
                        set('domain', event.target.value);
                    }}
                    className={`${inputClass} font-mono`}
                    placeholder="bella-nails.nailflow.app"
                />
            </Field>

            <div className="h-px bg-white/10" />

            <Field label="Nombre de la dueña">
                <input
                    value={form.owner_name ?? ''}
                    onChange={event => set('owner_name', event.target.value)}
                    className={inputClass}
                />
            </Field>

            <Field label="Correo de la dueña" hint="Con este correo entrará a su panel.">
                <input
                    type="email"
                    value={form.owner_email}
                    onChange={event => set('owner_email', event.target.value)}
                    className={inputClass}
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Teléfono">
                    <input
                        value={form.owner_phone ?? ''}
                        onChange={event => set('owner_phone', event.target.value)}
                        className={inputClass}
                    />
                </Field>
                <Field label="WhatsApp">
                    <input
                        value={form.owner_whatsapp ?? ''}
                        onChange={event => set('owner_whatsapp', event.target.value)}
                        className={inputClass}
                    />
                </Field>
            </div>

            <Field label="Notas internas">
                <textarea
                    value={form.notes ?? ''}
                    onChange={event => set('notes', event.target.value)}
                    rows={3}
                    className={inputClass}
                />
            </Field>

            {error && (
                <p role="alert" className="text-sm text-rose-300">
                    {error}
                </p>
            )}

            <button
                onClick={submit}
                disabled={saving || !form.name || !form.owner_email || !domain}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#14100E] disabled:opacity-40"
            >
                {saving ? 'Creando…' : 'Crear salón'}
            </button>
        </Drawer>
    );
}

// ── Ficha ────────────────────────────────────────────────────────────────────

function SalonDrawer({
    salon,
    onClose,
    onChanged,
}: {
    salon: PlatformSalon;
    onClose: () => void;
    onChanged: () => void;
}) {
    const [status, setStatus] = useState(salon.subscription?.status ?? 'trial');
    const [notes, setNotes] = useState(salon.notes ?? '');
    const [invite, setInvite] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const save = async () => {
        setBusy(true);
        try {
            await api.platform.updateSalon(salon.id, {
                notes,
                subscription: { status, plan: salon.subscription?.plan ?? 'standard' },
            });
            setMessage('Guardado');
            onChanged();
        } catch {
            setMessage('No pudimos guardar.');
        } finally {
            setBusy(false);
        }
    };

    const resend = async () => {
        setBusy(true);
        try {
            const { invite: link } = await api.platform.invite(salon.id);
            setInvite(link);
        } catch {
            setMessage('No pudimos generar el enlace.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Drawer title={salon.name ?? salon.domain} onClose={onClose}>
            <dl className="grid gap-3 text-sm">
                <Row label="Dominio" value={salon.domain} mono />
                <Row label="Dueña" value={salon.owner_name ?? '—'} />
                <Row label="Correo" value={salon.owner_email ?? '—'} />
                <Row label="Teléfono" value={salon.owner_phone ?? '—'} />
                <Row label="WhatsApp" value={salon.owner_whatsapp ?? '—'} />
                <Row
                    label="Alta"
                    value={new Date(salon.created_at).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                    })}
                />
            </dl>

            <div className="h-px bg-white/10" />

            <Field label="Suscripción">
                <select
                    value={status}
                    onChange={event =>
                        setStatus(event.target.value as 'active' | 'trial' | 'cancelled')
                    }
                    className={inputClass}
                >
                    <option value="trial">En prueba</option>
                    <option value="active">Al corriente</option>
                    <option value="cancelled">Cancelada</option>
                </select>
            </Field>

            <Field label="Notas internas">
                <textarea
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                    rows={3}
                    className={inputClass}
                />
            </Field>

            {message && <p className="text-sm text-white/60">{message}</p>}

            <div className="flex flex-wrap gap-3">
                <button
                    onClick={save}
                    disabled={busy}
                    className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#14100E] disabled:opacity-40"
                >
                    Guardar
                </button>
                <button
                    onClick={resend}
                    disabled={busy}
                    className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-white disabled:opacity-40"
                >
                    Reenviar acceso
                </button>
            </div>

            {invite && (
                <textarea
                    readOnly
                    value={invite}
                    onFocus={event => event.currentTarget.select()}
                    rows={4}
                    className="w-full rounded-xl border border-white/15 bg-black/30 p-4 font-mono text-xs text-white/80"
                />
            )}
        </Drawer>
    );
}

// ── Piezas compartidas ───────────────────────────────────────────────────────

const inputClass =
    'w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white ' +
    'placeholder:text-white/25 focus:border-white/40 focus:outline-none';

function Drawer({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex">
            <button
                aria-label="Cerrar"
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <div className="relative ml-auto flex h-full w-full max-w-lg flex-col overflow-y-auto overscroll-contain border-l border-white/10 bg-[#1A1512] p-8">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <h2 className="font-display text-2xl italic text-white">{title}</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70"
                    >
                        Cerrar
                    </button>
                </div>
                <div className="flex flex-col gap-5">{children}</div>
            </div>
        </div>
    );
}

function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                {label}
            </span>
            {children}
            {hint && <span className="mt-1.5 block text-xs text-white/35">{hint}</span>}
        </label>
    );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-2">
            <dt className="text-xs uppercase tracking-[0.12em] text-white/35">{label}</dt>
            <dd className={`text-right text-white/80 ${mono ? 'font-mono text-xs' : ''}`}>
                {value}
            </dd>
        </div>
    );
}
