import type { Server } from 'node:http';
import { env } from './config/env';
import { createApp } from './app';
import { initDb } from './db/schema';
import { closePool } from './db/pool';
import { scheduleCleanupJobs } from './jobs/cleanup';
import { createLogger, errorContext } from './lib/logger';

const log = createLogger('server');

/**
 * Process entry point: prepare the database, start listening, and shut down
 * cleanly when the platform sends SIGTERM.
 *
 * The schema bootstrap runs *before* the server accepts traffic. Previously it
 * was fired and forgotten, so the first requests after a deploy could hit
 * tables that did not exist yet.
 */
async function main(): Promise<void> {
    if (!env.cdn.systemToken && !env.cdn.referenceToken) {
        log.warn(
            'No CDN token configured (CDN_UPLOAD_TOKEN / CDN_API_KEY_REFERENCES). ' +
            'The API will start, but every image request answers 503.'
        );
    }

    await initDb();

    const app = createApp();
    const cleanupTask = scheduleCleanupJobs();

    const server: Server = app.listen(env.port, () => {
        log.info('NailFlow API listening', {
            port: env.port,
            env: env.nodeEnv,
            corsOrigins: env.corsOrigins,
        });
    });

    const shutdown = (signal: string) => {
        log.info('Shutting down', { signal });
        cleanupTask.stop();
        server.close(async () => {
            await closePool().catch(error => log.error('Failed to close pool', errorContext(error)));
            process.exit(0);
        });
        // Do not let a stuck connection hold the deploy open forever.
        setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(error => {
    log.error('Failed to start', errorContext(error));
    process.exit(1);
});
