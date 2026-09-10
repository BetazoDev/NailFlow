'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Which edges of a horizontal scroller still have content beyond them.
 *
 * The tab strip is 697px wide on a phone and scrolls, so three of the six tabs
 * sit off-screen with nothing to suggest they exist. Fading the content at an
 * edge is the smallest honest hint that there is more that way — and only at
 * the edge that actually has more, so it disappears at either end instead of
 * lying.
 *
 * A mask rather than a gradient overlay: it fades the content itself, so it
 * works over the strip's translucent background without having to guess the
 * colour underneath it.
 */
export function useScrollEdges<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [edges, setEdges] = useState({ start: false, end: false });

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        const measure = () => {
            const overflow = node.scrollWidth - node.clientWidth;
            setEdges({
                start: node.scrollLeft > 4,
                // A couple of pixels of slack: fractional scroll positions on
                // zoomed displays otherwise leave the fade on for ever.
                end: node.scrollLeft < overflow - 4,
            });
        };

        measure();
        node.addEventListener('scroll', measure, { passive: true });

        const observer = new ResizeObserver(measure);
        observer.observe(node);

        return () => {
            node.removeEventListener('scroll', measure);
            observer.disconnect();
        };
    }, []);

    const fade = 28;
    const stops = [
        edges.start ? `transparent 0, #000 ${fade}px` : '#000 0',
        edges.end ? `#000 calc(100% - ${fade}px), transparent 100%` : '#000 100%',
    ].join(', ');
    const mask = edges.start || edges.end ? `linear-gradient(to right, ${stops})` : undefined;

    return { ref, style: { maskImage: mask, WebkitMaskImage: mask } as React.CSSProperties };
}
