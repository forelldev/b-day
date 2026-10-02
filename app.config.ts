import type { ExpoConfig, ConfigContext } from 'expo/config';

// Colores de marca
const BRAND = '#E8467C';
const BRAND_DARK = '#B32D5A';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'B-Day - Recordatorio de Cumpleaños',
  slug: 'cumpleanos-apk',
  description: 'B-Day: recordatorios de cumpleaños que funcionan sin internet.',
  version: '1.0.0',
  scheme: 'cumpleanos',
  orientation: 'portrait',
  // 'automatic' y no 'light': la app pinta sus propios colores, pero los
  // diálogos nativos y la barra del sistema deben poder seguir al tema del
  // dispositivo. El `StatusBar` de la app se ajusta al fondo elegido a mano.
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',

  android: {
    package: 'com.cumpleanos.app',
    versionCode: 1,
    predictiveBackGestureEnabled: false,
    allowBackup: true,

    adaptiveIcon: {
      backgroundColor: BRAND,
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },

    // Permisos que Android necesita para poder lanzar un recordatorio aunque
    // la app esté cerrada.
    permissions: [
      // Android 13+ : permiso para mostrar notificaciones. Android lo concede
      // el usuario desde el diálogo que dispara el sistema.
      'android.permission.POST_NOTIFICATIONS',
      // Android 12+ (API 31): permite programar alarmas exactas. Sin este
      // permiso el sistema agrupa los avisos y puede retrasarlos.
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.VIBRATE',
      'android.permission.WAKE_LOCK',
    ],

    // La app es 100% local: ni ubicación ni almacenamiento externo. El permiso
    // de INTERNET no se bloquea porque lo necesitan Metro (desarrollo) y el
    // mecanismo de actualizaciones de Expo.
    blockedPermissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },

  plugins: [
    'expo-router',
    'expo-sqlite',
    '@react-native-community/datetimepicker',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: BRAND,
        defaultChannel: 'cumpleanos',
      },
    ],
  ],

  extra: {
    marca: BRAND,
    marcaOscura: BRAND_DARK,
    eas: {
      // Proyecto de EAS Build. Se fija aquí porque app.config.ts es dinámico
      // y la CLI no puede escribirlo sola.
      projectId: '248a939f-06f1-4f62-934a-3203ae992291',
    },
  },
});