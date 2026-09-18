/**
 * What someone sees when there is no salon behind this address.
 *
 * Two different things end up here and neither is her fault: a link to a salon
 * that never existed, and a salon whose API is momentarily down. Next's own
 * page says "This page could not be found" in English, which tells a client
 * nothing and reads like the link she was sent is broken.
 *
 * So it says the two useful things instead — that it is probably temporary, and
 * that trying again shortly is worth it — without promising a fix we cannot
 * guarantee, and without blaming an address she copied correctly.
 */
export default function NotFound() {
    return (
        <main className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
            <div className="max-w-sm">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">
                    No encontramos esta página
                </p>
                <h1 className="mb-4 font-display text-3xl leading-tight text-text-strong">
                    Aquí no hay nada ahora mismo
                </h1>
                <p className="text-sm leading-relaxed text-text-body">
                    Puede que el enlace esté mal escrito, o que este salón esté fuera de servicio
                    unos minutos. Si te lo mandó tu manicurista, inténtalo otra vez en un rato.
                </p>
            </div>
        </main>
    );
}
