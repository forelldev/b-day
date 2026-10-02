import React from 'react';
// Import directo: traería todas las familias de iconos si se usara la raíz.
import Feather from '@expo/vector-icons/Feather';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTema } from '../estado/TemaProvider';
import { ESPACIO, RADIO , type Colores } from '../ui/tema';
import type { EstadoPermiso } from '../notifications/permisos';
import { SIN_NOTIFICACIONES } from '../notifications/expoNotifications';

interface Props {
  permiso: EstadoPermiso;
  alPedir: () => void;
  /** Abre los ajustes del sistema: Android no vuelve a mostrar el diálogo. */
  alAbrirAjustes?: () => void;
}

/**
 * Banner que explica por qué no llegan los avisos y ofrece el botón para
 * conceder el permiso. Es lo más importante de la pantalla de lista: sin este
 * permiso la app "no funciona" y el usuario no lo sabría.
 */
export function AvisoPermisos({ permiso, alPedir, alAbrirAjustes }: Props) {
  const { colores } = useTema();
  const styles = React.useMemo(() => crearEstilos(colores), [colores]);
  if (permiso === 'concedido' && !SIN_NOTIFICACIONES) return null;

  if (SIN_NOTIFICACIONES) {
    return (
      <View style={[styles.contenedor, styles.contenedorInfo]}>
        <View style={styles.cabecera}>
          <Feather name="info" size={18} color={colores.textoSuave} />
          <Text style={styles.titulo}>Avisos desactivados en Expo Go</Text>
        </View>
        <Text style={styles.texto}>
          Los cumpleaños se guardan igual, pero Expo Go no permite programar avisos en Android. Para
          recibirlos necesitas la app instalada: ejecuta <Text style={styles.negrita}>npx expo run:android</Text> o
          instala la APK.
        </Text>
      </View>
    );
  }

  if (permiso === 'denegado') {
    return (
      <View style={[styles.contenedor, styles.contenedorAviso]}>
        <View style={styles.cabecera}>
          <Feather name="bell-off" size={18} color={colores.aviso} />
          <Text style={styles.titulo}>Notificaciones desactivadas</Text>
        </View>
        <Text style={styles.texto}>
          Android ya tiene bloqueadas las notificaciones de esta app. Actívalas en Ajustes para
          recibir los avisos aunque la aplicación esté cerrada.
        </Text>
        <Pressable style={styles.boton} onPress={alAbrirAjustes ?? alPedir}>
          <Text style={styles.botonTexto}>Ir a los ajustes de Android</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.contenedor, styles.contenedorInfo]}>
      <View style={styles.cabecera}>
        <Feather name="bell" size={18} color={colores.marca} />
        <Text style={styles.titulo}>Activa los recordatorios</Text>
      </View>
      <Text style={styles.texto}>
        Te avisaremos 2 días antes, 1 día antes, el mismo día y al día siguiente. Todo ocurre en
        este móvil: no hace falta internet ni cuenta.
      </Text>
      <Pressable style={styles.botonPrimario} onPress={alPedir}>
        <Text style={styles.botonTextoPrimario}>Activar notificaciones</Text>
      </Pressable>
    </View>
  );
}

function crearEstilos(colores: Colores) {
  return StyleSheet.create({
  contenedor: {
    borderRadius: RADIO.lg,
    padding: ESPACIO.lg,
    gap: ESPACIO.sm,
    marginBottom: ESPACIO.lg,
  },
  contenedorInfo: { backgroundColor: colores.marcaSuave },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm },
  contenedorAviso: { backgroundColor: colores.avisoSuave },
  titulo: { fontSize: 15, fontWeight: '700', color: colores.texto },
  texto: { fontSize: 14, color: colores.textoSuave, lineHeight: 20 },
  boton: {
    marginTop: ESPACIO.xs,
    alignSelf: 'flex-start',
    backgroundColor: colores.aviso,
    paddingHorizontal: ESPACIO.lg,
    paddingVertical: ESPACIO.sm + 2,
    borderRadius: RADIO.full,
  },
  botonTexto: { color: colores.super, fontWeight: '700', fontSize: 14 },
  botonPrimario: {
    marginTop: ESPACIO.xs,
    alignSelf: 'flex-start',
    backgroundColor: colores.marca,
    paddingHorizontal: ESPACIO.lg,
    paddingVertical: ESPACIO.sm + 2,
    borderRadius: RADIO.full,
  },
  botonTextoPrimario: { color: colores.super, fontWeight: '700', fontSize: 14 },
  negrita: { fontWeight: '700', color: colores.texto },
  });
}
