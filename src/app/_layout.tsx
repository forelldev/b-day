import React, { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import Feather from '@expo/vector-icons/Feather';
import { Notifications, type NotificationResponse } from '../notifications/expoNotifications';

import { ProveedorCumpleaneros } from '../estado/CumpleanerosProvider';
import { ProveedorNotificaciones } from '../estado/NotificacionesProvider';
import { ProveedorTema, useTema } from '../estado/TemaProvider';
import { configurarHandler } from '../notifications/canal';
import { esOscuro } from '../ui/tema';

// El handler decide qué se muestra cuando la notificación llega con la app
// abierta. Tiene que registrarse antes de que se pinte nada.
configurarHandler();

export default function LayoutRaiz() {
  const navigating = useRef(false);

  // Sin esto los iconos salen invisibles en el primer arranque y aparecen
  // solos cuando la fuente termina de cargar.
  useFonts(Feather.font);

  // Al tocar una notificación se abre la ficha de esa persona.
  useEffect(() => {
    const irAFicha = (respuesta: NotificationResponse | null | undefined) => {
      if (!respuesta || navigating.current) return;
      const id = respuesta.notification.request.content.data?.cumpleaneroId;
      if (typeof id !== 'number') return;
      navigating.current = true;
      router.push({ pathname: '/editar/[id]', params: { id: String(id) } });
    };

    irAFicha(Notifications.getLastNotificationResponse());

    const suscripcion = Notifications.addNotificationResponseReceivedListener((respuesta) => {
      navigating.current = false;
      irAFicha(respuesta);
    });
    return () => suscripcion.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <ProveedorTema>
        <ProveedorNotificaciones>
          <ProveedorCumpleaneros>
            <Navegacion />
          </ProveedorCumpleaneros>
        </ProveedorNotificaciones>
      </ProveedorTema>
    </SafeAreaProvider>
  );
}

/**
 * El navegador va aparte porque necesita la paleta: si estuviera dentro del
 * componente que la lee, quedaría debajo de su propio proveedor y no podría
 * usarla. `StatusBar` también se pone claro u oscuro según el fondo elegido.
 */
function Navegacion() {
  const { colores } = useTema();
  const fondoOscuro = esOscuro(colores.fondo);

  return (
    <>
      <StatusBar style={fondoOscuro ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colores.fondo },
          headerTitleStyle: { color: colores.texto, fontWeight: '700' },
          headerTintColor: colores.marca,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colores.fondo },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Recordatorio de Cumpleaños' }} />
        <Stack.Screen name="editar/[id]" options={{ title: 'Ficha', presentation: 'modal' }} />
        <Stack.Screen name="ajustes" options={{ title: 'Ajustes', presentation: 'modal' }} />
      </Stack>
    </>
  );
}