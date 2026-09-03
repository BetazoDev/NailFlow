/**
 * Firebase auth errors in Spanish.
 *
 * Firebase throws `FirebaseError` objects whose `code` is the stable identifier
 * and whose `message` is developer-facing English ("Firebase: Error
 * (auth/invalid-credential)"). Showing that raw message to a salon client was
 * both confusing and a small information leak about the stack.
 */

const MESSAGES: Record<string, string> = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/invalid-email': 'Ese correo no parece válido.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-disabled': 'Esta cuenta está deshabilitada.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/popup-closed-by-user': '',
    'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
    'auth/requires-recent-login': 'Vuelve a iniciar sesión para hacer este cambio.',
    'auth/missing-email': 'Escribe tu correo electrónico.',
    // The reset link has a lifetime; both of these mean "ask for a new one".
    'auth/expired-action-code': 'Ese enlace ya caducó. Pide uno nuevo.',
    'auth/invalid-action-code': 'Ese enlace ya no es válido. Pide uno nuevo.',
};

/** Returns a message to show, or an empty string when the error is not worth surfacing. */
export function authErrorMessage(error: unknown): string {
    const code =
        typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code: unknown }).code)
            : '';

    if (code in MESSAGES) return MESSAGES[code];
    return 'No pudimos completar la operación. Intenta de nuevo.';
}
