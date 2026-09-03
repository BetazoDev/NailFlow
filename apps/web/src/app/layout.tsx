import type { Metadata, Viewport } from 'next';
import './globals.css';

const FAVICON_URL =
    process.env.NEXT_PUBLIC_FAVICON_URL ??
    'https://cdn.diabolicalservices.tech/nailssalon/favicon-nails.png';

export const metadata: Metadata = {
    title: {
        default: 'NailFlow — Reserva tu cita',
        template: '%s · NailFlow',
    },
    description: 'Agenda tu cita de uñas en segundos: elige servicio, día y hora, y aparta tu lugar.',
    // Served from the CDN so every tenant domain resolves the same icon
    // without each deployment shipping its own copy.
    icons: {
        icon: FAVICON_URL,
        shortcut: FAVICON_URL,
        apple: FAVICON_URL,
    },
    // The booking page belongs to each salon, not to a search index of demos.
    robots: { index: false, follow: false },
};

export const viewport: Viewport = {
    // The colour follows the salon's palette, applied at runtime.
    themeColor: '#FDFBF7',
    width: 'device-width',
    initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <head>
                {/* Preconnect so the icon font does not block first paint. */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            </head>
            <body className="antialiased">{children}</body>
        </html>
    );
}
