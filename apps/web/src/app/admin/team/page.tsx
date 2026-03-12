'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Staff } from '@/lib/types';
import { useTenant } from '@/lib/tenant-context';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function TeamPage() {
    const [team, setTeam] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

    // Add/Edit member form
    const [editingMember, setEditingMember] = useState<Staff | null>(null);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<'staff' | 'owner'>('staff');
    const [newSpecialty, setNewSpecialty] = useState('');
    const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
    const [newPhotoPreview, setNewPhotoPreview] = useState<string | undefined>(undefined);
    const [saving, setSaving] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);

    const { tenantId, domain } = useTenant();

    useEffect(() => {
        if (!tenantId) return;
        api.getStaff()
            .then(data => {
                if (data.length > 0) setTeam(data);
            })
            .finally(() => setLoading(false));
    }, [tenantId]);

    const getStaffUrl = (member: Staff) => {
        const slug = member.slug || member.name.toLowerCase().replace(/\s+/g, '-');
        const baseDomain = domain && domain.includes('.') ? domain : `${domain}.nailflow.app`;
        // Dirección/owner: root domain. Staff: /book/slug
        return member.role === 'owner'
            ? { href: `https://${baseDomain}`, text: baseDomain }
            : { href: `https://${baseDomain}/book/${slug}`, text: `${baseDomain}/book/${slug}` };
    };

    const handleCopyLink = (member: Staff) => {
        const { href } = getStaffUrl(member);
        navigator.clipboard.writeText(href).catch(() => { });
        setCopiedSlug(member.id);
        setTimeout(() => setCopiedSlug(null), 2000);
    };

    const resetForm = () => {
        setNewName('');
        setNewEmail('');
        setNewRole('staff');
        setNewSpecialty('');
        setNewPhotoFile(null);
        setNewPhotoPreview(undefined);
        setEditingMember(null);
    };

    const openAddModal = () => {
        resetForm();
        setShowAddModal(true);
    };

    const openEditModal = (member: Staff) => {
        setEditingMember(member);
        setNewName(member.name);
        setNewEmail(member.email || '');
        setNewRole(member.role as 'staff' | 'owner');
        setNewSpecialty(member.specialty || member.bio || '');
        setNewPhotoPreview(member.photo_url || undefined);
        setNewPhotoFile(null);
        setShowAddModal(true);
    };

    const handleSaveMember = async () => {
        if (!newName.trim() || !tenantId) return;
        setSaving(true);
        try {
            let photoUrl = editingMember?.photo_url || '';
            if (newPhotoFile) {
                photoUrl = await api.uploadImage(tenantId, 'team', newPhotoFile);
            }

            if (editingMember) {
                // Update existing member
                const updatedData: Partial<Staff> = {
                    name: newName.trim(),
                    email: newEmail.trim(),
                    role: newRole,
                    bio: newSpecialty.trim(),
                    specialty: newSpecialty.trim(),
                    photo_url: photoUrl,
                    slug: newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                };
                await api.updateStaffMember(editingMember.id, updatedData);
                setTeam(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...updatedData } : m));
            } else {
                // Add new member
                const staffData = await api.createStaffMember({
                    tenant_id: tenantId,
                    name: newName.trim(),
                    email: newEmail.trim(),
                    role: newRole,
                    bio: newSpecialty.trim(),
                    specialty: newSpecialty.trim(),
                    photo_url: photoUrl,
                    active: true,
                    services_offered: [],
                    weekly_schedule: [],
                    color_identifier: '#C97794',
                    slug: newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                });
                if (staffData) {
                    setTeam(prev => [...prev, staffData as Staff]);
                }
            }

            resetForm();
            setShowAddModal(false);
        } catch (e: any) {
            console.error('Error saving staff member:', e);
            const errorMsg = e.details || e.message || 'Error desconocido';
            alert('Error al guardar: ' + errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoSelect = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        setNewPhotoFile(file);
        setNewPhotoPreview(URL.createObjectURL(file));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-aesthetic-accent border-t-aesthetic-pink rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in min-h-full pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-6 pt-16 pb-10">
                <div className="space-y-1">
                    <p className="text-[10px] tracking-[0.3em] text-aesthetic-muted uppercase font-display italic font-medium">Gestión de Talento</p>
                    <h1 className="font-display text-4xl font-medium tracking-tight text-aesthetic-taupe italic">Especialistas</h1>
                </div>
                <button
                    onClick={openAddModal}
                    className="bg-aesthetic-taupe text-white px-8 py-4 rounded-full font-bold text-[10px] tracking-[0.2em] uppercase flex items-center justify-center gap-3 hover:bg-black transition-all shadow-minimal active:scale-95 group"
                >
                    <span className="material-symbol text-lg group-hover:rotate-90 transition-transform duration-500">add</span>
                    Añadir Miembro
                </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block px-6">
                <div className="bg-white/40 backdrop-blur-sm rounded-[2rem] border border-aesthetic-accent overflow-hidden shadow-minimal">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-aesthetic-accent/50 bg-aesthetic-cream/30">
                                <th className="py-6 px-8 font-display italic font-medium text-aesthetic-muted text-xs tracking-widest uppercase">Especialista</th>
                                <th className="py-6 px-8 font-display italic font-medium text-aesthetic-muted text-xs tracking-widest uppercase text-center">Rol</th>
                                <th className="py-6 px-8 font-display italic font-medium text-aesthetic-muted text-xs tracking-widest uppercase">Especialidad</th>
                                <th className="py-6 px-8 font-display italic font-medium text-aesthetic-muted text-xs tracking-widest uppercase">Perfil Público</th>
                                <th className="py-6 px-8 font-display italic font-medium text-aesthetic-muted text-xs tracking-widest uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-aesthetic-accent/30">
                            {team.map((member) => {
                                const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                                const { href: linkHref, text: linkText } = getStaffUrl(member);
                                return (
                                    <tr key={member.id} className="hover:bg-aesthetic-soft-pink/10 transition-colors group">
                                        <td className="py-6 px-8">
                                            <div className="flex items-center gap-4">
                                                <div className="size-12 rounded-full flex items-center justify-center text-sm font-display italic bg-white border border-aesthetic-accent text-aesthetic-taupe shadow-minimal transition-transform group-hover:scale-110 overflow-hidden">
                                                    {member.photo_url ? (
                                                        <img src={api.getPublicUrl(member.photo_url)} alt={member.name} className="w-full h-full object-cover" />
                                                    ) : initials}
                                                </div>
                                                <div>
                                                    <span className="block font-display text-lg italic text-aesthetic-taupe leading-tight">{member.name}</span>
                                                    <span className="block text-[11px] text-aesthetic-muted font-medium tracking-wide opacity-60 uppercase">{member.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-6 px-8 text-center">
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[0.15em] ${member.role === 'owner' ? 'bg-aesthetic-pink/20 text-aesthetic-taupe border border-aesthetic-pink/30' : 'bg-white border border-aesthetic-accent text-aesthetic-muted'}`}>
                                                {member.role === 'owner' ? 'Dirección' : 'Staff'}
                                            </span>
                                        </td>
                                        <td className="py-6 px-8">
                                            <span className="text-sm font-display italic text-aesthetic-taupe">
                                                {member.specialty || member.bio || '—'}
                                            </span>
                                        </td>
                                        <td className="py-6 px-8">
                                            <div className="flex items-center gap-3 max-w-[240px]">
                                                <a
                                                    href={linkHref}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="bg-white border border-aesthetic-accent text-aesthetic-muted text-[10px] px-4 py-2 rounded-full font-display italic flex-1 truncate shadow-minimal group-hover:border-aesthetic-pink/30 transition-all hover:text-aesthetic-pink"
                                                >
                                                    {linkText}
                                                </a>
                                                <button
                                                    onClick={() => handleCopyLink(member)}
                                                    className={`size-8 rounded-full border flex items-center justify-center transition-all ${copiedSlug === member.id ? 'border-[#88C999] bg-[#88C999]/10 text-[#88C999]' : 'border-aesthetic-accent text-aesthetic-muted hover:bg-aesthetic-pink hover:text-white hover:border-aesthetic-pink'}`}
                                                >
                                                    <span className="material-symbol text-base">{copiedSlug === member.id ? 'check' : 'content_copy'}</span>
                                                </button>
                                            </div>
                                        </td>
                                        <td className="py-6 px-8">
                                            <button
                                                onClick={() => openEditModal(member)}
                                                className="size-9 rounded-full border border-aesthetic-accent flex items-center justify-center text-aesthetic-muted hover:bg-aesthetic-pink hover:text-white hover:border-aesthetic-pink transition-all"
                                            >
                                                <span className="material-symbol text-base">edit</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Cards View */}
            <div className="px-6 space-y-6 lg:hidden pb-10">
                {team.map((member) => {
                    const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                    const { href: linkHref, text: linkText } = getStaffUrl(member);
                    return (
                        <div key={member.id} className="bg-white rounded-[2.5rem] p-8 shadow-minimal border border-aesthetic-accent relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
                                <button
                                    onClick={() => openEditModal(member)}
                                    className="size-9 rounded-full bg-aesthetic-cream/60 border border-aesthetic-accent flex items-center justify-center text-aesthetic-muted hover:bg-aesthetic-pink hover:text-white transition-all"
                                >
                                    <span className="material-symbol text-base">edit</span>
                                </button>
                                <span className={`px-4 py-1.5 rounded-full text-[8px] font-bold uppercase tracking-[0.15em] ${member.role === 'owner' ? 'bg-aesthetic-pink/20 text-aesthetic-taupe border border-aesthetic-pink/30' : 'bg-aesthetic-cream border border-aesthetic-accent text-aesthetic-muted'}`}>
                                    {member.role === 'owner' ? 'Dirección' : 'Staff'}
                                </span>
                            </div>

                            <div className="flex items-center gap-5 mb-4">
                                <div className="size-16 rounded-full flex items-center justify-center text-lg font-display italic bg-aesthetic-cream border-2 border-white shadow-soft text-aesthetic-taupe overflow-hidden">
                                    {member.photo_url ? (
                                        <img src={api.getPublicUrl(member.photo_url)} alt={member.name} className="w-full h-full object-cover" />
                                    ) : initials}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-display text-2xl italic text-aesthetic-taupe leading-tight">{member.name}</h3>
                                    <p className="text-[11px] text-aesthetic-muted opacity-60 font-medium tracking-wide mt-1">{member.email}</p>
                                </div>
                            </div>

                            {/* Specialty */}
                            {(member.specialty || member.bio) && (
                                <div className="mb-4 px-4 py-3 bg-aesthetic-soft-pink/20 rounded-2xl border border-aesthetic-accent/20">
                                    <p className="text-[9px] uppercase tracking-[0.2em] font-medium text-aesthetic-muted mb-1">Especialidad</p>
                                    <p className="text-sm font-display italic text-aesthetic-taupe">{member.specialty || member.bio}</p>
                                </div>
                            )}

                            {/* Schedule */}
                            {member.weekly_schedule && member.weekly_schedule.length > 0 && (
                                <div className="mb-4 px-4 py-3 bg-white/50 rounded-2xl border border-aesthetic-accent/20">
                                    <p className="text-[9px] uppercase tracking-[0.2em] font-medium text-aesthetic-muted mb-2">Horario</p>
                                    <div className="space-y-1">
                                        {member.weekly_schedule.map((s, i) => (
                                            <p key={i} className="text-xs text-aesthetic-taupe font-display italic">
                                                {DAY_NAMES[s.day_of_week]}: {s.start_time} - {s.end_time}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="bg-aesthetic-cream/30 rounded-3xl p-5 border border-aesthetic-accent/50 space-y-4">
                                <div>
                                    <p className="text-[9px] uppercase tracking-[0.2em] font-medium text-aesthetic-muted mb-3 opacity-60">Perfil Público</p>
                                    <div className="flex items-center justify-between gap-3 bg-white border border-aesthetic-accent rounded-2xl py-3 px-5 shadow-minimal">
                                        <a
                                            href={linkHref}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[11px] font-display italic text-aesthetic-taupe truncate hover:text-aesthetic-pink transition-colors"
                                        >
                                            {linkText}
                                        </a>
                                        <button
                                            onClick={() => handleCopyLink(member)}
                                            className="text-aesthetic-pink hover:scale-110 active:scale-95 transition-all outline-none"
                                        >
                                            <span className="material-symbol text-lg">{copiedSlug === member.id ? 'check' : 'share'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add/Edit Member Modal */}
            {showAddModal && (
                <div
                    className="fixed inset-0 bg-aesthetic-taupe/40 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowAddModal(false); resetForm(); } }}
                >
                    <div className="bg-aesthetic-cream rounded-[3rem] p-10 w-full max-w-lg shadow-2xl relative border border-white/50 overflow-hidden max-h-[90vh] overflow-y-auto">
                        {/* Decorative background */}
                        <div className="absolute top-0 right-0 size-40 bg-aesthetic-pink/10 blur-3xl rounded-full -mr-20 -mt-20" />

                        <button
                            onClick={() => { setShowAddModal(false); resetForm(); }}
                            className="absolute top-10 right-10 size-10 rounded-full bg-white/50 flex items-center justify-center hover:bg-white transition-colors z-10"
                        >
                            <span className="material-symbol text-aesthetic-muted">close</span>
                        </button>

                        <div className="relative mb-8">
                            <p className="text-[10px] tracking-[0.4em] text-aesthetic-muted uppercase mb-2 font-display italic font-medium">
                                {editingMember ? 'Editar Miembro' : 'Nuevo Miembro'}
                            </p>
                            <h2 className="font-display text-4xl italic text-aesthetic-taupe leading-tight">
                                {editingMember ? 'Actualizar Perfil' : 'Agregar Talento'}
                            </h2>
                        </div>

                        <div className="space-y-6 relative">
                            {/* Photo upload */}
                            <div className="flex flex-col items-center gap-3">
                                <div
                                    className="size-24 rounded-full bg-white border-2 border-dashed border-aesthetic-accent flex items-center justify-center cursor-pointer hover:border-aesthetic-pink/50 transition-colors overflow-hidden"
                                    onClick={() => photoInputRef.current?.click()}
                                >
                                    {newPhotoPreview ? (
                                        <img src={api.getPublicUrl(newPhotoPreview)} alt="preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="material-symbol text-3xl text-aesthetic-muted/30">add_a_photo</span>
                                    )}
                                </div>
                                <p className="text-[10px] text-aesthetic-muted font-display italic">Foto de perfil (opcional)</p>
                                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={e => handlePhotoSelect(e.target.files)} />
                            </div>

                            {/* Name */}
                            <div className="space-y-3">
                                <label className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Nombre Completo</label>
                                <input
                                    type="text"
                                    placeholder="Ej. Sofia Thompson"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    className="w-full bg-white border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/30 rounded-2xl p-5 text-lg font-display italic shadow-minimal transition-all"
                                />
                            </div>

                            {/* Email */}
                            <div className="space-y-3">
                                <label className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">E-mail (opcional)</label>
                                <input
                                    type="email"
                                    placeholder="hola@studio.com"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    className="w-full bg-white border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/30 rounded-2xl p-5 text-lg font-display italic shadow-minimal transition-all"
                                />
                            </div>

                            {/* Specialty */}
                            <div className="space-y-3">
                                <label className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Especialidad</label>
                                <input
                                    type="text"
                                    placeholder="Ej. Manicura Rusa, Nail Art..."
                                    value={newSpecialty}
                                    onChange={e => setNewSpecialty(e.target.value)}
                                    className="w-full bg-white border-none ring-1 ring-aesthetic-accent focus:ring-aesthetic-pink/30 rounded-2xl p-5 text-lg font-display italic shadow-minimal transition-all"
                                />
                            </div>

                            {/* Role */}
                            <div className="space-y-3">
                                <label className="font-display text-xs font-medium tracking-wider text-aesthetic-muted ml-1 italic">Rol</label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setNewRole('staff')}
                                        className={`flex-1 py-4 rounded-2xl text-sm font-bold tracking-[0.15em] uppercase transition-all ${newRole === 'staff' ? 'bg-aesthetic-taupe text-white shadow-minimal' : 'bg-white ring-1 ring-aesthetic-accent text-aesthetic-muted'}`}
                                    >
                                        Staff
                                    </button>
                                    <button
                                        onClick={() => setNewRole('owner')}
                                        className={`flex-1 py-4 rounded-2xl text-sm font-bold tracking-[0.15em] uppercase transition-all ${newRole === 'owner' ? 'bg-aesthetic-taupe text-white shadow-minimal' : 'bg-white ring-1 ring-aesthetic-accent text-aesthetic-muted'}`}
                                    >
                                        Dirección
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleSaveMember}
                                disabled={saving || !newName.trim()}
                                className="w-full bg-aesthetic-taupe text-white py-6 rounded-full font-bold text-[10px] tracking-[0.3em] uppercase mt-4 shadow-minimal hover:shadow-2xl transition-all active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {saving ? (
                                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {editingMember ? 'GUARDAR CAMBIOS' : 'AGREGAR MIEMBRO'}
                                        <span className="material-symbol text-base group-hover:translate-x-2 transition-transform">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
