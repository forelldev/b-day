import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { COLORES, ESPACIO, RADIO, PALETAS, normalizarHex, textoSobre } from './tema';

interface Props {
  etiqueta: string;
  /** Color elegido, en `#RRGGBB`. */
  valor: string;
  /** Paleta a la que se pinta el texto y los bordes. */
  colores?: typeof COLORES;
  alCambiar: (color: string) => void;
}

/**
 * Selector de color: una fila de muestras y, debajo, el código hexadecimal
 * escrito a mano por si se quiere un color que no está en la lista.
 *
 * Las muestras salen de `PALETAS`, que incluye un modo oscuro. El texto
 * hexadecimal acepta tanto `#E8467C` como `#F0A`.
 */
export function SelectorColor({ etiqueta, valor, colores = COLORES, alCambiar }: Props) {
  const [texto, setTexto] = React.useState(valor);
  const [error, setError] = React.useState<string | null>(null);

  // Si el color cambia desde fuera (otra paleta o restablecer), el campo tiene
  // que reflejar el valor nuevo. Se ajusta durante el render en vez de en un
  // efecto, que provocaría un render de más con un texto desfasado.
  const [anterior, setAnterior] = React.useState(valor);
  if (anterior !== valor) {
    setAnterior(valor);
    setTexto(valor);
    setError(null);
  }

  const elegirMuestra = (color: string) => {
    setError(null);
    alCambiar(color);
  };

  const confirmarTexto = () => {
    const normalizado = normalizarHex(texto);
    if (!normalizado) {
      setError('Ese color no existe. Usa un valor como #E8467C.');
      return;
    }
    setError(null);
    setTexto(normalizado);
    alCambiar(normalizado);
  };

  return (
    <View style={styles.campo}>
      <Text style={[styles.etiqueta, { color: colores.textoSuave }]}>{etiqueta}</Text>

      <View style={styles.muestras}>
        {PALETAS.map((paleta) => {
          const esMarca = paleta.marca.toUpperCase() === valor.toUpperCase();
          return (
            <Pressable
              key={paleta.nombre}
              style={({ pressed }) => [
                styles.muestra,
                { backgroundColor: paleta.marca },
                esMarca && styles.muestraActiva,
                pressed && styles.muestraPulsada,
              ]}
              onPress={() => elegirMuestra(paleta.marca)}
              accessibilityRole="button"
              accessibilityLabel={paleta.nombre}
              accessibilityState={{ selected: esMarca }}
            >
              {esMarca && <Feather name="check" size={16} color={textoSobre(paleta.marca)} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.fila}>
        <View style={[styles.muestraChica, { backgroundColor: valor }]} />
        <View style={styles.entradaCaja}>
          <TextInput
            style={[styles.entradaTexto, { color: colores.texto }]}
            value={texto}
            onChangeText={(t) => {
              setTexto(t);
              setError(null);
            }}
            onSubmitEditing={confirmarTexto}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            placeholder="#E8467C"
            placeholderTextColor={colores.textoTenue}
            returnKeyType="done"
          />
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.aplicar, pressed && styles.aplicarPulsado]}
        onPress={confirmarTexto}
        accessibilityRole="button"
      >
        <Text style={styles.aplicarTexto}>Aplicar color</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: { gap: ESPACIO.sm },
  etiqueta: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  muestras: { flexDirection: 'row', flexWrap: 'wrap', gap: ESPACIO.sm },
  muestra: {
    width: 34,
    height: 34,
    borderRadius: RADIO.full,
    alignItems: 'center',
    justifyContent: 'center',
    // Sin este borde la muestra blanca no se ve sobre la tarjeta blanca.
    borderWidth: 1,
    borderColor: '#D9D4DA',
  },
  muestraActiva: { borderWidth: 3, borderColor: '#1F1520' },
  muestraPulsada: { opacity: 0.7 },

  fila: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm },
  muestraChica: { width: 40, height: 40, borderRadius: RADIO.md, borderWidth: 1, borderColor: '#D9D4DA' },
  entradaCaja: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D9D4DA',
    borderRadius: RADIO.md,
    paddingHorizontal: ESPACIO.md,
    paddingVertical: ESPACIO.sm,
  },
  entradaTexto: { fontSize: 15, fontWeight: '600' },

  aplicar: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDE7EE',
    paddingHorizontal: ESPACIO.lg,
    paddingVertical: ESPACIO.sm,
    borderRadius: RADIO.full,
  },
  aplicarPulsado: { backgroundColor: '#D9D2DB' },
  aplicarTexto: { color: '#1F1520', fontSize: 13, fontWeight: '700' },

  error: { color: '#D92D20', fontSize: 13 },
});