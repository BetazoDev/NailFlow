import { env } from '../config/env';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('hosting');

/**
 * Registering a new salon's subdomain with the reverse proxy.
 *
 * Creating a salon writes a database row. Nothing about that tells the proxy
 * the subdomain exists, so without this step her page answers 404 until someone
 * adds it by hand — and the person who notices is usually the owner, holding a
 * link that goes nowhere.
 *
 * DNS is deliberately not automated: one wildcard record covers every salon
 * that will ever exist, so there is nothing per-salon to do and no reason to
 * hold a DNS provider's credentials as well.
 *
 * Optional by design. With nothing configured, every function reports that it
 * is unavailable and the panel falls back to telling the operator what to do by
 * hand — which is exactly the behaviour before any of this existed.
 */

export type HostingOutcome =
    | { ok: true; detail: string }
    | { ok: false; reason: 'unconfigured' | 'rejected' | 'unreachable'; detail: string };

export function hostingEnabled(): boolean {
    return Boolean(env.hosting.url && env.hosting.apiKey && env.hosting.webApplicationId);
}

async function call(path: string, body: unknown): Promise<Response> {
    return fetch(`${env.hosting.url}/api/${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Dokploy authenticates API keys with this header.
            'x-api-key': env.hosting.apiKey!,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });
}

/**
 * Turns a failed call into something the operator can act on.
 *
 * "No se pudo" sends him looking in the wrong place; a rejected token and an
 * unreachable panel are fixed differently, and the status code already knows
 * which one happened.
 */
async function explain(response: Response): Promise<HostingOutcome> {
    const body = await response.text().catch(() => '');

    if (response.status === 401 || response.status === 403) {
        return {
            ok: false,
            reason: 'rejected',
            detail: 'El panel de hosting rechazó el token. Comprueba DOKPLOY_API_KEY.',
        };
    }

    return {
        ok: false,
        reason: 'rejected',
        detail: `El panel de hosting respondió ${response.status}. ${body.slice(0, 200)}`.trim(),
    };
}

/** Adds the salon's subdomain to the web application, with its own certificate. */
export async function registerDomain(host: string): Promise<HostingOutcome> {
    if (!hostingEnabled()) {
        return {
            ok: false,
            reason: 'unconfigured',
            detail: 'El alta automática de subdominios no está configurada en este servidor.',
        };
    }

    try {
        const response = await call('domain.create', {
            applicationId: env.hosting.webApplicationId,
            host,
            port: env.hosting.webPort,
            https: true,
            certificateType: 'letsencrypt',
            domainType: 'application',
            path: '/',
        });

        if (!response.ok) {
            const outcome = await explain(response);
            log.warn('Could not register the subdomain', { host, detail: outcome.detail });
            return outcome;
        }

        log.info('Subdomain registered', { host });
        return {
            ok: true,
            detail: 'Subdominio registrado. El certificado tarda un momento en emitirse.',
        };
    } catch (error) {
        log.warn('Hosting panel unreachable', { host, ...errorContext(error) });
        return {
            ok: false,
            reason: 'unreachable',
            detail: 'No pudimos contactar con el panel de hosting.',
        };
    }
}

/**
 * Confirms the token works and names the right application, before an actual
 * salon depends on it.
 *
 * Worth its own route: finding out the token is wrong while creating a salon
 * means finding out in front of a customer.
 */
export async function checkConnection(): Promise<HostingOutcome> {
    if (!hostingEnabled()) {
        return {
            ok: false,
            reason: 'unconfigured',
            detail:
                'Faltan DOKPLOY_URL, DOKPLOY_API_KEY o DOKPLOY_WEB_APPLICATION_ID en la API.',
        };
    }

    try {
        // Reading the domains of the configured application proves three things
        // at once: the panel answers, the token is accepted, and the
        // application id names something that exists.
        const response = await fetch(
            `${env.hosting.url}/api/domain.byApplicationId` +
                `?applicationId=${encodeURIComponent(env.hosting.webApplicationId!)}`,
            {
                headers: { 'x-api-key': env.hosting.apiKey! },
                signal: AbortSignal.timeout(15_000),
            }
        );

        if (!response.ok) return explain(response);

        const domains = (await response.json()) as unknown[];
        return {
            ok: true,
            detail: `Conectado. La aplicación web tiene ${
                Array.isArray(domains) ? domains.length : 0
            } dominio(s) registrados.`,
        };
    } catch (error) {
        log.warn('Hosting panel unreachable', errorContext(error));
        return {
            ok: false,
            reason: 'unreachable',
            detail: 'No pudimos contactar con el panel de hosting.',
        };
    }
}
