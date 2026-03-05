'use client';

import { createContext, useContext } from 'react';

interface TenantContextType {
    tenantId: string | null;
    domain: string | null;
}

export const TenantContext = createContext<TenantContextType>({ tenantId: null, domain: null });

export const useTenant = () => useContext(TenantContext);
