import { Tenant } from './types';

export async function getTenantByDomain(domain: string): Promise<Tenant | null> {
    // For localhost development, map localhost or localhost:3000 to "demo"
    let searchDomain = domain;
    if (domain.includes('localhost') || domain === 'demo.nailflow.com') {
        searchDomain = 'demo.com'; // Adjust default dev domain
    }

    // Mock response to avoid Firestore creds issue during MVP flow testing
    return {
        id: 'demo-tenant',
        domain: searchDomain,
        branding: {
            logo_url: '',
            primary_color: '#E8B4B8',
            secondary_color: '#82C3A6'
        },
        settings: {
            currency: 'MXN',
            timezone: 'America/Mexico_City'
        },
        owner_id: 'mock-owner-id',
        subscription: {
            status: 'active',
            plan: 'pro'
        }
    };
}

export async function getTenantById(id: string): Promise<Tenant | null> {
    return {
        id,
        domain: 'demo.com',
        branding: {
            logo_url: '',
            primary_color: '#E8B4B8',
            secondary_color: '#82C3A6'
        },
        settings: {
            currency: 'MXN',
            timezone: 'America/Mexico_City'
        },
        owner_id: 'mock-owner-id',
        subscription: {
            status: 'active',
            plan: 'pro'
        }
    };
}
