'use client';

import React from 'react';

/**
 * The app's button.
 *
 * Variants describe intent, not colour, so a palette change re-skins every
 * button without touching a call site.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    /** Announced and shown while loading. */
    loadingLabel?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'btn-gradient text-white',
    secondary: 'bg-surface-raised text-text-strong border border-line shadow-soft hover:border-brand-soft',
    outline: 'bg-transparent border-2 border-brand text-brand hover:bg-brand-tint',
    ghost: 'bg-transparent text-text-muted hover:bg-surface-sunken hover:text-text-strong',
    danger: 'bg-danger text-white hover:brightness-95',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'px-4 py-2 text-xs gap-1.5',
    md: 'px-6 py-3 text-sm gap-2',
    lg: 'px-8 py-4 text-base gap-2.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
        className = '',
        variant = 'primary',
        size = 'md',
        isLoading = false,
        loadingLabel = 'Cargando…',
        leftIcon,
        rightIcon,
        children,
        disabled,
        ...props
    },
    ref
) {
    return (
        <button
            ref={ref}
            // `aria-busy` tells assistive tech the control is working; without it
            // a swapped label reads as the button having simply changed.
            aria-busy={isLoading || undefined}
            disabled={isLoading || disabled}
            className={`inline-flex items-center justify-center rounded-full font-semibold tracking-tight
                        transition-all duration-150 active:scale-[0.98]
                        disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100
                        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
            {...props}
        >
            {isLoading ? (
                <>
                    <span
                        aria-hidden="true"
                        className="size-4 shrink-0 rounded-full border-2 border-current/30 border-t-current animate-spin"
                    />
                    {loadingLabel}
                </>
            ) : (
                <>
                    {leftIcon}
                    {children}
                    {rightIcon}
                </>
            )}
        </button>
    );
});
