'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
    { href: '/admin', label: 'Inicio', icon: 'home' },
    { href: '/admin/agenda', label: 'Agenda', icon: 'calendar' },
    { href: '/admin/services', label: 'Servicios', icon: 'sparkle' },
    { href: '/admin/clients', label: 'Clientes', icon: 'users' },
];

const ICONS: Record<string, React.ReactNode> = {
    home: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
    calendar: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    sparkle: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9 12l-7 3 7 3 3 10 3-10 7-3-7-3z" /></svg>,
    users: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const getIsActive = (href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(href));

    return (
        <div className="min-h-screen bg-cream flex flex-col lg:flex-row">
            {/* Desktop Sidebar (hidden on mobile) */}
            <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-cream-dark h-screen sticky top-0 shadow-sm z-20">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-gradient-to-br from-pink to-coral">
                            <span className="text-white font-bold font-serif text-lg">N</span>
                        </div>
                        <h2 className="font-serif text-2xl font-semibold text-charcoal">NailFlow</h2>
                    </div>

                    <nav className="flex flex-col gap-2">
                        {NAV_ITEMS.map((item) => {
                            const isActive = getIsActive(item.href);
                            return (
                                <Link
                                    key={`desktop-${item.href}`}
                                    href={item.href}
                                    className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 ${isActive
                                            ? 'bg-pink-pale text-pink shadow-sm font-semibold'
                                            : 'text-nf-gray hover:bg-cream hover:text-charcoal'
                                        }`}
                                >
                                    <div className={`${isActive ? 'text-pink' : 'text-gray-light'}`}>
                                        {ICONS[item.icon]}
                                    </div>
                                    <span className="text-[15px]">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="mt-auto p-8 border-t border-cream-dark/50">
                    <button className="flex items-center gap-3 text-nf-gray hover:text-charcoal transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        <span className="text-sm font-medium">Cerrar sesión</span>
                    </button>
                </div>
            </aside>

            {/* Mobile constraints structure for the main content */}
            <main className="flex-1 flex justify-center lg:justify-start lg:p-10 min-h-screen">
                <div className="w-full h-full lg:max-w-6xl relative flex flex-col bg-cream lg:bg-transparent lg:rounded-none">

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto pb-24 lg:pb-10 lg:bg-white lg:rounded-3xl lg:shadow-[0_8px_32px_rgba(0,0,0,0.03)] lg:border lg:border-cream-dark/50 p-0 lg:overflow-hidden relative">
                        <div className="lg:absolute lg:inset-0 lg:overflow-y-auto lg:p-6 custom-scrollbar">
                            {children}
                        </div>
                    </div>

                    {/* Mobile Bottom Navigation (hidden on desktop) */}
                    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-cream-dark flex items-center justify-around h-[80px] px-2 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.04)] z-50">
                        {NAV_ITEMS.map((item) => {
                            const isActive = getIsActive(item.href);
                            return (
                                <Link
                                    key={`mobile-${item.href}`}
                                    href={item.href}
                                    className={`flex flex-col items-center gap-1.5 px-4 py-2 transition-colors duration-200 ${isActive ? 'text-pink' : 'text-gray-light hover:text-charcoal-light'
                                        }`}
                                >
                                    {ICONS[item.icon]}
                                    <span className={`text-[11px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
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
