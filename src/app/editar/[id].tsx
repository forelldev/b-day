import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HORA_POR_DEFECTO, leerHoraNotificacion } from '../../db/ajustes';
import {
  actualizarCumpleanero,
  crearCumpleanero,
  obtenerCumpleanero,
} from '../../db/cumpleaneros';
import { confirmarBorrado as confirmarYVolver } from '../../utils/borrar';
import { useCumpleaneros } from '../../estado/CumpleanerosProvider';
import { useNotificaciones } from '../../estado/NotificacionesProvider';
import { useTema } from '../../estado/TemaProvider';
import { ESPACIO, RADIO , type Colores } from '../../ui/tema';
import { SelectorFechaCumple } from '../../ui/SelectorFechaCumple';
import { ANIO_MINIMO, anioMaximo } from '../../ui/limitesAnio';
import {
  OFFSETS,
  edadEnProximoCumple,
  fechaCorta,
  formatearFechaCumple,
  horaCorta,
  instanteRecordatorio,
  proximoCumple,
  type OffsetDias,
} from '../../utils/date';

type Errores = Partial<Record<'nombre' | 'apellido' | 'fecha', string>>;

/** Fecha por defecto al añadir: hoy, para no tener que desplazarse mucho. */
function fechaInicial(): Date {
  return new Date();
}

export default function PantallaFicha() {
  const { colores } = useTema();
  const styles = React.useMemo(() => crearEstilos(colores), [colores]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { recargar } = useCumpleaneros();
  const { sincronizar, avisosActivos } = useNotificaciones();

  const esNuevo = id === 'nuevo';
  const idNumerico = esNuevo ? null : Number(id);

  const [cargando, setCargando] = useState(!esNuevo);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState(fechaInicial);
  // Marcada por defecto: la mayoría de quien anota un cumpleaños no conoce el
  // año de nacimiento, y es mejor no mostrar una edad inventada.
  const [anioDesconocido, setAnioDesconocido] = useState(true);
  const [notas, setNotas] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [guardando, setGuardando] = useState(false);
  // La hora configurada, para que la vista previa sea real y no de mentira.
  const [hora, setHora] = useState(HORA_POR_DEFECTO);

  useEffect(() => {
    leerHoraNotificacion().then(setHora).catch(() => undefined);
  }, []);

  // Carga de la ficha existente.
  useEffect(() => {
    if (esNuevo) return;
    let vivo = true;
    (async () => {
      const persona = idNumerico ? await obtenerCumpleanero(idNumerico) : null;
      if (!vivo) return;
      if (!persona) {
        Alert.alert('No encontrado', 'Este cumpleaños ya no existe.', [
          { text: 'Cerrar', onPress: () => router.back() },
        ]);
        return;
      }
      setNombre(persona.nombre);
      setApellido(persona.apellido);
      setNotas(persona.notas ?? '');
      const [a, m, d] = persona.fechaNacimiento.split('-').map(Number);
      setFechaNacimiento(new Date(a, m - 1, d));
      setAnioDesconocido(persona.anioDesconocido);
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [esNuevo, idNumerico, router]);

  // Vista previa de los cuatro avisos, para que el usuario vea el resultado
  // antes de guardar.
  const previa = useMemo(() => {
    try {
      const iso = formatearFechaCumple({
        anio: fechaNacimiento.getFullYear(),
        mes: fechaNacimiento.getMonth() + 1,
        dia: fechaNacimiento.getDate(),
      });
      const cumple = proximoCumple(iso);
      return OFFSETS.map((offset) => ({
        offset,
        fecha: instanteRecordatorio(cumple, offset, hora.hora, hora.minuto),
      }));
    } catch {
      return [];
    }
  }, [fechaNacimiento, hora]);

  const edad = useMemo(() => {
    // Con la casilla marcada no hay edad que mostrar, aunque el año guardado
    // sea válido: la cifra sería inventada.
    if (anioDesconocido) return null;
    return edadEnProximoCumple(
      formatearFechaCumple({
        anio: fechaNacimiento.getFullYear(),
        mes: fechaNacimiento.getMonth() + 1,
        dia: fechaNacimiento.getDate(),
      }),
    );
  }, [fechaNacimiento, anioDesconocido]);

  const validar = useCallback((): boolean => {
    const nuevos: Errores = {};
    if (!nombre.trim()) nuevos.nombre = 'Escribe el nombre';
    if (!apellido.trim()) nuevos.apellido = 'Escribe al menos el primer apellido';

    // El año va entre 1900 y el año en curso. El selector ya no ofrece años
    // futuros, pero un valor antiguo guardado con la lista anterior puede venir
    // de aquí, así que la comprobación sigue haciendo falta.
    const anio = fechaNacimiento.getFullYear();
    if (anio < ANIO_MINIMO) {
      nuevos.fecha = `El año no puede ser anterior a ${ANIO_MINIMO}`;
    } else if (anio > anioMaximo()) {
      nuevos.fecha = `El año no puede ser posterior a ${anioMaximo()}`;
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }, [nombre, apellido, fechaNacimiento]);

  const guardar = useCallback(async () => {
    if (!validar()) return;
    setGuardando(true);
    try {
      const datos = {
        nombre,
        apellido,
        fechaNacimiento: formatearFechaCumple({
          anio: fechaNacimiento.getFullYear(),
          mes: fechaNacimiento.getMonth() + 1,
          dia: fechaNacimiento.getDate(),
        }),
        anioDesconocido,
        notas: notas.trim() ? notas : null,
      };

      if (esNuevo) {
        await crearCumpleanero(datos);
      } else if (idNumerico) {
        await actualizarCumpleanero(idNumerico, datos);
      }

      await recargar();
      await sincronizar();
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }, [validar, nombre, apellido, fechaNacimiento, anioDesconocido, notas, esNuevo, idNumerico, recargar, sincronizar, router]);

  const confirmarBorrado = useCallback(() => {
    if (!idNumerico) return;
    confirmarYVolver({ id: idNumerico, nombre, apellido }, async () => {
      await recargar();
      await sincronizar();
      router.back();
    });
  }, [idNumerico, nombre, apellido, recargar, sincronizar, router]);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colores.marca} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: esNuevo ? 'Nuevo cumpleaños' : `${nombre} ${apellido}`.trim().toUpperCase() }} />

      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: insets.bottom + ESPACIO.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Campo
          etiqueta="Nombre"
          valor={nombre}
          alCambiar={setNombre}
          marcador="María"
          error={errores.nombre}
          autoFoco={esNuevo}
        />
        <Campo
          etiqueta="Apellido"
          valor={apellido}
          alCambiar={setApellido}
          marcador="García"
          error={errores.apellido}
        />

        <SelectorFechaCumple
          etiqueta="Fecha de nacimiento"
          valor={fechaNacimiento}
          alCambiar={setFechaNacimiento}
        />
        {errores.fecha && <Text style={styles.error}>{errores.fecha}</Text>}

        {/* Casilla de "no conozco el año". Es la única forma de distinguir un
            cumpleaños sin año de un bebé que nació este año: en los dos casos la
            cifra guardada es el año en curso, pero solo en el segundo hay edad. */}
        <Pressable
          style={styles.casillaFila}
          onPress={() => setAnioDesconocido((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: anioDesconocido }}
          accessibilityLabel="No conozco el año de nacimiento"
        >
          <View style={[styles.casilla, anioDesconocido && styles.casillaMarcada]}>
            {anioDesconocido && <Feather name="check" size={14} color={colores.superficie} />}
          </View>
          <Text style={styles.casillaTexto}>No conozco el año de nacimiento</Text>
        </Pressable>

        {anioDesconocido && (
          <Text style={styles.pista}>
            Con solo el día y el mes el recordatorio funciona igual. En la lista y en los avisos
            no se mostrará la edad.
          </Text>
        )}

        {edad !== null && (
          <Text style={styles.pista}>
            {fechaCorta(
              formatearFechaCumple({
                anio: fechaNacimiento.getFullYear(),
                mes: fechaNacimiento.getMonth() + 1,
                dia: fechaNacimiento.getDate(),
              }),
            )}{' '}
            · cumple {edad} años
          </Text>
        )}

        <Campo
          etiqueta="Notas (opcional)"
          valor={notas}
          alCambiar={setNotas}
          marcador="Es mi hermano"
          multilinea
        />

        {avisosActivos && previa.length > 0 && (
          <View style={styles.previa}>
            <Text style={styles.previaTitulo}>Se recordará de la siguiente manera:</Text>
            {previa.map(({ offset, fecha }) => (
              <View key={offset} style={styles.previaFila}>
                <Text style={styles.previaEtiqueta}>{ETIQUETA_OFFSET[offset]}</Text>
                <Text style={styles.previaFecha}>
                  {fecha.getDate()}/{String(fecha.getMonth() + 1).padStart(2, '0')}/{fecha.getFullYear()}
                </Text>
              </View>
            ))}
            <Text style={styles.previaNota}>
              {horaCorta(hora.hora, hora.minuto)}. La hora se modifica en Ajustes.
            </Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.guardar, pressed && styles.guardarPulsado]}
          onPress={guardar}
          disabled={guardando}
          accessibilityRole="button"
        >
          <Text style={styles.guardarTexto}>{guardando ? 'Guardando…' : 'Guardar'}</Text>
        </Pressable>

        {!esNuevo && (
          <Pressable
            style={({ pressed }) => [styles.eliminar, pressed && styles.eliminarPulsado]}
            onPress={confirmarBorrado}
            accessibilityRole="button"
          >
            <Text style={styles.eliminarTexto}>Eliminar cumpleaños</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ETIQUETA_OFFSET: Record<OffsetDias, string> = {
  [-2]: '2 días antes',
  [-1]: '1 día antes',
  0: 'El mismo día',
  1: '1 día después',
};

function Campo({
  etiqueta,
  valor,
  alCambiar,
  marcador,
  error,
  multilinea,
  autoFoco,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (texto: string) => void;
  marcador?: string;
  error?: string;
  multilinea?: boolean;
  autoFoco?: boolean;
}) {
  const { colores } = useTema();
  const styles = React.useMemo(() => crearEstilos(colores), [colores]);
  const [enFoco, setEnFoco] = React.useState(false);
  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={alCambiar}
        placeholder={marcador}
        placeholderTextColor={colores.textoTenue}
        onFocus={() => setEnFoco(true)}
        onBlur={() => setEnFoco(false)}
        multiline={multilinea}
        autoFocus={autoFoco}
        style={[
          styles.entrada,
          multilinea && styles.entradaMultilinea,
          enFoco && styles.entradaFoco,
          error ? styles.entradaError : null,
        ]}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function crearEstilos(colores: Colores) {
  return StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo },
  contenido: { padding: ESPACIO.lg, gap: ESPACIO.lg },

  campo: { gap: ESPACIO.sm },
  etiqueta: {
    fontSize: 13,
    fontWeight: '700',
    color: colores.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  entrada: {
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: RADIO.md,
    paddingHorizontal: ESPACIO.lg,
    paddingVertical: ESPACIO.md + 2,
    fontSize: 16,
    color: colores.texto,
  },
  entradaMultilinea: { minHeight: 72, textAlignVertical: 'top' },
  entradaFoco: { borderColor: colores.marca, backgroundColor: colores.marcaSuave },
  entradaError: { borderColor: colores.peligro },
  error: { color: colores.peligro, fontSize: 13, fontWeight: '600' },

  casillaFila: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm },
  casilla: {
    width: 22,
    height: 22,
    borderRadius: RADIO.sm,
    borderWidth: 2,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaMarcada: { backgroundColor: colores.marca, borderColor: colores.marca },
  casillaTexto: { color: colores.texto, fontSize: 14, flex: 1 },
  pista: { color: colores.textoSuave, fontSize: 13, marginTop: -ESPACIO.sm },

  previa: {
    backgroundColor: colores.superficie,
    borderRadius: RADIO.lg,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: ESPACIO.lg,
    gap: ESPACIO.sm,
  },
  previaTitulo: { fontSize: 14, fontWeight: '700', color: colores.texto },
  previaFila: { flexDirection: 'row', justifyContent: 'space-between' },
  previaEtiqueta: { fontSize: 14, color: colores.textoSuave },
  previaFecha: { fontSize: 14, fontWeight: '600', color: colores.texto },
  previaNota: { fontSize: 12, color: colores.textoTenue, marginTop: ESPACIO.xs, lineHeight: 17 },

  guardar: {
    backgroundColor: colores.marca,
    paddingVertical: ESPACIO.lg,
    borderRadius: RADIO.full,
    alignItems: 'center',
  },
  guardarPulsado: { backgroundColor: colores.marcaOscura },
  guardarTexto: { color: colores.super, fontSize: 16, fontWeight: '700' },

  eliminar: {
    paddingVertical: ESPACIO.md,
    borderRadius: RADIO.full,
    alignItems: 'center',
    backgroundColor: colores.peligroSuave,
  },
  eliminarPulsado: { backgroundColor: '#FEE4E2' },
  eliminarTexto: { color: colores.peligro, fontSize: 15, fontWeight: '700' },
  });
}
