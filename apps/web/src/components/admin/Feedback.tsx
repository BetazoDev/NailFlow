'use client';

/**
 * A save result, shown as success or failure.
 *
 * The profile page decided the colour by sniffing the message text for the word
 * "éxito". Its own `save()` returns "¡Guardado!", which does not contain it, so
 * every successful save was painted in error red — visually identical to a
 * failure. The outcome is now carried explicitly instead of inferred.
 */
export type FeedbackTone = 'success' | 'error';

export interface FeedbackState {
    tone: FeedbackTone;
    message: string;
}

export function Feedback({ state }: { state: FeedbackState | null }) {
    if (!state) return null;

    const isError = state.tone === 'error';

    return (
        <p
            role={isError ? 'alert' : 'status'}
            className={`animate-fade-in flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
                isError
                    ? 'border-danger/30 bg-danger/10 text-danger'
                    : 'border-success/30 bg-success/10 text-success'
            }`}
        >
            <span className="material-symbol text-lg" aria-hidden="true">
                {isError ? 'error' : 'check_circle'}
            </span>
            {state.message}
        </p>
    );
}
