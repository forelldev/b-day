import React, { useCallback, useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { guardarHoraNotificacion, leerHoraNotificacion } from '../db/ajustes';
import { useNotificaciones } from '../estado/NotificacionesProvider';
import { SIN_NOTIFICACIONES } from '../notifications/expoNotifications';
import {
  abrirAjustesAlarmaExacta,
  abrirAjustesNotificaciones,
  type EstadoPermiso,
} from '../notifications/permisos';
import { useTema } from '../estado/TemaProvider';
import { SelectorColor } from '../ui/SelectorColor';
import { ESPACIO, RADIO , type Colores } from '../ui/tema';
import { SelectorHora } from '../ui/SelectorHora';
import { horaCorta } from '../utils/date';

/** Texto del interruptor según el estado real del permiso de Android. */
const PERMISO: Record<EstadoPermiso, string> = {
  concedido: 'Los recordatorios están activos en este móvil.',
  'sin-preguntar': 'Falta activar las notificaciones.',
  denegado: 'Android tiene bloqueadas las notificaciones de la app.',
};

export default function PantallaAjustes() {
  const { colores, colorMarca, colorFondo, cambiarColorMarca, cambiarColorFondo, restablecer } = useTema();
  const styles = React.useMemo(() => crearEstilos(colores), [colores]);
  const insets = useSafeAreaInsets();
  const {
    permiso,
    avisosActivos,
    cambiarAvisosActivos,
    pedirPermisoAhora,
    refrescarPermiso,
    sincronizar,
  } = useNotificaciones();

  const [hora, setHora] = useState(() => {
    const ahora = new Date();
    return new Date(2000, 0, 1, ahora.getHours(), ahora.getMinutes());
  });

  useEffect(() => {
    leerHoraNotificacion()
      .then((g) => setHora(new Date(2000, 0, 1, g.hora, g.minuto)))
      .catch(() => undefined);
  }, []);

  // Al volver de los ajustes del sistema, el permiso puede haber cambiado:
  // hay que releerlo en vez de fiarse del valor guardado.
  useFocusEffect(
    useCallback(() => {
      void refrescarPermiso();
    }, [refrescarPermiso]),
  );

  const cambiarHora = useCallback(
    async (nueva: Date) => {
      setHora(nueva);
      await guardarHoraNotificacion({ hora: nueva.getHours(), minuto: nueva.getMinutes() });
      await sincronizar();
    },
    [sincronizar],
  );

  return (
    <View style={styles.pantalla}>
      <Stack.Screen options={{ title: 'Ajustes' }} />
      <ScrollView contentContainerStyle={[styles.contenido, { paddingBottom: insets.bottom + ESPACIO.xxl }]}>
        <View style={styles.tarjeta}>
<View style={styles.filaInterruptor}>
            <View style={styles.texto}>
              <Text style={styles.titulo}>Recordatorios</Text>
              <Text style={styles.ayuda}>
                {avisosActivos
                  ? 'Te avisamos 2 días antes, 1 día antes, el mismo día y al día siguiente.'
                  : 'Por ahora se notifica solo el día del cumpleaños, si activas esta opción se notificará antes y después.'}
              </Text>
            </View>
            <Switch
              value={avisosActivos}
              onValueChange={(v) => void cambiarAvisosActivos(v)}
              trackColor={{ false: colores.borde, true: colores.marca }}
              thumbColor={colores.superficie}
              accessibilityLabel="Activar recordatorios"
            />
          </View>
        </View>

        <View style={styles.tarjeta}>
          <SelectorHora
            etiqueta="Hora del recordatorio"
            valor={hora}
            alCambiar={(f) => void cambiarHora(f)}
          />
          <Text style={styles.ayuda}>
            Todos los avisos llegan a las{' '}
            <Text style={styles.negrita}>{horaCorta(hora.getHours(), hora.getMinutes())}</Text>.
          </Text>
        </View>

        <View style={styles.tarjeta}>
          <Text style={styles.titulo}>Colores de la app</Text>
          <Text style={styles.ayuda}>
            Elige el color de los botones y el del fondo. El resto de tonos se ajustan solos para
            que todo siga leyéndose bien, también con un fondo oscuro.
          </Text>

          <SelectorColor
            etiqueta="Color de botones"
            valor={colorMarca}
            colores={colores}
            alCambiar={cambiarColorMarca}
          />

          <SelectorColor
            etiqueta="Color de fondo"
            valor={colorFondo}
            colores={colores}
            alCambiar={cambiarColorFondo}
          />

          <Pressable
            style={({ pressed }) => [styles.botonSecundario, pressed && styles.botonPulsado]}
            onPress={restablecer}
            accessibilityRole="button"
          >
            <Text style={styles.botonSecundarioTexto}>Volver a los colores de fábrica</Text>
          </Pressable>
        </View>

        <View style={styles.tarjeta}>
          <Text style={styles.titulo}>Permisos de Android</Text>
          <Text
            style={[
              styles.ayuda,
              permiso === 'denegado' && styles.aviso,
              permiso === 'concedido' && styles.bien,
            ]}
          >
            {SIN_NOTIFICACIONES
              ? 'Expo Go no permite programar avisos. Necesitas la app instalada.'
              : PERMISO[permiso]}
          </Text>
          {!SIN_NOTIFICACIONES && permiso !== 'concedido' && (
            <Pressable
              style={({ pressed }) => [styles.boton, pressed && styles.botonPulsado]}
              onPress={() =>
                void (permiso === 'denegado'
                  ? // Android ya no muestra el diálogo: hay que ir a ajustes.
                    abrirAjustesNotificaciones()
                  : pedirPermisoAhora())
              }
              accessibilityRole="button"
            >
              <Text style={styles.botonTexto}>
                {permiso === 'denegado' ? 'Abrir ajustes de Android' : 'Activar notificaciones'}
              </Text>
            </Pressable>
          )}

          {/* Android 12+ agrupa los avisos si no puede fijar alarmas exactas.
              El permiso solo se concede desde Ajustes, así que el atajo va
              directo al diálogo del sistema. En iOS y Android antiguo no
              aplica y no se muestra. */}
          {!SIN_NOTIFICACIONES && Platform.OS === 'android' && Number(Platform.Version) >= 31 && (
            <>
              <Text style={styles.subtitulo}>Avisos a la hora exacta</Text>
              <Text style={styles.ayuda}>
                Sin este permiso, Android puede agrupar los avisos y retrasarlos. Comprueba que esté
                activado en la pantalla que se abrirá a continuación.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.botonSecundario, pressed && styles.botonPulsado]}
                onPress={() => void abrirAjustesAlarmaExacta()}
                accessibilityRole="button"
              >
                <Text style={styles.botonSecundarioTexto}>Revisar alarma exacta</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function crearEstilos(colores: Colores) {
  return StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: ESPACIO.lg, gap: ESPACIO.lg },

  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: RADIO.lg,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: ESPACIO.lg,
    gap: ESPACIO.sm,
  },

  filaInterruptor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIO.lg,
  },
  texto: { flex: 1, gap: ESPACIO.xs },
  titulo: { fontSize: 16, fontWeight: '700', color: colores.texto },
  subtitulo: { fontSize: 14, fontWeight: '700', color: colores.texto, marginTop: ESPACIO.sm },
  ayuda: { fontSize: 14, color: colores.textoSuave, lineHeight: 20 },
  aviso: { color: colores.aviso },
  bien: { color: colores.exito },
  negrita: { fontWeight: '700', color: colores.texto },
  boton: {
    marginTop: ESPACIO.sm,
    alignSelf: 'flex-start',
    backgroundColor: colores.marca,
    paddingHorizontal: ESPACIO.lg,
    paddingVertical: ESPACIO.md,
    borderRadius: RADIO.full,
  },
  botonPulsado: { backgroundColor: colores.marcaOscura },
  botonTexto: { color: colores.superficie, fontWeight: '700', fontSize: 15 },
  botonSecundario: {
    alignSelf: 'flex-start',
    backgroundColor: colores.marcaSuave,
    paddingHorizontal: ESPACIO.lg,
    paddingVertical: ESPACIO.md,
    borderRadius: RADIO.full,
  },
  botonSecundarioTexto: { color: colores.marcaOscura, fontWeight: '700', fontSize: 14 },
  });
}
