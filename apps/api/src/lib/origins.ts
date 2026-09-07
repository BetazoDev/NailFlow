/**
 * Matching browser origins against an allowlist that may contain wildcards.
 *
 * Every salon lives on her own subdomain of one root, so listing them one by
 * one would mean editing an environment variable and redeploying the API each
 * time a salon is created. A single `https://*.nailflow.com` entry covers all
 * of them, present and future.
 *
 * The matching is deliberately strict about where the wildcard may stand:
 * only a whole leading label, never a bare suffix. `https://*.nailflow.com`
 * must match `https://bella.nailflow.com` and must not match
 * `https://nailflow.com.attacker.example` — a suffix test would accept both,
 * and the second is an attacker's domain.
 */

/** Escapes a literal for use inside a regular expression. */
function quote(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compiles one allowlist entry into a test.
 *
 * A pattern must contain `*.` immediately after the scheme to be treated as a
 * wildcard; anywhere else it is matched literally, so a malformed entry fails
 * closed rather than opening more than it names.
 */
function compile(pattern: string): (origin: string) => boolean {
    const wildcard = /^(https?:\/\/)\*\.(.+)$/.exec(pattern);

    if (!wildcard) {
        return origin => origin === pattern;
    }

    const [, scheme, rest] = wildcard;

    // One or more labels, then the literal root. Labels cannot contain a dot,
    // so the root has to sit at the end of the host and cannot be smuggled
    // into the middle of a longer name.
    const expression = new RegExp(
        `^${quote(scheme)}(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+${quote(rest)}$`,
        'i'
    );

    return origin => expression.test(origin);
}

export interface OriginPolicy {
    allows(origin: string): boolean;
}

export function originPolicy(patterns: readonly string[]): OriginPolicy {
    const tests = patterns.map(compile);
    return { allows: origin => tests.some(test => test(origin)) };
}
