/**
 * Estilos compartidos: espaciados, radios y paleta de colores.
 *
 * La paleta no es un objeto fijo: el usuario puede cambiar el color de la marca
 * y el del fondo desde Ajustes, así que lo que hay aquí son los valores por
 * defecto y las reglas para derivar el resto. `crearColores` es la única forma
 * de obtener una paleta completa y es lo que usan las pantallas.
 */

/** Colores por defecto de la app: marca rosita sobre fondo casi blanco. */
export const COLORES_POR_DEFECTO = {
  /** Color de los botones, del calendario y de los detalles que destacan. */
  marca: '#E8467C',
  /** Fondo de la pantalla. */
  fondo: '#FDF7F9',
} as const;

export const ESPACIO = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADIO = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

/**
 * Paleta completa que usan las pantallas. Los colores que el usuario no puede
 * elegir se derivan de los dos que sí puede, para que todo siga harmonico.
 */
export interface Colores {
  marca: string;
  marcaOscura: string;
  marcaSuave: string;
  fondo: string;
  superficie: string;
  texto: string;
  textoSuave: string;
  textoTenue: string;
  borde: string;
  peligro: string;
  peligroSuave: string;
  exito: string;
  exitoSuave: string;
  aviso: string;
  avisoSuave: string;
  super: string;
}

/** Paleta por defecto, ya derivando los colores que dependen de la marca. */
export const COLORES: Colores = crearColores(COLORES_POR_DEFECTO.marca, COLORES_POR_DEFECTO.fondo);

/** Paletas ofrecidas como atajo en Ajustes. */
export interface Paleta {
  nombre: string;
  marca: string;
  fondo: string;
}

export const PALETAS: Paleta[] = [
  { nombre: 'Rosita', marca: '#E8467C', fondo: '#FDF7F9' },
  { nombre: 'Lila', marca: '#7C4DFF', fondo: '#F6F4FF' },
  { nombre: 'Azul', marca: '#2563EB', fondo: '#F3F7FF' },
  { nombre: 'Verde', marca: '#0E9F6E', fondo: '#F2FBF7' },
  { nombre: 'Naranja', marca: '#E8590C', fondo: '#FFF7F2' },
  { nombre: 'Rojo', marca: '#D92D20', fondo: '#FEF4F3' },
  { nombre: 'Piedra', marca: '#6E6472', fondo: '#F7F6F8' },
  { nombre: 'Blanco', marca: '#FFFFFF', fondo: '#FFFFFF' },
  { nombre: 'Noche', marca: '#F26D9E', fondo: '#17131A' },
];

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/**
 * Normaliza a `#RRGGBB` en mayúsculas. Acepta abreviaturas (`#F0A`) porque así
 * los muestra el selector nativo de Android. Devuelve `null` si no parece un
 * color, para no propagar basura a la paleta.
 */
export function normalizarHex(valor: string): string | null {
  const limpio = valor.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(limpio)) {
    return `#${limpio
      .split('')
      .map((c) => c + c)
      .join('')
      .toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(limpio)) return `#${limpio.toUpperCase()}`;
  return null;
}

/** `#RRGGBB` → `[r, g, b]` con valores de 0 a 255. */
function aRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function aHex(r: number, g: number, b: number): string {
  const dos = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${dos(r)}${dos(g)}${dos(b)}`.toUpperCase();
}

/** Mezcla `a` con `b` en proporción `t` (0 = todo `a`, 1 = todo `b`). */
export function mezclar(a: string, b: string, t: number): string {
  const [r1, g1, b1] = aRgb(a);
  const [r2, g2, b2] = aRgb(b);
  return aHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Oscuridad de 0 a 1 según el brillo percebido. */
export function luminancia(hex: string): number {
  const [r, g, b] = aRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `true` si el fondo es oscuro y el texto debe ser claro. */
export function esOscuro(hex: string): boolean {
  return luminancia(hex) < 0.4;
}

/** Texto legible sobre un color dado: claro si el fondo es oscuro. */
export function textoSobre(hex: string): string {
  return esOscuro(hex) ? '#FFFFFF' : '#1F1520';
}

/**
 * Construye la paleta completa a partir de los dos colores que elige el
 * usuario. El resto se deriva:
 *
 * - Si el fondo es oscuro, superficie y textos se aclaran y se invierten.
 * - `marcaOscura`, `marcaSuave` y `borde` salen de mezclar la marca con el
 *   fondo y con el blanco o el negro según convenga.
 */
export function crearColores(marca: string, fondo: string): Colores {
  const marcaOk = normalizarHex(marca) ?? COLORES_POR_DEFECTO.marca;
  const fondoOk = normalizarHex(fondo) ?? COLORES_POR_DEFECTO.fondo;

  const oscuro = esOscuro(fondoOk);
  // Sobre fondo oscuro la superficie es un punto más claro que el fondo.
  const superficie = oscuro ? mezclar(fondoOk, '#FFFFFF', 0.08) : '#FFFFFF';
  // Y el negro puro sobre un fondo oscuro no se lee: se sube el tono.
  const tinta = oscuro ? mezclar(fondoOk, '#FFFFFF', 0.9) : '#1F1520';

  return {
    marca: marcaOk,
    marcaOscura: mezclar(marcaOk, '#000000', 0.28),
    marcaSuave: mezclar(marcaOk, superficie, 0.86),
    fondo: fondoOk,
    superficie,
    texto: tinta,
    textoSuave: mezclar(tinta, superficie, 0.32),
    textoTenue: mezclar(tinta, superficie, 0.58),
    borde: mezclar(marcaOk, superficie, 0.86),
    peligro: '#D92D20',
    peligroSuave: '#FEF3F2',
    exito: '#067647',
    exitoSuave: '#ECFDF3',
    aviso: '#B54708',
    avisoSuave: '#FFFAEB',
    super: textoSobre(marcaOk),
  };
}

/**
 * Colores por cercanía del cumpleaños, para que el usuario pueda escanear la
 * lista y ver de un vistazo quién cumple años.
 */
export function colorPorUrgencia(
  dias: number,
  colores: Colores = COLORES,
): { fondo: string; texto: string; pastilla: string } {
  if (dias <= 0) return { fondo: colores.exitoSuave, texto: colores.exito, pastilla: colores.exito };
  if (dias === 1) return { fondo: colores.marcaSuave, texto: colores.marcaOscura, pastilla: colores.marca };
  if (dias <= 7) return { fondo: colores.avisoSuave, texto: colores.aviso, pastilla: colores.aviso };
  return { fondo: colores.superficie, texto: colores.textoSuave, pastilla: colores.textoTenue };
}

/** Iniciales para el avatar: "María López" → "ML". */
export function iniciales(nombre: string, apellido: string): string {
  const n = nombre.trim().charAt(0);
  const a = apellido.trim().charAt(0);
  return `${n}${a}`.toUpperCase();
}