import {
  Notifications,
  type NotificationRequest,
  type NotificationRequestInput,
} from './expoNotifications';
import { CANAL } from './canal';
import { listarCumpleaneros, type Cumpleanero } from '../db/cumpleaneros';
import {
  LIMITE_PROGRAMADOS,
  leerAvisosActivos,
  leerColorMarcaNotificacion,
  leerHoraNotificacion,
} from '../db/ajustes';
import {
  OFFSETS,
  OFFSETS_SOLO_HOY,
  cumpleanerosParaCelebrar,
  edadEnCumpleDelAviso,
  fechaLarga,
  instanteRecordatorioSiguienteCiclo,
  pluralAnios,
  proximoInstanteRecordatorio,
  textoEdadAviso,
  type OffsetDias,
} from '../utils/date';

export interface ResultadoProgramacion {
  programados: number;
  /** Recordatorios descartados por el límite de alarmas del sistema. */
  omitidosPorLimite: number;
  /** Avisos immediate enviados por cumpleaños de hoy a una hora ya pasada. */
  celebrados: number;
  errores: string[];
}

interface Candidato {
  cumpleanero: Cumpleanero;
  offset: OffsetDias;
  instante: Date;
  /** Los avisos del próximo ciclo son la red de seguridad si la app no se
   *  vuelve a abrir antes del año que viene. */
  siguienteCiclo: boolean;
}

function nombreCompleto(c: Cumpleanero): string {
  return `${c.nombre} ${c.apellido}`;
}

/**
 * Texto de cada aviso según los días que faltan, con la edad que se cumple en
 * ese cumpleaños concreto.
 *
 * Cuando el año guardado no permite deducir una edad (es el año actual o
 * posterior) se conserva el texto sin cifras en lugar de inventar una.
 */
function redactar(
  c: Cumpleanero,
  offset: OffsetDias,
  instante: Date,
): { titulo: string; cuerpo: string } {
  const quien = nombreCompleto(c);
  const edad = edadEnCumpleDelAviso(c.fechaNacimiento, instante, offset, c.anioDesconocido);
  const frase = textoEdadAviso(edad, offset);
  // La frase de la edad va en su propia oración detrás de la principal.
  const cierre = (base: string) => (frase ? `${base}. ${frase}.` : `${base}.`);

  switch (offset) {
    case -2:
      return {
        titulo: 'Faltan 2 días',
        cuerpo: cierre(`El ${fechaLarga(instante)} cumple años ${quien}`),
      };
    case -1:
      return {
        titulo: '¡Mañana cumple años!',
        cuerpo: cierre(`${quien} cumple años mañana, ${fechaLarga(instante)}`),
      };
    case 0:
      return {
        titulo: '¡Hoy cumple años!',
        cuerpo: cierre(`¡Felicita a ${quien}! Hoy es su cumpleaños`),
      };
    case 1: {
      // Aquí la edad sustituye a "años" dentro de la frase, porque repetir
      // "cumplió años ayer. Cumplió 24 años." sonaría mal.
      const n = edad === null ? 'años' : pluralAnios(edad);
      return {
        titulo: 'Felicitación tardía',
        cuerpo: `${quien} cumplió ${n} ayer. ¡Todavía estás a tiempo de felicitarle!`,
      };
    }
  }
}

function construirPeticion(
  c: Cumpleanero,
  offset: OffsetDias,
  instante: Date,
  inmediato: boolean,
  colorMarca: string,
): NotificationRequestInput {
  const { titulo, cuerpo } = redactar(c, offset, instante);
  return {
    content: {
      title: titulo,
      body: cuerpo,
      color: colorMarca,
      sound: 'default',
      data: { cumpleaneroId: c.id, offset },
    },
    trigger: inmediato
      ? null
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: instante,
          channelId: CANAL,
        },
  };
}

/**
 * Reconstruye por completo la agenda de recordatorios.
 *
 * Se cancela todo y se vuelve a crear. Es idempotente y de coste bajo
 * (unas decenas de llamadas), y así nunca quedan avisos huérfanos de
 * cumpleaños que el usuario haya borrado o cambiado de fecha.
 */
export async function programarTodo(opciones: { celebrarHoy?: boolean } = {}): Promise<ResultadoProgramacion> {
  const resultado: ResultadoProgramacion = {
    programados: 0,
    omitidosPorLimite: 0,
    celebrados: 0,
    errores: [],
  };

  const cumpleaneros = await listarCumpleaneros();
  const { hora, minuto } = await leerHoraNotificacion();
  const colorMarca = await leerColorMarcaNotificacion();

  // Con el interruptor apagado solo queda el aviso del propio día del
  // cumpleaños; los de antes y después se descartan.
  const avisosActivos = await leerAvisosActivos();
  const offsets = avisosActivos ? OFFSETS : OFFSETS_SOLO_HOY;

  const candidatos: Candidato[] = [];
  const vistos = new Set<string>();

  const anadir = (c: Cumpleanero, offset: OffsetDias, instante: Date, siguienteCiclo: boolean) => {
    const clave = `${c.id}|${offset}|${instante.getTime()}`;
    if (vistos.has(clave)) return;
    vistos.add(clave);
    candidatos.push({ cumpleanero: c, offset, instante, siguienteCiclo });
  };

  for (const c of cumpleaneros) {
    for (const offset of offsets) {
      anadir(c, offset, proximoInstanteRecordatorio(c.fechaNacimiento, offset, hora, minuto), false);
      anadir(c, offset, instanteRecordatorioSiguienteCiclo(c.fechaNacimiento, offset, hora, minuto), true);
    }
  }

  // Lo más próximo primero; los del siguiente ciclo nunca desplazan a uno real.
  candidatos.sort((a, b) => {
    if (a.instante.getTime() !== b.instante.getTime()) return a.instante.getTime() - b.instante.getTime();
    return Number(a.siguienteCiclo) - Number(b.siguienteCiclo);
  });

  const seleccionados = candidatos.slice(0, LIMITE_PROGRAMADOS);
  resultado.omitidosPorLimite = candidatos.length - seleccionados.length;

  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const candidato of seleccionados) {
    try {
      await Notifications.scheduleNotificationAsync(
        construirPeticion(candidato.cumpleanero, candidato.offset, candidato.instante, false, colorMarca),
      );
      resultado.programados += 1;
    } catch (error) {
      resultado.errores.push(describirError(error));
    }
  }

  if (opciones.celebrarHoy) {
    resultado.celebrados = await celebrarCumpleanerosDeHoy(
      cumpleaneros,
      hora,
      minuto,
      resultado,
      colorMarca,
      avisosActivos,
    );
  }

  return resultado;
}

/**
 * Avisa al instante de los cumpleaños que son hoy pero cuya hora programada ya
 * pasó: si el usuario abre la app a las 14:00 y dejó los avisos a las 09:00,
 * el de "hoy" no se puede programar hacia atrás, así que se envía ya.
 */
async function celebrarCumpleanerosDeHoy(
  cumpleaneros: Cumpleanero[],
  hora: number,
  minuto: number,
  resultado: ResultadoProgramacion,
  colorMarca: string,
  avisosActivos: boolean,
): Promise<number> {
  let total = 0;
  // Solo se celebra si el interruptor está activo; la decisión vive en
  // `cumpleanerosParaCelebrar` para poder probarla sin Android.
  const pendientes = cumpleanerosParaCelebrar(
    cumpleaneros.map((c) => c.fechaNacimiento),
    hora,
    minuto,
    avisosActivos,
  );
  for (const c of cumpleaneros) {
    if (!pendientes.includes(c.fechaNacimiento)) continue;
    try {
      await Notifications.scheduleNotificationAsync(
        construirPeticion(c, 0, new Date(), true, colorMarca),
      );
      total += 1;
    } catch (error) {
      resultado.errores.push(describirError(error));
    }
  }
  return total;
}

/** Cuántos avisos hay programados ahora mismo. */
export async function contarProgramados(): Promise<number> {
  const pendientes = await Notifications.getAllScheduledNotificationsAsync();
  return pendientes.length;
}

/**
 * Avisos del cumpleaños de una persona concreta. Se usa en la ficha para
 * mostrarle al usuario exactamente qué tiene guardado el sistema.
 */
export async function listarProgramadosDe(cumpleaneroId: number): Promise<NotificationRequest[]> {
  const pendientes = await Notifications.getAllScheduledNotificationsAsync();
  return pendientes.filter(
    (p) => (p.content.data as { cumpleaneroId?: number } | undefined)?.cumpleaneroId === cumpleaneroId,
  );
}

/** Borra los avisos de una persona. La agenda completa se reconstruye luego. */
export async function cancelarProgramadosDe(cumpleaneroId: number): Promise<void> {
  const suyos = await listarProgramadosDe(cumpleaneroId);
  for (const p of suyos) {
    try {
      await Notifications.cancelScheduledNotificationAsync(p.identifier);
    } catch {
      // Si ya no existe, da igual: el objetivo es que no quede programmed.
    }
  }
}

function describirError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}