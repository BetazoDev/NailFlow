import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { createLogger, errorContext } from './logger';

const log = createLogger('firebase');

/**
 * Firebase Admin: verifying the ID tokens the browser sends, and pushing
 * notifications to the salon's devices.
 *
 * Credentials come from either `FIREBASE_SERVICE_ACCOUNT` (the JSON blob, handy
 * on platforms that only offer env vars) or the standard
 * `GOOGLE_APPLICATION_CREDENTIALS` file path.
 *
 * Misconfiguration degrades rather than stops the process: the public booking
 * flow needs no authentication at all, so refusing to boot would take a working
 * salon page offline over a credential only the admin panel uses. Authenticated
 * routes answer 503 instead, and the reason is logged once at startup.
 */
let resolved: App | null | undefined;

function initialise(): App | null {
    const existing = getApps()[0];
    if (existing) return existing;

    const inline = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();

    if (inline) {
        try {
            return initializeApp({ credential: cert(JSON.parse(inline)) });
        } catch (error) {
            log.error(
                'FIREBASE_SERVICE_ACCOUNT is set but could not be used. It must be the ' +
                'service-account JSON on a single line, with the newlines inside ' +
                'private_key kept as the two characters \\n. Generate it with: ' +
                'node -e "console.log(JSON.stringify(require(\'./service-account.json\')))"',
                errorContext(error)
            );
            return null;
        }
    }

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        log.warn(
            'No Firebase credentials configured. Set FIREBASE_SERVICE_ACCOUNT or ' +
            'GOOGLE_APPLICATION_CREDENTIALS; authenticated endpoints will be unavailable.'
        );
        return null;
    }

    try {
        return initializeApp({ credential: applicationDefault() });
    } catch (error) {
        log.error('Could not load GOOGLE_APPLICATION_CREDENTIALS', errorContext(error));
        return null;
    }
}

function app(): App | null {
    if (resolved === undefined) resolved = initialise();
    return resolved;
}

/** The verifier, or null when no usable credential was configured. */
export function firebaseAuth(): Auth | null {
    const instance = app();
    return instance ? getAuth(instance) : null;
}

/**
 * The push sender, or null when no usable credential was configured.
 *
 * Same credential as the verifier, so a salon that can sign in can be notified;
 * there is no case where one works and the other does not.
 */
export function firebaseMessaging(): Messaging | null {
    const instance = app();
    return instance ? getMessaging(instance) : null;
}
