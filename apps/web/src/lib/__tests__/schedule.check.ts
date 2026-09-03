/**
 * Checks the agenda's calendar arithmetic.
 *
 * The week view used to place appointments by day of the week alone, so every
 * Tuesday appointment in the salon's history was drawn on the Tuesday on
 * screen — a March booking appearing in September. These assertions pin that
 * down, along with the overlap lanes and the duration source.
 *
 * Run with: npx tsx apps/web/src/lib/__tests__/schedule.check.ts
 */
import { appointmentsOn, layOutWeek, weekDays } from '../schedule';

/** Minimal appointment shaped like the API's, enough for the layout code. */
function apt(id: string, startISO: string, minutes: number, status = 'confirmed') {
    const start = new Date(startISO);
    const end = new Date(start.getTime() + minutes * 60000);
    return {
        id,
        client_name: id,
        datetime_start: start.toISOString(),
        datetime_end: end.toISOString(),
        status,
        image_urls: [],
    } as never;
}

// The reported bug: a March appointment on a Tuesday drawn on September's Tuesday.
const marzo = apt('marzo', '2026-03-03T10:00:00', 60);      // martes de marzo
const hoy = apt('septiembre', '2026-09-01T10:00:00', 60);   // martes de septiembre

// Two clients at the same hour — they used to be drawn on top of each other.
const solapada1 = apt('solapa-a', '2026-09-02T11:00:00', 90);
const solapada2 = apt('solapa-b', '2026-09-02T11:30:00', 60);

// Cancelled must never occupy a slot.
const cancelada = apt('cancelada', '2026-09-02T15:00:00', 60, 'cancelled');

const todas = [marzo, hoy, solapada1, solapada2, cancelada];
const semana = weekDays(new Date('2026-09-03T12:00:00'));

let fallos = 0;
const check = (nombre: string, ok: boolean, detalle: string) => {
    if (!ok) fallos++;
    console.log(`${ok ? 'PASS' : 'FALLA'}  ${nombre} — ${detalle}`);
};

const colocadas = layOutWeek(todas, semana);
const ids = colocadas.map(c => c.appointment.id).sort();

check('la cita de marzo no se dibuja', !ids.includes('marzo'), `ids en pantalla: ${ids.join(', ')}`);
check('la cita de septiembre sí', ids.includes('septiembre'), 'presente');
check('la cancelada se excluye', !ids.includes('cancelada'), 'no ocupa hueco');

const solapadas = colocadas.filter(c => c.appointment.id.startsWith('solapa'));
check(
    'las simultáneas se reparten en carriles',
    solapadas.length === 2 && solapadas.every(s => s.lanes === 2) &&
        new Set(solapadas.map(s => s.lane)).size === 2,
    solapadas.map(s => `${s.appointment.id}: carril ${s.lane}/${s.lanes}`).join(' · ')
);

const sept = colocadas.find(c => c.appointment.id === 'septiembre')!;
check('la duración sale de datetime_end', sept.durationMinutes === 60, `${sept.durationMinutes} min`);

const delDia = appointmentsOn(todas, new Date('2026-09-02T00:00:00'));
check(
    'el listado del día filtra por fecha real',
    delDia.length === 2 && delDia.every(a => a.id.startsWith('solapa')),
    delDia.map(a => a.id).join(', ')
);

console.log(fallos === 0 ? '\nTODO CORRECTO' : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
