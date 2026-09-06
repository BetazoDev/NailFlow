'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api, type Standing } from '@/lib/api';
import { applyBranding } from '@/lib/theme';
import { SessionContext, type AdminSession } from '@/lib/session-context';
import type { StaffRole, Tenant } from '@/lib/types';

interface NavItem {
    href: string;
    label: string;
    icon: string;
    /** Roles allowed to see this section; enforced again by the API. */
    roles: StaffRole[];
}

const NAV_ITEMS: NavItem[] = [
    { href: '/admin', label: 'Inicio', icon: 'home', roles: ['owner', 'staff'] },
    { href: '/admin/agenda', label: 'Agenda', icon: 'calendar_today', roles: ['owner', 'staff'] },
    { href: '/admin/services', label: 'Servicios', icon: 'content_cut', roles: ['owner'] },
    { href: '/admin/clients', label: 'Clientas', icon: 'group', roles: ['owner'] },
    { href: '/admin/team', label: 'Equipo', icon: 'badge', roles: ['owner'] },
    { href: '/admin/profile', label: 'Perfil', icon: 'person', roles: ['owner'] },
];

function Icon({ name, filled }: { name: string; filled?: boolean }) {
    return (
        <span
            className="material-symbol"
            aria-hidden="true"
            style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 300` }}
        >
            {name}
        </span>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [role, setRole] = useState<StaffRole | null>(null);
    const [staffId, setStaffId] = useState<string | null>(null);
    const [standing, setStanding] = useState<Standing>('ok');
    const [graceDaysLeft, setGraceDaysLeft] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const loadTenant = useCallback(async () => {
        const current = await api.getTenant();
        setTenant(current);
        applyBranding(current?.branding);
    }, []);

    /**
     * The salon comes from the domain, and the role from the server. The panel
     * previously trusted `localStorage.mock_role`, so any signed-in visitor
     * could grant themselves owner access from the browser console.
     */
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async user => {
            if (!user) {
                router.replace('/login');
                return;
            }

            try {
                const [session] = await Promise.all([api.getSession(), loadTenant()]);

                if (!session?.role) {
                    setAccessDenied(true);
                    return;
                }

                setRole(session.role);
                setStaffId(session.staffId);
                setStanding(session.standing);
                setGraceDaysLeft(session.graceDaysLeft);
            } catch {
                setAccessDenied(true);
            } finally {
                setLoading(false);
            }
        });

        return unsubscribe;
    }, [router, loadTenant]);

    // Close the mobile drawer whenever navigation happens.
    useEffect(() => setDrawerOpen(false), [pathname]);

    const handleLogout = async () => {
        await signOut(auth);
        router.replace('/login');
    };

    const session: AdminSession = {
        tenant,
        role,
        staffId,
        standing,
        graceDaysLeft,
        loading,
        refresh: loadTenant,
    };
    const isActive = (href: string) =>
        pathname === href || (href !== '/admin' && pathname.startsWith(href));

    if (loading) {
        return (
            <output className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-surface">
                <div className="size-8 rounded-full border-2 border-brand-soft border-t-brand animate-spin" />
                <p className="text-sm text-text-muted">Cargando tu panel…</p>
            </output>
        );
    }

    if (accessDenied) {
        return (
            <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-surface">
                <span className="material-symbol text-4xl text-text-subtle" aria-hidden="true">lock</span>
                <h1 className="font-display text-2xl text-text-strong">Sin acceso a este salón</h1>
                <p className="max-w-sm text-sm text-text-muted">
                    Tu cuenta no está asociada a {tenant?.name ?? 'este salón'}. Pide a la
                    propietaria que te añada al equipo, o entra con otra cuenta.
                </p>
                <button onClick={handleLogout} className="btn-gradient px-6 py-3 text-sm">
                    Cerrar sesión
                </button>
            </div>
        );
    }

    const visibleItems = NAV_ITEMS.filter(item => role && item.roles.includes(role));
    const logo = api.getImageUrl(tenant?.branding?.logo_url);
    const salonName = tenant?.name ?? 'NailFlow';

    const sidebar = (
        <div className="flex h-full flex-col bg-surface-raised">
            <div className="flex items-center gap-3 p-8 pb-6">
                <div className="size-10 shrink-0 overflow-hidden rounded-xl bg-brand-soft grid place-items-center">
                    {logo ? (
                        <img src={logo} alt="" className="size-full object-cover" />
                    ) : (
                        <span className="font-display text-lg italic text-text-strong">
                            {salonName.charAt(0)}
                        </span>
                    )}
                </div>
                <div className="min-w-0">
                    <h2 className="truncate font-display text-xl italic text-text-strong">{salonName}</h2>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">
                        {role === 'owner' ? 'Dirección' : 'Equipo'}
                    </p>
                </div>
            </div>

            <nav aria-label="Secciones del panel" className="flex flex-1 flex-col gap-1 overflow-y-auto px-6 no-scrollbar">
                {visibleItems.map(item => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            className={`flex items-center gap-4 rounded-2xl px-5 py-3.5 transition-colors ${
                                active
                                    ? 'bg-text-strong text-white'
                                    : 'text-text-muted hover:bg-brand-tint hover:text-text-strong'
                            }`}
                        >
                            <Icon name={item.icon} filled={active} />
                            <span className="text-[11px] font-bold uppercase tracking-[0.15em]">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-line p-6">
                <button
                    onClick={handleLogout}
                    className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-text-muted transition-colors hover:text-text-strong"
                >
                    <Icon name="logout" />
                    <span className="text-sm font-medium">Cerrar sesión</span>
                </button>
            </div>
        </div>
    );

    return (
        <SessionContext.Provider value={session}>
            {/*
                The shell is taken out of the document flow on purpose.

                As an in-flow `h-dvh` block it was exactly the viewport tall, so
                anything that added height to the body — a browser extension's
                injected node, for instance — made the document scrollable, and
                scrolling carried the whole shell up and left a blank band below
                it. Out of flow the shell always covers the viewport and the
                document has nothing to scroll.
            */}
            <div className="fixed inset-0 flex flex-col overflow-hidden bg-surface lg:flex-row">
                <aside className="hidden w-72 shrink-0 lg:flex lg:flex-col">{sidebar}</aside>

                <header className="flex shrink-0 items-center justify-between border-b border-line bg-surface-raised px-5 py-4 lg:hidden">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="size-9 shrink-0 overflow-hidden rounded-lg bg-brand-soft">
                            {logo && (
                                <img src={logo} alt="" className="size-full object-cover" />
                            )}
                        </div>
                        <h1 className="truncate font-display text-xl italic text-text-strong">{salonName}</h1>
                    </div>
                    <button
                        onClick={() => setDrawerOpen(true)}
                        aria-label="Abrir menú"
                        aria-expanded={drawerOpen}
                        className="grid size-11 place-items-center rounded-xl border border-line text-text-strong"
                    >
                        <Icon name="menu" />
                    </button>
                </header>

                {drawerOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <button
                            className="absolute inset-0 bg-text-strong/30 backdrop-blur-sm"
                            aria-label="Cerrar menú"
                            onClick={() => setDrawerOpen(false)}
                        />
                        <div className="animate-slide-in-right relative ml-auto flex h-full w-80 max-w-[85vw] flex-col bg-surface-raised shadow-lg">
                            <button
                                onClick={() => setDrawerOpen(false)}
                                aria-label="Cerrar menú"
                                className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full text-text-muted"
                            >
                                <Icon name="close" />
                            </button>
                            {sidebar}
                        </div>
                    </div>
                )}

                <main className="flex-1 overflow-y-auto overscroll-contain lg:p-8">
                    {standing !== 'ok' && (
                        <div
                            role="status"
                            className={`mx-auto mb-4 w-full max-w-[1240px] rounded-2xl border px-5 py-4 text-sm lg:mb-6 ${
                                standing === 'suspended'
                                    ? 'border-danger/30 bg-danger/10 text-danger'
                                    : 'border-warning/30 bg-warning/10 text-warning'
                            }`}
                        >
                            {standing === 'suspended' ? (
                                <>
                                    <strong className="font-semibold">
                                        Tu página no está aceptando reservas.
                                    </strong>{' '}
                                    Tus citas y tus datos siguen aquí. Escríbenos para
                                    reactivarla.
                                </>
                            ) : (
                                <>
                                    <strong className="font-semibold">Tu cuota está pendiente.</strong>{' '}
                                    {graceDaysLeft === 0
                                        ? 'Tu página deja de aceptar reservas hoy.'
                                        : `Te quedan ${graceDaysLeft} ${
                                              graceDaysLeft === 1 ? 'día' : 'días'
                                          } antes de que tu página deje de aceptar reservas.`}
                                </>
                            )}
                        </div>
                    )}

                    <div className="mx-auto min-h-full w-full max-w-[1240px] lg:rounded-[2rem] lg:border lg:border-line lg:bg-surface-raised lg:p-8 lg:shadow-soft">
                        {children}
                    </div>
                </main>
            </div>
        </SessionContext.Provider>
    );
}
