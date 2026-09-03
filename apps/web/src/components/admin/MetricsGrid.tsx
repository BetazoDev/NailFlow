'use client';

import { Card } from '@/components/ui/Card';
import { formatMoney } from '@/lib/format';

interface MetricProps {
    label: string;
    value: string | number;
    hint?: string;
    icon: string;
    /** A token name from the design system, not a raw hex value. */
    accent: string;
}

function Metric({ label, value, hint, icon, accent }: MetricProps) {
    return (
        <Card className="flex flex-col p-8">
            <div
                className="mb-8 grid size-14 place-items-center rounded-2xl"
                style={{ background: 'var(--surface-sunken)' }}
            >
                <span className="material-symbol text-2xl" style={{ color: accent }} aria-hidden="true">
                    {icon}
                </span>
            </div>

            <p className="mb-1 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                {label}
            </p>
            <p className="font-display text-4xl font-light italic tracking-tight text-text-strong">{value}</p>
            {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
        </Card>
    );
}

export interface MetricsGridProps {
    income: number;
    completedCitations: number;
    pendingCitations: number;
    newClients: number;
    periodLabel: string;
    currency?: string;
}

/**
 * The salon's numbers for the selected period.
 *
 * Every tile shows a measured value. The revenue tile used to carry a hardcoded
 * "+12%" trend badge that was never computed from anything — a made-up figure
 * presented exactly like the real ones beside it.
 */
export function MetricsGrid({
    income,
    completedCitations,
    pendingCitations,
    newClients,
    periodLabel,
    currency,
}: MetricsGridProps) {
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Metric
                label={`Ingresos · ${periodLabel}`}
                value={formatMoney(income, currency)}
                hint="Solo citas completadas"
                icon="payments"
                accent="var(--brand-primary)"
            />
            <Metric
                label="Citas completadas"
                value={completedCitations}
                icon="check_circle"
                accent="var(--success)"
            />
            <Metric
                label="Citas pendientes"
                value={pendingCitations}
                hint="Hoy"
                icon="schedule"
                accent="var(--warning)"
            />
            <Metric
                label="Clientas nuevas"
                value={newClients}
                hint={`Primera reserva · ${periodLabel.toLowerCase()}`}
                icon="person_add"
                accent="var(--text-strong)"
            />
        </div>
    );
}
