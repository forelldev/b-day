import { obtenerDb } from './index';
import { parseHora } from '../utils/date';
import { COLORES_POR_DEFECTO, normalizarHex } from '../ui/tema';

export const CLAVE_HORA = 'hora_notificacion';
export const CLAVE_ULTIMA_SINCRONIZACION = 'ultima_sincronizacion';
export const CLAVE_ZONA_SINCRONIZACION = 'zona_ultima_sincronizacion';
export const CLAVE_AVISOS_ACTIVOS = 'avisos_activos';
export const CLAVE_COLOR_MARCA = 'color_marca';
export const CLAVE_COLOR_FONDO = 'color_fondo';

/** Por defecto: 09:00, una hora prudente antes de que empiece el día. */
export const HORA_POR_DEFECTO = { hora: 9, minuto: 0 };

/** Máximo de recordatorios que se dejan programados a la vez. */
export const LIMITE_PROGRAMADOS = 400;

/**
 * Color con el que el sistema pinta el aviso en la barra. Va con la marca que
 * eligió el usuario, no con un color fijo en el código, para que la app y sus
 * notificaciones se vean del mismo color.
 */
export async function leerColorMarcaNotificacion(): Promise<string> {
  const guardado = await leerAjuste(CLAVE_COLOR_MARCA);
  // Un valor guardado que no sea un hexadecimal válido (por ejemplo, escrito a
  // mano con un error) no puede mandarse al sistema: se cae al color por
  // defecto en lugar de romper la programación entera.
  return (guardado && normalizarHex(guardado)) || COLORES_POR_DEFECTO.marca;
}

export interface HoraNotificacion {
  hora: number;
  minuto: number;
}

export async function leerAjuste(clave: string): Promise<string | null> {
  const db = await obtenerDb();
  const fila = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM ajustes WHERE clave = ?', clave);
  return fila?.valor ?? null;
}

export async function escribirAjuste(clave: string, valor: string): Promise<void> {
  const db = await obtenerDb();
  await db.runAsync(
    'INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor',
    clave,
    valor,
  );
}

/** Hora a la que se disparan los recordatorios. */
export async function leerHoraNotificacion(): Promise<HoraNotificacion> {
  const guardado = await leerAjuste(CLAVE_HORA);
  if (!guardado) return HORA_POR_DEFECTO;
  return parseHora(guardado) ?? HORA_POR_DEFECTO;
}

export async function guardarHoraNotificacion(hora: HoraNotificacion): Promise<void> {
  await escribirAjuste(
    CLAVE_HORA,
    `${String(hora.hora).padStart(2, '0')}:${String(hora.minuto).padStart(2, '0')}`,
  );
}

/** `YYYY-MM-DD` del día de la última sincronización de recordatorios. */
export async function leerUltimaSincronizacion(): Promise<string | null> {
  return leerAjuste(CLAVE_ULTIMA_SINCRONIZACION);
}

export async function guardarUltimaSincronizacion(dia: string): Promise<void> {
  await escribirAjuste(CLAVE_ULTIMA_SINCRONIZACION, dia);
}

/**
 * Zona horaria con la que se calculó la agenda actual.
 *
 * Se guarda en la base de datos y no solo en memoria a propósito: si el usuario
 * cambia de país con la app cerrada, al volver a abrirla hay que poder saber
 * que esos avisos se calcularon con la zona anterior.
 */
export async function leerZonaSincronizacion(): Promise<string | null> {
  return leerAjuste(CLAVE_ZONA_SINCRONIZACION);
}

export async function guardarZonaSincronizacion(zona: string): Promise<void> {
  await escribirAjuste(CLAVE_ZONA_SINCRONIZACION, zona);
}

/**
 * Interruptor general de los cuatro avisos. Apagado no significa "sin
 * permiso", sino que el usuario no quiere que se programe nada.
 */
export async function leerAvisosActivos(): Promise<boolean> {
  return (await leerAjuste(CLAVE_AVISOS_ACTIVOS)) !== '0';
}

export async function guardarAvisosActivos(activo: boolean): Promise<void> {
  await escribirAjuste(CLAVE_AVISOS_ACTIVOS, activo ? '1' : '0');
}