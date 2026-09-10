/**
 * Design tokens a salon can choose between.
 *
 * Each palette sets the same semantic tokens, so switching one re-themes the
 * whole product — booking wizard and admin panel alike. Before, palettes only
 * wrote the `--aesthetic-*` variables the dashboard used, which is why the
 * booking flow stayed pink no matter what the salon picked.
 *
 * The token names are roles, not colours: `--surface`, `--text-muted`,
 * `--brand-primary`. A palette that wants a green brand does not end up with a
 * variable called "pink" holding green.
 */

export interface PaletteTokens {
    /** Page background. */
    '--surface': string;
    /** Cards and sheets that sit above the page. */
    '--surface-raised': string;
    /** Inset areas: inputs, wells, disabled rows. */
    '--surface-sunken': string;

    /** Primary brand colour: main actions, active states. */
    '--brand-primary': string;
    /** A lighter brand tone for fills and hovers. */
    '--brand-primary-soft': string;
    /** The faintest brand wash, for selected backgrounds. */
    '--brand-primary-tint': string;
    /** Secondary brand colour, used as the second gradient stop. */
    '--brand-secondary': string;

    /** Headings and emphasis. */
    '--text-strong': string;
    /** Body copy. */
    '--text': string;
    /** Labels, captions, secondary information. */
    '--text-muted': string;
    /** Placeholders and disabled text. */
    '--text-subtle': string;

    /** Hairlines and card outlines. */
    '--border': string;
}

export interface Palette {
    id: string;
    name: string;
    description: string;
    /** Three swatches shown in the picker: surface, brand, text. */
    swatches: [string, string, string];
    tokens: PaletteTokens;
}

/*
 * Los tres tonos de texto de cada paleta están medidos contra el `--surface`
 * de esa misma paleta, que es el peor de los dos fondos que existen —el
 * elevado es blanco y da algo más de contraste.
 *
 *   --text-strong  >= 7.0    titulares y cifras
 *   --text         >= 5.5    cuerpo
 *   --text-muted   >= 4.6    etiquetas y notas
 *
 * `--text-muted` fallaba en las cuatro (entre 2.82 y 3.64, con un mínimo de
 * 4.5) y es el color de casi todas las etiquetas de formulario del producto.
 * Al corregirlo se conservó el tono de cada paleta: son los mismos colores,
 * más profundos, no grises nuevos.
 *
 * `--text-subtle` se queda deliberadamente por debajo: es para iconos y
 * trazos decorativos, no para texto. Si acaba bajo un párrafo, el que está
 * mal es el párrafo.
 */
export const PALETTES: Palette[] = [
    {
        id: 'soft-rose',
        name: 'Soft Rose',
        description: 'Rosa cálido sobre crema. El look por defecto de NailFlow.',
        swatches: ['#FDFBF7', '#E8A0B4', '#2C2420'],
        tokens: {
            '--surface': '#FDFBF7',
            '--surface-raised': '#FFFFFF',
            '--surface-sunken': '#F5F0E8',
            '--brand-primary': '#E8A0B4',
            '--brand-primary-soft': '#F8D8E0',
            '--brand-primary-tint': '#FFF0F3',
            '--brand-secondary': '#E8B4A0',
            '--text-strong': '#2C2420',
            '--text': '#5A4E48',
            '--text-muted': '#7A706B',
            '--text-subtle': '#C8BEB8',
            '--border': '#F0E9DF',
        },
    },
    {
        id: 'vintage-rose',
        name: 'Vintage Rose',
        description: 'Sofisticación clásica y tonos empolvados.',
        swatches: ['#FDF7F7', '#E8C5C8', '#85595D'],
        tokens: {
            '--surface': '#FDF7F7',
            '--surface-raised': '#FFFFFF',
            '--surface-sunken': '#F6ECEC',
            '--brand-primary': '#E8C5C8',
            '--brand-primary-soft': '#F0E0E2',
            '--brand-primary-tint': '#FBF1F1',
            '--brand-secondary': '#D9AFB3',
            '--text-strong': '#6E4649',
            '--text': '#85595D',
            '--text-muted': '#856A6A',
            '--text-subtle': '#C7ABAB',
            '--border': '#EFE0E1',
        },
    },
    {
        id: 'modern-taupe',
        name: 'Modern Taupe',
        description: 'Minimalismo contemporáneo en tonos tierra.',
        swatches: ['#F9F8F6', '#D1C7BD', '#5C544E'],
        tokens: {
            '--surface': '#F9F8F6',
            '--surface-raised': '#FFFFFF',
            '--surface-sunken': '#EDE9E4',
            '--brand-primary': '#B9AC9F',
            '--brand-primary-soft': '#D1C7BD',
            '--brand-primary-tint': '#F1EDE8',
            '--brand-secondary': '#C9BEB2',
            '--text-strong': '#3F3934',
            '--text': '#5C544E',
            '--text-muted': '#786F68',
            '--text-subtle': '#B5ADA5',
            '--border': '#E5E0DA',
        },
    },
    {
        id: 'soft-aesthetic',
        name: 'Soft Aesthetic',
        description: 'Calidez natural y luz etérea.',
        swatches: ['#FCFBF9', '#E4CDB2', '#746351'],
        tokens: {
            '--surface': '#FCFBF9',
            '--surface-raised': '#FFFFFF',
            '--surface-sunken': '#F4EDE4',
            '--brand-primary': '#D8BE9E',
            '--brand-primary-soft': '#F2E6D8',
            '--brand-primary-tint': '#FAF5EE',
            '--brand-secondary': '#E7D4BE',
            '--text-strong': '#645442',
            '--text': '#746351',
            '--text-muted': '#806E5E',
            '--text-subtle': '#CBBBA7',
            '--border': '#EDE5DC',
        },
    },
];

export const DEFAULT_PALETTE_ID = 'soft-rose';

export interface TypographyOption {
    id: string;
    label: string;
    description: string;
    /** Headings and display copy. */
    display: string;
    /** Body copy, labels, controls. */
    body: string;
}

export const TYPOGRAPHY: TypographyOption[] = [
    {
        id: 'serif',
        label: 'Elegante',
        description: 'Titulares con serifa y cuerpo neutro.',
        display: "'Playfair Display', Georgia, serif",
        body: "'Inter', system-ui, -apple-system, sans-serif",
    },
    {
        id: 'editorial',
        label: 'Editorial',
        description: 'Cursiva refinada, estilo revista.',
        display: "'Newsreader', Georgia, serif",
        body: "'Inter', system-ui, -apple-system, sans-serif",
    },
    {
        id: 'sans',
        label: 'Limpia',
        description: 'Sans en todo, directa y moderna.',
        display: "'Inter', system-ui, -apple-system, sans-serif",
        body: "'Inter', system-ui, -apple-system, sans-serif",
    },
];

export const DEFAULT_TYPOGRAPHY_ID = 'serif';

/** Weekday labels, Monday-first to match the calendar grid. */
export const WEEKDAYS = [
    { day: 1, short: 'Lu', label: 'Lunes' },
    { day: 2, short: 'Ma', label: 'Martes' },
    { day: 3, short: 'Mi', label: 'Miércoles' },
    { day: 4, short: 'Ju', label: 'Jueves' },
    { day: 5, short: 'Vi', label: 'Viernes' },
    { day: 6, short: 'Sa', label: 'Sábado' },
    { day: 0, short: 'Do', label: 'Domingo' },
] as const;

export const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

/** How an appointment status is presented, in one place. */
export const STATUS_PRESENTATION = {
    confirmed: { label: 'Confirmada', token: 'confirmed' },
    pending_payment: { label: 'Pendiente de pago', token: 'pending' },
    completed: { label: 'Completada', token: 'completed' },
    cancelled: { label: 'Cancelada', token: 'cancelled' },
} as const;
