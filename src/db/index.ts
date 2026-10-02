import * as SQLite from 'expo-sqlite';

/** Base de datos local. Sin servidor: el fichero vive en el sandbox de la app. */
export const NOMBRE_DB = 'cumpleanos.db';

/**
 * Versión del esquema. Súbele en cada migración nueva y añade el bloque
 * correspondiente en `aplicarMigraciones`.
 */
const VERSION_ESQUEMA = 2;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Abre la base de datos (una sola vez) y aplica las migraciones pendientes.
 * Es idempotente: varias llamadas simultáneas comparten la misma promesa.
 */
export function obtenerDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(NOMBRE_DB);
      await aplicarMigraciones(db);
      return db;
    })().catch((error) => {
      // Que un fallo transitorio no deje la promesa cacheada para siempre.
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

/**
 * Si la tabla tiene una columna concreta.
 *
 * `PRAGMA user_version` no es fuente de verdad. Si la versión se sube a
 * `VERSION_ESQUEMA` antes de escribir su bloque de migración, la app puede
 * marcar la base como actualizada sin llegar a crear la columna: a partir de
 * ahí `user_version` afirma que todo está bien mientras las consultas fallan
 * con "no such column" y no hay vuelta atrás. Consultar las columnas reales
 * hace que esa base se repare sola al abrirla.
 */
async function tieneColumna(
  db: SQLite.SQLiteDatabase,
  tabla: string,
  columna: string,
): Promise<boolean> {
  const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tabla})`);
  return info.some((col) => col.name === columna);
}

async function aplicarMigraciones(db: SQLite.SQLiteDatabase): Promise<void> {
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const versionActual = fila?.user_version ?? 0;

  // Cada migración debe ser idempotente (`IF NOT EXISTS`) para que un
  // dispositivo con la base a medias pueda recuperarse sin perder datos.
  if (versionActual < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cumpleaneros (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre            TEXT    NOT NULL,
        apellido          TEXT    NOT NULL,
        fecha_nacimiento  TEXT    NOT NULL,
        notas             TEXT,
        creado_en         TEXT    NOT NULL,
        actualizado_en    TEXT    NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cumpleaneros_nacimiento
        ON cumpleaneros (fecha_nacimiento);

      CREATE TABLE IF NOT EXISTS ajustes (
        clave TEXT PRIMARY KEY NOT NULL,
        valor TEXT NOT NULL
      );
    `);
  }

  // 2: el año de nacimiento desconocido se marca en vez de deducirse.
  //
  // Antes se deducía del número: si el año guardado era el actual o posterior,
  // se asumía que nadie lo conocía. Eso confundía dos cosas distintas, un bebé
  // que nació este año (cuyo cumpleaños es real y vale 0 años) con una ficha en
  // la que el usuario solo anotaba el día y el mes. Ahora la intención se
  // guarda en la propia base.
  //
  // La condición es la existencia de la columna, no el número de versión: así
  // una base que quedó a medias también se repara sola. Las filas existentes
  // se marcan como "año desconocido" cuando su año es el en curso o posterior,
  // que es lo que significaban bajo la regla anterior. La migración es aditiva:
  // no se toca ninguna fila con año real.
  if (!(await tieneColumna(db, 'cumpleaneros', 'anio_desconocido'))) {
    await db.execAsync(`
      ALTER TABLE cumpleaneros
        ADD COLUMN anio_desconocido INTEGER NOT NULL DEFAULT 0;
    `);
    const anioEnCurso = new Date().getFullYear();
    await db.runAsync(
      `UPDATE cumpleaneros SET anio_desconocido = 1 WHERE CAST(substr(fecha_nacimiento, 1, 4) AS INTEGER) >= ?`,
      anioEnCurso,
    );
  }

  await db.execAsync(`PRAGMA user_version = ${VERSION_ESQUEMA}`);
}