'use client';

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'glass' | 'white' | 'cream' | 'pink';
    animate?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ children, variant = 'white', animate = true, className = '', ...props }, ref) => {
        const variants = {
            white: 'bg-white border-cream-dark',
            glass: 'bg-white/40 backdrop-blur-md border-white/40 shadow-xl',
            cream: 'bg-cream border-cream-dark/50',
            pink: 'bg-pink-pale border-pink-light/20',
        };

        return (
            <div
                ref={ref}
                className={`
                    rounded-[2.5rem] border p-6 shadow-soft transition-all duration-500
                    ${animate ? 'hover:shadow-2xl hover:scale-[1.01]' : ''}
                    ${variants[variant]}
                    ${className}
                `}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = 'Card';
