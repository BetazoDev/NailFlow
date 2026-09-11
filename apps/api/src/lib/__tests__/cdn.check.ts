/**
 * Checks that one salon's folder cannot be reached from another salon's page.
 *
 * This is the boundary that keeps a client's reference photos private. The
 * dangerous mistake is treating the first path segment as a folder whenever it
 * looks like one: that makes `/api/img/salon-de-ana/references/photo.jpg`
 * resolve to Ana's folder no matter whose domain asked for it, which is exactly
 * the leak this product had.
 *
 * Run with: npm run check:cdn --workspace @nailflow/api
 */
import { resolveImagePath } from '../image-paths';

let fallos = 0;
const check = (nombre: string, ok: boolean, detalle: string) => {
    if (!ok) fallos++;
    console.log(`${ok ? 'PASS ' : 'FALLA'}  ${nombre} — ${detalle}`);
};

const MIA = 'salon-de-ana';
const COMPARTIDA = 'nailssalon';

// ── Lo que debe resolver a la carpeta propia ─────────────────────────────────

{
    // Sin carpeta = escrita antes de que existieran las carpetas propias, y el
    // fichero sigue estando en la compartida. Mandarla a la suya daría 404 en
    // todas las fotos que ya tenía.
    const r = resolveImagePath(MIA, COMPARTIDA, 'services/manicura.jpg');
    check(
        'una ruta antigua sin carpeta sigue apuntando a la compartida',
        r?.slug === COMPARTIDA && r.rest === 'services/manicura.jpg',
        `${r?.slug}/${r?.rest}`
    );
}

{
    const r = resolveImagePath(MIA, COMPARTIDA, `${MIA}/services/manicura.jpg`);
    check(
        'una ruta con su propia carpeta se respeta',
        r?.slug === MIA && r.rest === 'services/manicura.jpg',
        `${r?.slug}/${r?.rest}`
    );
}

{
    const r = resolveImagePath(MIA, COMPARTIDA, `${COMPARTIDA}/services/vieja.jpg`);
    check(
        'una imagen antigua sigue apuntando a la carpeta compartida',
        r?.slug === COMPARTIDA && r.rest === 'services/vieja.jpg',
        'las fotos de antes de este cambio siguen cargando'
    );
}

// ── Lo que NO debe alcanzar la carpeta de otra ───────────────────────────────

{
    const r = resolveImagePath(MIA, COMPARTIDA, 'salon-de-bea/references/foto.jpg');
    check(
        'la carpeta de otro salón no se toma como carpeta',
        r?.slug === COMPARTIDA,
        `pedían salon-de-bea y resolvió a ${r?.slug}, donde hay que demostrar pertenencia`
    );
    check(
        'y su nombre queda dentro de la ruta, no delante',
        r?.rest === 'salon-de-bea/references/foto.jpg',
        r?.rest ?? 'null'
    );
}

{
    // El caso desde el otro lado: Bea pidiendo la carpeta de Ana.
    const r = resolveImagePath('salon-de-bea', COMPARTIDA, `${MIA}/references/foto.jpg`);
    check(
        'simétrico: Bea tampoco alcanza la de Ana',
        r?.slug === COMPARTIDA && r.rest === `${MIA}/references/foto.jpg`,
        `${r?.slug}/${r?.rest} — y Bea no referencia ese fichero`
    );
}

{
    const r = resolveImagePath(MIA, COMPARTIDA, `${COMPARTIDA}/${MIA}/x.jpg`);
    check(
        'la carpeta compartida no sirve de puente a otra',
        r?.slug === COMPARTIDA && r.rest === `${MIA}/x.jpg`,
        'queda sujeto a la comprobación de pertenencia, no al nombre'
    );
}

// ── Rutas que no son rutas ───────────────────────────────────────────────────

check('vacío se rechaza', resolveImagePath(MIA, COMPARTIDA, '') === null, 'null');
check(
    'solo la carpeta, sin fichero, se rechaza',
    resolveImagePath(MIA, COMPARTIDA, MIA) === null,
    'null'
);
check(
    'solo la compartida, sin fichero, se rechaza',
    resolveImagePath(MIA, COMPARTIDA, COMPARTIDA) === null,
    'null'
);
check(
    'las barras de más no cambian nada',
    resolveImagePath(MIA, COMPARTIDA, '//services//x.jpg')?.rest === 'services/x.jpg',
    'se normaliza'
);

// ── Un salón sin carpeta propia ──────────────────────────────────────────────

{
    // Antes de que se le asigne una, su `slug` ES la compartida.
    const r = resolveImagePath(COMPARTIDA, COMPARTIDA, 'services/x.jpg');
    check(
        'sin carpeta propia sigue funcionando como antes',
        r?.slug === COMPARTIDA && r.rest === 'services/x.jpg',
        'dar de alta la tabla no rompe a quien no la usa'
    );
}

console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} comprobación(es) fallida(s).`);
process.exit(fallos === 0 ? 0 : 1);
