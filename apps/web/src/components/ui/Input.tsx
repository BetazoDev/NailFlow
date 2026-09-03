'use client';

import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    helperText?: string;
    /** Material Symbols ligature name, or a node. */
    leftIcon?: React.ReactNode;
}

/**
 * Labelled text input.
 *
 * The label is a real `<label htmlFor>` rather than positioned text, and the
 * error is wired through `aria-describedby` — so screen readers announce which
 * field failed and why, and tapping the label focuses the input.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
    { label, error, helperText, leftIcon, className = '', id, ...props },
    ref
) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const messageId = `${inputId}-message`;
    const message = error ?? helperText;

    return (
        <div className="flex w-full flex-col gap-1.5">
            <label
                htmlFor={inputId}
                className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted"
            >
                {label}
            </label>

            <div className="relative">
                {leftIcon && (
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-text-subtle"
                    >
                        {typeof leftIcon === 'string' ? (
                            <span className="material-symbol text-xl">{leftIcon}</span>
                        ) : (
                            leftIcon
                        )}
                    </span>
                )}

                <input
                    ref={ref}
                    id={inputId}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={message ? messageId : undefined}
                    className={`input-field ${leftIcon ? 'pl-14' : ''} ${className}`}
                    {...props}
                />
            </div>

            {message && (
                <span
                    id={messageId}
                    role={error ? 'alert' : undefined}
                    className={`ml-1 text-[11px] ${error ? 'text-danger' : 'text-text-muted'}`}
                >
                    {message}
                </span>
            )}
        </div>
    );
});
