import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { listarCumpleaneros, type Cumpleanero } from '../db/cumpleaneros';
import { diasParaCumple, edadActual } from '../utils/date';

export interface CumpleaneroConCuenta extends Cumpleanero {
  /** Días hasta el próximo cumpleaños (0 = hoy). */
  dias: number;
  /** Edad que tiene hoy, o `null` si el año guardado no permite deducirla. */
  edad: number | null;
}

interface ValorContexto {
  cumpleaneros: CumpleaneroConCuenta[];
  cargando: boolean;
  error: string | null;
  recargar: () => Promise<void>;
}

const Contexto = createContext<ValorContexto | null>(null);

/**
 * Comparador por urgencia: primero quien cumple antes, y a igual distancia por
 * apellido, para que la lista no se reordene sola en cada recarga.
 */
function comparar(a: CumpleaneroConCuenta, b: CumpleaneroConCuenta): number {
  if (a.dias !== b.dias) return a.dias - b.dias;
  const apellido = a.apellido.localeCompare(b.apellido, 'es', { sensitivity: 'base' });
  if (apellido !== 0) return apellido;
  return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
}

/** Lectura de la base de datos y cálculo de la cuenta atrás y la edad. */
async function cargarLista(): Promise<CumpleaneroConCuenta[]> {
  const filas = await listarCumpleaneros();
  const ahora = new Date();
  return filas
    .map((c) => ({
      ...c,
      dias: diasParaCumple(c.fechaNacimiento, ahora),
      edad: edadActual(c.fechaNacimiento, ahora),
    }))
    .sort(comparar);
}

/**
 * Fuente única de la lista de cumpleaños para todas las pantallas.
 * Cualquier alta, edición o borrado llama a `recargar()` y la lista entera se
 * pone al día sin tener que sincronizar pantallas a mano.
 */
export function ProveedorCumpleaneros({ children }: { children: React.ReactNode }) {
  const [cumpleaneros, setCumpleaneros] = useState<CumpleaneroConCuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      setCumpleaneros(await cargarLista());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga inicial. El `vivo` evita escribir en el estado si el usuario ya salió.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const lista = await cargarLista();
        if (!vivo) return;
        setCumpleaneros(lista);
        setError(null);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const valor = useMemo<ValorContexto>(
    () => ({ cumpleaneros, cargando, error, recargar }),
    [cumpleaneros, cargando, error, recargar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCumpleaneros(): ValorContexto {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error('useCumpleaneros debe usarse dentro de <ProveedorCumpleaneros>');
  }
  return contexto;
}