import { Tenant } from './types';
import { DEMO_TENANT } from './mock-data';

// Map of domains → tenant configs
// In production, this will be a Firestore lookup
const tenantsByDomain: Record<string, Tenant> = {
    'localhost': DEMO_TENANT,
    'localhost:3000': DEMO_TENANT,
};

const tenantsById: Record<string, Tenant> = {
    [DEMO_TENANT.id]: DEMO_TENANT,
};

export function getTenantByDomain(domain: string): Tenant | null {
    return tenantsByDomain[domain] || DEMO_TENANT; // fallback to demo in dev
}

export function getTenantById(id: string): Tenant | null {
    return tenantsById[id] || null;
}

export function getDefaultTenant(): Tenant {
    return DEMO_TENANT;
}
