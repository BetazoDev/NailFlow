import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// This relies on the GOOGLE_APPLICATION_CREDENTIALS environment variable
// or standard Firebase deployment environments (Cloud Functions/Run).
if (!admin.apps.length) {
    admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();
