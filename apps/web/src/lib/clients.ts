import { toNumber } from '@nailflow/shared';
import type { Appointment, Client, LoyaltySettings, Service } from '@/lib/types';

/**
 * The salon's client list, derived from its appointment history.
 *
 * There is no clients table: a client is whoever has booked. Grouping happens
 * here rather than inline in the page so the rules — what counts as a visit,
 * what counts as spend — are stated once.
 */

/** Statuses that represent a visit that actually happened. */
const VISITED: Appointment['status'][] = ['completed'];
/** Statuses that still count as a real client relationship. */
const ACTIVE: Appointment['status'][] = ['completed', 'confirmed', 'pending_payment'];

export interface BuildClientsOptions {
    appointments: readonly Appointment[];
    services: readonly Service[];
    favorites: ReadonlySet<string>;
}

export function buildClients({ appointments, services, favorites }: BuildClientsOptions): Client[] {
    const serviceNames = new Map(services.map(service => [service.id, service.name]));
    const byPhone = new Map<string, Client>();

    // Newest last, so `lastVisit` ends up correct without comparing dates.
    const ordered = [...appointments]
        .filter(appointment => ACTIVE.includes(appointment.status))
        .sort((a, b) => a.datetime_start.localeCompare(b.datetime_start));

    for (const appointment of ordered) {
        // Phone is how a salon identifies a client; anything without one cannot
        // be grouped, messaged, or matched to a future booking.
        const phone = appointment.client_phone?.trim();
        if (!phone) continue;

        const serviceName =
            appointment.service_name ??
            (appointment.service_id ? serviceNames.get(appointment.service_id) : undefined) ??
            'Servicio';

        // Spend is what was charged at the time, not today's catalogue price —
        // otherwise raising a price rewrites every past client's total.
        const spend = VISITED.includes(appointment.status) ? toNumber(appointment.price) : 0;
        const counts = VISITED.includes(appointment.status);

        const existing = byPhone.get(phone);

        if (existing) {
            existing.visits += counts ? 1 : 0;
            existing.totalSpent += spend;
            existing.email ??= appointment.client_email ?? undefined;
            if (counts) {
                existing.lastVisit = appointment.datetime_start;
                existing.lastService = serviceName;
            }
            if (!existing.services.includes(serviceName)) existing.services.push(serviceName);
            continue;
        }

        byPhone.set(phone, {
            name: appointment.client_name,
            phone,
            email: appointment.client_email ?? undefined,
            visits: counts ? 1 : 0,
            lastVisit: counts ? appointment.datetime_start : '',
            lastService: counts ? serviceName : undefined,
            totalSpent: spend,
            services: [serviceName],
            favorite: favorites.has(phone),
        });
    }

    return [...byPhone.values()].sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
}

export interface LoyaltyStatus {
    /** How many complete rewards this client has earned. */
    rewards: number;
    /** Visits still needed for the next reward. */
    visitsToNext: number;
    rewardType: LoyaltySettings['reward_type'];
    discountValue?: number;
}

/** Where a client stands against the salon's loyalty programme. */
export function loyaltyStatusFor(
    client: Client,
    loyalty: LoyaltySettings | undefined
): LoyaltyStatus | null {
    if (!loyalty?.enabled) return null;

    const required = Math.max(1, loyalty.visits_required);
    const rewards = Math.floor(client.visits / required);

    return {
        rewards,
        visitsToNext: required - (client.visits % required),
        rewardType: loyalty.reward_type,
        discountValue: loyalty.discount_value,
    };
}
