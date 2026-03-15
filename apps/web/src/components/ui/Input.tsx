'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, helperText, leftIcon, className = '', ...props }, ref) => {
        return (
            <div className="flex flex-col gap-1.5 w-full">
                {label && (
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-nf-gray px-1">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    {leftIcon && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-nf-gray group-focus-within:text-pink transition-colors">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`
                            w-full bg-white/60 border-2 rounded-2xl py-3.5 px-6 
                            ${leftIcon ? 'pl-12' : ''}
                            ${error ? 'border-red-200' : 'border-cream-dark group-hover:border-pink-light/30 focus:border-pink'}
                            outline-none transition-all duration-300 font-sans text-charcoal placeholder:text-nf-gray/40
                            focus:bg-white focus:shadow-inner
                            ${className}
                        `}
                        {...props}
                    />
                </div>
                {error ? (
                    <span className="text-[10px] text-red-500 font-bold px-1 uppercase tracking-wider">{error}</span>
                ) : helperText ? (
                    <span className="text-[10px] text-nf-gray/60 px-1 uppercase tracking-wider">{helperText}</span>
                ) : null}
            </div>
        );
    }
);

Input.displayName = 'Input';
