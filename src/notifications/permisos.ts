import { Notifications, type NotificationPermissionsStatus } from './expoNotifications';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { asegurarCanal } from './canal';

export type EstadoPermiso = 'concedido' | 'denegado' | 'sin-preguntar';

export interface EstadoNotificaciones {
  permiso: EstadoPermiso;
  /** `false` cuando el permiso ya no se puede volver a pedir desde la app. */
  sePuedePedir: boolean;
}

/**
 * `true` cuando el permiso se pidió pero el usuario lootyó.
 * En Android el sistema no distingue "no ha preguntado" de "no hay permiso":
 * ambas cosas se leen igual, así que se deriva del `canAskAgain`.
 */
function traducirEstado(p: NotificationPermissionsStatus): {
  permiso: EstadoPermiso;
  sePuedePedir: boolean;
} {
  if (p.granted) return { permiso: 'concedido', sePuedePedir: false };

  // `canAskAgain` es `true` en Android cuando aún no se ha mostrado el diálogo.
  if (Platform.OS === 'android') {
    return p.canAskAgain ? { permiso: 'sin-preguntar', sePuedePedir: true } : { permiso: 'denegado', sePuedePedir: false };
  }

  // iOS distingue `NOT_DETERMINED`.
  const statusIos = p.ios?.status ?? Notifications.IosAuthorizationStatus.NOT_DETERMINED;
  if (statusIos === Notifications.IosAuthorizationStatus.DENIED) {
    return { permiso: 'denegado', sePuedePedir: false };
  }
  if (statusIos === Notifications.IosAuthorizationStatus.NOT_DETERMINED) {
    return { permiso: 'sin-preguntar', sePuedePedir: true };
  }
  return { permiso: 'concedido', sePuedePedir: false };
}

/**
 * Lee el estado actual de los permisos sin pedir nada.
 *
 * No incluye el permiso de alarma exacta a propósito: Android lo expone en
 * `Settings.canScheduleExactAlarms()`, que es API nativa sin equivalente en
 * JavaScript. Mostrar un "concedido/denegado" sería inventarlo, así que la app
 * solo ofrece el atajo para revisarlo en Ajustes del sistema.
 */
export async function leerEstado(): Promise<EstadoNotificaciones> {
  const permisos = await Notifications.getPermissionsAsync();
  return traducirEstado(permisos);
}

/**
 * Pide permiso de notificaciones. Se puede llamar aunque el usuario ya haya
 * denegado: en ese caso el sistema no vuelve a mostrar el diálogo y hay que
 * enviarlo a los ajustes del sistema.
 */
export async function pedirPermiso(): Promise<EstadoNotificaciones> {
  await asegurarCanal();

  const antes = await Notifications.getPermissionsAsync();
  const { sePuedePedir } = traducirEstado(antes);

  if (sePuedePedir) {
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
  }

  const despues = await Notifications.getPermissionsAsync();
  return traducirEstado(despues);
}

/** Abre los ajustes de notificaciones de esta app en el sistema operativo. */
export async function abrirAjustesNotificaciones(): Promise<void> {
  await Linking.openSettings();
}

/**
 * Android 12+ exige `SCHEDULE_EXACT_ALARM` para que un recordatorio salte a
 * su hora exacta. Sin él el sistema agrupa las alarmas y puede retrasarlas
 * varios minutos. Es un permiso especial que solo se concede desde Ajustes,
 * así que se llega con un intent directo al diálogo del sistema.
 *
 * En iOS y Android < 12 no aplica: se devuelve `true`.
 */
export async function abrirAjustesAlarmaExacta(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  // API 31 = Android 12. Por debajo no hace falta el permiso.
  if (Number(Platform.Version) < 31) return true;

  const paquete = Constants.expoConfig?.android?.package ?? 'com.cumpleanos.app';

  try {
    await Linking.openURL(
      `android.settings.REQUEST_SCHEDULE_EXACT_ALARM?package=${paquete}`,
    );
    return true;
  } catch {
    try {
      await Linking.openURL('android.settings.APP_NOTIFICATION_SETTINGS');
      return false;
    } catch {
      await Linking.openSettings();
      return false;
    }
  }
}

/** Abre los ajustes del sistema para que el usuario puede ver el canal. */
export async function abrirAjustesCanal(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.openURL('android.settings.APP_NOTIFICATION_SETTINGS');
  } catch {
    await Linking.openSettings();
  }
}