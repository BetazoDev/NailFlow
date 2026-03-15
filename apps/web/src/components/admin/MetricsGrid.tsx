'use client';

import React from 'react';
import { Card } from '../ui/Card';

interface MetricProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: string;
    trend?: {
        value: string;
        positive: boolean;
    };
    color?: string;
}

const Metric = ({ label, value, subValue, icon, trend, color = 'var(--pink)' }: MetricProps) => (
    <Card variant="white" className="flex flex-col p-8 group">
        <div className="flex items-start justify-between mb-8">
            <div 
                className="size-14 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500"
                style={{ background: 'var(--cream)' }}
            >
                <span className="material-symbol text-2xl font-light" style={{ color }}>{icon}</span>
            </div>
            {trend && (
                <div className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${trend.positive ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                    <span className="material-symbol text-xs">{trend.positive ? 'trending_up' : 'trending_down'}</span>
                    {trend.value}
                </div>
            )}
        </div>
        <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-nf-gray mb-1 opacity-60 font-display italic">
            {label}
        </p>
        <div className="flex items-baseline gap-2">
            <h3 className="font-display text-4xl font-light italic text-charcoal tracking-tight">{value}</h3>
            {subValue && <span className="text-xs font-medium text-nf-gray/40">{subValue}</span>}
        </div>
    </Card>
);

interface MetricsGridProps {
    income: number;
    completedCitations: number;
    pendingCitations: number;
    newClients: number;
    periodLabel: string;
}

export const MetricsGrid = ({ income, completedCitations, pendingCitations, newClients, periodLabel }: MetricsGridProps) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Metric 
                label={`Ingresos ${periodLabel}`} 
                value={`$${income.toLocaleString()}`} 
                icon="payments" 
                trend={{ value: '+12%', positive: true }} 
                color="var(--pink)"
            />
            <Metric 
                label="Citas Completadas" 
                value={completedCitations} 
                icon="check_circle" 
                color="#88C999"
            />
            <Metric 
                label="Citas Pendientes" 
                value={pendingCitations} 
                icon="schedule" 
                color="var(--orange-pale, #F4A261)"
            />
            <Metric 
                label="Nuevas Clientas" 
                value={newClients} 
                icon="person_add" 
                color="var(--aesthetic-taupe)"
            />
        </div>
    );
};
