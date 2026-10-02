import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as nodeSqlite from 'node:sqlite';

/**
 * Migraciones del esquema.
 *
 * Se prueban contra una base en memoria con `node:sqlite`, que es el mismo
 * motor que usa `expo-sqlite` en el dispositivo. La lógica de migración vive
 * dentro de `db/index.ts`, que importa `expo-sqlite` y no se puede cargar en
 * Node, así que aquí se replica exactamente su forma de decidir qué hacer.
 *
 * Lo que se quiere proteger no es tanto el resultado final, que es obvio, sino
 * la decisión: que la migración se guíe por las columnas reales y no solo por
 * `PRAGMA user_version`. Ya ha pasado: al subir la versión antes de escribir su
 * bloque, la base quedó marcada como actualizada sin la columna nueva y toda
 * consulta falló con "no such column: anio_desconocido" sin possibility de
 * reintentar.
 */

const ANIO_EN_CURSO = new Date().getFullYear();

function columnas(db: nodeSqlite.DatabaseSync, tabla: string): string[] {
  return db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => (c as { name: string }).name);
}

function tieneColumna(db: nodeSqlite.DatabaseSync, tabla: string, columna: string): boolean {
  return columnas(db, tabla).includes(columna);
}

const CREAR_TABLA = `
  CREATE TABLE IF NOT EXISTS cumpleaneros (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre            TEXT    NOT NULL,
    apellido          TEXT    NOT NULL,
    fecha_nacimiento  TEXT    NOT NULL,
    notas             TEXT,
    creado_en         TEXT    NOT NULL,
    actualizado_en    TEXT    NOT NULL
  )
`;

/** Réplica de `aplicarMigraciones`. */
function migrar(db: nodeSqlite.DatabaseSync, versionEsquema = 2): void {
  const versionActual = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version ?? 0;

  if (versionActual < 1) {
    db.exec(CREAR_TABLA);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cumpleaneros_nacimiento
        ON cumpleaneros (fecha_nacimiento);
      CREATE TABLE IF NOT EXISTS ajustes (
        clave TEXT PRIMARY KEY NOT NULL,
        valor TEXT NOT NULL
      );
    `);
  }

  // La condición es la existencia de la columna, no el número de versión.
  if (!tieneColumna(db, 'cumpleaneros', 'anio_desconocido')) {
    db.exec(`ALTER TABLE cumpleaneros ADD COLUMN anio_desconocido INTEGER NOT NULL DEFAULT 0`);
    db.prepare(
      `UPDATE cumpleaneros SET anio_desconocido = 1
         WHERE CAST(substr(fecha_nacimiento, 1, 4) AS INTEGER) >= ?`,
    ).run(ANIO_EN_CURSO);
  }

  db.exec(`PRAGMA user_version = ${versionEsquema}`);
}

function baseConFichas(fechas: [string, string, string][]): nodeSqlite.DatabaseSync {
  const db = new nodeSqlite.DatabaseSync(':memory:');
  db.exec(CREAR_TABLA);
  const insertar = db.prepare(
    `INSERT INTO cumpleaneros (nombre, apellido, fecha_nacimiento, notas, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, 'x', 'x')`,
  );
  for (const [nombre, apellido, fecha] of fechas) insertar.run(nombre, apellido, fecha, null);
  return db;
}

test('una instalación nueva nace con la columna y sin marcar nada', () => {
  const db = baseConFichas([]);
  migrar(db);

  assert.ok(tieneColumna(db, 'cumpleaneros', 'anio_desconocido'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cumpleaneros').get()!.n, 0);
});

test('una base dañada se repara sola aunque diga que ya está actualizada', () => {
  // El caso real: `user_version` valía 2 pero la columna nunca se creó, porque
  // la versión se subió antes de escribir el bloque de migración. Con la
  // condición por `user_version` la app no lo intentaba nunca más.
  const db = baseConFichas([
    ['Ana', 'Ruiz', `${ANIO_EN_CURSO}-05-15`],
    ['Luis', 'Soto', '2000-03-02'],
  ]);
  db.exec('PRAGMA user_version = 2');
  assert.ok(!tieneColumna(db, 'cumpleaneros', 'anio_desconocido'), ' precondition: base sin la columna');

  migrar(db);

  assert.ok(tieneColumna(db, 'cumpleaneros', 'anio_desconocido'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cumpleaneros').get()!.n, 2, 'no se pierde ninguna fila');
});

test('la reparación marca como desconocido solo a las fichas sin año real', () => {
  const db = baseConFichas([
    ['Ana', 'Ruiz', `${ANIO_EN_CURSO}-05-15`],
    ['Luis', 'Soto', '2000-03-02'],
  ]);
  db.exec('PRAGMA user_version = 2');
  migrar(db);

  const filas = db
    .prepare('SELECT nombre, anio_desconocido FROM cumpleaneros ORDER BY nombre')
    .all() as { nombre: string; anio_desconocido: number }[];

  // Con el año en curso, la regla antigua no distinguía este caso de un
  // cumpleaños sin año, así que se marca como desconocido.
  assert.equal(filas.find((f) => f.nombre === 'Ana')!.anio_desconocido, 1);
  // Un año real no se toca: es la edad que el usuario quiere ver.
  assert.equal(filas.find((f) => f.nombre === 'Luis')!.anio_desconocido, 0);
});

test('migrar dos veces no altera los datos ya guardados', () => {
  // La app abre la base en cada arranque, así que esto pasa constantemente.
  const db = baseConFichas([['Luis', 'Soto', '2000-03-02']]);
  migrar(db);

  db.prepare('UPDATE cumpleaneros SET anio_desconocido = 1 WHERE nombre = ?').run('Luis');
  migrar(db);

  // El cambio del usuario se respeta: la segunda pasada no lo revierte.
  assert.equal(db.prepare('SELECT anio_desconocido FROM cumpleaneros').get()!.anio_desconocido, 1);
});