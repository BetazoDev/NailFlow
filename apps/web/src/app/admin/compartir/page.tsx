'use client';

import { useSession } from '@/lib/session-context';
import { SharePanel } from '@/components/admin/SharePanel';

/**
 * The salon's link and QR, one click from anywhere.
 *
 * This is what an owner reaches for most often — a client asks how to book and
 * she sends the link — so it earns a place in the sidebar rather than a tab
 * three clicks inside her settings, next to things she touches once a year.
 */
export default function CompartirPage() {
    const { tenant } = useSession();

    return (
        <div className="pb-16">
            <header className="mb-8">
                <p className="t-label mb-2">Tu enlace</p>
                <h1 className="t-display">Comparte</h1>
            </header>

            <SharePanel domain={tenant?.domain} />
        </div>
    );
}
