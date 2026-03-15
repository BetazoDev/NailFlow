'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center rounded-full font-serif transition-all duration-300 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none tracking-tight';
        
        const variants = {
            primary: 'btn-gradient text-white shadow-soft hover:shadow-lg',
            secondary: 'bg-white text-charcoal shadow-sm hover:shadow-md border border-cream-dark',
            outline: 'bg-transparent border-2 border-pink text-pink hover:bg-pink-pale',
            ghost: 'bg-transparent text-nf-gray hover:bg-cream-dark/30 hover:text-charcoal',
            danger: 'bg-red-500 text-white shadow-soft hover:bg-red-600',
        };

        const sizes = {
            sm: 'px-4 py-1.5 text-xs',
            md: 'px-6 py-2.5 text-sm',
            lg: 'px-8 py-3.5 text-base',
            xl: 'px-10 py-4.5 text-lg',
        };

        return (
            <button
                ref={ref}
                className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        <span>Cargando...</span>
                    </div>
                ) : (
                    <>
                        {leftIcon && <span className="mr-2">{leftIcon}</span>}
                        {children}
                        {rightIcon && <span className="ml-2">{rightIcon}</span>}
                    </>
                )}
            </button>
        );
    }
);

Button.displayName = 'Button';
