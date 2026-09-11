/**
 * Splitting a stored image reference into a folder and a path inside it.
 *
 * Kept apart from the rest of the CDN service, and free of every import, for
 * two reasons: it is the whole boundary between one salon's photos and
 * another's, and a boundary that cannot be tested without a database is a
 * boundary nobody tests.
 */

/**
 * Stored references come in two shapes, because two versions of this product
 * wrote them: some carry the folder (`nailssalon/services/x.jpg`), some are
 * bare (`services/x.jpg`).
 *
 * A bare one is always old. Every upload since salons got their own folders
 * stores the path the CDN answered with, and that always begins with a folder —
 * so anything without one was written when there was only the shared folder,
 * and that is where the file still physically is. Sending it to the salon's new
 * folder instead would 404 every photo she had before today.
 *
 * The rule that matters is the *third* shape: a path naming some other salon's
 * folder. It is not treated as a folder at all, so it can only ever resolve
 * into the shared one, where being there proves nothing and the caller still
 * has to be shown to own the file. That is what stops
 * `/api/img/salon-de-ana/references/photo.jpg` from working when the request
 * arrived on somebody else's domain.
 */
export function resolveImagePath(
    ownSlug: string,
    sharedSlug: string,
    path: string
): { slug: string; rest: string } | null {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    const named = segments[0] === ownSlug || segments[0] === sharedSlug;
    const slug = named ? segments[0] : sharedSlug;
    const rest = named ? segments.slice(1).join('/') : segments.join('/');

    return rest ? { slug, rest } : null;
}

/**
 * Every spelling of one image that might be sitting in the database.
 *
 * Used to ask "does this salon reference this file", which is what authorises
 * serving anything out of the shared folder. Exact matching is the only cheap
 * way to ask it, and the column holds whatever the version that wrote it chose
 * to store: a bare path, a path with its folder, or — which is what the oldest
 * rows actually hold — the whole CDN URL.
 *
 * Miss a spelling and the salon's own photos stop loading the day she is given
 * a folder of her own, which is the one moment nobody would think to check.
 */
export function storedSpellings(cdnBaseUrl: string, slug: string, rest: string): string[] {
    const withSlug = `${slug}/${rest}`;
    const origin = cdnBaseUrl.replace(/\/+$/, '');
    const bare = origin.replace(/^https?:\/\//, '');

    return [
        rest,
        withSlug,
        `/${withSlug}`,
        `${origin}/${withSlug}`,
        `https://${bare}/${withSlug}`,
        `http://${bare}/${withSlug}`,
    ];
}
