import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  DateTimePickerAndroid,
  default as DateTimePicker,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useTema } from '../estado/TemaProvider';
import { ESPACIO, RADIO , type Colores } from './tema';

interface Props {
  etiqueta: string;
  valor: Date;
  alCambiar: (fecha: Date) => void;
}

/**
 * Selector de hora. En Android el diálogo nativo se abre de forma imperativa
 * (modal del sistema) y en iOS se despliega dentro de la pantalla, así que este
 * componente esconde esa diferencia detrás de un único pulsador.
 *
 * Las fechas no usan este componente: el diálogo nativo de Android se dibuja en
 * el idioma del dispositivo y no admite forzar el español, por lo que hay un
 * selector propio en `SelectorFechaCumple`.
 */
export function SelectorHora({ etiqueta, valor, alCambiar }: Props) {
  const { colores } = useTema();
  const styles = React.useMemo(() => crearEstilos(colores), [colores]);
  const [visibleIos, setVisibleIos] = React.useState(false);

  const abrir = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: valor,
        mode: 'time',
        display: 'default',
        onChange: (evento: DateTimePickerEvent, fecha?: Date) => {
          // `dismissed` llega también con fecha: hay que ignorar ese caso o el
          // selector se movería solo al cerrarlo sin confirmar.
          if (evento.type === 'set' && fecha) alCambiar(fecha);
        },
      });
      return;
    }
    setVisibleIos((v) => !v);
  };

  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Pressable
        style={({ pressed }) => [styles.caja, pressed && styles.cajaPulsada]}
        onPress={abrir}
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${formatearHora(valor)}`}
      >
        <Text style={styles.valor}>{formatearHora(valor)}</Text>
        <Text style={styles.pila}>{visibleIos && Platform.OS !== 'android' ? '▴' : '▾'}</Text>
      </Pressable>

      {Platform.OS === 'ios' && visibleIos && (
        <DateTimePicker
          value={valor}
          mode="time"
          display="spinner"
          onChange={(_, fecha) => {
            if (fecha) alCambiar(fecha);
            setVisibleIos(false);
          }}
          style={styles.ios}
        />
      )}
    </View>
  );
}

function formatearHora(fecha: Date): string {
  const h = String(fecha.getHours()).padStart(2, '0');
  const m = String(fecha.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
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
  caja: {
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
  cajaPulsada: { borderColor: colores.marca, backgroundColor: colores.marcaSuave },
  valor: { fontSize: 16, color: colores.texto, fontWeight: '600' },
  pila: { fontSize: 14, color: colores.textoTenue },
  ios: { alignSelf: 'stretch' },
  });
}
