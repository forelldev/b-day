import * as SQLite from 'expo-sqlite';

/** Base de datos local. Sin servidor: el fichero vive en el sandbox de la app. */
export const NOMBRE_DB = 'cumpleanos.db';

/**
 * Versión del esquema. Súbele en cada migración nueva y añade el bloque
 * correspondiente en `aplicarMigraciones`.
 */
const VERSION_ESQUEMA = 1;

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

async function aplicarMigraciones(db: SQLite.SQLiteDatabase): Promise<void> {
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const versionActual = fila?.user_version ?? 0;

  if (versionActual >= VERSION_ESQUEMA) return;

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

  await db.execAsync(`PRAGMA user_version = ${VERSION_ESQUEMA}`);
}