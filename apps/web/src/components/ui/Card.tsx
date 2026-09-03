'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'raised' | 'glass' | 'sunken' | 'brand';
    /** Lifts on hover. Only set this on cards that are actually clickable. */
    interactive?: boolean;
}

const VARIANTS: Record<NonNullable<CardProps['variant']>, string> = {
    raised: 'bg-surface-raised border-line',
    glass: 'glass-card border-transparent',
    sunken: 'bg-surface-sunken border-line',
    brand: 'bg-brand-tint border-brand-soft',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
    { children, variant = 'raised', interactive = false, className = '', ...props },
    ref
) {
    return (
        <div
            ref={ref}
            className={`rounded-[--radius-lg] border p-6 shadow-soft transition-all duration-200
                        ${interactive ? 'hover:-translate-y-0.5 hover:shadow-md' : ''}
                        ${VARIANTS[variant]} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
});
