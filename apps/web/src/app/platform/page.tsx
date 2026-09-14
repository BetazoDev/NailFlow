'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    api,
    ApiError,
    type CdnSummary,
    type DomainCheck,
    type HostingOutcome,
    type MailOutcome,
    type NewSalon,
    type PlatformSalon,
} from '@/lib/api';
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
    // Comes from the server rather than the build, so changing the root domain
    // is a variable on the API and not a rebuild of this app.
    const [rootDomain, setRootDomain] = useState<string | null>(null);
    const [hosting, setHosting] = useState<(HostingOutcome & { enabled: boolean }) | null>(null);
    const [mail, setMail] = useState<(MailOutcome & { enabled: boolean }) | null>(null);
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
        void api.platform.session().then(session => setRootDomain(session.rootDomain));
        // Checked when the panel opens rather than behind a button: finding out
        // the token is wrong while creating a salon means finding out in front
        // of a customer.
        void api.platform.hosting().then(setHosting).catch(() => setHosting(null));
        void api.platform.mail().then(setMail).catch(() => setMail(null));
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

            {hosting && !hosting.ok && hosting.reason !== 'unconfigured' && (
                <p
                    role="alert"
                    className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
                >
                    <strong className="font-semibold">Alta automática de subdominios caída.</strong>{' '}
                    {hosting.detail} Los salones que crees ahora habrá que enrutarlos a mano.
                </p>
            )}

            {mail && !mail.ok && (
                <p
                    role="alert"
                    className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
                >
                    <strong className="font-semibold">
                        {mail.reason === 'unconfigured'
                            ? 'El envío de accesos no está configurado.'
                            : 'El buzón que envía los accesos no responde.'}
                    </strong>{' '}
                    {mail.detail} Las dueñas que des de alta ahora tendrás que avisarlas tú.
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
                    rootDomain={rootDomain}
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
    rootDomain,
    onClose,
    onCreated,
}: {
    rootDomain: string | null;
    onClose: () => void;
    onCreated: () => void;
}) {
    const [form, setForm] = useState<NewSalon>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [invite, setInvite] = useState<string | null>(null);
    const [created, setCreated] = useState('');
    const [hosting, setHosting] = useState<HostingOutcome | null>(null);
    const [mail, setMail] = useState<MailOutcome | null>(null);
    const [domainTouched, setDomainTouched] = useState(false);

    const set = <K extends keyof NewSalon>(field: K, value: NewSalon[K]) =>
        setForm(current => ({ ...current, [field]: value }));

    /**
     * The domain follows the salon's name until it is edited by hand.
     * Multi-tenancy resolves from this value, so getting it right matters more
     * than anything else on the form — and typing it twice invites a typo.
     */
    const suggested =
        form.name && !domainTouched && rootDomain
            ? `${slugify(form.name)}.${rootDomain}`
            : '';
    const domain = domainTouched ? form.domain : suggested;

    const submit = async () => {
        setSaving(true);
        setError(null);
        try {
            const salon = await api.platform.createSalon({ ...form, domain });
            setCreated(salon.domain);
            setHosting(salon.hosting);
            setMail(salon.mail);
            setInvite(salon.invite);
            if (!salon.invite) onCreated();
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
                {/*
                    The row exists; her subdomain does not. Sending the invitation
                    before routing it means she opens a link that goes nowhere and
                    neither of you knows why, so the two manual steps come first.
                */}
                {hosting?.ok ? (
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                        <p className="text-sm font-semibold text-emerald-200">
                            Subdominio registrado
                        </p>
                        <p className="mt-1 text-xs text-emerald-100/70">{hosting.detail}</p>
                        <p className="mt-2 font-mono text-[11px] text-emerald-100/50">{created}</p>
                    </div>
                ) : (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                        <p className="text-sm font-semibold text-amber-200">
                            Registra el subdominio antes de enviar el enlace
                        </p>
                        {hosting && (
                            <p className="mt-1 text-xs text-amber-100/70">{hosting.detail}</p>
                        )}
                        <p className="mt-3 text-sm text-amber-100/80">
                            En Dokploy: añade{' '}
                            <code className="font-mono text-xs text-white">{created}</code> a la
                            aplicación web, puerto 3000, con certificado Let&apos;s Encrypt.
                        </p>
                        <p className="mt-2 text-xs text-amber-100/60">
                            El DNS ya está cubierto por tu registro comodín. Es el mismo proyecto
                            de siempre — solo un dominio más en la lista.
                        </p>
                    </div>
                )}

                {mail?.ok ? (
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                        <p className="text-sm font-semibold text-emerald-200">Acceso enviado</p>
                        <p className="mt-1 text-xs text-emerald-100/70">{mail.detail}</p>
                        <p className="mt-2 text-xs text-emerald-100/60">
                            No tienes que hacer nada más. El enlace de abajo es el mismo, por si
                            prefieres mandárselo también por WhatsApp.
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-white/70">
                        {mail?.detail ?? 'No se envió el correo.'} Cuando su subdominio responda,
                        usa <strong className="text-white">Reenviar acceso</strong> en su ficha —
                        o mándale este enlace tú. No lo sabemos nosotros ni queda guardado: es de
                        un solo uso y caduca.
                    </p>
                )}
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
                hint={
                    rootDomain
                        ? 'Se rellena solo desde el nombre. Es de donde el sistema reconoce al salón.'
                        : 'Es de donde el sistema reconoce al salón. Configura APP_ROOT_DOMAIN para que se rellene solo.'
                }
            >
                <input
                    value={domain}
                    onChange={event => {
                        setDomainTouched(true);
                        set('domain', event.target.value);
                    }}
                    className={`${inputClass} font-mono`}
                    placeholder={rootDomain ? `bella-nails.${rootDomain}` : 'bella-nails.tudominio.com'}
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
    const [domain, setDomain] = useState<DomainCheck | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    // Asked once when the card opens: it is the answer to "why can't she get
    // in", and waiting for a button press means nobody ever finds out.
    useEffect(() => {
        setDomain(null);
        void api.platform.checkDomain(salon.id).then(setDomain).catch(() => setDomain(null));
    }, [salon.id]);

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

    /**
     * Deleting asks for the domain to be typed out.
     *
     * A confirm dialog is dismissed by reflex; typing the name is the smallest
     * thing that proves the right salon is being deleted, and it costs nothing
     * on the only salons this is allowed for — the ones nobody booked into.
     */
    const [confirmDomain, setConfirmDomain] = useState('');

    const remove = async () => {
        setBusy(true);
        try {
            await api.platform.deleteSalon(salon.id);
            onChanged();
            onClose();
        } catch (caught) {
            setMessage(
                caught instanceof ApiError ? caught.message : 'No pudimos borrarlo.'
            );
            setBusy(false);
        }
    };

    const registerPayment = async () => {
        setBusy(true);
        try {
            await api.platform.markPaid(salon.id, 1);
            setStatus('active');
            setMessage('Un mes más registrado');
            onChanged();
        } catch {
            setMessage('No pudimos registrar el pago.');
        } finally {
            setBusy(false);
        }
    };

    /**
     * Offered only when the domain is not routed: a button that re-does
     * something already done is a button people press to see what happens.
     */
    const retryDomain = async () => {
        setBusy(true);
        try {
            const outcome = await api.platform.registerDomain(salon.id);
            setMessage(outcome.detail);
            if (outcome.ok) {
                setDomain(await api.platform.checkDomain(salon.id).catch(() => null));
            }
        } catch {
            setMessage('No pudimos registrarlo.');
        } finally {
            setBusy(false);
        }
    };

    /**
     * Sends her access letter, and says whether it actually went.
     *
     * The link is still shown either way. It is the same one, and WhatsApp is
     * how most of these salons are reached anyway — the email is the thing that
     * stops it being forgotten, not a replacement for handing it over.
     */
    const resend = async () => {
        setBusy(true);
        setMessage(null);
        try {
            const { invite: link, mail } = await api.platform.invite(salon.id);
            setInvite(link);
            setMessage(
                mail.ok
                    ? `Enviado. ${mail.detail}`
                    : `No se envió el correo: ${mail.detail} El enlace de abajo sigue sirviendo.`
            );
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
                <Row
                    label="Pagada hasta"
                    value={
                        salon.subscription?.current_period_end
                            ? new Date(salon.subscription.current_period_end).toLocaleDateString(
                                  'es-MX',
                                  { day: 'numeric', month: 'long', year: 'numeric' }
                              )
                            : 'Sin registrar'
                    }
                />
            </dl>

            <DomainStatus check={domain} />

            {domain && domain.verdict !== 'ok' && (
                <button
                    onClick={retryDomain}
                    disabled={busy}
                    className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-white disabled:opacity-40"
                >
                    Registrar el subdominio ahora
                </button>
            )}

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
                    onClick={registerPayment}
                    disabled={busy}
                    className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-white disabled:opacity-40"
                >
                    Registrar un mes pagado
                </button>
                <button
                    onClick={resend}
                    disabled={busy}
                    className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-white disabled:opacity-40"
                >
                    Reenviar acceso
                </button>
            </div>

            <div className="h-px bg-white/10" />

            <CdnPanel salonId={salon.id} />

            <div className="h-px bg-white/10" />

            <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.14em] text-white/35">Borrar</p>
                <p className="text-xs text-white/50">
                    Escribe <code className="font-mono text-white/70">{salon.domain}</code> para
                    confirmar. Solo se puede borrar un salón sin citas.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                        value={confirmDomain}
                        onChange={event => setConfirmDomain(event.target.value)}
                        placeholder={salon.domain}
                        aria-label="Confirma el dominio del salón a borrar"
                        className={inputClass}
                    />
                    <button
                        onClick={remove}
                        disabled={busy || confirmDomain.trim() !== salon.domain}
                        className="shrink-0 rounded-xl border border-rose-400/40 px-5 py-2.5 text-sm text-rose-200 disabled:opacity-30"
                    >
                        Borrar salón
                    </button>
                </div>
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

/**
 * The salon's own CDN folder and keys.
 *
 * This is here and not in her panel because she has no CDN account: the keys
 * are ours to issue and to rotate, and handing the wrong one to the wrong salon
 * would file her clients' photos in someone else's folder. It is a thing one
 * person does deliberately, once, per salon.
 *
 * A stored key is never shown back. The panel says whether one is set, which is
 * all that is needed to decide whether to replace it, and means a leaked screen
 * or a shoulder does not leak the key.
 */
function CdnPanel({ salonId }: { salonId: string }) {
    const [state, setState] = useState<CdnSummary | null>(null);
    const [slug, setSlug] = useState('');
    const [referenceSlug, setReferenceSlug] = useState('');
    const [uploadToken, setUploadToken] = useState('');
    const [referenceToken, setReferenceToken] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        setMessage(null);
        setUploadToken('');
        setReferenceToken('');
        void api.platform
            .cdn(salonId)
            .then(summary => {
                setState(summary);
                setSlug(summary.configured ? summary.slug : '');
                setReferenceSlug(summary.referenceSlug ?? '');
            })
            .catch(() => setState(null));
    }, [salonId]);

    const save = async () => {
        setBusy(true);
        setMessage(null);
        try {
            const summary = await api.platform.saveCdn(salonId, {
                slug: slug.trim(),
                ...(referenceSlug.trim() ? { reference_slug: referenceSlug.trim() } : {}),
                // Only what was actually typed: an empty box means "keep the
                // stored key", not "delete it".
                ...(uploadToken.trim() ? { upload_token: uploadToken.trim() } : {}),
                ...(referenceToken.trim() ? { reference_token: referenceToken.trim() } : {}),
            });
            setState(summary);
            setUploadToken('');
            setReferenceToken('');
            setMessage('Guardado. Sus próximas fotos van a su carpeta.');
        } catch (caught) {
            setMessage(caught instanceof ApiError ? caught.message : 'No pudimos guardarlo.');
        } finally {
            setBusy(false);
        }
    };

    const reset = async () => {
        setBusy(true);
        setMessage(null);
        try {
            const summary = await api.platform.clearCdn(salonId);
            setState(summary);
            setSlug('');
            setReferenceSlug('');
            setMessage('Vuelve a la carpeta compartida.');
        } catch {
            setMessage('No pudimos quitarlo.');
        } finally {
            setBusy(false);
        }
    };

    /**
     * Checks a key before it is stored, and says which folder it writes into.
     *
     * The folder is the answer that matters. A key that authenticates but
     * belongs to another project files her photos where nothing will look for
     * them, and nobody finds out until she asks where her pictures went.
     */
    const probe = async (token: string) => {
        setBusy(true);
        setMessage(null);
        try {
            const result = await api.platform.probeCdn(token.trim());
            if (!result.ok) {
                setMessage(result.detail);
            } else if (result.slug) {
                setMessage(`La clave funciona y escribe en "${result.slug}".`);
                if (!slug.trim()) setSlug(result.slug);
            } else {
                setMessage('La clave funciona. Su carpeta está vacía, así que no sé cuál es.');
            }
        } catch {
            setMessage('No pudimos comprobarla.');
        } finally {
            setBusy(false);
        }
    };

    if (!state) {
        return (
            <p className="text-xs uppercase tracking-[0.14em] text-white/35">
                Almacenamiento de imágenes
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <p className="text-xs uppercase tracking-[0.14em] text-white/35">
                    Almacenamiento de imágenes
                </p>
                {state.configured ? (
                    <p className="mt-2 text-xs text-white/50">
                        Sus fotos van a{' '}
                        <code className="font-mono text-emerald-200">{state.slug}</code>
                        {state.referenceSlug ? (
                            <>
                                {' '}y las de sus clientas a{' '}
                                <code className="font-mono text-emerald-200">
                                    {state.referenceSlug}
                                </code>
                            </>
                        ) : (
                            <> — todavía sin carpeta aparte para las fotos de sus clientas</>
                        )}
                        . Nadie más las ve.
                    </p>
                ) : (
                    <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
                        Está en la carpeta compartida{' '}
                        <code className="font-mono">{state.sharedSlug}</code>, junto a los demás
                        salones que tampoco tienen la suya. Dale una carpeta y su propia clave para
                        separarla.
                    </p>
                )}
            </div>

            {!state.storable && (
                <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-100">
                    Falta <code className="font-mono">CREDENTIALS_KEY</code> en la API: sin ella no
                    hay con qué cifrar las claves y no se puede guardar ninguna.
                </p>
            )}

            <Field
                label="Carpeta de sus fotos"
                hint="El proyecto del CDN con sus servicios, su equipo y su logo."
            >
                <input
                    value={slug}
                    onChange={event => setSlug(event.target.value)}
                    placeholder="salon-de-ana"
                    aria-label="Carpeta de las fotos del salón"
                    className={inputClass}
                />
            </Field>

            <Field
                label="Carpeta de las fotos de sus clientas"
                hint="Un proyecto aparte, no una subcarpeta: el CDN guarda todo plano, así que el proyecto es la única separación que hay. Y la clave que escribe aquí la usa gente sin sesión."
            >
                <input
                    value={referenceSlug}
                    onChange={event => setReferenceSlug(event.target.value)}
                    placeholder="salon-de-ana-referencias"
                    aria-label="Carpeta de las fotos de las clientas"
                    className={inputClass}
                />
            </Field>

            <CdnKey
                label="Clave de las fotos del salón"
                hint={
                    state.hasUploadToken
                        ? 'Ya hay una guardada. Escribe otra solo si la vas a cambiar.'
                        : 'Servicios, equipo y su logo.'
                }
                stored={state.hasUploadToken}
                value={uploadToken}
                onChange={setUploadToken}
                onProbe={probe}
                busy={busy}
            />

            <CdnKey
                label="Clave de las fotos de las clientas"
                hint={
                    state.hasReferenceToken
                        ? 'Ya hay una guardada. Escribe otra solo si la vas a cambiar.'
                        : 'Las referencias que suben al reservar. Puede ser la misma que la de arriba.'
                }
                stored={state.hasReferenceToken}
                value={referenceToken}
                onChange={setReferenceToken}
                onProbe={probe}
                busy={busy}
            />

            {message && <p className="text-sm text-white/60">{message}</p>}

            <div className="flex flex-wrap gap-3">
                <button
                    onClick={save}
                    disabled={busy || !state.storable || !slug.trim()}
                    className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#14100E] disabled:opacity-40"
                >
                    Guardar almacenamiento
                </button>
                {state.configured && (
                    <button
                        onClick={reset}
                        disabled={busy}
                        className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-white disabled:opacity-40"
                    >
                        Volver a la compartida
                    </button>
                )}
            </div>
        </div>
    );
}

function CdnKey({
    label,
    hint,
    stored,
    value,
    onChange,
    onProbe,
    busy,
}: {
    label: string;
    hint: string;
    stored: boolean;
    value: string;
    onChange: (next: string) => void;
    onProbe: (token: string) => void;
    busy: boolean;
}) {
    return (
        <Field label={label} hint={hint}>
            <div className="flex flex-col gap-3 sm:flex-row">
                <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={value}
                    onChange={event => onChange(event.target.value)}
                    placeholder={stored ? '•••••••• guardada' : 'dmm_…'}
                    aria-label={label}
                    className={`${inputClass} font-mono`}
                />
                <button
                    onClick={() => onProbe(value)}
                    disabled={busy || value.trim().length < 8}
                    className="shrink-0 rounded-xl border border-white/20 px-5 py-2.5 text-sm text-white disabled:opacity-30"
                >
                    Probar
                </button>
            </div>
        </Field>
    );
}

/**
 * Whether this salon's subdomain reaches us, and what to do when it does not.
 *
 * Each verdict names a different missing step, because "no funciona" sends you
 * looking in the wrong place: a missing DNS record and a missing entry in the
 * reverse proxy look identical from the outside and are fixed in different
 * panels.
 */
const DOMAIN_FIX: Record<DomainCheck['verdict'], { tone: string; label: string; fix: string }> = {
    ok: {
        tone: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
        label: 'Enrutado',
        fix: 'Su página responde. Puedes enviarle el enlace.',
    },
    'no-dns': {
        tone: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
        label: 'Falta el DNS',
        fix: 'Añade el registro que apunte este subdominio a tu servidor.',
    },
    'no-route': {
        tone: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
        label: 'Falta en Dokploy',
        fix: 'El DNS ya llega, pero añade el dominio a la aplicación web (puerto 3000).',
    },
    'no-certificate': {
        tone: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
        label: 'Sin certificado',
        fix: 'Llega al servidor. El certificado tarda un momento en emitirse.',
    },
    unknown: {
        tone: 'border-white/15 bg-white/5 text-white/60',
        label: 'Sin comprobar',
        fix: 'No pudimos comprobarlo desde aquí.',
    },
};

function DomainStatus({ check }: { check: DomainCheck | null }) {
    if (!check) {
        return <div className="h-16 animate-pulse rounded-xl bg-white/5" aria-label="Comprobando el dominio" />;
    }

    const { tone, label, fix } = DOMAIN_FIX[check.verdict];

    return (
        <div className={`rounded-xl border p-4 ${tone}`}>
            <p className="text-sm font-semibold">{label}</p>
            <p className="mt-1 text-xs opacity-80">{fix}</p>
            <p className="mt-2 font-mono text-[11px] opacity-60">{check.domain}</p>
        </div>
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
