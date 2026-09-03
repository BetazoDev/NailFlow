import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { ApiError } from './errors';

/**
 * Parses and replaces `req.body` / `req.query` / `req.params` with the schema's
 * output, so handlers receive typed, trimmed, range-checked values instead of
 * `any` straight off the wire.
 */
function validator(source: 'body' | 'query' | 'params') {
    return <S extends ZodTypeAny>(schema: S) =>
        (req: Request, _res: Response, next: NextFunction): void => {
            const result = schema.safeParse(req[source]);
            if (!result.success) {
                const details = result.error.issues.map(issue => ({
                    field: issue.path.join('.') || source,
                    message: issue.message,
                }));
                return next(ApiError.badRequest('Invalid request', details));
            }
            // `req.query` is a getter in Express 5; assigning per-key keeps both versions happy.
            Object.assign(req[source] as object, result.data);
            next();
        };
}

export const validateBody = validator('body');
export const validateQuery = validator('query');
export const validateParams = validator('params');

export type Infer<S extends ZodTypeAny> = z.infer<S>;
