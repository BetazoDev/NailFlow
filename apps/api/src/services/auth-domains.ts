import { query } from '../db/pool';
import { firebaseAccessToken, firebaseProjectId } from '../lib/firebase';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('auth-domains');

/**
 * Which hosts Firebase will let a sign-in happen on.
 *
 * Google refuses to run on a domain that is not in this list, and the list
 * takes no wildcards — so every salon's subdomain has to be in it by name.
 * Until now that meant a person opening a console after every salon, which is
 * the one manual step left in an otherwise automatic creation, and the reason
 * "Continue with Google" could not live on a salon's own page.
 *
 * It is one array for the whole project, so a single read-and-write covers
 * every salon at once. That shape is why the sync below is cheap enough to run
 * at boot: it reconciles all of them in two requests, or none if nothing has
 * changed.
 *
 * Entries already there are never removed. The list also holds `localhost` and
 * Firebase's own hosting domains, and dropping those would break local
 * development and the password-reset links in the same move.
 */

const BASE = 'https://identitytoolkit.googleapis.com/admin/v2';

export type DomainOutcome =
    | { ok: true; added: string[] }
    | { ok: false; reason: 'unconfigured' | 'forbidden' | 'failed'; detail: string };

async function call(
    token: string,
    project: string,
    init: RequestInit & { search?: string }
): Promise<Response> {
    const { search, ...rest } = init;
    return fetch(`${BASE}/projects/${encodeURIComponent(project)}/config${search ?? ''}`, {
        ...rest,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...rest.headers,
        },
        signal: AbortSignal.timeout(15_000),
    });
}

/**
 * Adds these hosts to the project's list, leaving everything else alone.
 *
 * Reads before writing because the update replaces the whole array: patching
 * with only the new domain would delete every other salon's, and nobody would
 * notice until the next person tried to sign in.
 *
 * Returns rather than throws. A salon whose domain could not be registered is
 * still a working salon — she signs in with her password, and the panel's
 * Google button falls back to the slower path — so this must never be the
 * thing that fails a creation.
 */
export async function authorizeDomains(hosts: readonly string[]): Promise<DomainOutcome> {
    const wanted = [...new Set(hosts.map(host => host.trim().toLowerCase()).filter(Boolean))];
    if (wanted.length === 0) return { ok: true, added: [] };

    const project = firebaseProjectId();
    const token = await firebaseAccessToken();

    // Told apart on purpose. These two fail for different reasons and are
    // fixed in different places, and saying "no credentials" when the
    // credential was fine sent the last reader to the wrong one.
    if (!token) {
        return {
            ok: false,
            reason: 'unconfigured',
            detail: 'No hay credenciales de Firebase en este servidor.',
        };
    }

    if (!project) {
        return {
            ok: false,
            reason: 'unconfigured',
            detail:
                'Hay credenciales, pero no sabemos de qué proyecto son. Define ' +
                'FIREBASE_PROJECT_ID, o usa una cuenta de servicio que incluya project_id.',
        };
    }

    let current: string[];
    try {
        const response = await call(token, project, { method: 'GET' });
        if (!response.ok) {
            return explain(response.status, await response.text().catch(() => ''));
        }
        const config = (await response.json()) as { authorizedDomains?: string[] };
        current = config.authorizedDomains ?? [];
    } catch (error) {
        log.error('Could not read the authorized domains', errorContext(error));
        return { ok: false, reason: 'failed', detail: 'No pudimos leer la lista de dominios.' };
    }

    const known = new Set(current.map(domain => domain.toLowerCase()));
    const missing = wanted.filter(host => !known.has(host));
    if (missing.length === 0) return { ok: true, added: [] };

    try {
        const response = await call(token, project, {
            method: 'PATCH',
            search: '?updateMask=authorizedDomains',
            body: JSON.stringify({ authorizedDomains: [...current, ...missing] }),
        });
        if (!response.ok) {
            return explain(response.status, await response.text().catch(() => ''));
        }
    } catch (error) {
        log.error('Could not update the authorized domains', errorContext(error));
        return { ok: false, reason: 'failed', detail: 'No pudimos actualizar la lista.' };
    }

    log.info('Authorized domains added', { added: missing });
    return { ok: true, added: missing };
}

/**
 * Brings every existing salon into the list, once, at startup.
 *
 * Salons created before this existed have domains Firebase has never been told
 * about, and their owners would find the Google button refusing to work with
 * no way to tell why. Reconciling on boot fixes them without anyone running
 * anything by hand.
 *
 * Cheap enough to do every time because the list is one array: when nothing is
 * missing it is a single GET and no write at all.
 */
export async function syncSalonDomains(): Promise<void> {
    let domains: string[];
    try {
        const result = await query<{ domain: string }>('SELECT domain FROM tenants');
        domains = result.rows.map(row => row.domain);
    } catch (error) {
        log.error('Could not list salon domains to sync', errorContext(error));
        return;
    }

    if (domains.length === 0) return;

    const outcome = await authorizeDomains(domains);

    // Never fatal. The API's job is to serve salons; a sign-in list that is one
    // domain short is a degraded button, not a reason to refuse to start.
    if (!outcome.ok) {
        log.warn('Could not sync salon domains for sign-in', {
            reason: outcome.reason,
            detail: outcome.detail,
        });
    } else if (outcome.added.length > 0) {
        log.info('Salon domains brought into the sign-in list', { added: outcome.added });
    }
}

function explain(status: number, body: string): DomainOutcome {
    // Trimmed because Google's error bodies are long and occasionally echo the
    // request; the status is what decides what to do about it.
    const detail = body.slice(0, 300);

    if (status === 401 || status === 403) {
        log.error('Firebase refused the domain update', { status, detail });
        return {
            ok: false,
            reason: 'forbidden',
            detail:
                'Firebase rechazó la petición. La cuenta de servicio necesita el permiso ' +
                'de administrar Identity Platform, y la API identitytoolkit.googleapis.com ' +
                'tiene que estar habilitada en el proyecto.',
        };
    }

    log.error('Firebase rejected the domain update', { status, detail });
    return { ok: false, reason: 'failed', detail: `Firebase respondió ${status}.` };
}
