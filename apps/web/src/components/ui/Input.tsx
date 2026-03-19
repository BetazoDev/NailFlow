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
            <div className="flex flex-col gap-1 w-full">
                <div className="relative group">
                    <input
                        ref={ref}
                        placeholder=" "
                        className={`
                            peer w-full bg-white/60 border border-aesthetic-accent/30 rounded-2xl py-4 pb-3 pt-6 px-6 
                            ${leftIcon ? 'pl-14' : ''}
                            ${error ? 'border-red-200 ring-1 ring-red-200' : 'border-aesthetic-accent/20 focus:border-aesthetic-pink/50 focus:ring-1 focus:ring-aesthetic-pink/20'}
                            outline-none transition-all duration-300 font-display italic text-base text-aesthetic-taupe
                            focus:bg-white focus:shadow-minimal
                            ${className}
                        `}
                        {...props}
                    />

                    {label && (
                        <label className={`
                            absolute top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.2em] font-bold text-aesthetic-muted/40
                            transition-all duration-300 pointer-events-none select-none
                            peer-focus:top-3.5 peer-focus:text-aesthetic-pink peer-focus:scale-95
                            peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:scale-95
                            ${leftIcon ? 'left-14' : 'left-6'}
                        `}>
                            {label}
                        </label>
                    )}

                    {leftIcon && (
                        <div className={`
                            absolute left-6 top-1/2 -translate-y-1/2 transition-all duration-300 h-6 flex items-center
                            peer-focus:text-aesthetic-pink peer-focus:scale-110
                            ${props.value || props.defaultValue ? 'text-aesthetic-pink' : 'text-aesthetic-muted/40'}
                        `}>
                            {typeof leftIcon === 'string' ? (
                                <span className="material-symbol text-xl font-light">{leftIcon}</span>
                            ) : (
                                leftIcon
                            )}
                        </div>
                    )}
                </div>
                {error ? (
                    <span className="text-[9px] text-red-400 font-bold px-4 uppercase tracking-[0.1em] mt-1">{error}</span>
                ) : helperText ? (
                    <span className="text-[9px] text-aesthetic-muted/60 px-4 uppercase tracking-[0.1em] mt-1">{helperText}</span>
                ) : null}
            </div>
        );
    }
);

Input.displayName = 'Input';
