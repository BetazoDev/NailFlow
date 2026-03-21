'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/api';
import { TenantContext } from '@/lib/tenant-context';
import { PALETTES, TYPOGRAPHY } from '@/lib/constants';

const NAV_ITEMS = [
    { href: '/admin', label: 'Inicio', icon: 'home', roles: ['owner', 'staff'] },
    { href: '/admin/agenda', label: 'Agenda', icon: 'calendar_today', roles: ['owner', 'staff'] },
    { href: '/admin/services', label: 'Servicios', icon: 'content_cut', roles: ['owner'] },
    { href: '/admin/clients', label: 'Clientas', icon: 'group', roles: ['owner'] },
    { href: '/admin/team', label: 'Equipo', icon: 'badge', roles: ['owner'] },
    { href: '/admin/profile', label: 'Perfil', icon: 'person', roles: ['owner'] },
];

const MaterialSymbol = ({ name, active }: { name: string; active?: boolean }) => (
    <span
        className="material-symbol transition-all"
        data-icon-name={name}
        style={{
            fontVariationSettings: `'FILL' ${active ? 1 : 0}, 'wght' 300, 'GRAD' 0, 'opsz' 24`,
        }}
    >
        {name}
    </span>
);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isAuth, setIsAuth] = useState<boolean | null>(null);
    const [userRole, setUserRole] = useState<'owner' | 'staff' | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [tenantId, setTenantId] = useState<string | null>(null);
    const [domain, setDomain] = useState<string | null>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [salonName, setSalonName] = useState<string>('NailFlow');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.replace('/login');
            } else {
                setIsAuth(true);
                const role = localStorage.getItem('mock_role') as 'owner' | 'staff' || 'owner';
                setUserRole(role);

                const t = await api.getTenantByOwner(user.uid);
                if (t) {
                    setTenantId(t.id);
                    setDomain(t.domain);
                    setLogoUrl(t.branding?.logo_url || null);
                    setPhotoUrl(t.branding?.photo_url || null);
                    setSalonName(t.name || 'NailFlow');
                } else {
                    setTenantId('demo-tenant');
                    setDomain('demo.diabolicalservices.tech');
                    api.getTenantById('demo-tenant').then(dt => {
                        if (dt) {
                            setLogoUrl(dt.branding?.logo_url || null);
                            setPhotoUrl(dt.branding?.photo_url || null);
                            setSalonName(dt.name || 'NailFlow');
                        }
                    });
                }
            }
        });
        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        if (!tenantId) return;
        api.getTenantById(tenantId).then(tenant => {
            if (!tenant) return;
            setLogoUrl(tenant.branding?.logo_url || null);
            setPhotoUrl(tenant.branding?.photo_url || null);
            setSalonName(tenant.name || 'NailFlow');
            const p = PALETTES.find(item => item.id === tenant.branding?.palette_id);
            const t = TYPOGRAPHY.find(item => item.id === tenant.branding?.typography);

            if (p) {
                Object.entries(p.cssVars).forEach(([key, value]) => {
                    document.documentElement.style.setProperty(key, value);
                });
            }
            if (t) {
                document.documentElement.style.setProperty('--font-display', t.fontDisplay);
                document.documentElement.style.setProperty('--font-sans', t.fontSans);
            }
        });
    }, [tenantId]);

    // Listen for profile save events – update sidebar instantly without re-loading
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.name) setSalonName(detail.name);
            if (detail?.logoUrl !== undefined) setLogoUrl(detail.logoUrl || null);
        };
        window.addEventListener('tenant-updated', handler);
        return () => window.removeEventListener('tenant-updated', handler);
    }, []);

    const handleLogout = async () => {
        await signOut(auth);
        document.cookie = 'mock_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        localStorage.removeItem('mock_role');
        router.push('/login');
    };

    if (isAuth === null) {
        return <div className="min-h-screen bg-cream flex items-center justify-center">Cargando...</div>;
    }

    const getIsActive = (href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(href));

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-white relative overflow-hidden">
            {/* Sidebar Header: Fixed at top */}
            <div className="p-8 pb-4 flex-shrink-0">
                <div className="flex items-center gap-3 mb-6">
                    <div className="size-10 rounded-xl flex items-center justify-center shadow-soft bg-aesthetic-accent overflow-hidden">
                        {logoUrl ? (
                            <img src={api.getPublicUrl(logoUrl)} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-aesthetic-taupe font-bold font-display text-lg italic">N</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-display text-xl font-light italic tracking-tight text-aesthetic-taupe truncate">{salonName}</h2>
                        <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-aesthetic-muted/60 leading-none mt-0.5">Dashboard</p>
                    </div>
                </div>
            </div>

            {/* Main Nav: Scrollable */}
            <nav className="flex-1 overflow-y-auto px-8 no-scrollbar flex flex-col gap-2 pb-6">
                {NAV_ITEMS.filter(item => item.roles.includes(userRole || 'owner')).map((item) => {
                    const isActive = getIsActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsSidebarOpen(false)}
                            className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 ${isActive
                                ? 'bg-aesthetic-taupe text-white shadow-soft'
                                : 'text-aesthetic-muted/60 hover:text-aesthetic-pink hover:bg-aesthetic-soft-pink/20'
                                }`}
                        >
                            <MaterialSymbol name={item.icon} active={isActive} />
                            <span className={`text-[11px] uppercase tracking-[0.15em] font-bold ${isActive ? 'text-white' : ''}`}>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Sidebar Footer: Fixed at bottom */}
            <div className="p-8 border-t border-cream-dark/50 bg-white flex-shrink-0">
                <button onClick={handleLogout} className="flex items-center gap-3 text-nf-gray hover:text-charcoal transition-colors w-full group">
                    <span className="material-symbol text-xl transition-transform group-hover:scale-110">logout</span>
                    <span className="text-sm font-medium">Cerrar sesión</span>
                </button>
            </div>
        </div>
    );

    return (
        <div className="h-screen bg-cream flex flex-col lg:flex-row overflow-hidden relative">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-72 h-full z-20 flex-shrink-0">
                <SidebarContent />
            </aside>

            {/* Mobile Header / Top Bar */}
            <header className="lg:hidden flex items-center justify-between px-6 py-5 bg-white/80 backdrop-blur-md border-b border-cream-dark/50 z-30 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-aesthetic-accent overflow-hidden border border-white shadow-soft">
                        {logoUrl && <img src={api.getPublicUrl(logoUrl)} alt="Logo" className="w-full h-full object-cover" />}
                    </div>
                    <h1 className="font-display italic text-2xl text-aesthetic-taupe tracking-tight">{salonName}</h1>
                </div>
                <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="size-12 flex items-center justify-center rounded-2xl bg-white border border-aesthetic-accent text-aesthetic-taupe shadow-minimal transition-all active:scale-95 group"
                >
                    <span className="material-symbol text-2xl transition-transform group-hover:scale-110">menu</span>
                </button>
            </header>

            {/* Mobile Sidebar Overlay (Drawer) */}
            {isSidebarOpen && (
                <div className="lg:hidden fixed inset-0 z-[100] animate-fade-in" onClick={() => setIsSidebarOpen(false)}>
                    <div className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm" />
                    <div className="relative w-80 h-full bg-white shadow-2xl animate-slide-in-right flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-4 right-4 z-10 font-bold uppercase tracking-widest text-[#811910]">
                            <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-aesthetic-muted pb-0">
                                <span className="material-symbol">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto w-full no-scrollbar pb-10">
                            <SidebarContent />
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                <div className="flex-1 overflow-y-auto lg:p-8 relative">
                    <div className="mx-auto w-full min-h-full max-w-[1240px] lg:bg-white lg:rounded-[2.5rem] lg:shadow-minimal lg:border lg:border-cream-dark/50 p-0 relative">
                        <div className="lg:p-8">
                            <TenantContext.Provider value={{ tenantId, domain }}>
                                {children}
                            </TenantContext.Provider>
                        </div>
                    </div>
                </div>

                {/* Mobile FAB (Optional reminder) */}
                {/* No FAB as per request */}
            </main>
        </div>
    );
}
