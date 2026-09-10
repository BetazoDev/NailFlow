'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Which edges of a horizontal scroller still have content beyond them.
 *
 * A strip of tabs or categories is routinely twice the width of a phone, so
 * half of it sits off-screen with nothing to suggest it exists. Fading the
 * content at an edge is the smallest honest hint that there is more that way —
 * and only at the edge that actually has more, so it disappears at either end
 * instead of lying.
 *
 * A mask rather than a gradient overlay: it fades the content itself, so it
 * works over a translucent background without having to guess the colour
 * underneath it.
 *
 * The element is tracked by callback ref, not `useRef`. Some of these strips
 * only render once their contents have loaded — the booking flow's categories
 * appear with the services — and a `useRef` read inside a mount effect is null
 * at that point and never looked at again, leaving the fade permanently off on
 * exactly the strips that overflow most.
 */
export function useScrollEdges<T extends HTMLElement>() {
    const [node, setNode] = useState<T | null>(null);
    const [edges, setEdges] = useState({ start: false, end: false });

    useEffect(() => {
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

        // The strip's own box and its contents both change what overflows:
        // the box when the phone rotates, the contents when a longer set of
        // categories replaces a shorter one.
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        for (const child of Array.from(node.children)) observer.observe(child);

        return () => {
            node.removeEventListener('scroll', measure);
            observer.disconnect();
        };
    }, [node]);

    const ref = useCallback((element: T | null) => setNode(element), []);

    const fade = 28;
    const stops = [
        edges.start ? `transparent 0, #000 ${fade}px` : '#000 0',
        edges.end ? `#000 calc(100% - ${fade}px), transparent 100%` : '#000 100%',
    ].join(', ');
    const mask = edges.start || edges.end ? `linear-gradient(to right, ${stops})` : undefined;

    return { ref, style: { maskImage: mask, WebkitMaskImage: mask } as React.CSSProperties };
}
