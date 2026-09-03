import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../config/env';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('db');

export const pool = new Pool({
    connectionString: env.database.url,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

pool.on('error', err => {
    log.error('Idle client error', errorContext(err));
});

/**
 * Run a parameterised query. Always pass values via `params` — string
 * interpolation into `text` would open the door to SQL injection.
 */
export function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[]
): Promise<QueryResult<T>> {
    return pool.query<T>(text, params as unknown[]);
}

/** Run several statements atomically; rolls back if the callback throws. */
export async function transaction<T>(
    fn: (tx: { query: typeof query }) => Promise<T>
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn({
            query: ((text, params) => client.query(text, params as unknown[])) as typeof query,
        });
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function closePool(): Promise<void> {
    await pool.end();
}
