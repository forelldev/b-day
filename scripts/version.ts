#!/usr/bin/env node
/**
 * Sube la versión de la app de un tirón.
 *
 * Escribe a la vez `version` en `package.json` y `version` + `versionCode` en
 * `app.config.ts`, que es donde EAS la lee (`appVersionSource: 'local'`).
 *
 * Por qué existe: el `versionCode` es un entero que Android nunca deja bajar. Si
 * instalas encima una APK con un número menor, el sistema la rechaza con
 * `INSTALL_FAILED_VERSION_DOWNGRADE` y no hay forma de saber qué pasa si nadie
 * recuerda la regla. Además, dos APK distintas con el mismo número son
 * indistinguibles para quien ya tiene la app instalada, y las tiendas (Google
 * Play de forma estricta) rechazan una actualización que no lo suba.
 *
 * No puede usarse `autoIncrement` de EAS porque `app.config.ts` exporta una
 * función y la CLI necesita editar el archivo para escribir el número nuevo.
 *
 *   node --experimental-strip-types scripts/version.ts --patch
 *   node --experimental-strip-types scripts/version.ts --minor
 *   node --experimental-strip-types scripts/version.ts --major
 *
 * Opciones:
 *   --patch   1.0.0 -> 1.0.1   (por defecto)
 *   --minor   1.0.0 -> 1.1.0
 *   --major   1.0.0 -> 2.0.0
 *   --dry-run Muestra lo que haría sin escribir nada.
 *   --raiz D  Trabaja sobre otra carpeta. Lo usan los tests para no tocar el
 *              `app.config.ts` del repositorio.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


type Parte = 'patch' | 'minor' | 'major';

const argumentos = process.argv.slice(2);
const dryRun = argumentos.includes('--dry-run');
const OPCIONES = ['--patch', '--minor', '--major', '--dry-run'];
const parte: Parte =
  argumentos.includes('--major') ? 'major' : argumentos.includes('--minor') ? 'minor' : 'patch';

// `--raiz` lleva un valor detrás, así que se filtra de la comprobación.
const banderaRaiz = argumentos.indexOf('--raiz');
if (banderaRaiz !== -1) OPCIONES.push('--raiz');
if (
  argumentos.some(
    (a: string, i: number) =>
      a.startsWith('--') && !OPCIONES.includes(a) && i !== banderaRaiz + 1,
  )
) {
  console.error('Opción desconocida. Usa --patch, --minor, --major, --dry-run o --raiz.');
  process.exit(1);
}

/**
 * Carpeta del proyecto: la que contiene al script, salvo que se pase otra con
 * `--raiz`. Ese parámetro existe para que los tests escriban sobre una copia
 * temporal; sin él, probarlos modificaría el `app.config.ts` real.
 */
const RAIZ =
  banderaRaiz === -1
    ? resolve(dirname(fileURLToPath(import.meta.url)), '..')
    : resolve(argumentos[banderaRaiz + 1]);
const RUTA_CONFIG = resolve(RAIZ, 'app.config.ts');
const RUTA_PKG = resolve(RAIZ, 'package.json');

/** Suma 1, 2 o 3 a un número sin acabar en 9 al pasar de decade. */
function siguiente(valor: number): number {
  return valor + 1;
}

const textoConfig = readFileSync(RUTA_CONFIG, 'utf8');
const textoPkg = readFileSync(RUTA_PKG, 'utf8');

/** Extrae la versión y el versionCode actuales de `app.config.ts`. */
function leerConfig(texto: string): { version: string; versionCode: number } {
  const version = texto.match(/^\s*version:\s*'([^']+)'\s*,/m);
  const versionCode = texto.match(/^\s*versionCode:\s*(\d+)\s*,/m);
  if (!version || !versionCode) {
    console.error('No se encontró `version` o `versionCode` en app.config.ts.');
    process.exit(1);
  }
  // `process.exit` no estrecha el tipo para el typechecker, así que se repite
  // la comprobación con un `throw` que sí lo hace.
  if (version === null || versionCode === null) throw new Error('versión no encontrada');
  return { version: version[1], versionCode: Number(versionCode[1]) };
}

/** Sube `1.2.3` según la parte indicada. */
function subirVersion(actual: string, parte: Parte): string {
  const partes = actual.split('.');
  if (partes.length !== 3 || partes.some((p) => !/^\d+$/.test(p))) {
    console.error(`La versión "${actual}" no tiene el formato X.Y.Z.`);
    process.exit(1);
  }
  const [mayor, menor, parche] = partes.map(Number);
  if (parte === 'major') return `${siguiente(mayor)}.0.0`;
  if (parte === 'minor') return `${mayor}.${siguiente(menor)}.0`;
  return `${mayor}.${menor}.${siguiente(parche)}`;
}

const { version: versionActual, versionCode: codeActual } = leerConfig(textoConfig);
const versionNueva = subirVersion(versionActual, parte);
const codeNuevo = codeActual + 1;

console.log(`  version     ${versionActual} -> ${versionNueva}`);
console.log(`  versionCode ${codeActual} -> ${codeNuevo}`);

if (dryRun) {
  console.log('\n(--dry-run: no se ha escrito nada)');
  process.exit(0);
}

// `version` y `versionCode` de app.config.ts. Se sustituye solo la primera vez
// que aparece cada uno para no tocar otros usos del mismo número.
const configNuevo = textoConfig
  .replace(/^(\s*version:\s*)'[^']+'(\s*,)/m, `$1'${versionNueva}'$2`)
  .replace(/^(\s*versionCode:\s*)\d+(\s*,)/m, `$1${codeNuevo}$2`);

// `package.json` se edita como JSON para no romper el formato a mano.
const pkg = JSON.parse(textoPkg);
pkg.version = versionNueva;
writeFileSync(RUTA_PKG, `${JSON.stringify(pkg, null, 2)}\n`);

writeFileSync(RUTA_CONFIG, configNuevo);

console.log('\nActualizado app.config.ts y package.json.');
console.log('Recuerda subir los cambios a git antes de compilar.');