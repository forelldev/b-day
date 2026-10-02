# B-Day - Recordatorio de Cumpleaños

App Android para no olvidarse de ningún cumpleaños. Registras a quién, cuándo cumple y el móvil
te avisa por su cuenta: 2 días antes, 1 día antes, el mismo día y al día siguiente.

No hay cuentas, ni servidor, ni conexión a internet. Los cumpleaños viven en una base de datos
SQLite dentro del propio teléfono y los avisos los programa el sistema operativo, así que
llegan aunque la app esté cerrada o el móvil sin cobertura.

---

## Contenido

- [Qué hace](#qué-hace)
- [Instalar la APK](#instalar-la-apk)
- [Uso](#uso)
- [Cómo funciona por dentro](#cómo-funciona-por-dentro)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Desarrollo](#desarrollo)
- [Tests](#tests)
- [Generar la APK](#generar-la-apk)
- [Decisiones y límites conocidos](#decisiones-y-límites-conocidos)
- [Tecnologías](#tecnologías)

---

## Qué hace

- **Lista ordenada por urgencia.** Primero quien cumple antes, con la distancia en días y la
  edad que va a cumplir.
- **Ficha por persona.** Nombre, apellido, fecha de nacimiento y notas libres.
- **Cuatro avisos por cumpleaños**, a una hora que eliges tú (9:00 por defecto).
- **Interruptor general** para dejar solo la felicitación del día y quitar los de antes y después.
- **Avisos resilientes.** Se agenda el próximo ciclo y otro de respaldo al año siguiente, así
  que los avisos siguen aunque no abras la app durante meses.
- **Funciona sin internet y sin cuenta**, y no envía datos a ningún sitio.

---

## Instalar la APK

Necesitas un **Android 8.0 o superior**. La versión mínima exacta la fija Expo SDK 57 en
tiempo de compilación; para verla, genera el proyecto nativo con `npx expo prebuild` y mira
`minSdkVersion` en `android/build.gradle`.

1. Abre el enlace de descarga que te pasen y acepta "instalar apps de orígenes desconocidos"
   para tu navegador o gestor de archivos.
2. Instala el `.apk`.
3. Abre **B-Day** y concede el permiso de notificaciones cuando lo pida.

La app no pide nada más: ni registro, ni correo, ni ubicación.

El icono, el nombre visible y el canal de notificaciones se definen en `app.config.ts`, así que
cambiarlos no obliga a tocar ninguna pantalla.

### Si los avisos no llegan

Es el punto donde más falla este tipo de app, así que conviene revisarlo:

1. **Permiso de notificaciones.** Si lo denegaste, Android no vuelve a mostrar el diálogo.
   Ve a *Ajustes → Apps → B-Day → Notificaciones* y actívalas.
2. **Alarma exacta.** Android 12+ agrupa los avisos y los retrasa si la app no tiene este
   permiso. En *Ajustes → Permisos de Android* hay un botón **Revisar alarma exacta** que abre
   directamente el diálogo del sistema. Solo aparece en Android 12 o superior, que es donde el
   permiso existe; en versiones anteriores no hace falta. La app **no puede leer** si el permiso
   está concedido (vive en una API nativa sin equivalente en JavaScript), por eso no te dice si
   está bien o mal: abre el ajuste y compruébalo tú.
3. **Batería.** Algunos fabricantes (Xiaomi, Samsung, Huawei) matan los avisos en segundo
   plano. Busca "B-Day" en los ajustes de batería y ponlo en "sin restricciones".

Los tres puntos son accesibles desde la app, en **Ajustes → Permisos de Android**.

---

## Uso

**Añadir un cumpleaños.** Pulsa *Registrar Nuevo Recordatorio* (abajo a la derecha). Escribe el
nombre y el apellido y elige el día y el mes. Notas es opcional. El nombre se guarda solo, con la
primera letra de cada palabra en mayúscula. Debajo verás el apartado *Se recordará de la siguiente
manera* con las fechas exactas de cada aviso.

El selector de la fecha está en español: eliges el mes y el día con el calendario, y el año en
una lista aparte. El año vale cualquiera: si no sabes el de nacimiento, pon el que te salga, por
ejemplo 2026, porque para los recordatorios solo importan el día y el mes.

Cada tarjeta de la lista muestra el nombre, la fecha de nacimiento, los años que tiene hoy
seguidos de los que cumplirá (*23 años · Cumplirá 24*) y cuántos días faltan para el próximo. La edad no aparece si el año guardado es el actual o posterior, porque en
ese caso el año se anotó sin saberlo y la edad sería inventada.

**Editar.** Toca cualquier tarjeta de la lista. Desde la ficha puedes cambiar los datos, añadir
notas o eliminar el registro.

**Eliminar.** Hay un icono de papelera en cada tarjeta de la lista. Pide confirmación antes de
borrar y limpia también los avisos ya programados.

**Cambiar la hora o apagar los recordatorios.** En *Ajustes* (engranaje arriba a la derecha).

**Al tocar una notificación** se abre directamente la ficha de esa persona.

---

## Cómo funciona por dentro

### La base de datos

Dos tablas, gestionadas por `expo-sqlite` (`cumpleanos.db`):

| Tabla | Contenido |
|---|---|
| `cumpleaneros` | id, nombre, apellido, fecha de nacimiento (`YYYY-MM-DD`), notas, fechas de creación y actualización |
| `ajustes` | clave/valor: hora del recordatorio, último día sincronizado, interruptor de avisos |

La migración se controla con `PRAGMA user_version` y es **idempotente**: un dispositivo con la
base a medias se recupera sin perder datos.

### La agenda de avisos

`src/notifications/agenda.ts` reconstruye la agenda entera cada vez:

1. Lee todos los cumpleaños y la hora configurada.
2. Calcula el instante de cada uno de los cuatro avisos de cada persona.
3. Cancela todos los avisos anteriores y crea los nuevos.

Reconstruir todo en lugar de parchearlo cuesta unas decenas de llamadas, pero garantiza que
nunca queden avisos huérfanos de alguien que borraste o cuya fecha cambiaste.

**Por qué dos ciclos.** Se programa el aviso real y otro equivalente un año después. Android
libera las alarmas huérfanas cuando el dispositivo reinicia, y la app puede no abrirse en
mucho tiempo. El aviso del año siguiente actúa como red de seguridad.

**Casos borde que cubre la lógica de fechas:**

- El 29 de febrero se celebra el 28 en los años no bisiestos.
- Años bisiestos: el 29 solo se usa cuando el año en curso lo es.
- Si el cumpleaños es hoy y la hora configurada ya pasó, el aviso sale en el acto. Con el
  interruptor de avisos apagado no sale ninguno, ni siquiera ese.
- Cambios de hora de verano y zonas con media hora de salto o con desfase de 30 minutos.

### El máximo de 400 avisos

Android limita cuántas alarmas exactas puede guardar una app. B-Day programa hasta
`LIMITE_PROGRAMADOS = 400` y, si se superan, conserva los más próximos. Los avisos del ciclo
de respaldo nunca desplazan a uno real.

---

## Estructura del proyecto

```
app.config.ts              Configuración de Expo y Android (permisos, canal, icono)
eas.json                   Perfiles de build

src/app/                   Rutas de Expo Router (cada archivo es una pantalla)
  _layout.tsx              Providers,Stack y navegación desde notificación
  index.tsx                Lista principal
  editar/[id].tsx          Alta y edición (también `nuevo`)
  ajustes.tsx              Hora, interruptor y permisos

src/db/                    Capa de datos
  index.ts                 Apertura y migraciones SQLite
  cumpleaneros.ts          CRUD, con normalización de nombres
  ajustes.ts               Lectura y escritura de preferencias

src/notifications/
  expoNotifications.ts     Fachada: única puerta de entrada a expo-notifications
  canal.ts                 Canal de Android y handler en primer plano
  permisos.ts              Permisos y accesos a los ajustes del sistema
  agenda.ts                Cálculo y programación de los avisos

src/estado/                Contextos de React
  TemaProvider.tsx         Color de marca y de fondo, guardados en ajustes
  CumpleanerosProvider.tsx  Lista única compartida por todas las pantallas
  NotificacionesProvider.tsx Permisos, agenda y sincronización

src/ui/                    Componentes compartidos y tema visual
  SelectorFechaCumple.tsx Selector de día, mes y año, todo en español
  SelectorHora.tsx        Selector de hora
  SelectorColor.tsx       Selector de color con muestras y código hexadecimal
  tema.ts                 Espaciados y paleta, con los colores que deriva
src/utils/                 Fechas, husos horarios y borrado con confirmación

tests/                     Tests con el runner nativo de Node
```

### Los colores de la app son configurables

El rosa de los botones y el color de fondo se eligen en Ajustes, y se guardan en la tabla de
ajustes, así que sobreviven a cerrar la app. Hay nueve paletas de muestra (Rosita, Lila, Azul,
Verde, Naranja, Rojo, Piedra, Blanco y Noche, que es oscura) y además se puede escribir el
código hexadecimal a mano, en `#RRGGBB` o abreviado (`#F0A`).

El usuario solo elige dos colores: `marca` y `fondo`. Todo lo demás se **deriva** en
`crearColores`, que es lo que hace que un solo cambio propague a botones, bordes, textos, el
selector de fechas y el calendario sin tocar ninguna pantalla:

El color elegido también tiñe los **avisos del sistema**, así que la notificación aparece en el
color de la marca y no en un rosa fijo. Si el valor guardado en ajustes no llega a ser un
hexadecimal válido, los avisos usan el color de marca por defecto en lugar de romper la
programación.

Los textos sobre el color de marca (el número de un día seleccionado, un mes elegido) se pintan
con `textoSobre()`, que decide entre oscuro y claro según el contraste. Por eso siguen
leyéndose si eliges una marca muy clara, como la blanca.

- Si el fondo es oscuro, los textos se aclaran y las tarjetas se separan de él.
- `marcaOscura`, `marcaSuave` y `borde` salen de mezclar la marca con el blanco o el negro.
- El color del texto sobre la marca se calcula por contraste, para que los botones siga
  siendo legibles con cualquier color.

Por eso los `StyleSheet` de las pantallas son funciones que reciben la paleta
(`crearEstilos(colores)`) y se memorizan, en vez de constantes: si fueran fijos, cambiar el
color no se vería hasta reinstalar la app.

### El selector de fechas es propio

En Android el diálogo nativo de `@react-native-community/datetimepicker` se dibuja en el idioma
del dispositivo y la librería **no admite la prop `locale` en Android** (solo en iOS): con el
móvil en inglés, los meses salían en inglés. El diálogo nativo tampoco deja saltarse el año, y
aquí el año da igual, porque quien registra un cumpleaños puede no conocerlo.

Por eso `src/ui/SelectorFechaCumple.tsx` construye el calendario entero: día y mes en rejilla,
meses y días de la semana en español y una lista aparte para el año. El diálogo nativo se queda
solo para la hora, en `SelectorHora.tsx`.

La fecha no se valida contra hoy a propósito: lo que se guarda es un cumpleaños, no una cita, así
que vale cualquier año y también las fechas futuras. Si no se conoce el año de nacimiento se
puede apuntar 2026 o el que sea, porque para agendar los avisos solo se usan el día y el mes.

### La fachada de notificaciones

`src/notifications/expoNotifications.ts` deserves un aparte. `expo-notifications` se
auto-registra para recibir push **al cargarse**, y eso lanza una excepción dentro de Expo Go
en Android desde el SDK 53. Como el módulo se importaba en varias pantallas, el fallo tumbaba
la app entera.

La fachada lo resuelve una sola vez: en Expo Go devuelve una implementación vacía y el resto de
la app sigue funcionando. En una app instalada carga el módulo real.

**Regla del repositorio:** nadie importa `expo-notifications` directamente. Todo pasa por la
fachada.

---

## Desarrollo

```bash
npm install
npx expo start
```

Escanea el QR con Expo Go y la app abre. El servidor muestra los logs debajo.

### Qué sí funciona en Expo Go

Toda la interfaz, la base de datos, añadir, editar, borrar y los ajustes.

### Qué no funciona en Expo Go

**Los avisos.** El módulo nativo de notificaciones no existe en Expo Go desde el SDK 53, no es
un límite del código. La app lo detecta y lo dice con un banner, en vez de fallar en silencio.

Para probar los avisos de verdad necesitas la app instalada:

```bash
npx expo run:android
```

Eso instala un development build y sigues viendo los cambios con el mismo QR. Necesitas el
SDK de Android y un dispositivo conectado por USB con depuración activada.

> Importante: el directorio `android/` y el `ios/` están en `.gitignore`. Se generan con
> Continuous Native Generation y no se editan a mano; la configuración nativa vive en
> `app.config.ts`.

### Comandos

| Comando | Qué hace |
|---|---|
| `npx expo start` | Servidor de desarrollo con QR |
| `npx expo run:android` | Instala un development build en el dispositivo |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, app y tests |
| `npm test` | Suite de tests |

---

## Tests

```bash
npm test
```

79 tests con el runner nativo de Node (`node --test`), sin dependencias extra. No necesitan
emulador ni dispositivo.

Cubren lo que de verdad puede fallar en una app de cumpleaños:

- Bisiestos y el 29 de febrero.
- Cruces de año, de mes y de año nuevo.
- Cambio de hora de verano.
- Cinco husos horarios: `Europe/Madrid`, `America/Santiago`, `Australia/Lord_Howe`, `UTC` y
  `Pacific/Chatham` (los dos últimos con saltos de 30 minutos).
- Que la agenda nunca programe un aviso en el pasado.
- Que los cuatro avisos de una persona sean distintos entre sí.
- Normalización de nombres y apellidos, con `ñ`, diéresis y nombres compuestos.

---

## Generar la APK

Con [EAS Build](https://docs.expo.dev/eas/), en la nube. No hace falta Java ni Android Studio
en el equipo.

```bash
npx eas-cli build -p android --profile preview
```

| Perfil | Para qué |
|---|---|
| `preview` | APK instalable, para probar en el móvil |
| `production` | APK de distribución |
| `development` | Development build con cliente de desarrollo |

El build se puede cancelar desde la web o con `npx eas-cli build:cancel <id>`.

Al terminar, el enlace de descarga aparece en
[expo.dev/accounts/forelldev/projects/cumpleanos-apk](https://expo.dev/accounts/forelldev/projects/cumpleanos-apk/builds).

---

## Decisiones y límites conocidos

**Sin permiso de ubicación, y a propósito.** La app no pide ubicación porque no la necesita:
todos los cálculos de fecha usan hora local (`new Date(2026, 9, 3, 9, 0)`), que JavaScript
interpreta con la zona que Android ya tiene configurada en el reloj. El aviso de las 09:00
significa "las 09:00 del móvil de quien lo recibe", vaya en Chile o en Japón. Además
`app.config.ts` **bloquea** los tres permisos de ubicación: una app de cumpleaños que pide la
ubicación es una app de cumpleaños que da mala impresión.

Lo que sí hace la app es **vigilar la zona horaria**. Cada 60 segundos, y al volver del
segundo plano, comprueba si cambió el día o la zona; si cambió, rehace la agenda. Eso cubre
viajar a otro país: los avisos que ya estaban agendados guardan un instante absoluto, así que
sin esto un usuario que vuela de Chile a España recibiría el aviso de las 09:00 a las 17:00.
La zona con la que se calculó la agenda se guarda en la base de datos, no solo en memoria,
porque si el usuario viaja con la app cerrada al volver a abrirla hay que poder compararla.

**Sin cuentas ni servidor.** Una decisión de producto, no una limitación pendiente: no hay
sincronización entre dispositivos ni copia de seguridad en la nube. Borrar la app borra los
datos.

**Identidad de la app.** El `slug` (`cumpleanos-apk`) y el `package` de Android
(`com.cumpleanos.app`) no se tocan aunque cambie el nombre visible. Android trata un cambio de
package como una app distinta.

**El aviso de "hoy" con la hora ya pasada.** No se puede programar hacia atrás, así que si
abres la app el día del cumpleaños después de la hora configurada, el aviso sale en el acto. Una
vez al día, para no repetirlo en cada apertura. Con el interruptor de avisos apagado no se manda
ninguno, ni siquiera ese.

**El permiso de alarma exacta no se puede consultar.** Android lo expone en
`Settings.canScheduleExactAlarms()`, que es API nativa sin equivalente en JavaScript. La app no
puede decirte si está concedido o denegado, así que solo te lleva al ajuste del sistema. Es una
limitación de la plataforma, no un fallo pendiente.

**No hay pantalla de bienvenida ni pantalla de inicio personalizada.** El arranque muestra el
fondo por defecto; no se instaló `expo-splash-screen`.

**Acceso a la hora del recordatorio desde la ficha.** La vista previa muestra las fechas
reales, calculadas con la hora configurada.

**El comportamiento real depende del fabricante.** Android no garantiza que una alarma
programada se ejecute a su hora exacta: depende de las optimizaciones de batería de cada
fabricante. En equipos que restringen la actividad en segundo plano, la app tiene que estar en
"sin restricciones" para que los avisos lleguen a su hora.

**En la Play Store, `SCHEDULE_EXACT_ALARM` es un permiso restringido.** Google solo lo concede a
apps que sean de calendario o alarmas, o que usen `USE_EXACT_ALARM`. Para instalar la APK
fuera de la tienda no hay ningún problema; si en algún momento se publica en Play, este punto
hay que revisarlo.

---

## Tecnologías

- **Expo SDK 57** y React Native 0.86
- **Expo Router** para la navegación
- **expo-sqlite** para la base de datos local
- **expo-notifications** para los avisos locales
- **@expo/vector-icons** (Feather) para los iconos
- **TypeScript** en modo estricto

---

## Licencia

B-Day es software libre bajo la **GNU General Public License v3.0**.

El aviso de copyright del proyecto es:

```
Copyright (c) 2026 Forell Dev (Carlos Soteldo)
```

El texto íntegro e inalterado de la licencia está en [`LICENSE`](LICENSE).

### Qué significa en la práctica

**Para quien usa la app, no cambia nada.** No hay que aceptar nada, ni registrarse, ni
cumplir condiciones de uso. B-Day es un programa, no un servicio: no hay cuentas, ni se envían
datos a ningún sitio, y por tanto no hay nada que aceptar.

**Para quien quiera el código:** puede leerlo, estudiarlo, modificarlo y compilarlo. La única
condición es que, si distribuye el código —modificado o no—, lo hace bajo la misma licencia y
ofrece el código fuente completo.

**La app que se distribuye sale de este mismo repositorio.** El `apk` que se descarga está
compilado desde el código que está aquí, así que el código fuente está disponible en la misma
dirección desde la que se obtiene la app. Si en algún momento se distribuyeran binarios por otra
vía, esa condición obliga a seguir apuntándolos.

**El nombre "B-Day" no forma parte de la licencia.** El GPL concede permisos sobre el código, no
sobre la marca, así que el nombre, el icono y la identidad visual siguen siendo del titular del
proyecto y nadie puede usarlos como si fueran suyos.