import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Import directo: traería todas las familias de iconos si se usara la raíz.
import Feather from '@expo/vector-icons/Feather';

import { useCumpleaneros, type CumpleaneroConCuenta } from '../estado/CumpleanerosProvider';
import { useNotificaciones } from '../estado/NotificacionesProvider';
import { confirmarBorrado } from '../utils/borrar';
import { useTema } from '../estado/TemaProvider';
import { ESPACIO, RADIO, colorPorUrgencia, iniciales , type Colores } from '../ui/tema';
import {
  fechaCorta,
  semanaDelCumple,
  textoCuentaAtras,
  textoEdadTarjeta,
} from '../utils/date';
import { AvisoPermisos } from '../ui/AvisoPermisos';
import { abrirAjustesNotificaciones } from '../notifications/permisos';

export default function PantallaLista() {
  const { colores } = useTema();
  const styles = React.useMemo(() => crearEstilos(colores), [colores]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cumpleaneros, ahora, cargando, error, recargar } = useCumpleaneros();
  const { permiso, avisosActivos, pedirPermisoAhora, sincronizar } = useNotificaciones();

  // Al volver del formulario la lista se recarga, así la cuenta atrás y la
  // edad que se muestran siempre están al día.
  useFocusEffect(
    useCallback(() => {
      void recargar();
    }, [recargar]),
  );

  // Las semanas van de lunes a domingo. "Esta semana" incluye hoy, que ya
  // cuenta aparte en el texto, y se detiene en el domingo: contar los próximos
  // siete días metía en esta semana el lunes siguiente.
  const resumen = useMemo(() => {
    const cuenta = { hoy: 0, esta: 0, proxima: 0, masAdelante: 0 };
    // Mientras no haya lista cargada no hay nada que contar.
    if (!ahora) return cuenta;
    for (const c of cumpleaneros) {
      cuenta[semanaDelCumple(c.dias, ahora)] += 1;
    }
    return cuenta;
  }, [cumpleaneros, ahora]);

  return (
    <View style={styles.pantalla}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/ajustes" asChild>
              <Pressable
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Abrir ajustes"
                style={({ pressed }) => pressed && styles.cabeceraPulsada}
              >
                <Feather name="settings" size={22} color={colores.texto} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <FlatList
        data={cumpleaneros}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={[
          styles.lista,
          { paddingBottom: insets.bottom + 96 },
          cumpleaneros.length === 0 && styles.listaVacia,
        ]}
        refreshing={false}
        ListHeaderComponent={
          <View>
            {/* Con los recordatorios apagados a propósito el aviso estorba. */}
            {avisosActivos && (
              <AvisoPermisos
                permiso={permiso}
                alPedir={pedirPermisoAhora}
                alAbrirAjustes={() => void abrirAjustesNotificaciones()}
              />
            )}
            {cumpleaneros.length > 0 && (
              <Text style={styles.resumen}>
                {resumen.hoy > 0 ? `${resumen.hoy} cumpleaños hoy` : ''}
                {resumen.hoy > 0 && (resumen.esta > 0 || resumen.proxima > 0) ? ' · ' : ''}
                {resumen.esta > 0 ? `${resumen.esta} esta semana` : ''}
                {resumen.esta > 0 && resumen.proxima > 0 ? ' · ' : ''}
                {resumen.proxima > 0 ? `${resumen.proxima} la próxima semana` : ''}
                {resumen.hoy === 0 && resumen.esta === 0 && resumen.proxima === 0
                  ? 'Nadie cumple años en las próximas dos semanas'
                  : ''}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TarjetaCumpleanero
            cumpleanero={item}
            alPulsar={() =>
              router.push({ pathname: '/editar/[id]', params: { id: String(item.id) } })
            }
            alBorrar={() =>
              confirmarBorrado(item, async () => {
                await recargar();
                await sincronizar();
              })
            }
          />
        )}
        ListEmptyComponent={
          cargando ? (
            <ActivityIndicator size="large" color={colores.marca} style={styles.vacio} />
          ) : error ? (
            <View style={styles.vacio}>
              <Feather name="alert-triangle" size={56} color={colores.aviso} />
              <Text style={styles.vacioTitulo}>No se pudo abrir la base de datos</Text>
              <Text style={styles.vacioTexto}>{error}</Text>
            </View>
          ) : (
            <View style={styles.vacio}>
              <Feather name="gift" size={56} color={colores.marca} />
              <Text style={styles.vacioTitulo}>Aún no hay cumpleaños</Text>
              <Text style={styles.vacioTexto}>
                Añade a las personas que quieres recordar. Todo se guarda en este móvil, sin
                internet y sin cuentas.
              </Text>
              <Pressable style={styles.cta} onPress={() => router.push('/editar/nuevo')}>
                <Text style={styles.ctaTexto}>Registrar Nuevo Recordatorio</Text>
              </Pressable>
            </View>
          )
        }
      />

      {/* `Pressable` + `router.push` y no `Link asChild`: el botón de la lista
          vacía ya funciona así y el `Link` no se montaba. */}
      <Pressable
        onPress={() => router.push('/editar/nuevo')}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + ESPACIO.xl },
          pressed && styles.fabPulsado,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Registrar nuevo recordatorio de cumpleaños"
      >
        <Feather name="plus" size={22} color={colores.superficie} />
        <Text style={styles.fabTexto}>Registrar Nuevo Recordatorio</Text>
      </Pressable>
    </View>
  );
}

function TarjetaCumpleanero({
  cumpleanero,
  alPulsar,
  alBorrar,
}: {
  cumpleanero: CumpleaneroConCuenta;
  alPulsar: () => void;
  alBorrar: () => void;
}) {
  const { colores } = useTema();
  const styles = React.useMemo(() => crearEstilos(colores), [colores]);
  const { dias, edad } = cumpleanero;
  const color = colorPorUrgencia(dias, colores);

  return (
    <Pressable
      onPress={alPulsar}
      style={({ pressed }) => [styles.tarjeta, pressed && styles.tarjetaPulsada]}
      accessibilityRole="button"
      accessibilityLabel={[
        `${cumpleanero.nombre} ${cumpleanero.apellido}`,
        edad !== null ? textoEdadTarjeta(edad, dias) : null,
        textoCuentaAtras(dias),
      ]
        .filter(Boolean)
        .join(', ')}
    >
      {/* Dos filas: la de arriba para identidad y la de abajo para los datos.
          En una sola fila la pastilla y la papelera se comían el ancho del
          nombre y lo recortaban. */}
      <View style={styles.tarjetaFila}>
        <View style={[styles.avatar, { backgroundColor: color.fondo }]}>
          <Text style={[styles.avatarTexto, { color: color.texto }]}>
            {iniciales(cumpleanero.nombre, cumpleanero.apellido)}
          </Text>
        </View>

        <View style={styles.tarjetaCuerpo}>
          <Text style={styles.nombre} numberOfLines={2}>
            {cumpleanero.nombre} {cumpleanero.apellido}
          </Text>
          <Text style={styles.detalle} numberOfLines={2}>
            {fechaCorta(cumpleanero.fechaNacimiento)}
            {cumpleanero.notas ? ` · ${cumpleanero.notas}` : ''}
          </Text>
          {edad !== null ? (
            <Text style={styles.edad}>{textoEdadTarjeta(edad, dias)}</Text>
          ) : cumpleanero.anioDesconocido ? (
            /* El usuario dejó claro que no conoce el año. Decirlo es mejor que
               dejar la línea en blanco, que parece un fallo. */
            <Text style={styles.sinAnio}>Año de nacimiento desconocido</Text>
          ) : (
            /* Hay edad pero no se ha podido calcular: el año guardado es
               posterior a hoy, lo cual es un dato imposible. */
            <Text style={styles.sinAnio}>Revisa el año de nacimiento</Text>
          )}
        </View>

        {/* Zona aparte para no disparar la apertura de la ficha al borrar. */}
        <Pressable
          onPress={alBorrar}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Eliminar a ${cumpleanero.nombre} ${cumpleanero.apellido}`}
          style={({ pressed }) => [styles.borrar, pressed && styles.borrarPulsado]}
        >
          <Feather name="trash-2" size={18} color={colores.textoSuave} />
        </Pressable>
      </View>

      <View style={styles.tarjetaPie}>
        <View style={[styles.pastilla, { backgroundColor: color.fondo }]}>
          <Text style={[styles.pastillaTexto, { color: color.texto }]} numberOfLines={2}>
            {textoCuentaAtras(dias)}
          </Text>
        </View>
      </View>

    </Pressable>
  );
}

function crearEstilos(colores: Colores) {
  return StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  cabeceraPulsada: { opacity: 0.5 },
  lista: { paddingHorizontal: ESPACIO.lg, paddingTop: ESPACIO.sm, gap: ESPACIO.md },
  listaVacia: { flexGrow: 1 },

  resumen: {
    color: colores.textoSuave,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: ESPACIO.md,
    paddingHorizontal: ESPACIO.xs,
  },

  tarjeta: {
    gap: ESPACIO.sm,
    backgroundColor: colores.superficie,
    borderRadius: RADIO.lg,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: ESPACIO.md,
  },
  tarjetaPulsada: { opacity: 0.7 },
  tarjetaFila: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.md },
  tarjetaCuerpo: { flex: 1, gap: 2 },
  tarjetaPie: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: RADIO.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { fontSize: 16, fontWeight: '700' },
  nombre: { fontSize: 16, fontWeight: '700', color: colores.texto },
  detalle: { fontSize: 13, color: colores.textoSuave },
  edad: { fontSize: 13, color: colores.textoSuave, fontWeight: '600' },
  // Aviso de que falta el año: en tono suave, no en color de error, porque no
  // es un fallo sino algo que el usuario puede completar cuando quiera.
  sinAnio: { fontSize: 12, color: colores.textoSuave, fontStyle: 'italic' },
  pastilla: {
    paddingHorizontal: ESPACIO.md,
    paddingVertical: ESPACIO.xs + 2,
    borderRadius: RADIO.full,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastillaTexto: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    // Sin `lineHeight` la línea se dibuja más alta que la caja y el número
    // acaba abajo del todo.
    lineHeight: 16,
  },

  borrar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIO.full,
  },
  borrarPulsado: { backgroundColor: colores.peligroSuave },

  vacio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ESPACIO.sm,
    paddingHorizontal: ESPACIO.xl,
    paddingBottom: 64,
  },
  vacioTitulo: { fontSize: 19, fontWeight: '700', color: colores.texto, textAlign: 'center' },
  vacioTexto: {
    fontSize: 15,
    color: colores.textoSuave,
    textAlign: 'center',
    lineHeight: 22,
  },
  cta: {
    marginTop: ESPACIO.md,
    backgroundColor: colores.marca,
    paddingHorizontal: ESPACIO.xl,
    paddingVertical: ESPACIO.md,
    borderRadius: RADIO.full,
  },
  ctaTexto: {
    color: colores.superficie,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },

  fab: {
    position: 'absolute',
    right: ESPACIO.lg,
    left: ESPACIO.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ESPACIO.sm,
    paddingHorizontal: ESPACIO.lg,
    height: 56,
    borderRadius: RADIO.full,
    backgroundColor: colores.marca,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  fabPulsado: { backgroundColor: colores.marcaOscura },
  fabTexto: { color: colores.superficie, fontWeight: '700', fontSize: 15 },
  });
}
