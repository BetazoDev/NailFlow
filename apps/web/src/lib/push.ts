import { getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging';
import { api } from './api';

/**
 * Push notifications for the salon panel.
 *
 * Everything here can legitimately be unavailable — the browser may not support
 * push, the salon may have declined, the deployment may have no VAPID key — so
 * every function reports what happened instead of throwing. A salon without
 * notifications must still have a working panel.
 */

export type PushState = 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/**
 * The service worker is static and shared by every deployment, so the Firebase
 * project it should talk to travels in the query string. Registering the same
 * path with different parameters gives each environment its own worker.
 */
function workerUrl(): string {
    const config = new URLSearchParams({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
    });
    return `/firebase-messaging-sw.js?${config.toString()}`;
}

async function messaging(): Promise<Messaging | null> {
    if (typeof window === 'undefined') return null;
    if (!(await isSupported().catch(() => false))) return null;
    return getMessaging(getApp());
}

/** What the panel should show, without asking the salon for anything. */
export async function pushState(): Promise<PushState> {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    if (!(await isSupported().catch(() => false))) return 'unsupported';
    if (!VAPID_KEY || !process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) return 'unconfigured';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.permission === 'granted' ? 'on' : 'off';
}

/**
 * Asks for permission and registers this device with the salon.
 *
 * Only ever called from a button. A panel that asks for notification permission
 * the moment it loads is a panel people click "Block" on, and a blocked
 * permission cannot be asked for again.
 */
export async function enablePush(): Promise<PushState> {
    const state = await pushState();
    if (state === 'unsupported' || state === 'unconfigured' || state === 'denied') return state;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

    const instance = await messaging();
    if (!instance) return 'unsupported';

    const registration = await navigator.serviceWorker.register(workerUrl());
    const token = await getToken(instance, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
    });

    if (!token) return 'off';

    await api.registerDevice(token);
    localStorage.setItem('push_token', token);
    return 'on';
}

/**
 * Stops this device receiving the salon's notifications.
 *
 * The browser permission is deliberately left alone: revoking it is the
 * viewer's to do, and a product that could would be one that could also
 * silently re-grant it.
 */
export async function disablePush(): Promise<PushState> {
    const token = localStorage.getItem('push_token');
    if (token) {
        await api.forgetDevice(token).catch(() => {
            // The device stops being notified either way once the token rotates;
            // failing here should not leave the toggle stuck.
        });
        localStorage.removeItem('push_token');
    }
    return 'off';
}
