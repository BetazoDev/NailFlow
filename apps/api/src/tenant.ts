import { Tenant } from './types';
import { query } from './lib/db';

export async function getTenantByDomain(domain: string): Promise<Tenant | null> {
    let searchDomain = domain;
    if (domain.includes('localhost') || domain === 'api-demo.diabolicalservices.tech') {
        searchDomain = 'demo.diabolicalservices.tech';
    }

    const res = await query('SELECT * FROM tenants WHERE domain = $1', [searchDomain]);
    if (res.rowCount === 0) return null;

    return res.rows[0] as Tenant;
}

export async function getTenantById(id: string): Promise<Tenant | null> {
    const res = await query('SELECT * FROM tenants WHERE id = $1', [id]);
    if (res.rowCount === 0) return null;

    return res.rows[0] as Tenant;
}
