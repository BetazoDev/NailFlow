'use client';

import { useEffect, useState } from 'react';

interface SplashScreenProps {
    salonName?: string;
    tagline?: string;
    logoUrl?: string; // New prop for branding
    onFinish: () => void;
}

export default function SplashScreen({
    salonName = "L'Atelier Nails",
    tagline = 'Art at your fingertips',
    logoUrl,
    onFinish
}: SplashScreenProps) {
    const [show, setShow] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShow(false);
            setTimeout(onFinish, 400);
        }, 2200);
        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-400"
            style={{
                background: 'var(--cream)',
                opacity: show ? 1 : 0,
                pointerEvents: show ? 'auto' : 'none',
            }}
        >
            {/* Branding Logo or Brush icon */}
            <div className="mb-8 animate-scale-in" style={{ animationDuration: '0.6s' }}>
                {logoUrl ? (
                    <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-soft border-4 border-white">
                        <img src={logoUrl} alt={salonName} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect x="28" y="4" width="10" height="30" rx="5" fill="var(--pink)" opacity="0.7" transform="rotate(20 28 4)" />
                        <ellipse cx="16" cy="38" rx="8" ry="5" fill="var(--coral)" opacity="0.6" />
                        <rect x="20" y="20" width="6" height="16" rx="3" fill="var(--charcoal-light)" opacity="0.5" />
                    </svg>
                )}
            </div>

            {/* Salon name */}
            <h1
                className="font-serif text-charcoal text-3xl font-normal mb-2 animate-fade-in-up"
                style={{ animationDelay: '0.2s', letterSpacing: '-0.5px' }}
            >
                {salonName}
            </h1>

            {/* Tagline */}
            <p
                className="italic text-nf-gray text-base animate-fade-in-up"
                style={{ animationDelay: '0.35s', fontFamily: 'Georgia, var(--font-serif)' }}
            >
                {tagline}
            </p>

            {/* Loading bar */}
            <div
                className="loading-bar-track mt-16 animate-fade-in"
                style={{ animationDelay: '0.5s', animationFillMode: 'both' }}
            >
                <div className="loading-bar-fill" style={{ animationDelay: '0.6s' }} />
            </div>
            <p
                className="text-[10px] tracking-[0.2em] text-gray-light mt-3 animate-fade-in uppercase"
                style={{ animationDelay: '0.7s', animationFillMode: 'both' }}
            >
                loading
            </p>
        </div>
    );
}
