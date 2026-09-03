'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session-context';
import { initials, slugify } from '@/lib/format';
import type { Staff, StaffRole } from '@/lib/types';

interface Draft {
    name: string;
    email: string;
    role: StaffRole;
    specialty: string;
    slug: string;
    photoFile: File | null;
    photoPreview: string | null;
}

const EMPTY: Draft = {
    name: '',
    email: '',
    role: 'staff',
    specialty: '',
    slug: '',
    photoFile: null,
    photoPreview: null,
};

export default function TeamPage() {
    const { tenant } = useSession();

    const [team, setTeam] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [editing, setEditing] = useState<Staff | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const photoRef = useRef<HTMLInputElement>(null);
    const domain = tenant?.domain ?? '';

    useEffect(() => {
        if (!tenant) return;
        let cancelled = false;

        api.getTeam()
            .then(members => {
                if (!cancelled) setTeam(members);
            })
            .catch(() => {
                if (!cancelled) setLoadError('No pudimos cargar tu equipo. Recarga la página.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [tenant]);

    const openNew = () => {
        setEditing(null);
        setDraft(EMPTY);
        setFormError(null);
        setShowForm(true);
    };

    const openEdit = (member: Staff) => {
        setEditing(member);
        setDraft({
            name: member.name,
            email: member.email ?? '',
            role: member.role,
            specialty: member.specialty ?? '',
            slug: member.slug ?? '',
            photoFile: null,
            photoPreview: member.photo_url,
        });
        setFormError(null);
        setShowForm(true);
    };

    /**
     * The slug is only ever proposed from the name for a *new* member.
     *
     * It used to be regenerated on every save, so correcting a typo in someone's
     * surname silently broke the booking link she had already shared.
     */
    const proposedSlug = useMemo(
        () => draft.slug.trim() || slugify(draft.name),
        [draft.slug, draft.name]
    );

    const handlePhoto = (files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
            setFormError('Elige una imagen de 8 MB o menos.');
            return;
        }

        setFormError(null);
        setDraft(current => ({
            ...current,
            photoFile: file,
            photoPreview: URL.createObjectURL(file),
        }));
    };

    const save = async () => {
        if (!draft.name.trim()) {
            setFormError('Escribe el nombre.');
            return;
        }
        if (!proposedSlug) {
            setFormError('Ese nombre no genera un link válido. Escribe uno a mano.');
            return;
        }

        setSaving(true);
        setFormError(null);

        try {
            let photoUrl = draft.photoFile ? null : draft.photoPreview;
            if (draft.photoFile) photoUrl = await api.uploadImage(draft.photoFile, 'team');

            const payload = {
                name: draft.name.trim(),
                email: draft.email.trim() || null,
                role: draft.role,
                specialty: draft.specialty.trim() || null,
                photo_url: photoUrl ?? undefined,
                slug: proposedSlug,
            };

            if (editing) {
                const updated = await api.updateStaffMember(editing.id, payload);
                setTeam(current => current.map(item => (item.id === editing.id ? updated : item)));
            } else {
                const created = await api.createStaffMember({ ...payload, active: true });
                setTeam(current => [...current, created]);
            }

            setShowForm(false);
        } catch (caught) {
            setFormError(
                caught instanceof ApiError ? caught.message : 'No pudimos guardar. Intenta de nuevo.'
            );
        } finally {
            setSaving(false);
        }
    };

    const bookingUrl = (member: Staff) =>
        member.role === 'owner' || !member.slug
            ? `https://${domain}`
            : `https://${domain}/book/${member.slug}`;

    const copyLink = async (member: Staff) => {
        try {
            await navigator.clipboard.writeText(bookingUrl(member));
            setCopied(member.id);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            setLoadError('Tu navegador bloqueó el portapapeles. Copia el link a mano.');
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 p-2" aria-busy="true" aria-label="Cargando equipo">
                <div className="skeleton h-12 w-64" />
                {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="skeleton h-20 w-full" />
                ))}
            </div>
        );
    }

    return (
        <div className="pb-16">
            {loadError && (
                <p role="alert" className="mb-6 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                    {loadError}
                </p>
            )}

            <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="t-label mb-2">Especialistas</p>
                    <h1 className="t-display">Equipo</h1>
                </div>
                <button onClick={openNew} className="btn-gradient flex items-center gap-2 px-5 py-3 text-sm">
                    <span className="material-symbol text-lg" aria-hidden="true">person_add</span>
                    Añadir
                </button>
            </header>

            {team.length === 0 ? (
                <div className="blank-slate">
                    <span className="material-symbol text-3xl opacity-40" aria-hidden="true">groups</span>
                    <p className="t-body">Aún no hay nadie en el equipo.</p>
                    <p className="t-meta">
                        Cada especialista recibe su propio link de reservas al añadirla.
                    </p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {team.map(member => {
                        const url = bookingUrl(member);
                        const isCopied = copied === member.id;

                        return (
                            <li
                                key={member.id}
                                className={`sheet flex flex-wrap items-center gap-4 p-4 ${member.active ? '' : 'opacity-60'}`}
                            >
                                <span className="size-12 shrink-0 overflow-hidden rounded-full border border-line">
                                    {member.photo_url ? (
                                        <img src={api.getImageUrl(member.photo_url)} alt="" className="size-full object-cover" />
                                    ) : (
                                        <span className="grid size-full place-items-center bg-brand-tint text-sm font-semibold text-text-strong">
                                            {initials(member.name)}
                                        </span>
                                    )}
                                </span>

                                <div className="min-w-[160px] flex-1">
                                    <p className="t-body font-semibold text-text-strong">
                                        {member.name}
                                        {member.role === 'owner' && <span className="t-meta ml-2">Dirección</span>}
                                        {!member.active && <span className="t-meta ml-2">· Inactiva</span>}
                                    </p>
                                    <p className="t-meta truncate">
                                        {member.specialty || member.email || 'Sin especialidad'}
                                    </p>
                                </div>

                                <p className="t-meta hidden min-w-0 flex-1 truncate lg:block">{url}</p>

                                <div className="flex shrink-0 items-center gap-2">
                                    <button
                                        onClick={() => copyLink(member)}
                                        aria-label={`Copiar el link de ${member.name}`}
                                        className={`grid size-10 place-items-center rounded-xl border transition-colors ${
                                            isCopied
                                                ? 'border-success/40 bg-success/10 text-success'
                                                : 'border-line text-text-muted hover:text-text-strong'
                                        }`}
                                    >
                                        <span className="material-symbol text-lg" aria-hidden="true">
                                            {isCopied ? 'check' : 'link'}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => openEdit(member)}
                                        aria-label={`Editar a ${member.name}`}
                                        className="grid size-10 place-items-center rounded-xl border border-line text-text-muted transition-colors hover:text-text-strong"
                                    >
                                        <span className="material-symbol text-lg" aria-hidden="true">edit</span>
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {showForm && (
                <div
                    className="animate-fade-in fixed inset-0 z-50 grid place-items-end sm:place-items-center"
                    onClick={() => !saving && setShowForm(false)}
                >
                    <div className="absolute inset-0 bg-text-strong/25 backdrop-blur-sm" />

                    <div
                        role="dialog"
                        aria-label={editing ? 'Editar especialista' : 'Añadir especialista'}
                        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-surface-raised p-7 shadow-lg sm:max-w-lg sm:rounded-[2rem]"
                        onClick={event => event.stopPropagation()}
                    >
                        <div className="mb-7 flex items-start justify-between gap-4">
                            <h2 className="t-title">
                                {editing ? 'Editar especialista' : 'Nueva especialista'}
                            </h2>
                            <button
                                onClick={() => setShowForm(false)}
                                aria-label="Cerrar"
                                className="grid size-9 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-sunken"
                            >
                                <span className="material-symbol text-xl" aria-hidden="true">close</span>
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => photoRef.current?.click()}
                                    className="size-20 shrink-0 overflow-hidden rounded-full border border-dashed border-line transition-colors hover:border-brand"
                                >
                                    {draft.photoPreview ? (
                                        <img
                                            src={
                                                draft.photoPreview.startsWith('blob:')
                                                    ? draft.photoPreview
                                                    : api.getImageUrl(draft.photoPreview)
                                            }
                                            alt=""
                                            className="size-full object-cover"
                                        />
                                    ) : (
                                        <span className="grid size-full place-items-center text-text-subtle">
                                            <span className="material-symbol" aria-hidden="true">add_a_photo</span>
                                        </span>
                                    )}
                                </button>
                                <p className="t-meta">Una foto ayuda a que la clienta reconozca con quién reserva.</p>
                                <input
                                    ref={photoRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={event => handlePhoto(event.target.files)}
                                />
                            </div>

                            <div>
                                <label htmlFor="staff-name" className="t-label mb-2 block">Nombre</label>
                                <input
                                    id="staff-name"
                                    value={draft.name}
                                    onChange={event => setDraft({ ...draft, name: event.target.value })}
                                    placeholder="Sofía Quinn"
                                    className="input-field"
                                />
                            </div>

                            <div>
                                <label htmlFor="staff-email" className="t-label mb-2 block">
                                    Correo electrónico
                                </label>
                                <input
                                    id="staff-email"
                                    type="email"
                                    value={draft.email}
                                    onChange={event => setDraft({ ...draft, email: event.target.value })}
                                    placeholder="sofia@correo.com"
                                    className="input-field"
                                />
                                <p className="t-meta mt-2">
                                    Con este correo entra al panel. Debe coincidir con su cuenta.
                                </p>
                            </div>

                            <div>
                                <label htmlFor="staff-specialty" className="t-label mb-2 block">Especialidad</label>
                                <input
                                    id="staff-specialty"
                                    value={draft.specialty}
                                    onChange={event => setDraft({ ...draft, specialty: event.target.value })}
                                    placeholder="Manicura rusa"
                                    className="input-field"
                                />
                            </div>

                            <div>
                                <label htmlFor="staff-slug" className="t-label mb-2 block">Link de reservas</label>
                                <div className="flex items-center gap-2">
                                    <span className="t-meta shrink-0">{domain}/book/</span>
                                    <input
                                        id="staff-slug"
                                        value={draft.slug}
                                        onChange={event =>
                                            setDraft({ ...draft, slug: slugify(event.target.value) })
                                        }
                                        placeholder={slugify(draft.name) || 'sofia'}
                                        className="input-field"
                                    />
                                </div>
                                <p className="t-meta mt-2">
                                    {editing
                                        ? 'Si lo cambias, los links que ya compartió dejarán de funcionar.'
                                        : 'Se propone a partir del nombre. Puedes escribir otro.'}
                                </p>
                            </div>

                            <fieldset>
                                <legend className="t-label mb-2">Rol</legend>
                                <div className="flex gap-2">
                                    {(['staff', 'owner'] as StaffRole[]).map(role => (
                                        <button
                                            key={role}
                                            type="button"
                                            onClick={() => setDraft({ ...draft, role })}
                                            aria-pressed={draft.role === role}
                                            className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                                                draft.role === role
                                                    ? 'border-transparent bg-text-strong text-white'
                                                    : 'border-line text-text-muted hover:text-text-strong'
                                            }`}
                                        >
                                            {role === 'staff' ? 'Especialista' : 'Dirección'}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>

                            {formError && (
                                <p role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                                    {formError}
                                </p>
                            )}

                            <button
                                onClick={save}
                                disabled={saving || !draft.name.trim()}
                                className="btn-gradient w-full py-4 disabled:opacity-50"
                            >
                                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Añadir al equipo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
