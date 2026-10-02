import { obtenerDb } from './index';

export interface Cumpleanero {
  id: number;
  nombre: string;
  apellido: string;
  /** `YYYY-MM-DD` */
  fechaNacimiento: string;
  /**
   * `true` cuando quien la anotó no conocía el año de nacimiento y solo
   * matteredía el día y el mes. Distingue eso de un bebé que sí nació este año:
   * en ambos casos el año guardado es el en curso, pero solo en el primero
   * falta la edad.
   */
  anioDesconocido: boolean;
  notas: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

interface FilaCumpleanero {
  id: number;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  anio_desconocido: number;
  notas: string | null;
  creado_en: string;
  actualizado_en: string;
}

const SELECT = `
  SELECT id, nombre, apellido, fecha_nacimiento, anio_desconocido, notas, creado_en, actualizado_en
  FROM cumpleaneros
`;

function aCumpleanero(fila: FilaCumpleanero): Cumpleanero {
  return {
    id: fila.id,
    nombre: fila.nombre,
    apellido: fila.apellido,
    fechaNacimiento: fila.fecha_nacimiento,
    anioDesconocido: fila.anio_desconocido === 1,
    notas: fila.notas,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

function ahoraIso(): string {
  return new Date().toISOString();
}

/**
 * Cada palabra con la primera letra en mayúscula y el resto en minúscula, sin
 * espacios de sobra. Se normaliza aquí y no en la pantalla para que el orden
 * alfabético de la lista y las comparaciones sean coherentes venga el dato de
 * donde venga.
 */
function normalizar(texto: string): string {
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, previo: string, letra: string) => {
      return previo + letra.toLocaleUpperCase('es');
    });
}

export async function listarCumpleaneros(): Promise<Cumpleanero[]> {
  const db = await obtenerDb();
  const filas = await db.getAllAsync<FilaCumpleanero>(`${SELECT} ORDER BY apellido COLLATE NOCASE, nombre COLLATE NOCASE`);
  return filas.map(aCumpleanero);
}

export async function obtenerCumpleanero(id: number): Promise<Cumpleanero | null> {
  const db = await obtenerDb();
  const fila = await db.getFirstAsync<FilaCumpleanero>(`${SELECT} WHERE id = ?`, id);
  return fila ? aCumpleanero(fila) : null;
}

export interface DatosCumpleanero {
  nombre: string;
  apellido: string;
  /** `YYYY-MM-DD` */
  fechaNacimiento: string;
  anioDesconocido?: boolean;
  notas?: string | null;
}

/** Inserta un cumpleanero y devuelve su `id`. */
export async function crearCumpleanero(datos: DatosCumpleanero): Promise<number> {
  const db = await obtenerDb();
  const sello = ahoraIso();
  const resultado = await db.runAsync(
    `INSERT INTO cumpleaneros (nombre, apellido, fecha_nacimiento, anio_desconocido, notas, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    normalizar(datos.nombre),
    normalizar(datos.apellido),
    datos.fechaNacimiento,
    datos.anioDesconocido ? 1 : 0,
    datos.notas?.trim() ? datos.notas.trim() : null,
    sello,
    sello,
  );
  return resultado.lastInsertRowId;
}

/** Actualiza un cumpleanero. Devuelve `false` si no existe. */
export async function actualizarCumpleanero(id: number, datos: DatosCumpleanero): Promise<boolean> {
  const db = await obtenerDb();
  const resultado = await db.runAsync(
    `UPDATE cumpleaneros
        SET nombre = ?, apellido = ?, fecha_nacimiento = ?, anio_desconocido = ?, notas = ?, actualizado_en = ?
      WHERE id = ?`,
    normalizar(datos.nombre),
    normalizar(datos.apellido),
    datos.fechaNacimiento,
    datos.anioDesconocido ? 1 : 0,
    datos.notas?.trim() ? datos.notas.trim() : null,
    ahoraIso(),
    id,
  );
  return resultado.changes > 0;
}

/** Borra un cumpleanero. Devuelve `false` si no existía. */
export async function eliminarCumpleanero(id: number): Promise<boolean> {
  const db = await obtenerDb();
  const resultado = await db.runAsync('DELETE FROM cumpleaneros WHERE id = ?', id);
  return resultado.changes > 0;
}

export async function contarCumpleaneros(): Promise<number> {
  const db = await obtenerDb();
  const fila = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM cumpleaneros');
  return fila?.total ?? 0;
}