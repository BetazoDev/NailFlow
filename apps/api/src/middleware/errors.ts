import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('http');

/**
 * An error whose message is safe to show the caller.
 * Anything thrown that is *not* an ApiError becomes a generic 500, so internal
 * details (SQL text, driver messages, stack traces) never reach the client.
 */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
        readonly details?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
    }

    static badRequest(message: string, details?: unknown) {
        return new ApiError(400, message, details);
    }
    static unauthorized(message = 'Authentication required') {
        return new ApiError(401, message);
    }
    static forbidden(message = 'You do not have access to this resource') {
        return new ApiError(403, message);
    }
    static notFound(message = 'Resource not found') {
        return new ApiError(404, message);
    }
    static conflict(message: string) {
        return new ApiError(409, message);
    }
}

/**
 * Wraps an async handler so a rejected promise reaches the error middleware.
 * Express 4 does not do this itself; without it a failed `await` hangs the
 * request until the client times out.
 */
export function asyncHandler<T extends Request = Request>(
    handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(handler(req as T, res, next)).catch(next);
    };
}

export function notFoundHandler(req: Request, res: Response): void {
    log.warn('No route matched', { method: req.method, path: req.path });
    res.status(404).json({ error: 'Route not found' });
}

export function errorHandler(
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    if (error instanceof ApiError) {
        log.warn('Request rejected', {
            method: req.method,
            path: req.path,
            status: error.status,
            message: error.message,
        });
        res.status(error.status).json({ error: error.message, details: error.details });
        return;
    }

    log.error('Unhandled request error', {
        method: req.method,
        path: req.path,
        ...errorContext(error),
    });

    res.status(500).json({
        error: 'Internal server error',
        // Surface the cause only outside production, where the caller is the developer.
        ...(env.isProduction ? {} : errorContext(error)),
    });
}
