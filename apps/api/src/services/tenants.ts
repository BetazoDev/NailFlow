import type { Tenant } from '@nailflow/shared';
import { query } from '../db/pool';

/**
 * Tenant lookups.
 *
 * `SELECT *` is deliberate here: the tenant row is the app's configuration
 * object and every column is used by the caller. Elsewhere prefer explicit
 * column lists.
 */

const SELECT_TENANT = `
    SELECT id, domain, name, branding, settings, owner_id, subscription, created_at
    FROM tenants
`;

export async function getTenantByDomain(domain: string): Promise<Tenant | null> {
    const result = await query<Tenant>(`${SELECT_TENANT} WHERE domain = $1`, [domain]);
    return result.rows[0] ?? null;
}

export async function getTenantById(id: string): Promise<Tenant | null> {
    const result = await query<Tenant>(`${SELECT_TENANT} WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
}

export async function getTenantByOwner(ownerId: string): Promise<Tenant | null> {
    const result = await query<Tenant>(`${SELECT_TENANT} WHERE owner_id = $1`, [ownerId]);
    return result.rows[0] ?? null;
}

/** Strip the port from a Host header so `salon.com:3000` resolves like `salon.com`. */
export function normaliseDomain(host: string): string {
    return host.split(':')[0].trim().toLowerCase();
}
