'use client';

import type { Standing } from './api';
import { createContext, useContext } from 'react';
import type { StaffRole, Tenant } from '@/lib/types';

/**
 * The admin panel's session: which salon is being managed and what the signed-in
 * user may do in it.
 *
 * The role comes from `GET /api/session`, so it reflects what the server
 * actually enforces. It replaces the previous `localStorage.mock_role`, which
 * any visitor could set to `owner` from the browser console.
 */
export interface AdminSession {
    tenant: Tenant | null;
    role: StaffRole | null;
    staffId: string | null;
    /** Whether the salon is paid up. Only the panel sees this. */
    standing: Standing;
    /** Days before a lapsed salon stops taking bookings. Null when not in grace. */
    graceDaysLeft: number | null;
    /** True until the first session lookup resolves. */
    loading: boolean;
    /** Re-reads the tenant after a settings change. */
    refresh: () => Promise<void>;
}

export const SessionContext = createContext<AdminSession>({
    tenant: null,
    role: null,
    staffId: null,
    standing: 'ok',
    graceDaysLeft: null,
    loading: true,
    refresh: async () => {},
});

export function useSession(): AdminSession {
    return useContext(SessionContext);
}
