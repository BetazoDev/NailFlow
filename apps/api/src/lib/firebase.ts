import { cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createLogger } from '../lib/logger';

const log = createLogger('firebase');

/**
 * Firebase Admin, used only to verify the ID tokens the browser sends.
 *
 * Credentials come from either `FIREBASE_SERVICE_ACCOUNT` (the JSON blob, handy
 * on platforms that only offer env vars) or the standard
 * `GOOGLE_APPLICATION_CREDENTIALS` file path.
 */
function initialise() {
    const existing = getApps()[0];
    if (existing) return existing;

    const inlineServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (inlineServiceAccount) {
        try {
            return initializeApp({ credential: cert(JSON.parse(inlineServiceAccount)) });
        } catch {
            throw new Error(
                'FIREBASE_SERVICE_ACCOUNT is set but is not valid service-account JSON'
            );
        }
    }

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        log.warn(
            'No Firebase credentials configured. Set FIREBASE_SERVICE_ACCOUNT or ' +
            'GOOGLE_APPLICATION_CREDENTIALS; authenticated endpoints will reject every request.'
        );
    }

    return initializeApp({ credential: applicationDefault() });
}

export const firebaseApp = initialise();
export const auth = getAuth(firebaseApp);
