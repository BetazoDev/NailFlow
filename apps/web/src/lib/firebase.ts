import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/**
 * Firebase client SDK, configured from environment variables.
 *
 * These values are not secrets — Firebase ships them to the browser by design,
 * and access is controlled by Firebase security rules, not by hiding the keys.
 * They still belong in the environment rather than in source, so that a staging
 * deploy cannot accidentally read and write the production project.
 */
const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    // Fail loudly at module load rather than with an opaque auth error on the
    // first sign-in attempt.
    throw new Error(
        'Firebase is not configured. Copy apps/web/.env.example to .env.local and fill in ' +
        'the NEXT_PUBLIC_FIREBASE_* values.'
    );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
