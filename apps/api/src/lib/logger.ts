import { env } from '../config/env';

/**
 * Minimal structured logger.
 *
 * Emits one JSON object per line in production so log aggregators can parse it,
 * and a readable single line in development. Never log tokens, passwords or
 * full CDN URLs — pass identifiers instead.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = LEVEL_ORDER[(process.env.LOG_LEVEL as Level) ?? (env.isProduction ? 'info' : 'debug')];

/* eslint-disable no-console -- this module is the one place console output belongs */
function emit(level: Level, scope: string, message: string, context?: Record<string, unknown>) {
    if (LEVEL_ORDER[level] < minLevel) return;

    if (env.isProduction) {
        console[level === 'debug' ? 'log' : level](
            JSON.stringify({ level, scope, message, ...context, time: new Date().toISOString() })
        );
        return;
    }

    const suffix = context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : '';
    console[level === 'debug' ? 'log' : level](`[${scope}] ${message}${suffix}`);
}

export interface Logger {
    debug(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
}

export function createLogger(scope: string): Logger {
    return {
        debug: (message, context) => emit('debug', scope, message, context),
        info: (message, context) => emit('info', scope, message, context),
        warn: (message, context) => emit('warn', scope, message, context),
        error: (message, context) => emit('error', scope, message, context),
    };
}

/** Narrow an unknown catch binding down to something safe to log. */
export function errorContext(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        return env.isProduction
            ? { error: error.message }
            : { error: error.message, stack: error.stack };
    }
    return { error: String(error) };
}
