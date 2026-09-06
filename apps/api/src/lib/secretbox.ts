import crypto from 'node:crypto';
import { env } from '../config/env';

/**
 * Encryption for third-party credentials held on a salon's behalf.
 *
 * A salon's Mercado Pago refresh token can create charges against her account
 * for as long as it lives. Storing it in plain text would mean a single leaked
 * database dump hands an attacker every salon's payment account at once, so
 * these values are sealed before they reach a column and opened only in the
 * moment a charge is created.
 *
 * AES-256-GCM: the tag authenticates the ciphertext, so a tampered row fails to
 * open rather than decrypting to something attacker-chosen.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

let cachedKey: Buffer | null | undefined;

/**
 * The key is 32 bytes, supplied as hex or base64. Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
function key(): Buffer | null {
    if (cachedKey !== undefined) return cachedKey;

    const raw = env.credentialsKey;
    if (!raw) {
        cachedKey = null;
        return null;
    }

    const decoded = /^[0-9a-fA-F]{64}$/.test(raw)
        ? Buffer.from(raw, 'hex')
        : Buffer.from(raw, 'base64');

    cachedKey = decoded.length === 32 ? decoded : null;
    return cachedKey;
}

/** Whether credentials can be sealed at all. Connecting a gateway needs this. */
export function secretsEnabled(): boolean {
    return key() !== null;
}

export class SecretKeyMissing extends Error {
    constructor() {
        super(
            'CREDENTIALS_KEY is unset or not 32 bytes. Payment credentials cannot ' +
                'be stored without it.'
        );
        this.name = 'SecretKeyMissing';
    }
}

/** Returns `v1.<iv>.<tag>.<ciphertext>`, all base64url. */
export function seal(plaintext: string): string {
    const k = key();
    if (!k) throw new SecretKeyMissing();

    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, k, iv);
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    return [
        'v1',
        iv.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
        body.toString('base64url'),
    ].join('.');
}

/** Opens a sealed value. Throws if the key is wrong or the row was tampered with. */
export function open(sealed: string): string {
    const k = key();
    if (!k) throw new SecretKeyMissing();

    const [version, iv, tag, body] = sealed.split('.');
    if (version !== 'v1' || !iv || !tag || !body) {
        throw new Error('Sealed value is malformed');
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, k, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));

    return Buffer.concat([
        decipher.update(Buffer.from(body, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}

/** Opens a value that may be absent, without forcing every caller to branch. */
export function openMaybe(sealed: string | null | undefined): string | null {
    return sealed ? open(sealed) : null;
}
