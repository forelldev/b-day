import { test } from 'node:test';
import assert from 'node:assert/strict';

import { esBisiesto, parseFechaCumple, formatearFechaCumple, proximoCumple } from '../src/utils/date.ts';

/**
 * Lógica del selector de cumpleaños: el día se recorta al último que existe en
 * el mes y el año elegido. Se replica aquí porque vive dentro del componente
 * visual, que no se puede importar en el runner de Node.
 */

/** Días del mes, con `mes` de 1 a 12. */
function diasDelMes(mes: number, anio: number): number {
  return new Date(anio, mes, 0).getDate();
}

/** Reproduce el `confirmar` del componente. */
function confirmar(nuevoDia: number, nuevoMes: number, nuevoAnio: number): Date {
  const limite = diasDelMes(nuevoMes + 1, nuevoAnio);
  const diaValido = Math.min(nuevoDia, limite);
  return new Date(nuevoAnio, nuevoMes, diaValido);
}

test('confirma el día y el mes tal cual', () => {
  const f = confirmar(15, 5, 1990); // junio
  assert.equal(f.getFullYear(), 1990);
  assert.equal(f.getMonth(), 5);
  assert.equal(f.getDate(), 15);
});

test('recorta el día cuando el mes es más corto', () => {
  // 31 de febrero no existe: el selector debe correcciónalo a 28/29.
  assert.equal(confirmar(31, 1, 2001).getDate(), 28);
  assert.equal(confirmar(31, 1, 2000).getDate(), 29);
  assert.equal(confirmar(31, 3, 1990).getDate(), 30); // abril
  assert.equal(confirmar(31, 0, 1990).getDate(), 31); // enero, sí tiene 31
});

test('el 29 de febrero se guarda como 28 en años no bisiestos', () => {
  assert.equal(confirmar(29, 1, 1900).getDate(), 28); // 1900 no es bisiesto
  assert.equal(confirmar(29, 1, 2024).getDate(), 29); // 2024 sí lo es
});

test('acepta fechas futuras a propósito', () => {
  // Lo que se guarda es un cumpleaños, no una cita: el año 2026 y los siguientes
  // son válidos aunque todavía no hayan llegado.
  const f = confirmar(10, 11, 2030); // diciembre de 2030
  assert.equal(f.getFullYear(), 2030);
  const iso = formatearFechaCumple({ anio: 2030, mes: 12, dia: 10 });
  assert.equal(iso, '2030-12-10');
  assert.deepEqual(parseFechaCumple(iso), { anio: 2030, mes: 12, dia: 10 });
});

test('un cumpleaños sin año real (2026) se agenda cada año', () => {
  const iso = '2026-03-15';
  const { dia, mes } = parseFechaCumple(iso);
  // Da igual el año guardado: el cumpleaños se repite el mismo día y mes.
  assert.equal(dia, 15);
  assert.equal(mes, 3);
});

test('la edad no se calcula si el año guardado no es real', () => {
  // Con el año actual o posterior la edad no significa nada, así que el
  // formulario la oculta. Se comprueba aquí que el año se conserva para que la
  // agenda siga funcionando.
  const anioActual = new Date().getFullYear();
  const iso = formatearFechaCumple({ anio: anioActual, mes: 6, dia: 1 });
  assert.equal(iso, `${anioActual}-06-01`);
});

test('esBisiesto coincide con el calendario gregoriano', () => {
  assert.equal(esBisiesto(2024), true);
  assert.equal(esBisiesto(2026), false);
  assert.equal(esBisiesto(1900), false);
  assert.equal(esBisiesto(2000), true);
});

test('proximoCumple funciona con años futuros', () => {
  const cumple = proximoCumple('2030-07-20');
  assert.equal(cumple.getMonth(), 6);
  assert.equal(cumple.getDate(), 20);
  assert.ok(cumple.getFullYear() >= new Date().getFullYear());
});