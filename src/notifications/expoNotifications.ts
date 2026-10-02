import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import type * as Tipos from 'expo-notifications';

/**
 * Única puerta de entrada a `expo-notifications`.
 *
 * El módulo real no se puede importar dentro de Expo Go en Android desde el
 * SDK 53: al cargarse se auto-registra para recibir push y eso lanza una
 * excepción que tumba toda la app (y con ella Expo Router). Como la app usa
 * `import * as Notifications from 'expo-notifications'` en varios sitios,
 * importar el paquete directamente es una bomba de relojería.
 *
 * Aquí se resuelve una sola vez: en Expo Go se expone una implementación vacía
 * y el resto de la app sigue funcionando con normalidad. Para que los avisos
 * lleguen de verdad hace falta un development build o la APK.
 */

type Modulo = typeof Tipos;

/** `true` cuando el módulo real de notificaciones no está disponible. */
export const SIN_NOTIFICACIONES = isRunningInExpoGo() && Platform.OS === 'android';

/** Implementación para cuando no hay módulo: todo falla con un mensaje claro. */
const NO_DISPONIBLE =
  'Las notificaciones no funcionan dentro de Expo Go. Usa un development build (npx expo run:android) o la APK instalada.';

const noDisponible = (): never => {
  throw new Error(NO_DISPONIBLE);
};

/** Los mismos valores numéricos que los enums reales del módulo nativo. */
const enSin: Partial<Modulo> = {
  AndroidImportance: {
    UNKNOWN: 0,
    UNSPECIFIED: 1,
    NONE: 2,
    MIN: 3,
    LOW: 4,
    DEFAULT: 5,
    HIGH: 6,
    MAX: 7,
  } as Modulo['AndroidImportance'],

  AndroidNotificationVisibility: {
    UNKNOWN: 0,
    PUBLIC: 1,
    PRIVATE: 2,
    SECRET: 3,
  } as Modulo['AndroidNotificationVisibility'],

  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
  } as Modulo['SchedulableTriggerInputTypes'],

  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  } as Modulo['IosAuthorizationStatus'],

  setNotificationChannelAsync: noDisponible,
  setNotificationHandler: () => undefined,
  getPermissionsAsync: async () =>
    ({ granted: false, canAskAgain: false, status: 'denied' }) as Tipos.NotificationPermissionsStatus,
  requestPermissionsAsync: async () =>
    ({ granted: false, canAskAgain: false, status: 'denied' }) as Tipos.NotificationPermissionsStatus,
  cancelAllScheduledNotificationsAsync: async () => undefined,
  cancelScheduledNotificationAsync: async () => undefined,
  scheduleNotificationAsync: noDisponible,
  getAllScheduledNotificationsAsync: async () => [] as Tipos.NotificationRequest[],
  getLastNotificationResponse: () => null,
  addNotificationResponseReceivedListener: () => ({ remove: () => undefined }),
}

// `require` dentro de la rama evita que Metro ejecute el módulo real cuando no
// hace falta. Los tipos vienen de `import type`, que el compilador borra.
const moduloReal: Modulo = SIN_NOTIFICACIONES
  ? (enSin as Modulo)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports -- el `require` es deliberado: un `import` estático cargaría el módulo real (y rompería Expo Go).
    require('expo-notifications');

export const Notifications = moduloReal;

export type {
  Notification,
  NotificationPermissionsStatus,
  NotificationRequest,
  NotificationRequestInput,
  NotificationResponse,
  SchedulableNotificationTriggerInput,
} from 'expo-notifications';
