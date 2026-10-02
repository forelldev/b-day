import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COLORES_POR_DEFECTO,
  PALETAS,
  colorPorUrgencia,
  crearColores,
  esOscuro,
  iniciales,
  luminancia,
  mezclar,
  normalizarHex,
  textoSobre,
} from '../src/ui/tema.ts';

/**
 * Lógica de la paleta configurable. El usuario solo elige el color de la marca
 * y el del fondo; todo lo demás se deriva, así que lo que hay que comprobar es
 * que la derivación no rompe la legibilidad, sobre todo con fondos oscuros.
 */

test('normalizarHex acepta las dos formas y unifica el formato', () => {
  assert.equal(normalizarHex('#e8467c'), '#E8467C');
  assert.equal(normalizarHex('E8467C'), '#E8467C');
  assert.equal(normalizarHex('  #E8467C  '), '#E8467C');
  // Abreviatura de tres caracteres, tal y como la escribe el usuario.
  assert.equal(normalizarHex('#F0A'), '#FF00AA');
  assert.equal(normalizarHex('#abc'), '#AABBCC');
});

test('normalizarHex rechaza lo que no es un color', () => {
  assert.equal(normalizarHex(''), null);
  assert.equal(normalizarHex('rojo'), null);
  assert.equal(normalizarHex('#12345'), null);
  assert.equal(normalizarHex('#GGGGGG'), null);
});

test('mezclar interpola entre dos colores', () => {
  assert.equal(mezclar('#000000', '#FFFFFF', 0), '#000000');
  assert.equal(mezclar('#000000', '#FFFFFF', 1), '#FFFFFF');
  assert.equal(mezclar('#000000', '#FFFFFF', 0.5), '#808080');
  // Mezclar un color consigo mismo no lo mueve.
  assert.equal(mezclar('#E8467C', '#E8467C', 0.3), '#E8467C');
});

test('mezclar no se sale de los limites al pasar de 0 a 255', () => {
  assert.equal(mezclar('#FFFFFF', '#000000', 1.5), '#000000');
  assert.equal(mezclar('#000000', '#FFFFFF', -1), '#000000');
});

test('luminancia ordena de oscuro a claro', () => {
  assert.ok(luminancia('#000000') < luminancia('#808080'));
  assert.ok(luminancia('#808080') < luminancia('#FFFFFF'));
  assert.ok(esOscuro('#17131A'));
  assert.ok(!esOscuro('#FDF7F9'));
});

test('textoSobre elige un color legible', () => {
  assert.equal(textoSobre('#FFFFFF'), '#1F1520');
  assert.equal(textoSobre('#17131A'), '#FFFFFF');
});

test('crearColores mantiene el color elegido y deriva el resto', () => {
  const c = crearColores('#7C4DFF', '#F6F4FF');
  assert.equal(c.marca, '#7C4DFF');
  assert.equal(c.fondo, '#F6F4FF');
  // La marca oscura y la suave tienen que seguir siendo Derivatives de la
  // marca: si fueran fijas, cambiar el color de botones no cambiaría nada más.
  assert.notEqual(c.marcaOscura, '#B32D5A');
  assert.notEqual(c.marcaOscura, c.marca);
  assert.notEqual(c.marcaSuave, c.marca);
  assert.notEqual(c.marcaSuave, c.marcaOscura);
});

test('crearColores con fondo oscuro aclara textos y superficies', () => {
  const c = crearColores('#F26D9E', '#17131A');
  // Sobre fondo oscuro el texto tiene que ser claro o no se lee.
  assert.ok(luminancia(c.texto) > 0.5, 'el texto debe ser claro');
  assert.ok(luminancia(c.superficie) > luminancia(c.fondo), 'la tarjeta debe verse sobre el fondo');
  assert.ok(luminancia(c.textoSuave) > luminancia(c.textoTenue), 'el texto suave debe verse más');
});

test('crearColores con fondo claro mantiene el texto oscuro', () => {
  const c = crearColores('#E8467C', '#FDF7F9');
  assert.ok(luminancia(c.texto) < 0.2);
  assert.equal(c.superficie, '#FFFFFF');
});

test('crearColores cae en los valores por defecto si el color es inválido', () => {
  const c = crearColores('no es un color', 'tampoco');
  assert.equal(c.marca, COLORES_POR_DEFECTO.marca);
  assert.equal(c.fondo, COLORES_POR_DEFECTO.fondo);
});

test('todas las paletas ofrecen colores válidos y distinguibles entre sí', () => {
  const marcas = new Set<string>();
  for (const paleta of PALETAS) {
    assert.ok(normalizarHex(paleta.marca), `marca inválida: ${paleta.marca}`);
    assert.ok(normalizarHex(paleta.fondo), `fondo inválida: ${paleta.fondo}`);
    // Marca y fondo pueden coincidir (blanco sobre blanco), pero dos muestras
    // con el mismo color de botón no distinguished al usuario.
    assert.ok(!marcas.has(paleta.marca.toUpperCase()), `${paleta.nombre} repite marca`);
    marcas.add(paleta.marca.toUpperCase());
  }
  // La primera es la que se usa por defecto, así que tiene que coincidir.
  assert.equal(PALETAS[0].marca, COLORES_POR_DEFECTO.marca);
  assert.equal(PALETAS[0].fondo, COLORES_POR_DEFECTO.fondo);
  assert.ok(PALETAS.length >= 8);
});

test('la muestra blanca tiene un color de texto que se ve sobre ella', () => {
  const blanco = PALETAS.find((p) => p.nombre === 'Blanco');
  assert.ok(blanco, 'debe existir la paleta blanca');
  // Sobre blanco el texto tiene que ser oscuro, o el check de selección
  // desaparecería igual que la propia muestra.
  assert.equal(textoSobre(blanco.marca), '#1F1520');
});

test('crearColores con marca blanca sigue siendo utilizable', () => {
  const c = crearColores('#FFFFFF', '#FDF7F9');
  // El texto sobre el botón blanco tiene que poder leerse.
  assert.equal(textoSobre(c.marca), '#1F1520');
  assert.notEqual(c.marcaOscura, c.marca);
  assert.ok(luminancia(c.marcaSuave) > 0.9);
});

test('la paleta por defecto se parece a la de siempre', () => {
  const c = crearColores(COLORES_POR_DEFECTO.marca, COLORES_POR_DEFECTO.fondo);
  assert.equal(c.marca, '#E8467C');
  assert.equal(c.fondo, '#FDF7F9');
});

test('colorPorUrgencia sigue la paleta activa', () => {
  const porDefecto = crearColores(COLORES_POR_DEFECTO.marca, COLORES_POR_DEFECTO.fondo);
  const lila = crearColores('#7C4DFF', '#F6F4FF');

  // "Mañana" se pinta con la marca, así que su pastilla cambia con ella.
  assert.equal(colorPorUrgencia(1, lila).pastilla, '#7C4DFF');
  assert.notEqual(colorPorUrgencia(1, lila).pastilla, colorPorUrgencia(1, porDefecto).pastilla);
  assert.notEqual(colorPorUrgencia(1, lila).fondo, colorPorUrgencia(1, porDefecto).fondo);

  // Éxito, aviso y "queda lejos" no dependen de la marca.
  for (const dias of [0, 3, 40]) {
    assert.equal(colorPorUrgencia(dias, lila).fondo, colorPorUrgencia(dias, porDefecto).fondo);
    assert.equal(colorPorUrgencia(dias, lila).texto, colorPorUrgencia(dias, porDefecto).texto);
  }
});

test('iniciales saca la primera letra de nombre y apellido', () => {
  assert.equal(iniciales('María', 'García'), 'MG');
  assert.equal(iniciales('  ana ', ' lopez '), 'AL');
  assert.equal(iniciales('m', 'n'), 'MN');
});