import { Notifications } from './expoNotifications';
import { Platform } from 'react-native';

/**
 * Identificador del canal de Android. Importante: si cambia, el usuario
 * pierde los ajustes que haya hecho a mano en ese canal.
 */
export const CANAL = 'cumpleanos';

/** Crea el canal de notificaciones. En Android debe existir ANTES de pedir
 *  permiso, porque Android 13 solo muestra el diálogo del sistema cuando la app
 *  ya tiene al menos un canal registrado. */
export async function asegurarCanal(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: 'Recordatorios de cumpleaños',
    description: 'Avisos cuando se acerca el cumpleaños de alguien.',
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 250, 250, 250, 500],
    lightColor: '#E8467C',
    sound: 'default',
    bypassDnd: false,
  });
}

/**
 * Comportamiento cuando la notificación llega con la app abierta.
 * Debe registrarse en el módulo de entrada, antes de renderizar nada.
 */
export function configurarHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}