'use client';

import type { SocialLinks } from '@/lib/types';

/**
 * What the salon says about herself, on the page where her clients book.
 *
 * Handles are stored bare, so the link is built here. That keeps a stored value
 * from ever being a URL of its own choosing: whatever the salon typed can only
 * ever become a link to the platform this entry is for.
 */

const NETWORKS = [
    {
        key: 'instagram',
        label: 'Instagram',
        icon: 'photo_camera',
        href: (handle: string) => `https://instagram.com/${strip(handle)}`,
    },
    {
        key: 'tiktok',
        label: 'TikTok',
        icon: 'music_note',
        href: (handle: string) => `https://tiktok.com/@${strip(handle)}`,
    },
    {
        key: 'facebook',
        label: 'Facebook',
        icon: 'thumb_up',
        href: (handle: string) => `https://facebook.com/${strip(handle)}`,
    },
    {
        key: 'whatsapp',
        label: 'WhatsApp',
        icon: 'chat',
        href: (number: string) => `https://wa.me/${number.replace(/\D/g, '')}`,
    },
] as const satisfies readonly {
    key: keyof SocialLinks;
    label: string;
    icon: string;
    href: (value: string) => string;
}[];

/** Owners paste "@bellanails" as often as "bellanails". */
function strip(handle: string): string {
    return encodeURIComponent(handle.trim().replace(/^@/, ''));
}

export function SalonPresence({
    description,
    social,
}: {
    description?: string;
    social?: SocialLinks;
}) {
    const links = NETWORKS.filter(network => social?.[network.key]?.trim());
    const website = social?.website?.trim();

    if (!description?.trim() && links.length === 0 && !website) return null;

    return (
        <div className="mb-8 space-y-4">
            {description?.trim() && (
                <p className="text-[13px] leading-relaxed text-white/55">{description.trim()}</p>
            )}

            {(links.length > 0 || website) && (
                <div className="flex flex-wrap gap-2">
                    {links.map(network => (
                        <a
                            key={network.key}
                            href={network.href(social![network.key]!.trim())}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={network.label}
                            className="grid size-9 place-items-center rounded-full border border-white/15 text-white/50 transition-colors hover:border-white/40 hover:text-white"
                        >
                            <span className="material-symbol text-base" aria-hidden="true">
                                {network.icon}
                            </span>
                        </a>
                    ))}

                    {website && (
                        <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Sitio web"
                            className="grid size-9 place-items-center rounded-full border border-white/15 text-white/50 transition-colors hover:border-white/40 hover:text-white"
                        >
                            <span className="material-symbol text-base" aria-hidden="true">
                                language
                            </span>
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}
