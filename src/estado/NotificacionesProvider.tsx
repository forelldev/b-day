import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  guardarAvisosActivos,
  guardarUltimaSincronizacion,
  guardarZonaSincronizacion,
  leerAvisosActivos,
  leerUltimaSincronizacion,
  leerZonaSincronizacion,
} from '../db/ajustes';
import { programarTodo, contarProgramados, type ResultadoProgramacion } from '../notifications/agenda';
import { asegurarCanal } from '../notifications/canal';
import { SIN_NOTIFICACIONES } from '../notifications/expoNotifications';
import { leerEstado, pedirPermiso, type EstadoNotificaciones } from '../notifications/permisos';
import { hoyIso, necesitaReconstruirAgenda, zonaHorariaActual } from '../utils/date';

interface ValorContexto {
  permiso: EstadoNotificaciones['permiso'];
  permisoCargando: boolean;
  /** Interruptor general de los cuatro avisos. */
  avisosActivos: boolean;
  /** Resultado de la última reconstrucción de la agenda. */
  ultimaProgramacion: ResultadoProgramacion | null;
  programados: number;
  sincronizando: boolean;
  pedirPermisoAhora: () => Promise<void>;
  cambiarAvisosActivos: (activo: boolean) => Promise<void>;
  sincronizar: () => Promise<void>;
  refrescarPermiso: () => Promise<void>;
}

const Contexto = createContext<ValorContexto | null>(null);

/**
 * Dueño del estado de notificaciones: pide permisos, mantiene la agenda al día
 * y la reconstruye cuando cambia el día o vuelve el usuario a la app.
 */
export function ProveedorNotificaciones({ children }: { children: React.ReactNode }) {
  const [permiso, setPermiso] = useState<EstadoNotificaciones['permiso']>('sin-preguntar');
  const [permisoCargando, setPermisoCargando] = useState(true);
  const [avisosActivos, setAvisosActivos] = useState(true);
  const [ultimaProgramacion, setUltimaProgramacion] = useState<ResultadoProgramacion | null>(null);
  const [programados, setProgramados] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  const refrescarPermiso = useCallback(async () => {
    const estado = await leerEstado();
    setPermiso(estado.permiso);
  }, []);

  // Evita que dos sincronizaciones se solapen (montaje + primer render).
  const enCurso = useRef(false);
  const diaUltimaSync = useRef<string | null>(null);
  const zonaUltimaSync = useRef<string | null>(null);

  const sincronizar = useCallback(async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setSincronizando(true);
    try {
      if (SIN_NOTIFICACIONES) {
        setProgramados(0);
        return;
      }

      const hoy = hoyIso();
      const zona = zonaHorariaActual();
      // El aviso inmediato de un cumpleaños cuya hora ya pasó solo se envía una vez al día,
      // para no repetir la notificación cada vez que se abre la app.
      const { diaNuevo } = necesitaReconstruirAgenda(diaUltimaSync.current, zonaUltimaSync.current, hoy, zona);

      const resultado = await programarTodo({ celebrarHoy: diaNuevo });
      setUltimaProgramacion(resultado);

      if (diaNuevo) {
        await guardarUltimaSincronizacion(hoy);
        diaUltimaSync.current = hoy;
      }
      // La zona se guarda siempre, no solo cuando es día nuevo: si el usuario
      // viaja, los avisos se recalculan y hay que dejar constancia de la zona
      // con la que se han hecho.
      if (zonaUltimaSync.current !== zona) {
        await guardarZonaSincronizacion(zona);
        zonaUltimaSync.current = zona;
      }

      setProgramados(resultado.programados + resultado.celebrados);
    } finally {
      enCurso.current = false;
      setSincronizando(false);
    }
  }, []);

  const pedirPermisoAhora = useCallback(async () => {
    setPermisoCargando(true);
    try {
      if (SIN_NOTIFICACIONES) return;
      const estado = await pedirPermiso();
      setPermiso(estado.permiso);
      await sincronizar();
    } finally {
      setPermisoCargando(false);
    }
  }, [sincronizar]);

  const cambiarAvisosActivos = useCallback(
    async (activo: boolean) => {
      setAvisosActivos(activo);
      await guardarAvisosActivos(activo);
      await sincronizar();
    },
    [sincronizar],
  );

  // Arranque: canal, permisos y primera agenda.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (SIN_NOTIFICACIONES) return;

        await asegurarCanal();

        setAvisosActivos(await leerAvisosActivos());

        if (diaUltimaSync.current === null) {
          diaUltimaSync.current = await leerUltimaSincronizacion();
        }
        if (zonaUltimaSync.current === null) {
          zonaUltimaSync.current = await leerZonaSincronizacion();
        }

        // Al abrir por primera vez se pide el permiso directamente. Si ya se
        // denegó, Android no vuelve a mostrar el diálogo: entonces no se
        // insiste y el banner de la lista ofrece abrir los ajustes.
        const inicial = await leerEstado();
        const permisoInicial =
          inicial.permiso === 'sin-preguntar' ? (await pedirPermiso()).permiso : inicial.permiso;
        if (vivo) setPermiso(permisoInicial);

        // La agenda se reconstruye igual: aunque el permiso esté denegado,
        // los avisos quedan preparados para cuando el usuario lo conceda.
        if (vivo) await sincronizar();
      } catch {
        // Un fallo aquí no debe impedir abrir la app: la lista de cumpleaños
        // funciona igual y la agenda se reintentará al volver a entrar.
      } finally {
        if (vivo) setPermisoCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [sincronizar]);

  // Si la app queda abierta y cambia el día, el usuario cambia de zona horaria
  // (vuela a otro país con el móvil puesto a la hora local), o vuelve desde
  // atrás, hay que rehacer la agenda: los avisos que ya dispararon se
  // sustituyen por los del año siguiente, y los que se calcularon con la zona
  // anterior por los de la nueva.
  useEffect(() => {
    const comprobar = () => {
      const { reconstruir } = necesitaReconstruirAgenda(
        diaUltimaSync.current,
        zonaUltimaSync.current,
        hoyIso(),
        zonaHorariaActual(),
      );
      if (reconstruir) {
        void sincronizar();
      } else {
        void contarProgramados().then(setProgramados).catch(() => undefined);
      }
    };

    const alVolver = (estado: AppStateStatus) => {
      if (estado === 'active') comprobar();
    };

    const suscripcion = AppState.addEventListener('change', alVolver);
    // El intervalo cubre el cambio de día y de zona estando la app en segundo
    // plano, que no dispara ningún evento de `AppState`.
    const intervalo = setInterval(comprobar, 60_000);

    return () => {
      suscripcion.remove();
      clearInterval(intervalo);
    };
  }, [sincronizar]);

  const valor = useMemo<ValorContexto>(
    () => ({
      permiso,
      permisoCargando,
      avisosActivos,
      ultimaProgramacion,
      programados,
      sincronizando,
      pedirPermisoAhora,
      cambiarAvisosActivos,
      sincronizar,
      refrescarPermiso,
    }),
    [
      permiso,
      permisoCargando,
      avisosActivos,
      ultimaProgramacion,
      programados,
      sincronizando,
      pedirPermisoAhora,
      cambiarAvisosActivos,
      sincronizar,
      refrescarPermiso,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useNotificaciones(): ValorContexto {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error('useNotificaciones debe usarse dentro de <ProveedorNotificaciones>');
  }
  return contexto;
}