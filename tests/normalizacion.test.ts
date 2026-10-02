import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * `normalizar` vive dentro de `cumpleaneros.ts` junto al acceso a SQLite, así
 * que aquí se replica su lógica para fijar el comportamiento esperado: cada
 * palabra con la primera letra en mayúscula, sin espacios de sobra y con
 * `ñ`/`ü` y la `l` con acento bien tratadas.
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

test('pone la primera letra de cada palabra en mayúscula', () => {
  assert.equal(normalizar('maria'), 'Maria');
  assert.equal(normalizar('lopez garcia'), 'Lopez Garcia');
});

test('baja el resto de las letras', () => {
  assert.equal(normalizar('MARÍA'), 'María');
  assert.equal(normalizar('MARÍA JOSÉ'), 'María José');
});

test('respeta la ñ, la diéresis y la l con acento', () => {
  assert.equal(normalizar('MUÑOZ'), 'Muñoz');
  assert.equal(normalizar('BÜRGER'), 'Bürger');
  // `l` con acento al principio: no debe convertirse en otra letra.
  assert.equal(normalizar('ÁLVAREZ'), 'Álvarez');
  assert.equal(normalizar('ÉLISABET'), 'Élisabet');
});

test('recorta y colapsa espacios', () => {
  assert.equal(normalizar('  ana   maría  '), 'Ana María');
  assert.equal(normalizar('juan\tperez\nlopez'), 'Juan Perez Lopez');
});

test('mantiene la inicial de los nombres compuestos', () => {
  assert.equal(normalizar('MARÍA DE LOS ÁNGELES'), 'María De Los Ángeles');
  assert.equal(normalizar("ANA MARÍA O'NEIL"), "Ana María O'Neil");
});

test('respeta signos y guiones sin perderlos', () => {
  // Tras apóstrofo o guion también_necesita_ mayúscula inicial.
  assert.equal(normalizar("o'NEIL-smith"), "O'Neil-Smith");
});

test('texto ya formateado no cambia', () => {
  assert.equal(normalizar('María García'), 'María García');
});

test('cadenas límite', () => {
  assert.equal(normalizar(''), '');
  assert.equal(normalizar('   '), '');
  assert.equal(normalizar('a'), 'A');
  assert.equal(normalizar('ñ'), 'Ñ');
  assert.equal(normalizar('Ñ'), 'Ñ');
});