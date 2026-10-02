import { test } from 'node:test';
import assert from 'node:assert/strict';

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * El script de versión.
 *
 * Escribir a mano `version` y `versionCode` es la forma más fácil de subir uno
 * y olvidar el otro, y de dejar el `versionCode` igual entre dos APK, que
 * vuelve indistinguibles dos APK distintas para quien ya tiene la app
 * instalada (y que Google Play rechaza de forma estricta). El script existe
 * para que eso no dependa de la memoria de nadie.
 *
 * Aquí se prueba sobre copias en un directorio temporal: el script recibe su
 * raíz por argumento, así que no toca el `app.config.ts` real del repositorio.
 */

const RAIZ_REPO = resolve(import.meta.dirname, '..');

/** Réplica de las dos funciones puras del script, para probarlas sin escribir. */
function subirVersion(actual: string, parte: 'patch' | 'minor' | 'major'): string {
  const [mayor, menor, parche] = actual.split('.').map(Number);
  if (parte === 'major') return `${mayor + 1}.0.0`;
  if (parte === 'minor') return `${mayor}.${menor + 1}.0`;
  return `${mayor}.${menor}.${parche + 1}`;
}

test('cada parte sube el número que corresponde', () => {
  assert.equal(subirVersion('1.0.0', 'patch'), '1.0.1');
  assert.equal(subirVersion('1.0.9', 'patch'), '1.0.10');
  assert.equal(subirVersion('1.0.0', 'minor'), '1.1.0');
  assert.equal(subirVersion('1.9.3', 'minor'), '1.10.0');
  assert.equal(subirVersion('1.0.0', 'major'), '2.0.0');
  // Cruzar una decade no debe dejar un 9 colgando: 1.9.9 -> 1.10.0.
  assert.equal(subirVersion('1.9.9', 'patch'), '1.9.10');
});

/** Prepara una copia del repositorio y devuelve la raíz temporal. */
function repoTemporal(): string {
  const raiz = mkdtempSync(join(tmpdir(), 'bday-version-'));
  const config = readFileSync(join(RAIZ_REPO, 'app.config.ts'), 'utf8');
  const pkg = readFileSync(join(RAIZ_REPO, 'package.json'), 'utf8');

  // Se parte siempre de 1.0.0 / 1 para que el resultado sea predecible.
  writeFileSync(
    join(raiz, 'app.config.ts'),
    config.replace(/^(\s*version:\s*)'[^']+'(\s*,)/m, "$1'1.0.0'$2").replace(
      /^(\s*versionCode:\s*)\d+(\s*,)/m,
      '$11$2',
    ),
  );
  const pkgObjeto = JSON.parse(pkg) as Record<string, unknown>;
  pkgObjeto.version = '1.0.0';
  writeFileSync(join(raiz, 'package.json'), `${JSON.stringify(pkgObjeto, null, 2)}\n`);
  return raiz;
}

/** Ejecuta el script sobre una raíz temporal. */
function ejecutar(raiz: string, ...args: string[]): string {
  // `--raiz` es imprescindible: sin él el script usaría su propia carpeta y
  // escribiría sobre el app.config.ts del repositorio, no sobre la copia.
  return execFileSync(
    process.execPath,
    ['--experimental-strip-types', join(RAIZ_REPO, 'scripts/version.ts'), ...args, '--raiz', raiz],
    { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

test('el script sube version y versionCode a la vez', () => {
  const raiz = repoTemporal();
  try {
    ejecutar(raiz, '--patch');

    const config = readFileSync(join(raiz, 'app.config.ts'), 'utf8');
    assert.match(config, /version:\s*'1\.0\.1'/);
    assert.match(config, /versionCode:\s*2,/);

    const pkg = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
    assert.equal(pkg.version, '1.0.1');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('el script no toca nada más de app.config.ts', () => {
  // Si el archivo se corrompe al reescribirlo, la app no arranca. Solo pueden
  // cambiar las dos líneas de versión.
  const raiz = repoTemporal();
  try {
    const antes = readFileSync(join(raiz, 'app.config.ts'), 'utf8');
    ejecutar(raiz, '--minor');
    const despues = readFileSync(join(raiz, 'app.config.ts'), 'utf8');

    const lineasDistintas = antes
      .split('\n')
      .map((linea, i) => (linea === despues.split('\n')[i] ? null : i))
      .filter((i) => i !== null);

    assert.equal(lineasDistintas.length, 2, `cambiaron ${lineasDistintas.length} líneas`);
    // Ni el nombre del paquete ni el resto de la config deben moverse.
    assert.match(despues, /package:\s*'com\.cumpleanos\.app'/);
    assert.match(despues, /slug:\s*'cumpleanos-apk'/);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('package.json conserva metadatos y dependencias', () => {
  // Se reescribe el archivo entero como JSON, así que conviene comprobar que
  // no se pierde nada por el camino.
  const raiz = repoTemporal();
  try {
    ejecutar(raiz, '--patch');
    const pkg = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')) as Record<string, unknown>;

    assert.equal(pkg.version, '1.0.1');
    assert.equal(pkg.private, true);
    assert.equal(pkg.license, 'GPL-3.0-only');
    assert.ok(pkg.repository, 'se pierde el repositorio');
    assert.ok(pkg.dependencies, 'se pierden las dependencias');
    assert.ok(pkg.devDependencies, 'se pierden las devDependencies');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('--dry-run muestra el cambio sin escribir nada', () => {
  const raiz = repoTemporal();
  try {
    const antes = readFileSync(join(raiz, 'app.config.ts'), 'utf8');
    const salida = ejecutar(raiz, '--patch', '--dry-run');

    assert.match(salida, /1\.0\.0 -> 1\.0\.1/);
    assert.match(salida, /versionCode 1 -> 2/);
    assert.equal(readFileSync(join(raiz, 'app.config.ts'), 'utf8'), antes, 'el archivo cambió');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('una opción desconocida se rechaza antes de escribir', () => {
  const raiz = repoTemporal();
  try {
    const antes = readFileSync(join(raiz, 'app.config.ts'), 'utf8');
    assert.throws(() => ejecutar(raiz, '--chirimbolo'));
    assert.equal(readFileSync(join(raiz, 'app.config.ts'), 'utf8'), antes);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('el versionCode siempre sube, nunca se queda igual', () => {
  // El fallo concreto que motiva el script: dos APK con el mismo número.
  const raiz = repoTemporal();
  try {
    const codigos: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      ejecutar(raiz, '--patch');
      const config = readFileSync(join(raiz, 'app.config.ts'), 'utf8');
      codigos.push(Number(config.match(/versionCode:\s*(\d+)/)![1]));
    }
    assert.deepEqual(codigos, [2, 3, 4]);
    assert.equal(new Set(codigos).size, codigos.length, 'hay versionCodes repetidos');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});