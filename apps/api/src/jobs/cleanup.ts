import cron, { type ScheduledTask } from 'node-cron';
import { DateTime } from 'luxon';
import { env } from '../config/env';
import { query } from '../db/pool';
import { purgeExpiredLocks } from '../services/availability';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('cleanup');

/**
 * Spec §10: reference photos a client uploaded are kept only as long as the
 * salon plausibly needs them, then dropped.
 *
 * Only the database references are cleared here. Deleting the files themselves
 * needs a CDN delete API that this service does not currently have — the
 * previous implementation called an endpoint that does not exist, so it logged
 * a failure for every photo on every run while silently succeeding at the part
 * that mattered.
 */
export async function purgeExpiredReferenceImages(): Promise<number> {
    const cutoff = DateTime.now().minus({ days: env.retention.referenceImageDays }).toISO();

    const result = await query(
        `UPDATE appointments
         SET image_urls = '[]'::jsonb, image_url = NULL
         WHERE created_at < $1
           AND (image_url IS NOT NULL OR jsonb_array_length(COALESCE(image_urls, '[]'::jsonb)) > 0)`,
        [cutoff]
    );

    return result.rowCount ?? 0;
}

async function runCleanup(): Promise<void> {
    try {
        const [images, locks] = await Promise.all([
            purgeExpiredReferenceImages(),
            purgeExpiredLocks(),
        ]);
        log.info('Cleanup finished', {
            appointmentsCleared: images,
            expiredLocksRemoved: locks,
            retentionDays: env.retention.referenceImageDays,
        });
    } catch (error) {
        log.error('Cleanup failed', errorContext(error));
    }
}

export function scheduleCleanupJobs(): ScheduledTask {
    log.info('Scheduling cleanup', {
        cron: env.retention.cleanupCron,
        retentionDays: env.retention.referenceImageDays,
    });
    return cron.schedule(env.retention.cleanupCron, runCleanup);
}
