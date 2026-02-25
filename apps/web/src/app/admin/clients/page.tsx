import { api } from '@/lib/api';

export default async function ClientsPage() {
    // Derive unique clients from appointments
    const clientMap = new Map<string, { name: string; phone: string; visits: number; lastVisit: string }>();
    const appointments = await api.getAppointments();

    appointments.forEach((apt) => {
        const existing = clientMap.get(apt.client_phone);
        if (existing) {
            existing.visits += 1;
            if (apt.datetime_start > existing.lastVisit) existing.lastVisit = apt.datetime_start;
        } else {
            clientMap.set(apt.client_phone, {
                name: apt.client_name,
                phone: apt.client_phone,
                visits: 1,
                lastVisit: apt.datetime_start,
            });
        }
    });

    const clients = Array.from(clientMap.values());

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-12 pb-4">
                <h1 className="font-serif text-2xl font-semibold text-charcoal">Clientes</h1>
                <span className="text-xs font-medium text-nf-gray bg-cream-dark px-3 py-1.5 rounded-full">
                    {clients.length} total
                </span>
            </div>

            {/* Search */}
            <div className="px-6 mb-4">
                <div className="relative">
                    <svg
                        className="absolute left-4 top-1/2 -translate-y-1/2"
                        width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="var(--nf-gray)" strokeWidth="2"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        className="input-field pl-11"
                        placeholder="Buscar cliente..."
                    />
                </div>
            </div>

            {/* Client list - Mobile Cards */}
            <div className="px-6 space-y-2.5 stagger-children lg:hidden">
                {clients.map((client) => {
                    const initials = client.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                    return (
                        <div
                            key={client.phone}
                            className="flex items-center bg-white rounded-xl p-4 shadow-sm border border-black/[0.03] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                        >
                            <div
                                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 mr-3.5"
                                style={{ background: 'linear-gradient(135deg, var(--pink), var(--coral))' }}
                            >
                                {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[15px] font-semibold text-charcoal truncate">{client.name}</p>
                                <p className="text-xs text-nf-gray">{client.phone}</p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-3">
                                <p className="text-sm font-medium text-charcoal">{client.visits} {client.visits === 1 ? 'visita' : 'visitas'}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Client list - Desktop Table */}
            <div className="hidden lg:block px-6">
                <div className="bg-white rounded-2xl shadow-sm border border-cream-dark/50 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-cream/50 border-b border-cream-dark/50">
                                <th className="py-4 px-6 font-serif font-semibold text-nf-gray text-sm">Cliente</th>
                                <th className="py-4 px-6 font-serif font-semibold text-nf-gray text-sm">Teléfono</th>
                                <th className="py-4 px-6 font-serif font-semibold text-nf-gray text-sm">Total Visitas</th>
                                <th className="py-4 px-6 font-serif font-semibold text-nf-gray text-sm text-right">Última Visita</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map((client) => {
                                const initials = client.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                                return (
                                    <tr key={client.phone} className="border-b border-cream-dark/20 hover:bg-pink-pale/30 transition-colors cursor-pointer">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-gradient-to-br from-pink to-coral">
                                                    {initials}
                                                </div>
                                                <span className="font-semibold text-charcoal">{client.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-charcoal-light">{client.phone}</td>
                                        <td className="py-4 px-6">
                                            <span className="inline-flex items-center justify-center bg-cream-dark/50 text-charcoal text-xs font-semibold px-2.5 py-1 rounded-full">
                                                {client.visits}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-nf-gray text-right">
                                            {new Date(client.lastVisit).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
