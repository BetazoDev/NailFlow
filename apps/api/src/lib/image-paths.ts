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
