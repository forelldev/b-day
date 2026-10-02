import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ESPACIO, RADIO, textoSobre, type Colores } from './tema';
import { useTema } from '../estado/TemaProvider';
import { MESES, fechaLargaConAnio } from '../utils/date';

/** Abreviaturas de tres letras para la cabecera del calendario. */
const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** Días de la semana empezando en lunes, que es como se lee un calendario en español. */
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const ANIO_MINIMO = 1900;

/**
 * Último año de la lista. Va algunos años por delante del actual porque la
 * fecha es un cumpleaños y puede que se apunte el año de otra persona, pero no
 * tanto que la lista deje de ser manejable.
 */
export function anioMaximo(): number {
  return new Date().getFullYear() + 10;
}

interface Props {
  etiqueta: string;
  /** Fecha seleccionada. Solo se usa el día y el mes. */
  valor: Date;
  alCambiar: (fecha: Date) => void;
}

/**
 * Selector de cumpleaños propio, en español.
 *
 * Sustituye al nativo porque en Android el diálogo del sistema se dibuja en el
 * idioma del dispositivo y la librería no admite la prop `locale` ahí: en un
 * móvil en inglés los meses salían en inglés. El diálogo nativo tampoco permite
 * saltarse el año, y aquí el año da igual, así que se construye entero.
 *
 * La fecha es libre: vale cualquier año y no se rechaza una fecha futura,
 * porque lo que se apunta es un cumpleaños, no la fecha de hoy.
 */
export function SelectorFechaCumple({ etiqueta, valor, alCambiar }: Props) {
  const { colores } = useTema();
  const styles = React.useMemo(() => crearEstilos(colores), [colores]);
  const [mes, setMes] = React.useState(valor.getMonth());
  const [dia, setDia] = React.useState(valor.getDate());
  const [anio, setAnio] = React.useState(valor.getFullYear());
  const [mesesAbierto, setMesesAbierto] = React.useState(false);
  const [aniosAbierto, setAniosAbierto] = React.useState(false);

  /** Confirma el día y el mes elegidos conservando el año seleccionado. */
  const confirmar = React.useCallback(
    (nuevoDia: number, nuevoMes: number, nuevoAnio: number) => {
      // El 29 de febrero solo existe en años bisiestos: si el año elegido no lo
      // es, el día se ajusta al 28 en lugar de dejar una fecha inexistente.
      const limite = diasDelMes(nuevoMes + 1, nuevoAnio);
      const diaValido = Math.min(nuevoDia, limite);
      alCambiar(new Date(nuevoAnio, nuevoMes, diaValido));
    },
    [alCambiar],
  );

  const años = React.useMemo(() => {
    const lista: number[] = [];
    for (let a = anioMaximo(); a >= ANIO_MINIMO; a--) lista.push(a);
    return lista;
  }, []);

  const primerDiaDelMes = new Date(anio, mes, 1).getDay();
  // `getDay` gives 0 for Sunday; the week starts on Monday, so Sunday becomes 6.
  const desplazamiento = (primerDiaDelMes + 6) % 7;
  const totalDias = diasDelMes(mes + 1, anio);

  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>

      {/* Mes y año en la misma línea. El día no va aquí: se elige en la
          rejilla del calendario, que es donde tiene sentido ver el mes entero. */}
      <View style={styles.cabecera}>
        <Pressable
          style={({ pressed }) => [styles.cajaBase, styles.cajaMes, pressed && styles.cajaPulsada]}
          onPress={() => {
            setMesesAbierto((v) => !v);
            setAniosAbierto(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Mes: ${nombreMes(mes)}`}
        >
          <Text style={styles.valor} numberOfLines={1}>
            {nombreMes(mes)}
          </Text>
          <Feather name={mesesAbierto ? 'chevron-up' : 'chevron-down'} size={16} color={colores.textoSuave} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.cajaBase, styles.cajaAnio, pressed && styles.cajaPulsada]}
          onPress={() => {
            setAniosAbierto((v) => !v);
            setMesesAbierto(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Año: ${anio}`}
        >
          <Text style={styles.valor}>{anio}</Text>
          <Feather name={aniosAbierto ? 'chevron-up' : 'chevron-down'} size={16} color={colores.textoSuave} />
        </Pressable>
      </View>

      {mesesAbierto && (
        <View style={styles.panel}>
          <View style={styles.mesesRejilla}>
            {MESES.map((nombre, indice) => (
              <Pressable
                key={indice}
                style={({ pressed }) => [
                  styles.mes,
                  indice === mes && styles.mesActivo,
                  pressed && styles.cajaPulsada,
                ]}
                onPress={() => {
                  setMes(indice);
                  setMesesAbierto(false);
                  confirmar(dia, indice, anio);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: indice === mes }}
              >
                <Text style={[styles.mesTexto, indice === mes && styles.mesTextoActivo]}>
                  {MESES_CORTOS[indice]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {aniosAbierto && (
        <ScrollView style={styles.aniosLista} nestedScrollEnabled>
          {años.map((a) => (
            <Pressable
              key={a}
              style={({ pressed }) => [
                styles.anio,
                a === anio && styles.anioActivo,
                pressed && styles.cajaPulsada,
              ]}
              onPress={() => {
                setAnio(a);
                setAniosAbierto(false);
                confirmar(dia, mes, a);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: a === anio }}
            >
              <Text style={[styles.anioTexto, a === anio && styles.anioTextoActivo]}>{a}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Calendario con la rejilla de días, solo si el selector de año está cerrado. */}
      {!aniosAbierto && (
        <View style={styles.calendario}>
          <View style={styles.calendarioCabecera}>
            {DIAS_SEMANA.map((d) => (
              <Text key={d} style={styles.diaSemana}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.calendarioRejilla}>
            {Array.from({ length: desplazamiento }).map((_, i) => (
              <View key={`vacio-${i}`} style={styles.celda} />
            ))}
            {Array.from({ length: totalDias }).map((_, i) => {
              const numeroDia = i + 1;
              const activo = numeroDia === dia;
              return (
                <View key={numeroDia} style={styles.celda}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.celdaDia,
                      activo && styles.celdaActiva,
                      pressed && styles.celdaPulsada,
                    ]}
                    onPress={() => {
                      setDia(numeroDia);
                      confirmar(numeroDia, mes, anio);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${numeroDia} de ${nombreMes(mes)} de ${anio}`}
                    accessibilityState={{ selected: activo }}
                  >
                    <Text style={[styles.celdaTexto, activo && styles.celdaTextoActivo]}>
                      {numeroDia}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <Text style={styles.calendarioPie}>
            {fechaLargaConAnio(new Date(anio, mes, dia))}
            {mes === 1 && dia === 29 && !esBisiesto(anio) ? ' · en años no bisiestos, el 28' : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

/** "Marzo", con la inicial en mayúscula para las etiquetas. */
function nombreMes(indice: number): string {
  const nombre = MESES[indice];
  return nombre[0].toUpperCase() + nombre.slice(1);
}

/** Días del mes, con `mes` de 1 a 12. */
function diasDelMes(mes: number, anio: number): number {
  return new Date(anio, mes, 0).getDate();
}

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

function crearEstilos(colores: Colores) {
  return StyleSheet.create({
  campo: { gap: ESPACIO.sm },
  etiqueta: {
    fontSize: 13,
    fontWeight: '700',
    color: colores.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  cabecera: { flexDirection: 'row', gap: ESPACIO.sm },
  // Mes y año comparten los estilos de caja: el año ocupaba `flex: 0` a secas y
  // salía sin borde ni fondo, por eso parecía que no estaba.
  cajaBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: RADIO.md,
    paddingHorizontal: ESPACIO.lg,
    paddingVertical: ESPACIO.md + 2,
  },
  cajaMes: { flex: 1 },
  cajaAnio: { minWidth: 104 },
  cajaPulsada: { borderColor: colores.marca, backgroundColor: colores.marcaSuave },
  valor: { fontSize: 16, color: colores.texto, fontWeight: '600' },

  panel: {
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: RADIO.md,
    padding: ESPACIO.sm,
    backgroundColor: colores.superficie,
  },
  mesesRejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: ESPACIO.xs },
  mes: {
    width: '23%',
    paddingVertical: ESPACIO.sm,
    alignItems: 'center',
    borderRadius: RADIO.sm,
  },
  mesActivo: { backgroundColor: colores.marca },
  mesTexto: { fontSize: 12, fontWeight: '700', color: colores.textoSuave },
  mesTextoActivo: { color: textoSobre(colores.marca) },

  aniosLista: { maxHeight: 200, borderRadius: RADIO.md },
  anio: { paddingVertical: ESPACIO.md, paddingHorizontal: ESPACIO.lg, borderRadius: RADIO.sm },
  anioActivo: { backgroundColor: colores.marca },
  anioTexto: { fontSize: 15, color: colores.texto, fontWeight: '600' },
  anioTextoActivo: { color: textoSobre(colores.marca) },

  calendario: {
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: RADIO.md,
    padding: ESPACIO.sm,
    backgroundColor: colores.superficie,
    gap: ESPACIO.xs,
  },
  calendarioCabecera: { flexDirection: 'row' },
  diaSemana: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colores.textoTenue,
  },
  calendarioRejilla: { flexDirection: 'row', flexWrap: 'wrap' },
  // La celda solo reparte el ancho de la semana y mide lo justo de alto. Con
  // `aspectRatio: 1` quedaba tan alta como ancha y el círculo se comía la fila.
  celda: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El círculo va dentro de la celda con tamaño fijo, así el número queda
  // centrado en lugar de caer en una caja cuadrada descompensada.
  celdaDia: {
    width: 34,
    height: 34,
    borderRadius: RADIO.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celdaActiva: { backgroundColor: colores.marca },
  celdaPulsada: { backgroundColor: colores.marcaSuave },
  celdaTexto: {
    fontSize: 14,
    color: colores.texto,
    textAlign: 'center',
    // Sin `lineHeight` el número se dibuja más abajo que el centro del círculo.
    lineHeight: 18,
  },
  // Contraste contra el color de marca, no contra la tarjeta: con una marca
  // clara el círculo activo se pierde si el texto va en blanco.
  celdaTextoActivo: { color: textoSobre(colores.marca), fontWeight: '700' },
  calendarioPie: { fontSize: 12, color: colores.textoTenue, textAlign: 'center' },
  });
}
