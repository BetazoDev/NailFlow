/*
 * Service worker that receives notifications while the panel is closed.
 *
 * Served from /public because a service worker can only control pages at or
 * below its own path, and this one has to cover the whole origin.
 *
 * The config is read from the query string rather than inlined: this file is
 * static and identical in every environment, while the Firebase project is not,
 * and a build step that rewrote it would be one more thing to get wrong.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;

firebase.initializeApp({
    apiKey: params.get('apiKey'),
    authDomain: params.get('authDomain'),
    projectId: params.get('projectId'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId'),
});

firebase.messaging().onBackgroundMessage(payload => {
    const { title, body } = payload.notification ?? {};
    if (!title) return;

    self.registration.showNotification(title, {
        body,
        icon: '/favicon.png',
        badge: '/favicon.png',
        data: { link: payload.fcmOptions?.link ?? '/admin/agenda' },
    });
});

/* Tapping the notification should land on the booking, not a blank tab. */
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const link = event.notification.data?.link ?? '/admin/agenda';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
            // Reuse an open panel rather than stacking tabs on every booking.
            for (const client of windows) {
                if (client.url.includes(link) && 'focus' in client) return client.focus();
            }
            return clients.openWindow(link);
        })
    );
});
