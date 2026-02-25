import { api } from '@/lib/api';

export default async function AdminDashboard() {
    const tenant = await api.getTenant();
    const todayAppointments = await api.getAppointments();
    const totalEarnings = todayAppointments.reduce((sum, a) => sum + a.total_price, 0);
    const confirmedCount = todayAppointments.filter(a => a.status === 'confirmed').length;

    const colorSlots = ['pink', 'coral', 'beige', 'pink'] as const;

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="px-6 pt-12 pb-4">
                <div className="flex items-center justify-between mb-5">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--pink-light), var(--coral-light))' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </div>
                    <button className="p-2 rounded-full hover:bg-cream-dark transition-colors">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--charcoal)" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                    </button>
                </div>
                <h1 className="font-serif text-[30px] font-semibold text-charcoal">Hola, {tenant.owner_name.split(' ')[0]} ✨</h1>
            </div>

            <div className="px-6">
                {/* Earnings Card */}
                <div className="rounded-2xl p-5 mb-4" style={{ background: 'linear-gradient(135deg, var(--pink-pale), var(--cream))' }}>
                    <p className="text-[11px] font-semibold text-nf-gray uppercase tracking-widest mb-2">INGRESOS DEL DÍA</p>
                    <div className="flex items-baseline gap-3">
                        <span className="font-serif text-4xl font-bold text-charcoal">${totalEarnings.toLocaleString()}</span>
                        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">+12%</span>
                    </div>
                    <p className="text-xs text-nf-gray mt-1.5">{confirmedCount} citas confirmadas hoy</p>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2.5 mb-7">
                    <button className="flex-1 flex items-center justify-center gap-2 bg-white border-[1.5px] border-cream-dark rounded-xl py-3.5 text-[13px] font-medium text-charcoal hover:border-pink hover:bg-pink-pale transition-all duration-200">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Nueva cita
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 bg-white border-[1.5px] border-cream-dark rounded-xl py-3.5 text-[13px] font-medium text-charcoal hover:border-pink hover:bg-pink-pale transition-all duration-200">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                        Compartir link
                    </button>
                </div>

                {/* Today's Appointments */}
                <div className="flex items-center justify-between mb-3.5">
                    <h2 className="font-serif text-xl font-semibold text-charcoal">Hoy</h2>
                    <a href="/admin/agenda" className="text-[13px] font-medium text-pink hover:underline">Ver agenda →</a>
                </div>

                <div className="space-y-2.5 stagger-children">
                    {todayAppointments.map((apt, i) => {
                        const time = new Date(apt.datetime_start).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
                        const color = colorSlots[i % colorSlots.length];
                        const statusBg = apt.status === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700';

                        return (
                            <div key={apt.id} className="flex items-center gap-3.5 bg-white rounded-xl p-4 shadow-sm border border-black/[0.03] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                                <span className="text-sm font-semibold text-nf-gray min-w-[42px]">{time}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[15px] font-semibold text-charcoal truncate">{apt.client_name}</p>
                                    <p className="text-xs text-nf-gray truncate">{apt.service_name}</p>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBg}`}>
                                    {apt.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                                </span>
                                <div className={`w-1 h-9 rounded-full ${color === 'pink' ? 'bg-pink' : color === 'coral' ? 'bg-coral' : 'bg-beige'
                                    }`} />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
