/**
 * Checks money formatting and timezone-aware day keys.
 *
 * The dashboard used to derive "today" by slicing the UTC ISO string, so in
 * Mexico City every appointment from 18:00 onward counted as tomorrow.
 *
 * Run with: npx tsx apps/web/src/lib/__tests__/format.check.ts
 */
import { dayKeyInZone, formatMoney, todayKeyInZone } from '../format';

let fallos = 0;
const check = (nombre: string, ok: boolean, detalle: string) => {
    if (!ok) fallos++;
    console.log(`${ok ? 'PASS' : 'FALLA'}  ${nombre} — ${detalle}`);
};

check('entero sin decimales', formatMoney(450) === '$450.00' || !formatMoney(450).includes('.'), formatMoney(450));
check('medio peso con dos decimales', formatMoney(450.5).endsWith('450.50'), formatMoney(450.5));
check('centavos intactos', formatMoney(450.25).endsWith('450.25'), formatMoney(450.25));

// 2026-09-04T00:00 UTC son las 18:00 del día 3 en Ciudad de México.
const tarde = '2026-09-04T00:00:00.000Z';
check('el corte UTC daba el día equivocado', tarde.split('T')[0] === '2026-09-04', 'ISO dice 04');
check(
    'el día en la zona del salón es el correcto',
    dayKeyInZone(tarde, 'America/Mexico_City') === '2026-09-03',
    dayKeyInZone(tarde, 'America/Mexico_City')
);
check('formato ordenable YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(todayKeyInZone('America/Mexico_City')), todayKeyInZone('America/Mexico_City'));

console.log(fallos === 0 ? '\nTODO CORRECTO' : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
