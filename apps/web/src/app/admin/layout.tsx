'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/api';
import { TenantContext } from '@/lib/tenant-context';
import { PALETTES, TYPOGRAPHY } from '@/lib/constants';

// Branding will be loaded from shared constants

const NAV_ITEMS = [
    { href: '/admin', label: 'Inicio', icon: 'home', roles: ['owner', 'staff'] },
    { href: '/admin/agenda', label: 'Agenda', icon: 'calendar_today', roles: ['owner', 'staff'] },
    { href: '/admin/services', label: 'Servicios', icon: 'content_cut', roles: ['owner'] },
    { href: '/admin/clients', label: 'Clientas', icon: 'group', roles: ['owner'] },
    { href: '/admin/team', label: 'Equipo', icon: 'badge', roles: ['owner'] },
    { href: '/admin/settings', label: 'Perfil', icon: 'person', roles: ['owner'] },
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

                // Fetch tenant
                const t = await api.getTenantByOwner(user.uid);
                if (t) {
                    setTenantId(t.id);
                    setDomain(t.domain);
                    setLogoUrl(t.branding?.logo_url || null);
                    setPhotoUrl(t.branding?.photo_url || null);
                    setSalonName(t.name || 'NailFlow');
                } else {
                    // Fallback to testing state or error state
                    setTenantId('demo-tenant'); // fallback for testing if no tenant created yet by owner
                    setDomain('demo.diabolicalservices.tech');

                    // Also try to load demo-tenant data directly for branding
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

    // Load saved branding from Firestore and apply CSS vars
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

    return (
        <div className="h-screen bg-cream flex flex-col lg:flex-row overflow-hidden">
            {/* Desktop Sidebar (hidden on mobile) */}
            <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-cream-dark h-full shadow-sm z-20 flex-shrink-0">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="size-10 rounded-xl flex items-center justify-center shadow-soft bg-aesthetic-accent overflow-hidden">
                            {logoUrl ? (
                                <img src={api.getPublicUrl(logoUrl)} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-aesthetic-taupe font-bold font-display text-lg italic">N</span>
                            )}
                        </div>
                        <h2 className="font-display text-xl font-light italic tracking-tight text-aesthetic-taupe truncate">{salonName}</h2>
                    </div>

                    <nav className="flex flex-col gap-2">
                        {NAV_ITEMS.filter(item => item.roles.includes(userRole || 'owner')).map((item) => {
                            const isActive = getIsActive(item.href);
                            return (
                                <Link
                                    key={`desktop-${item.href}`}
                                    href={item.href}
                                    className={`flex flex-col items-center gap-2 px-4 py-3.5 rounded-2xl transition-all duration-300 ${isActive
                                        ? 'text-aesthetic-pink font-medium'
                                        : 'text-aesthetic-muted/60 hover:text-aesthetic-pink'
                                        }`}
                                >
                                    <MaterialSymbol name={item.icon} active={isActive} />
                                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="mt-auto p-8 border-t border-cream-dark/50">
                    <button onClick={handleLogout} className="flex items-center gap-3 text-nf-gray hover:text-charcoal transition-colors w-full">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        <span className="text-sm font-medium">Cerrar sesión</span>
                    </button>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-aesthetic-soft-pink flex items-center justify-center overflow-hidden border border-aesthetic-accent shadow-minimal">
                            {photoUrl ? (
                                <img src={api.getPublicUrl(photoUrl)} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span className="font-display italic text-aesthetic-taupe text-lg">{salonName[0]}</span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-aesthetic-taupe leading-tight truncate">{salonName}</p>
                            <p className="text-[10px] text-aesthetic-muted uppercase tracking-wider">{userRole === 'owner' ? 'Propietario' : 'Staff'}</p>
                        </div>
                        {logoUrl && (
                            <div className="size-8 rounded-lg overflow-hidden border border-cream-dark shadow-sm bg-white p-1">
                                <img src={api.getPublicUrl(logoUrl)} alt="Brand Logo" className="w-full h-full object-contain" />
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Mobile constraints structure for the main content */}
            <main className="flex-1 flex justify-center lg:justify-start lg:p-10 h-full overflow-hidden">
                <div className="w-full h-full lg:max-w-6xl relative flex flex-col bg-cream lg:bg-transparent lg:rounded-none">

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto pb-24 lg:pb-10 lg:bg-white lg:rounded-3xl lg:shadow-[0_8px_32px_rgba(0,0,0,0.03)] lg:border lg:border-cream-dark/50 p-0 lg:overflow-hidden relative">
                        <div className="lg:absolute lg:inset-0 lg:overflow-y-auto lg:p-6 custom-scrollbar">
                            <TenantContext.Provider value={{ tenantId, domain }}>
                                {children}
                            </TenantContext.Provider>
                        </div>
                    </div>

                    {/* Mobile Bottom Navigation (hidden on desktop) */}
                    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-cream-dark flex items-center justify-around h-[80px] px-2 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.04)] z-50">
                        {NAV_ITEMS.filter(item => item.roles.includes(userRole || 'owner')).map((item) => {
                            const isActive = getIsActive(item.href);
                            return (
                                <Link
                                    key={`mobile-${item.href}`}
                                    href={item.href}
                                    className={`flex flex-col items-center gap-1.5 px-4 py-2 transition-all duration-300 ${isActive ? 'text-aesthetic-pink' : 'text-aesthetic-muted/40 hover:text-aesthetic-pink'
                                        }`}
                                >
                                    <MaterialSymbol name={item.icon} active={isActive} />
                                    <span className={`text-[9px] font-bold uppercase tracking-[0.15em]`}>
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </main>
        </div>
    );
}
