/**
 * Lógica de cálculo de cumpleaños y fechas de recordatorio.
 *
 * Todo se trabaja con fechas locales (sin zona horaria explícita) porque el
 * recordatorio debe dispararse a la hora que el usuario ve en su móvil.
 *
 * Un cumpleaños es anual: de `1990-02-29` solo existe la fecha real en años
 * bisiestos. En los años no bisiestos se celebra el 28 de febrero.
 */

/** Días de antelación con los que se avisa. */
export type OffsetDias = -2 | -1 | 0 | 1;

/** Todos los avisos que se generan por cumpleaños. */
export const OFFSETS: readonly OffsetDias[] = [-2, -1, 0, 1] as const;

/**
 * Solo la felicitación del propio día: es lo que queda cuando el usuario
 * desactiva los avisos por adelantado en Ajustes.
 */
export const OFFSETS_SOLO_HOY: readonly OffsetDias[] = [0] as const;

/** Margen de seguridad: no agendar nada que dispare en los próximos 30 s. */
const MARGEN_SEGUNDOS = 30_000;

const MS_DIA = 86_400_000;

/** ¿Es bisiesto el año? */
export function esBisiesto(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Número de días de un mes (1-12). */
export function diasDelMes(year: number, mes: number): number {
  // mes 0 = diciembre del año anterior, mes 12 = enero del siguiente
  return new Date(year, mes, 0).getDate();
}

export interface FechaCumple {
  anio: number;
  mes: number; // 1-12
  dia: number;
}

/** Convierte un texto `YYYY-MM-DD` en sus componentes. */
export function parseFechaCumple(fecha: string): FechaCumple {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
  if (!m) {
    throw new Error(`Fecha de cumpleaños inválida: "${fecha}" (se espera YYYY-MM-DD)`);
  }
  const [, anio, mes, dia] = m;
  const d = new Date(Number(anio), Number(mes) - 1, Number(dia));
  // Descarta fechas imposibles como 1990-02-31
  if (d.getFullYear() !== Number(anio) || d.getMonth() !== Number(mes) - 1 || d.getDate() !== Number(dia)) {
    throw new Error(`Fecha de cumpleaños inexistente: "${fecha}"`);
  }
  return { anio: Number(anio), mes: Number(mes), dia: Number(dia) };
}

/** Formatea `YYYY-MM-DD` sin parsear (evita sorpresas de zona horaria). */
export function formatearFechaCumple(f: FechaCumple): string {
  const mm = String(f.mes).padStart(2, '0');
  const dd = String(f.dia).padStart(2, '0');
  return `${f.anio}-${mm}-${dd}`;
}

/**
 * El cumpleaños dentro de un año concreto, a medianoche local.
 * Si el 29 de febrero cae en un año no bisiesto se devuelve el 28.
 */
export function cumpleEnAnio(fecha: string, anio: number): Date {
  const { mes, dia } = parseFechaCumple(fecha);
  const diaReal = mes === 2 && dia === 29 && !esBisiesto(anio) ? 28 : dia;
  return new Date(anio, mes - 1, diaReal, 0, 0, 0, 0);
}

/** Midnight local del día que contiene `d`. */
export function inicioDelDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Número de día absoluto. Se usa para contar días sin que un cambio de hora
 * de verano (DST) produzca un día de más o de menos.
 */
export function numeroDeDia(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_DIA);
}

/**
 * Próximo cumpleaños a partir de `desde` (medianoche local).
 * Si hoy es el cumpleaños, devuelve hoy → 0 días.
 */
export function proximoCumple(fecha: string, desde: Date = new Date()): Date {
  const base = inicioDelDia(desde);
  const esteAnio = cumpleEnAnio(fecha, base.getFullYear());
  return esteAnio.getTime() >= base.getTime() ? esteAnio : cumpleEnAnio(fecha, base.getFullYear() + 1);
}

/** Días que faltan para el próximo cumpleaños. 0 = hoy. */
export function diasParaCumple(fecha: string, desde: Date = new Date()): number {
  return numeroDeDia(proximoCumple(fecha, desde)) - numeroDeDia(inicioDelDia(desde));
}

/** Edad que cumple en el próximo cumpleaños. */
export function edadEnProximoCumple(fecha: string, desde: Date = new Date()): number {
  const { anio } = parseFechaCumple(fecha);
  return proximoCumple(fecha, desde).getFullYear() - anio;
}

/**
 * Edad que tiene hoy, que no es lo mismo que la que cumple en el próximo
 * cumpleaños: si el cumpleaños ya pasó este año, esa cuenta da un año más.
 *
 * Devuelve `null` solo si el año de nacimiento es posterior al actual, que es
 * un dato imposible. Un año igual al actual es una edad legítima de 0 años: un
 * bebé que nació este año tiene un cumpleaños real, y quien no conoce el año
 *birthday se marca aparte con `anioDesconocido`, no se deduce de la cifra.
 */
export function edadActual(fecha: string, desde: Date = new Date()): number | null {
  const { anio, mes, dia } = parseFechaCumple(fecha);
  const base = inicioDelDia(desde);
  if (anio > base.getFullYear()) return null;
  let edad = base.getFullYear() - anio;
  // Todavía no ha cumplido este año: le falta uno.
  const cumpleEsteAnio = mes < base.getMonth() + 1 || (mes === base.getMonth() + 1 && dia <= base.getDate());
  if (!cumpleEsteAnio) edad -= 1;
  // Un bebé nacido este año tiene edad 0, no -1: si su cumpleaños aún no ha
  // llegado, esa resta lo dejaría en negativo.
  return Math.max(0, edad);
}

/**
 * Edad deducible a partir del año guardado.
 *
 * Es `edadActual` con el matiz del año desconocido: si quien anotó la ficha
 * dejó claro que no conoce el año, no hay nada que deducir aunque la cifra sea
 * válida. Sin este matiz, una ficha marcada como desconocida seguiría enseñando
 * `0 años`, que es justo el dato falso que se quiere evitar.
 */
export function edadDeducible(
  fecha: string,
  anioDesconocido: boolean,
  desde: Date = new Date(),
): number | null {
  if (anioDesconocido) return null;
  return edadActual(fecha, desde);
}

/**
 * Fecha y hora exacta de un recordatorio, sin ajustar al futuro.
 * `cumple` debe ser el cumpleaños ya resuelto (medianoche local).
 * El desplazamiento en días se resuelve solo aunque cambie de mes o de año.
 */
export function instanteRecordatorio(cumple: Date, offsetDias: number, hora: number, minuto: number): Date {
  return new Date(
    cumple.getFullYear(),
    cumple.getMonth(),
    cumple.getDate() + offsetDias,
    hora,
    minuto,
    0,
    0,
  );
}

/**
 * Cumpleaños (medianoche local) al que pertenece el próximo aviso de un
 * `offsetDias`: el de este año si su hora aún no pasó, o el del año siguiente.
 * Las dos funciones siguientes parten de aquí para no desincronizarse.
 */
function cumpleDelProximoAviso(
  fecha: string,
  offsetDias: OffsetDias,
  hora: number,
  minuto: number,
  ahora: Date,
): Date {
  const cumple = proximoCumple(fecha, ahora);
  const instante = instanteRecordatorio(cumple, offsetDias, hora, minuto);
  return instante.getTime() >= ahora.getTime() + MARGEN_SEGUNDOS
    ? cumple
    : cumpleEnAnio(fecha, cumple.getFullYear() + 1);
}

/**
 * Próxima fecha en la que debe dispararse el recordatorio de `offsetDias`,
 * garantizada como futura. Si el aviso de este año ya pasó (o falta menos de
 * medio minuto), salta al cumpleaños del año siguiente.
 */
export function proximoInstanteRecordatorio(
  fecha: string,
  offsetDias: OffsetDias,
  hora: number,
  minuto: number,
  ahora: Date = new Date(),
): Date {
  return instanteRecordatorio(cumpleDelProximoAviso(fecha, offsetDias, hora, minuto, ahora), offsetDias, hora, minuto);
}

/**
 * Instante del recordatorio en el cumpleaños *posterior* al que se usa ahora.
 * Nunca coincide con `proximoInstanteRecordatorio`, incluso cuando el aviso de
 * este año ya tuvo que saltar al año que viene.
 */
export function instanteRecordatorioSiguienteCiclo(
  fecha: string,
  offsetDias: OffsetDias,
  hora: number,
  minuto: number,
  ahora: Date = new Date(),
): Date {
  const cumple = cumpleDelProximoAviso(fecha, offsetDias, hora, minuto, ahora);
  return instanteRecordatorio(cumpleEnAnio(fecha, cumple.getFullYear() + 1), offsetDias, hora, minuto);
}

/**
 * `true` cuando el aviso de "hoy" ya no puede programarse a la hora elegida
 * pero el cumpleaños es hoy. Permite avisar de inmediato en vez de esperar un año.
 */
export function cumpleHoyPeroHoraPasada(
  fecha: string,
  offsetDias: OffsetDias,
  hora: number,
  minuto: number,
  ahora: Date = new Date(),
): boolean {
  if (diasParaCumple(fecha, ahora) !== 0) return false;
  const instante = instanteRecordatorio(inicioDelDia(ahora), offsetDias, hora, minuto);
  return instante.getTime() < ahora.getTime();
}

/**
 * Cumpleaños de hoy cuya hora de aviso ya pasó y que hay que celebrar en el
 * momento: si el usuario abre la app a las 14:00 y dejó los avisos a las 09:00,
 * el de "hoy" no se puede programar hacia atrás.
 *
 * `avisosActivos` va dentro a propósito y no en quien llama. Con el interruptor
 * apagado el usuario no quiere enterarse de ningún cumpleaños, así que la
 * respuesta tiene que ser una lista vacía.
 */
export function cumpleanerosParaCelebrar(
  fechas: readonly string[],
  hora: number,
  minuto: number,
  avisosActivos: boolean,
  ahora: Date = new Date(),
): string[] {
  if (!avisosActivos) return [];
  return fechas.filter(
    (fecha) =>
      diasParaCumple(fecha, ahora) === 0 && cumpleHoyPeroHoraPasada(fecha, 0, hora, minuto, ahora),
  );
}

// ---------------------------------------------------------------------------
// Formato para pantalla
// ---------------------------------------------------------------------------

/** Meses en minúscula, como deben ir dentro de una frase. */
export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "12 de marzo" */
export function fechaLarga(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "12 de marzo de 1990" */
export function fechaLargaConAnio(d: Date): string {
  return `${fechaLarga(d)} de ${d.getFullYear()}`;
}

/** "12/03/1990" */
export function fechaCorta(iso: string): string {
  const { anio, mes, dia } = parseFechaCumple(iso);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
}

/** "hh:mm" con ceros. */
export function horaCorta(hora: number, minuto: number): string {
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

/** "09:00" → { hora: 9, minuto: 0 }. Devuelve null si el formato es inválido. */
export function parseHora(texto: string): { hora: number; minuto: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!m) return null;
  const hora = Number(m[1]);
  const minuto = Number(m[2]);
  if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null;
  return { hora, minuto };
}

/** `YYYY-MM-DD` del día local actual. Se usa para detectar el cambio de día. */
export function hoyIso(ahora: Date = new Date()): string {
  return formatearFechaCumple({ anio: ahora.getFullYear(), mes: ahora.getMonth() + 1, dia: ahora.getDate() });
}

/**
 * Zona horaria del dispositivo, tal y como la tiene configurada Android.
 *
 * La app no pide permiso de ubicación: no lo necesita. El reloj del móvil ya
 * viene con la zona puesta desde la operadora o el wifi, y todos los cálculos
 * usan hora local sin conversiones, así que una persona en Chile recibe el
 * aviso a las 09:00 de su reloj y otra en Japón también.
 *
 * El identificador se usa para detectar viajes: si el usuario cambia de país
 * con la app cerrada, los avisos ya agendados conservan el instante con el que
 * se crearon y hay que volver a calcularlos. Algunos Android llevan la base de
 * datos de zonas recortada, así que si no hay nombre se usa el desfase.
 */
export function zonaHorariaActual(): string {
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (zona) return zona;
  // Respaldo: el desfase en minutos, con signo, cubre el caso sin nombre.
  const desfase = -new Date().getTimezoneOffset();
  return `desfase${desfase >= 0 ? '+' : '-'}${Math.abs(desfase)}`;
}

/** Qué hay que rehacer de la agenda, según lo último que se sincronizó. */
export interface NecesidadDeReconstruccion {
  /** El día local es otro: los avisos de ayer ya dispararon. */
  diaNuevo: boolean;
  /** El dispositivo cambió de zona horaria: los avisos se calcularon con la anterior. */
  cambioZona: boolean;
  /** `true` si hay que volver a programar. */
  reconstruir: boolean;
}

/**
 * Decide si la agenda necesita rehacerse.
 *
 * Es una función pura a propósito: no lee el reloj ni la zona reales, para poder
 * probarla con fechas y zonas escritas a mano. Quien llama pasa `hoyIso()` y
 * `zonaHorariaActual()`.
 *
 * Un dispositivo sin zona guardada (la primera vez) no se cuenta como cambio:
 * no hay con qué compararlo y ya se va a reconstruir por ser día nuevo.
 */
export function necesitaReconstruirAgenda(
  diaUltimo: string | null,
  zonaUltima: string | null,
  diaAhora: string,
  zonaAhora: string,
): NecesidadDeReconstruccion {
  const diaNuevo = diaUltimo !== diaAhora;
  const cambioZona = zonaUltima !== null && zonaUltima !== zonaAhora;
  return { diaNuevo, cambioZona, reconstruir: diaNuevo || cambioZona };
}

/**
 * Texto de la edad en la lista, adaptado a lo cerca que esté el cumpleaños.
 *
 * - No es ni hoy ni ayer: "Edad: 23 años · Cumplirá: 24 años". Se muestran las
 *   dos cifras porque no siempre coinciden.
 * - Es hoy: "Está cumpliendo 24 años". Aquí `edad` ya es la que se cumple
 *   este mismo día, así que no se le suma uno.
 * - Fue ayer: "Cumplió 24 años".
 *
 * `dias` negativo solo llega desde el resumen, que sí cuenta hacia atrás.
 *
 * Devuelve cadena vacía cuando no hay edad que deducir (año actual o
 * posterior), para que la tarjeta no muestre una edad inventada.
 */
export function textoEdadTarjeta(edad: number | null, dias: number): string {
  if (edad === null) return '';
  if (dias === 0) return `Está cumpliendo ${pluralAnios(edad)}`;
  if (dias < 0) return `Cumplió ${pluralAnios(edad)}`;
  return `Edad: ${pluralAnios(edad)} · Cumplirá: ${pluralAnios(edad + 1)}`;
}

/**
 * Frase con la edad para el cuerpo de un aviso, en minúsculas y sin punto,
 * para poder encajarla dentro de la frase que ya se está componiendo.
 *
 * El verbo va en pasado solo cuando el aviso es el de la felicitación tardía,
 * que es el único que se dispara con el cumpleaños ya atrás.
 */
export function textoEdadAviso(edad: number | null, offsetDias: number): string {
  if (edad === null) return '';
  const anios = pluralAnios(edad);
  if (offsetDias > 0) return `Cumplió ${anios}`;
  if (offsetDias === 0) return `Está cumpliendo ${anios}`;
  return `Va a cumplir ${anios}`;
}

/**
 * Edad que se cumple en el cumpleaños al que pertenece un aviso de
 * `offsetDias` que se dispara en `instanteAviso`.
 *
 * No se puede reutilizar `edadEnProximoCumple` porque la agenda se programa
 * con antelación y también para el ciclo siguiente: lo que debe decir el
 * aviso es la edad de ese cumpleaños concreto, no la que tiene la persona hoy.
 *
 * Devuelve `null` si el año guardado no permite deducir ninguna edad.
 */
export function edadEnCumpleDelAviso(
  fecha: string,
  instanteAviso: Date,
  offsetDias: number,
  anioDesconocido = false,
): number | null {
  if (anioDesconocido) return null;
  const { anio } = parseFechaCumple(fecha);
  // El cumpleaños al que pertenece el aviso es `offsetDias` días antes del
  // instante en que se dispara.
  const cumple = new Date(instanteAviso);
  cumple.setDate(cumple.getDate() - offsetDias);
  if (anio > cumple.getFullYear()) return null;
  return cumple.getFullYear() - anio;
}

/** "1 año" o "34 años". */
export function pluralAnios(n: number): string {
  return `${n} ${n === 1 ? 'año' : 'años'}`;
}

/**
 * Día de la semana con la semana empezando en lunes, como se lee un calendario
 * en español: 0 = lunes ... 6 = domingo.
 */
export function indiceDiaSemana(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * Último valor de "días para el cumpleaños" que sigue dentro de la semana en
 * curso. Domingo da 0 (hoy es el último día) y lunes da 6 (el domingo cierra
 * la semana a seis días vista).
 *
 * Se calcula como `6 - índice` porque el domingo tiene índice 6, y no con un
 * módulo: `(7 - 0) % 7` daría 0 en lunes, que es justo el error que separaba
 * "esta semana" de "la próxima".
 */
export function diasHastaFinDeSemana(ahora: Date = new Date()): number {
  return 6 - indiceDiaSemana(ahora);
}

/** En qué semana cae un cumpleaños, para agruparlo en el resumen de la lista. */
export type SemanaCumple = 'hoy' | 'esta' | 'proxima' | 'masAdelante';

/**
 * Agrupa un cumpleaños por semana natural: la semana va de lunes a domingo.
 *
 * "Esta semana" incluye hoy y llega hasta el domingo, y "la próxima" es la que
 * va del lunes al domingo siguientes. Contar los próximos siete días no es lo
 * mismo: si hoy es lunes, el lunes siguiente está a siete días y no es de esta
 * semana.
 */
export function semanaDelCumple(dias: number, ahora: Date = new Date()): SemanaCumple {
  if (dias === 0) return 'hoy';
  const fin = diasHastaFinDeSemana(ahora);
  if (dias <= fin) return 'esta';
  if (dias <= fin + 7) return 'proxima';
  return 'masAdelante';
}

/** Texto legible de "dentro de N días". */
export function textoCuentaAtras(dias: number): string {
  if (dias === 0) return '¡Hoy es su cumpleaños!';
  if (dias === 1) return 'Mañana';
  if (dias > 1) return `En ${dias} días`;
  if (dias === -1) return 'Ayer';
  return `Hace ${Math.abs(dias)} días`;
}