import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  OFFSETS,
  OFFSETS_SOLO_HOY,
  cumpleanerosParaCelebrar,
  necesitaReconstruirAgenda,
  diasHastaFinDeSemana,
  indiceDiaSemana,
  semanaDelCumple,
  textoEdadAviso,
  textoEdadTarjeta,
  zonaHorariaActual,
  cumpleEnAnio,
  cumpleHoyPeroHoraPasada,
  diasDelMes,
  diasParaCumple,
  edadDeducible,
  edadEnCumpleDelAviso,
  edadEnProximoCumple,
  edadActual,
  esBisiesto,
  formatearFechaCumple,
  hoyIso,
  inicioDelDia,
  instanteRecordatorio,
  instanteRecordatorioSiguienteCiclo,
  numeroDeDia,
  parseFechaCumple,
  parseHora,
  proximoCumple,
  proximoInstanteRecordatorio,
  textoCuentaAtras,
  type OffsetDias,
} from '../src/utils/date.ts';

const HORA = 9;
const MIN = 0;

/** Formato corto para comparar: "2027-03-12 09:00". */
const fmt = (d: Date) =>
  `${formatearFechaCumple({
    anio: d.getFullYear(),
    mes: d.getMonth() + 1,
    dia: d.getDate(),
  })} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
test('esBisiesto sigue el calendario gregoriano', () => {
  assert.equal(esBisiesto(2024), true);
  assert.equal(esBisiesto(2026), false);
  assert.equal(esBisiesto(1900), false, '1900 no es bisiesto (divisible por 100)');
  assert.equal(esBisiesto(2000), true, '2000 sí es bisiesto (divisible por 400)');
});

test('parseFechaCumple acepta fechas válidas y rechaza imposibles', () => {
  assert.deepEqual(parseFechaCumple('1990-03-12'), { anio: 1990, mes: 3, dia: 12 });
  assert.throws(() => parseFechaCumple('1990-02-31'));
  assert.throws(() => parseFechaCumple('12/03/1990'));
  assert.throws(() => parseFechaCumple('ayer'));
});

test('parseHora valida el rango', () => {
  assert.deepEqual(parseHora('09:00'), { hora: 9, minuto: 0 });
  assert.deepEqual(parseHora('23:59'), { hora: 23, minuto: 59 });
  assert.equal(parseHora('24:00'), null);
  assert.equal(parseHora('9:99'), null);
  assert.equal(parseHora('nope'), null);
});

test('el 29 de febrero se celebra el 28 en años no bisiestos', () => {
  assert.equal(fmt(cumpleEnAnio('1992-02-29', 2028)), '2028-02-29 00:00');
  assert.equal(fmt(cumpleEnAnio('1992-02-29', 2027)), '2027-02-28 00:00');
  assert.equal(fmt(cumpleEnAnio('1992-02-29', 2026)), '2026-02-28 00:00');
});

test('el resto de fechas no se ven afectadas por años bisiestos', () => {
  assert.equal(fmt(cumpleEnAnio('1990-01-01', 2027)), '2027-01-01 00:00');
  assert.equal(fmt(cumpleEnAnio('1990-03-01', 2027)), '2027-03-01 00:00');
  assert.equal(fmt(cumpleEnAnio('1990-12-31', 2027)), '2027-12-31 00:00');
  // 28 de febrero se mantiene siempre: no se convierte en 29.
  assert.equal(fmt(cumpleEnAnio('1990-02-28', 2027)), '2027-02-28 00:00');
});

test('proximoCumple devuelve hoy mismo cuando hoy es el cumpleaños', () => {
  const hoy = new Date(2027, 2, 12, 23, 59);
  assert.equal(fmt(proximoCumple('1990-03-12', hoy)), '2027-03-12 00:00');
});

test('proximoCumple salta al año siguiente cuando ya pasó', () => {
  const manana = new Date(2027, 2, 13, 8, 0);
  assert.equal(fmt(proximoCumple('1990-03-12', manana)), '2028-03-12 00:00');
});

test('diasParaCumple cuenta bien a través de fin de año', () => {
  // 31 dic → 1 ene
  assert.equal(diasParaCumple('1990-01-01', new Date(2026, 11, 31, 12, 0)), 1);
  assert.equal(diasParaCumple('1990-12-31', new Date(2026, 11, 30, 12, 0)), 1);
  assert.equal(diasParaCumple('1990-12-31', new Date(2026, 11, 31, 12, 0)), 0);
  assert.equal(diasParaCumple('1990-01-01', new Date(2026, 11, 29, 12, 0)), 3);
});

test('diasParaCumple no se rompe por el cambio de hora de verano', () => {
  // Este test solo es significativo en una zona con horario de verano, así
  // que se ejecuta en un subproceso con TZ forzada (ver test más abajo).
  const antesDelCambio = new Date(2027, 2, 26, 23, 30);
  assert.equal(diasParaCumple('1990-03-28', antesDelCambio), 2);

  const elDiaDelCumple = new Date(2027, 2, 28, 12, 0);
  assert.equal(diasParaCumple('1990-03-28', elDiaDelCumple), 0);

  const diaDespues = new Date(2027, 2, 29, 12, 0);
  assert.equal(diasParaCumple('1990-03-28', diaDespues), 365);
});

test('edadEnProximoCumple tiene en cuenta el año ya cumplido', () => {
  assert.equal(edadEnProximoCumple('1990-03-12', new Date(2027, 2, 12, 10, 0)), 37);
  assert.equal(edadEnProximoCumple('1990-03-12', new Date(2027, 2, 13, 10, 0)), 38);
  // Recién nacido: en su primer cumpleaños cumple 0.
  assert.equal(edadEnProximoCumple('2027-03-12', new Date(2027, 2, 1, 10, 0)), 0);
});

test('edadActual cuenta los años cumplidos a día', () => {
  // Un día antes de cumplir años todavía tiene la edad anterior.
  assert.equal(edadActual('1990-03-12', new Date(2026, 2, 11, 10, 0)), 35);
  // El mismo día ya ha cumplido.
  assert.equal(edadActual('1990-03-12', new Date(2026, 2, 12, 0, 1)), 36);
  assert.equal(edadActual('1990-03-12', new Date(2026, 2, 12, 23, 59)), 36);
  // Un día después sigue con la edad nueva.
  assert.equal(edadActual('1990-03-12', new Date(2026, 2, 13, 10, 0)), 36);
});

test('edadActual no se adelanta al cumpleaños que aún no ha llegado', () => {
  // Hoy es marzo y cumple en mayo: aún no ha cumplido este año.
  assert.equal(edadActual('1990-05-20', new Date(2026, 2, 1, 10, 0)), 35);
  // Ya pasó su cumpleaños en enero: este año sí cuenta.
  assert.equal(edadActual('1990-01-20', new Date(2026, 2, 1, 10, 0)), 36);
});

test('edadActual no anticipa la edad del próximo cumpleaños', () => {
  // Caso reportado: 11/04/2003 con hoy 02/10/2026. Ya cumplió 23 en abril, así
  // que tiene 23 años, aunque su próximo cumpleaños sea el de 24.
  const hoy = new Date(2026, 9, 2);
  assert.equal(edadActual('2003-04-11', hoy), 23);
  // La edad del próximo cumpleaños sí es una más, que es lo que se muestra al
  // editar, donde el verbo "cumple" sí encaja.
  assert.equal(edadEnProximoCumple('2003-04-11', hoy), 24);
  // Y al día siguiente de su cumpleaños tampoco se adelanta.
  assert.equal(edadActual('2003-04-12', hoy), 23);
});

test('la edad que se muestra y la que se cumplirá son consecutivas', () => {
  // Lo que la lista pinta es "Edad: 23 años · Cumplirá: 24 años": la edad de hoy y la del
  // próximo cumpleaños, que siempre es una mayor.
  const hoy = new Date(2026, 9, 2);
  const edad = edadActual('2003-04-11', hoy);
  assert.equal(edad, 23);
  assert.equal(edadEnProximoCumple('2003-04-11', hoy), 24);
});

test('un niño que cumple un año da 0 y 1', () => {
  // La tarjeta pinta "Edad: 0 años · Cumplirá: 1 año": el segundo número es el único
  // que va en singular, y sale de sumar uno a la edad de hoy.
  const anio = new Date().getFullYear() - 1;
  const hoy = new Date(2026, 5, 15); // después de su cumpleaños de junio
  assert.equal(edadActual(`${anio}-06-01`, hoy), 1);
  assert.equal(edadEnProximoCumple(`${anio}-06-01`, hoy), 2);

  const antes = new Date(2026, 2, 15); // antes de cumplir
  assert.equal(edadActual(`${anio}-06-01`, antes), 0);
  assert.equal(edadEnProximoCumple(`${anio}-06-01`, antes), 1);
});

test('edadActual respeta el cambio de año', () => {
  assert.equal(edadActual('1990-12-31', new Date(2026, 0, 1, 10, 0)), 35);
  assert.equal(edadActual('1990-01-01', new Date(2026, 0, 1, 10, 0)), 36);
});

test('un bebé nacido este año tiene una edad real de 0 años', () => {
  // El año igual al actual ya no se descarta: un bebé que nació este año
  // cumple años de verdad, y ese 0 no es un dato inventado. Lo que marca el
  // cumpleaños sin año es la casilla, no la cifra.
  assert.equal(edadActual('2026-03-12', new Date(2026, 2, 1, 10, 0)), 0);
  assert.equal(edadActual('2026-01-05', new Date(2026, 5, 1, 10, 0)), 0);
  // Después de su cumpleaños, ya va por 1.
  assert.equal(edadActual('2026-01-05', new Date(2027, 5, 1, 10, 0)), 1);
});

test('solo un año posterior a hoy es un dato imposible', () => {
  // Nadie puede nacer en 2027 estando en 2026, así que ahí sí no hay edad.
  assert.equal(edadActual('2030-03-12', new Date(2026, 2, 1, 10, 0)), null);
  assert.equal(edadActual('2027-01-05', new Date(2026, 11, 1, 10, 0)), null);
  // En cuanto el año es pasado, la edad vuelve a ser fiable.
  assert.equal(edadActual('2025-01-05', new Date(2026, 5, 1, 10, 0)), 1);
});

test('la casilla de año desconocido es lo que apaga la edad, no la cifra', () => {
  // Es la clave de todo el cambio: con la misma fecha guardada, "nació este año"
  // y "no sé el año" se comportan distinto según la casilla.
  const bebe = '2026-01-05';
  const hoy = new Date(2026, 5, 1, 10, 0);
  assert.equal(edadDeducible(bebe, false, hoy), 0);
  assert.equal(edadDeducible(bebe, true, hoy), null);
  assert.equal(textoEdadTarjeta(edadDeducible(bebe, false, hoy), 5), 'Edad: 0 años · Cumplirá: 1 año');
  assert.equal(textoEdadTarjeta(edadDeducible(bebe, true, hoy), 5), '');
});

test('edadActual aguanta el 29 de febrero', () => {
  // El 29 de febrero solo hay unos años; el resto se celebra el 28.
  assert.equal(edadActual('2024-02-29', new Date(2026, 1, 28, 10, 0)), 1);
  assert.equal(edadActual('2024-02-29', new Date(2026, 1, 29, 10, 0)), 2);
});

test('instanteRecordatorio cruza meses y años correctamente', () => {
  const cumple = new Date(2027, 2, 1, 0, 0, 0, 0); // 1 de marzo
  assert.equal(fmt(instanteRecordatorio(cumple, -2, HORA, MIN)), '2027-02-27 09:00');
  assert.equal(fmt(instanteRecordatorio(cumple, -1, HORA, MIN)), '2027-02-28 09:00');
  assert.equal(fmt(instanteRecordatorio(cumple, 0, HORA, MIN)), '2027-03-01 09:00');
  assert.equal(fmt(instanteRecordatorio(cumple, 1, HORA, MIN)), '2027-03-02 09:00');
});

test('los cuatro avisos cubren siempre una ventana de 4 días', () => {
  const cumple = new Date(2027, 11, 31, 0, 0, 0, 0); // 31 dic: el +1 cae en enero
  assert.equal(fmt(instanteRecordatorio(cumple, -2, HORA, MIN)), '2027-12-29 09:00');
  assert.equal(fmt(instanteRecordatorio(cumple, 1, HORA, MIN)), '2028-01-01 09:00');
});

test('proximoInstanteRecordatorio agenda hacia adelante, nunca hacia atrás', () => {
  // Faltan 2 días para un cumpleaños y la hora de aviso (16:00) aún no ha
  // llegado: el aviso de "2 días antes" debe salir hoy.
  const ahora = new Date(2027, 2, 10, 14, 30);
  assert.equal(
    fmt(proximoInstanteRecordatorio('1990-03-12', -2, 16, 0, ahora)),
    '2027-03-10 16:00',
  );

  // Si ya pasó la hora del aviso de "2 días antes" (09:00), no se puede
  // programar hacia atrás: salta al año siguiente.
  const tardeAntes = new Date(2027, 2, 10, 10, 0);
  assert.equal(
    fmt(proximoInstanteRecordatorio('1990-03-12', -2, HORA, MIN, tardeAntes)),
    '2028-03-10 09:00',
  );
});

test('proximoInstanteRecordatorio usa la fecha real cuando el cumple es hoy', () => {
  const ahora = new Date(2027, 2, 12, 8, 0); // 08:00, el aviso es a las 09:00
  assert.equal(
    fmt(proximoInstanteRecordatorio('1990-03-12', 0, HORA, MIN, ahora)),
    '2027-03-12 09:00',
    'aún falta para el aviso de hoy',
  );

  const tarde = new Date(2027, 2, 12, 10, 0); // 10:00, el aviso ya pasó
  assert.equal(
    fmt(proximoInstanteRecordatorio('1990-03-12', 0, HORA, MIN, tarde)),
    '2028-03-12 09:00',
    'el aviso de hoy ya no cabe: va para el año que viene',
  );
});

test('proximoInstanteRecordatorio con cumpleaños el 29 de febrero', () => {
  // Hoy es 1 de marzo de 2028 (bisiesto): el próximo cumple real es 28 feb 2029.
  const ahora = new Date(2028, 2, 1, 12, 0);
  assert.equal(
    fmt(proximoInstanteRecordatorio('1992-02-29', 0, HORA, MIN, ahora)),
    '2029-02-28 09:00',
  );
});

test('con los avisos apagados solo queda el del propio día', () => {
  // Lo que hace el interruptor de Ajustes: el aviso del día sigue saliendo,
  // los de antes y después no.
  assert.deepEqual([...OFFSETS_SOLO_HOY], [0]);
  assert.ok(OFFSETS_SOLO_HOY.includes(0));
  assert.ok(!OFFSETS_SOLO_HOY.includes(-1));
  assert.ok(!OFFSETS_SOLO_HOY.includes(-2));
  assert.ok(!OFFSETS_SOLO_HOY.includes(1));
});

test('OFFSETS_SOLO_HOY es un subconjunto de OFFSETS', () => {
  for (const o of OFFSETS_SOLO_HOY) assert.ok(OFFSETS.includes(o));
  assert.ok(OFFSETS_SOLO_HOY.length < OFFSETS.length);
});

test('los cuatro avisos de una persona son distintos entre sí', () => {
  const ahora = new Date(2027, 5, 15, 8, 0);
  const fechas = OFFSETS.map((offset: OffsetDias) =>
    proximoInstanteRecordatorio('1990-07-20', offset, HORA, MIN, ahora).getTime(),
  );
  assert.equal(new Set(fechas).size, OFFSETS.length, 'ningún aviso duplica a otro');
  for (const f of fechas) {
    assert.ok(f > ahora.getTime(), 'ningún aviso queda en el pasado');
  }
});

test('el ciclo siguiente queda más adelante que el actual', () => {
  const ahora = new Date(2027, 5, 15, 8, 0);
  for (const offset of OFFSETS) {
    const actual = proximoInstanteRecordatorio('1990-07-20', offset, HORA, MIN, ahora);
    const siguiente = instanteRecordatorioSiguienteCiclo('1990-07-20', offset, HORA, MIN, ahora);
    assert.ok(
      siguiente.getTime() > actual.getTime(),
      `el aviso de ${offset} días del siguiente ciclo debe ir después`,
    );
    // Entre el Cumple de 2027 y el de 2028 cae el 29 de febrero de 2028.
    const dias = numeroDeDia(siguiente) - numeroDeDia(actual);
    assert.ok(dias === 365 || dias === 366, `diferencia inesperada: ${dias} días`);
  }
});

test('el ciclo siguiente no se solapa con el actual cuando el aviso ya pasó', () => {
  // Cumple hoy y la hora de aviso ya pasó: el aviso actual salta al año que
  // viene, así que el ciclo siguiente debe caer un año más allá.
  const ahora = new Date(2027, 2, 12, 10, 0);
  const actual = proximoInstanteRecordatorio('1990-03-12', 0, HORA, MIN, ahora);
  const siguiente = instanteRecordatorioSiguienteCiclo('1990-03-12', 0, HORA, MIN, ahora);
  assert.equal(fmt(actual), '2028-03-12 09:00');
  assert.equal(fmt(siguiente), '2029-03-12 09:00');
  assert.notEqual(actual.getTime(), siguiente.getTime());
});

test('cumpleHoyPeroHoraPasada solo es cierto el día del cumpleaños', () => {
  const mananaDelCumple = new Date(2027, 2, 11, 23, 0);
  assert.equal(cumpleHoyPeroHoraPasada('1990-03-12', 0, HORA, MIN, mananaDelCumple), false);

  const hoyAntesDeHora = new Date(2027, 2, 12, 8, 59);
  assert.equal(cumpleHoyPeroHoraPasada('1990-03-12', 0, HORA, MIN, hoyAntesDeHora), false);

  const hoyDespuesDeHora = new Date(2027, 2, 12, 9, 1);
  assert.equal(cumpleHoyPeroHoraPasada('1990-03-12', 0, HORA, MIN, hoyDespuesDeHora), true);
});

test('la hora configurada se respeta exactamente', () => {
  const cumple = new Date(2027, 2, 12, 0, 0, 0, 0);
  assert.equal(fmt(instanteRecordatorio(cumple, 0, 20, 45)), '2027-03-12 20:45');
  assert.equal(fmt(instanteRecordatorio(cumple, 0, 0, 0)), '2027-03-12 00:00');
  assert.equal(fmt(instanteRecordatorio(cumple, 0, 23, 59)), '2027-03-12 23:59');
});

test('utilidades de apoyo', () => {
  assert.equal(diasDelMes(2027, 2), 28);
  assert.equal(diasDelMes(2028, 2), 29);
  assert.equal(inicioDelDia(new Date(2027, 2, 12, 17, 45, 30)).getHours(), 0);
  assert.equal(hoyIso(new Date(2027, 2, 12, 23, 0)), '2027-03-12');
  assert.equal(hoyIso(new Date(2027, 0, 1, 0, 0)), '2027-01-01');
  assert.equal(textoCuentaAtras(0), '¡Hoy es su cumpleaños!');
  assert.equal(textoCuentaAtras(1), 'Mañana');
  assert.equal(textoCuentaAtras(5), 'En 5 días');
  assert.equal(textoCuentaAtras(-1), 'Ayer');
});
// ---------------------------------------------------------------------------
// El conteo de días tiene que ser immune al cambio de hora. Este bloque se
// ejecuta en subprocesos con TZ forzada, porque la máquina de CI puede no
// tener horario de verano en absoluto.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RUTA_DATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'utils', 'date.ts');

const ZONAS = [
  'Europe/Madrid', // DST en marzo y octubre
  'America/Santiago', // DST en septiembre y abril, y año sin febrero bisiesto
  'Australia/Lord_Howe', // media hora de DST
  'UTC',
  'Pacific/Chatham', // +12:45 y +13:45
];

for (const zona of ZONAS) {
  test(`la cuenta atrás es correcta con la zona horaria ${zona}`, () => {
    const guion = `
      import assert from 'node:assert/strict';
      import { cumpleEnAnio, diasParaCumple, instanteRecordatorio, numeroDeDia } from ${JSON.stringify(RUTA_DATE)};
      const dia = (d) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      assert.equal(dia(new Date()), dia(new Date()), 'TZ aplicada');

      // Cruza el cambio a horario de verano (final de marzo en el hemisferio norte).
      assert.equal(diasParaCumple('1990-03-30', new Date(2027, 2, 27, 23, 30)), 3);
      assert.equal(diasParaCumple('1990-03-28', new Date(2027, 2, 28, 12, 0)), 0);
      assert.equal(diasParaCumple('1990-03-28', new Date(2027, 2, 29, 12, 0)), 365);
      assert.equal(diasParaCumple('1990-03-28', new Date(2027, 2, 26, 0, 30)), 2);
      assert.equal(diasParaCumple('1990-01-01', new Date(2026, 11, 31, 23, 0)), 1);

      // Cruza el cambio de horario de otoño.
      assert.equal(diasParaCumple('1990-10-28', new Date(2027, 9, 25, 12, 0)), 3);
      assert.equal(diasParaCumple('1990-10-28', new Date(2027, 9, 28, 12, 0)), 0);

      // Un aviso a las 02:30 puede caer en un día que no existe por el cambio
      // de hora: debe normalizarse a una hora válida, nunca a una fecha inválida.
      const r = instanteRecordatorio(new Date(2027, 2, 27, 0, 0), 0, 2, 30);
      assert.ok(Number.isFinite(r.getTime()));
      assert.equal(dia(r), '2027-03-27');
      assert.equal(numeroDeDia(r), numeroDeDia(new Date(2027, 2, 27, 0, 0)));

      // Un cumpleaños a medianoche sigue en su día con cualquier desplazamiento.
      const med = instanteRecordatorio(new Date(2027, 2, 27, 0, 0), 0, 0, 0);
      assert.equal(dia(med), '2027-03-27');

      // El 29 de febrero se celebra el 28 en años no bisiestos, también aquí.
      assert.equal(dia(cumpleEnAnio('1992-02-29', 2027)), '2027-02-28');
      assert.equal(dia(cumpleEnAnio('1992-02-29', 2028)), '2028-02-29');
    `;
    execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', guion], {
      env: { ...process.env, TZ: zona },
      stdio: 'pipe',
    });
  });
}

test('con los avisos desactivados no se celebra ni el cumpleaños de hoy', () => {
  // El interruptor de Ajustes tiene que mandar también sobre el aviso
  // inmediato. Antes, abrir la app con los avisos apagados igual te mandaba la
  // felicitación del día.
  const ahora = new Date(2026, 9, 2, 14, 0); // 2 oct, 14:00
  const fechas = ['2003-10-02', '1990-10-03'];

  // Con avisos activos: el de hoy, cuya hora (09:00) ya pasó, se celebra.
  assert.deepEqual(cumpleanerosParaCelebrar(fechas, 9, 0, true, ahora), ['2003-10-02']);

  // Con avisos apagados: nada, ni siquiera el de hoy.
  assert.deepEqual(cumpleanerosParaCelebrar(fechas, 9, 0, false, ahora), []);
});

test('no se celebra si la hora del aviso todavía no ha llegado', () => {
  const ahora = new Date(2026, 9, 2, 7, 30); // 2 oct, 07:30
  // El aviso de hoy a las 09:00 se puede programar normal, así que no hace
  // falta mandarlo de inmediato.
  assert.deepEqual(cumpleanerosParaCelebrar(['2003-10-02'], 9, 0, true, ahora), []);
  // Y si la hora ya pasó, sí.
  const despues = new Date(2026, 9, 2, 10, 0);
  assert.deepEqual(cumpleanerosParaCelebrar(['2003-10-02'], 9, 0, true, despues), ['2003-10-02']);
});

test('no se celebra ningún cumpleaños que no sea hoy', () => {
  const ahora = new Date(2026, 9, 2, 14, 0);
  assert.deepEqual(cumpleanerosParaCelebrar(['1990-10-03'], 9, 0, true, ahora), []);
  assert.deepEqual(cumpleanerosParaCelebrar([], 9, 0, true, ahora), []);
});

// --- Zona horaria -----------------------------------------------------------
// La app no pide permiso de ubicación: usa la zona que Android ya tiene
// configurada. Estos tests fijan la invariante que lo hace posible.

test('cambiar de día obliga a rehacer la agenda', () => {
  const r = necesitaReconstruirAgenda('2026-10-02', 'Europe/Madrid', '2026-10-03', 'Europe/Madrid');
  assert.equal(r.diaNuevo, true);
  assert.equal(r.cambioZona, false);
  assert.equal(r.reconstruir, true);
});

test('viajar a otro país rehace la agenda aunque siga siendo el mismo día', () => {
  // El caso que se añadió: el usuario deja la app abierta y vuela de Chile a
  // España. Los avisos ya agendados se calcularon con la zona anterior, así que
  // hay que rehaclos aunque sea el mismo día.
  const r = necesitaReconstruirAgenda('2026-10-02', 'America/Santiago', '2026-10-02', 'Europe/Madrid');
  assert.equal(r.cambioZona, true);
  assert.equal(r.diaNuevo, false);
  assert.equal(r.reconstruir, true);
});

test('un viaje que cruza la medianoche cuenta como día nuevo y cambio de zona', () => {
  // De Chile a Japón la fecha local puede ir hacia delante.
  const r = necesitaReconstruirAgenda('2026-10-02', 'America/Santiago', '2026-10-03', 'Asia/Tokyo');
  assert.equal(r.diaNuevo, true);
  assert.equal(r.cambioZona, true);
  assert.equal(r.reconstruir, true);
});

test('sin cambios no se toca la agenda', () => {
  const r = necesitaReconstruirAgenda('2026-10-02', 'Europe/Madrid', '2026-10-02', 'Europe/Madrid');
  assert.equal(r.diaNuevo, false);
  assert.equal(r.cambioZona, false);
  assert.equal(r.reconstruir, false);
});

test('la primera sincronización no cuenta como cambio de zona', () => {
  // Una instalación nueva no tiene zona guardada. No hay con qué compararla, y
  // la agenda se rehace igualmente por ser día nuevo.
  const r = necesitaReconstruirAgenda(null, null, '2026-10-02', 'Europe/Madrid');
  assert.equal(r.cambioZona, false);
  assert.equal(r.reconstruir, true);
});

test('la zona guardada sin día no evita reconstruir', () => {
  // Caso raro: base de datos con la zona puesta y el día vacío.
  const r = necesitaReconstruirAgenda(null, 'America/Santiago', '2026-10-02', 'America/Santiago');
  assert.equal(r.diaNuevo, true);
  assert.equal(r.cambioZona, false);
  assert.equal(r.reconstruir, true);
});

test('la zona horaria del dispositivo siempre se puede leer', () => {
  // Los Android con la base de datos de zonas recortada pueden devolver vacío.
  // En ese caso se cae al desfase, que también distingue Chile de España.
  const zona = zonaHorariaActual();
  assert.equal(typeof zona, 'string');
  assert.ok(zona.length > 0);
});

test('los avisos no dependen de la zona: solo de la hora local', () => {
  // Con la misma fecha y la misma hora local, el instante se construye igual
  //fuera cual sea la zona. Es lo que permite que la app funcione en cualquier
  // país sin pedir permiso de ubicación.
  const cumple = cumpleEnAnio('1990-10-03', 2026);
  const aviso = new Date(cumple.getFullYear(), cumple.getMonth(), cumple.getDate() + 1, 9, 0, 0, 0);
  assert.equal(aviso.getHours(), 9);
  assert.equal(aviso.getMinutes(), 0);
  assert.equal(aviso.getDate(), 4);
});

test('la tarjeta escribe la edad con etiquetas y dos puntos cuando falta más de un día', () => {
  // Texto exacto de Main. Va con etiquetas para que no se confunda la edad de
  // hoy con la del próximo cumpleaños.
  assert.equal(textoEdadTarjeta(23, 5), 'Edad: 23 años · Cumplirá: 24 años');
  assert.equal(textoEdadTarjeta(0, 5), 'Edad: 0 años · Cumplirá: 1 año');
  assert.equal(textoEdadTarjeta(34, 2), 'Edad: 34 años · Cumplirá: 35 años');
});

test('si cumple hoy la tarjeta no dice "Cumplirá" sino "Está cumpliendo"', () => {
  // El día del cumpleaños `edad` ya es la que se cumple, así que no lleva +1:
  // "Está cumpliendo 24 años" y no "Está cumpliendo 25 años".
  assert.equal(textoEdadTarjeta(24, 0), 'Está cumpliendo 24 años');
  assert.equal(textoEdadTarjeta(1, 0), 'Está cumpliendo 1 año');
  assert.ok(!textoEdadTarjeta(24, 0).includes('Cumplirá'));
});

test('si el cumpleaños fue ayer la tarjeta lo dice en pasado', () => {
  // Solo el resumen cuenta hacia atrás (`dias` negativo), pero el texto tiene
  // que ser coherente si algún día la lista también lo hace.
  assert.equal(textoEdadTarjeta(24, -1), 'Cumplió 24 años');
  assert.equal(textoEdadTarjeta(24, -3), 'Cumplió 24 años');
});

test('sin edad que deducir la tarjeta no escribe nada', () => {
  // Año actual o posterior: la edad sería inventada, así que no se imprime.
  assert.equal(textoEdadTarjeta(null, 5), '');
  assert.equal(textoEdadTarjeta(null, 0), '');
  assert.equal(textoEdadTarjeta(null, -1), '');
});

test('en cualquier edad la tarjeta imprime la de hoy y la siguiente', () => {
  // Cualquier edad: la segunda cifra de la tarjeta es la primera más uno.
  for (const edad of [0, 1, 17, 23, 64, 99]) {
    const texto = textoEdadTarjeta(edad, 5);
    assert.match(texto, new RegExp(`^Edad: ${edad} `));
    assert.ok(texto.includes(`Cumplirá: ${edad + 1}`), `falta Cumplirá: ${edad + 1} en ${texto}`);
  }
});

test('sin año de nacimiento la tarjeta no puede mostrar edad ni "cumplirá"', () => {
  const ahora = new Date(2026, 9, 2);
  // Año real conocido: la edad y el "cumplirá" salen.
  assert.equal(textoEdadTarjeta(edadDeducible('2000-05-15', false, ahora), 5), 'Edad: 26 años · Cumplirá: 27 años');
  // Mismo día y mes, pero marcado como desconocido: no sale nada, para no
  // inventar un número.
  assert.equal(textoEdadTarjeta(edadDeducible('2026-05-15', true, ahora), 5), '');
});

test('la frase del aviso concuerda con el momento del cumpleaños', () => {
  // Offset negativo = el cumpleaños está por venir; 0 = hoy; positivo = ya pasó.
  assert.equal(textoEdadAviso(24, -2), 'Va a cumplir 24 años');
  assert.equal(textoEdadAviso(24, -1), 'Va a cumplir 24 años');
  assert.equal(textoEdadAviso(24, 0), 'Está cumpliendo 24 años');
  assert.equal(textoEdadAviso(24, 1), 'Cumplió 24 años');
  assert.equal(textoEdadAviso(1, 1), 'Cumplió 1 año');
  assert.equal(textoEdadAviso(null, 0), '');
});

test('la edad del aviso es la del cumpleaños al que pertenece, no la de hoy', () => {
  // La agenda se programa con antelación y también para el ciclo siguiente,
  // así que el aviso del año que viene tiene que decir la edad de ese año.
  // Nace en 2000: el aviso de 2026 habla de 26 y el de 2027 de 27.
  const deEsteAnio = edadEnCumpleDelAviso('2000-05-15', new Date(2026, 4, 15, 9, 0), 0);
  const delAnioQueViene = edadEnCumpleDelAviso('2000-05-15', new Date(2027, 4, 15, 9, 0), 0);
  assert.equal(deEsteAnio, 26);
  assert.equal(delAnioQueViene, 27);
});

test('el aviso de ayer usa la edad del cumpleaños que acaba de pasar', () => {
  // El aviso del offset +1 se dispara un día después del cumpleaños: retroceder
  // un día desde el aviso devuelve el cumpleaños y su edad correcta.
  const edad = edadEnCumpleDelAviso('2000-05-15', new Date(2026, 4, 16, 9, 0), 1);
  assert.equal(edad, 26);
});

test('sin año deducible el aviso se queda sin edad en vez de inventarla', () => {
  // La casilla de año desconocido apaga la edad aunque la cifra sea válida.
  assert.equal(edadEnCumpleDelAviso('2000-05-15', new Date(2026, 4, 15, 9, 0), 0, true), null);
  // Un año posterior al del cumpleaños es imposible, así que tampoco hay edad:
  // un cumple guardado en 2031 no puede ser el de 2026.
  assert.equal(edadEnCumpleDelAviso('2031-05-15', new Date(2026, 4, 15, 9, 0), 0), null);
  // Nacido este año, el cumpleaños de 0 años también es real.
  assert.equal(edadEnCumpleDelAviso('2026-05-15', new Date(2026, 4, 15, 9, 0), 0), 0);
  // Un cumple de 2026 en 2027 sí vale 1 año: es un bebé que ya pasó su
  // cumpleaños de 0 años.
  assert.equal(edadEnCumpleDelAviso('2026-05-15', new Date(2027, 4, 15, 9, 0), 0), 1);
});

// --- Semanas naturales: lunes a domingo --------------------------------------
// Las fechas de abajo están comprobadas: el 5 de octubre de 2026 es lunes y el
// 4 es domingo.

test('la semana empieza en lunes y termina en domingo', () => {
  assert.equal(indiceDiaSemana(new Date(2026, 9, 5)), 0); // lunes
  assert.equal(indiceDiaSemana(new Date(2026, 9, 6)), 1); // martes
  assert.equal(indiceDiaSemana(new Date(2026, 9, 1)), 3); // jueves
  assert.equal(indiceDiaSemana(new Date(2026, 9, 4)), 6); // domingo
});

test('la semana en curso cierra en su domingo', () => {
  // El valor es el último día que sigue dentro de la semana, no la cantidad de
  // días que faltan: desde el lunes el domingo está a seis días vista.
  assert.equal(diasHastaFinDeSemana(new Date(2026, 9, 5)), 6); // lunes -> domingo
  assert.equal(diasHastaFinDeSemana(new Date(2026, 9, 1)), 3); // jueves -> domingo
  assert.equal(diasHastaFinDeSemana(new Date(2026, 9, 4)), 0); // domingo: hoy es el último
});

test('hoy, mañana, el domingo y el lunes: 3 en esta semana y 1 en la próxima', () => {
  // El caso que destapó el fallo, con el lunes 5 de octubre de 2026: hoy lunes,
  // mañana martes, el domingo 11 y el lunes 12 siguiente.
  const lunes = new Date(2026, 9, 5);
  assert.equal(semanaDelCumple(0, lunes), 'hoy');
  assert.equal(semanaDelCumple(1, lunes), 'esta');    // martes
  assert.equal(semanaDelCumple(6, lunes), 'esta');    // domingo 11
  assert.equal(semanaDelCumple(7, lunes), 'proxima'); // lunes 12

  // Repartidos: hoy cuenta una vez y el resto de la semana dos, de modo que
  // esta semana natural son tres personas (lunes, martes y domingo).
  const cuenta = { hoy: 0, esta: 0, proxima: 0, masAdelante: 0 };
  for (const dias of [0, 1, 6, 7]) cuenta[semanaDelCumple(dias, lunes)] += 1;
  assert.equal(cuenta.hoy, 1);
  assert.equal(cuenta.esta, 2);
  assert.equal(cuenta.proxima, 1);
  assert.equal(cuenta.hoy + cuenta.esta, 3, 'esta semana natural son tres');
});

test('siete días no es una semana: desde el lunes, el siguiente va a la próxima', () => {
  // El fallo original era contar `dias > 0 && dias <= 7`, que metía en esta
  // semana el lunes que viene y se saltaba a quien cumple hoy.
  const lunes = new Date(2026, 9, 5);
  assert.equal(semanaDelCumple(7, lunes), 'proxima');
  for (let d = 8; d <= 60; d += 7) {
    assert.notEqual(semanaDelCumple(d, lunes), 'esta', `día ${d} no es de esta semana`);
  }
});

test('cada día de la semana cae donde le toca', () => {
  // Reparto completo desde un lunes, semana a semana, sin huecos ni solapes.
  const lunes = new Date(2026, 9, 5);
  for (let d = 0; d <= 13; d += 1) {
    const esperado = d === 0 ? 'hoy' : d <= 6 ? 'esta' : d <= 13 ? 'proxima' : 'masAdelante';
    assert.equal(semanaDelCumple(d, lunes), esperado, `día ${d}`);
  }
  assert.equal(semanaDelCumple(14, lunes), 'masAdelante');
});

test('quien cumple hoy se separa de "hoy" sin salirse de su semana', () => {
  // Desde el domingo solo queda hoy; el lunes siguiente ya es la próxima semana.
  const domingo = new Date(2026, 9, 4);
  assert.equal(semanaDelCumple(0, domingo), 'hoy');
  assert.equal(semanaDelCumple(1, domingo), 'proxima');
  assert.equal(semanaDelCumple(7, domingo), 'proxima');
  assert.equal(semanaDelCumple(8, domingo), 'masAdelante');
});

test('nadie se queda sin clasificar: todo cae en alguna semana o más adelante', () => {
  const hoy = new Date(2026, 9, 1);
  for (const dias of [0, 1, 2, 3, 4, 7, 8, 14, 30, 100, 365]) {
    const semana = semanaDelCumple(dias, hoy);
    assert.ok(['hoy', 'esta', 'proxima', 'masAdelante'].includes(semana), `día ${dias}: ${semana}`);
  }
  assert.equal(semanaDelCumple(400, hoy), 'masAdelante');
});
