/**
 * Checks that a wildcard CORS entry opens exactly what it names.
 *
 * This is the guard between "a new salon works the moment DNS points at us"
 * and "any domain on the internet can drive the API with a signed-in owner's
 * cookies". The dangerous mistake is testing the pattern as a plain suffix:
 * that accepts `nailflow.com.attacker.example`, which is the attacker's domain
 * and not ours.
 *
 * Run with: npx tsx apps/api/src/lib/__tests__/origins.check.ts
 */
import { originPolicy } from '../origins';

let fallos = 0;
const check = (nombre: string, ok: boolean, detalle: string) => {
    if (!ok) fallos++;
    console.log(`${ok ? 'PASS' : 'FALLA'}  ${nombre} — ${detalle}`);
};

const policy = originPolicy([
    'https://*.nailflow.com',
    'https://demo.diabolicalservices.tech',
]);

// ── Lo que debe aceptar ──────────────────────────────────────────────────────

check(
    'un salón cualquiera del dominio raíz',
    policy.allows('https://bella-nails.nailflow.com'),
    'https://bella-nails.nailflow.com'
);
check(
    'un salón que aún no existe, sin tocar configuración',
    policy.allows('https://salon-que-no-existia-ayer.nailflow.com'),
    'sin redeploy'
);
check(
    'subdominios de más de un nivel',
    policy.allows('https://a.b.nailflow.com'),
    'https://a.b.nailflow.com'
);
check(
    'la entrada exacta sigue valiendo',
    policy.allows('https://demo.diabolicalservices.tech'),
    'sin comodín'
);

// ── Lo que NO debe aceptar ───────────────────────────────────────────────────

check(
    'el dominio del atacante con nuestro nombre delante',
    !policy.allows('https://nailflow.com.attacker.example'),
    'un test por sufijo lo aceptaría'
);
check(
    'un dominio que solo termina parecido',
    !policy.allows('https://evilnailflow.com'),
    'falta el punto separador'
);
check(
    'el dominio raíz pelado, que el comodín no cubre',
    !policy.allows('https://nailflow.com'),
    'el comodín exige al menos una etiqueta'
);
check(
    'el mismo host sin cifrar',
    !policy.allows('http://bella.nailflow.com'),
    'el esquema forma parte del origen'
);
check(
    'otro dominio entero',
    !policy.allows('https://example.com'),
    'https://example.com'
);
check(
    'una lista vacía no abre nada',
    !originPolicy([]).allows('https://bella.nailflow.com'),
    'sin entradas'
);

console.log(fallos === 0 ? '\nTODO CORRECTO' : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
