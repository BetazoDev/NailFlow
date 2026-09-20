import { imageUrlSchema } from '../../routes/schemas';

const cases: [string, boolean, string][] = [
    // Lo que el subidor devuelve hoy, que es lo que rompía el guardado.
    ['alo/services/original/manicura.jpg', true, 'ruta pelada del CDN'],
    ['unas-cabronas/references/original/probe-6.png', true, 'carpeta de referencias'],
    // Lo que se guardaba antes, que tiene que seguir valiendo.
    ['/nailssalon/services/x.jpg', true, 'ruta con barra inicial'],
    ['https://cdn.diabolicalservices.tech/nailssalon/manicura-clasica.jpg', true, 'URL completa, filas viejas'],
    ['nailssalon/manicura-clasica.jpg', true, 'ruta pelada sin carpeta'],
    // Lo que no es nuestro.
    ['//evil.com/rastreador.jpg', false, 'protocolo-relativa: la fuga que dejaba la regla vieja'],
    ['/../../etc/passwd', false, 'travesía'],
    ['alo/../otro-salon/x.jpg', false, 'travesía por el medio'],
    ['javascript:alert(1)', false, 'esquema javascript'],
    ['data:image/png;base64,AAAA', false, 'data URI'],
    ['ftp://host/x.jpg', false, 'otro protocolo'],
    ['', false, 'vacío'],
];

let bad = 0;
for (const [value, want, why] of cases) {
    const got = imageUrlSchema.safeParse(value).success;
    const mark = got === want ? 'ok  ' : 'MAL ';
    if (got !== want) bad++;
    console.log(`${mark} ${want ? 'acepta' : 'rechaza'}  ${JSON.stringify(value).padEnd(62)} ${why}`);
}
console.log(bad === 0 ? `\n${cases.length}/${cases.length} correctos` : `\n${bad} FALLOS`);
process.exit(bad === 0 ? 0 : 1);
