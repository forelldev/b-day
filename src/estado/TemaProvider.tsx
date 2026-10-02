import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { leerAjuste, escribirAjuste, CLAVE_COLOR_MARCA, CLAVE_COLOR_FONDO } from '../db/ajustes';
import {
  COLORES_POR_DEFECTO,
  crearColores,
  normalizarHex,
  type Colores,
} from '../ui/tema';

export { CLAVE_COLOR_MARCA, CLAVE_COLOR_FONDO } from '../db/ajustes';

interface ValorContexto {
  /** Color de marca e interfaz. */
  colorMarca: string;
  /** Color de fondo de las pantallas. */
  colorFondo: string;
  /** Paleta completa ya derivada a partir de los dos anteriores. */
  colores: Colores;
  cambiarColorMarca: (color: string) => void;
  cambiarColorFondo: (color: string) => void;
  /** Vuelve a los rosita y blanco de fábrica. */
  restablecer: () => void;
}

const Contexto = createContext<ValorContexto | null>(null);

/**
 * Colores de la interfaz.
 *
 * El usuario solo elige dos: el de la marca y el del fondo. Todo lo demás se
 * deriva en `crearColores`, así que un solo cambio de color propaga a botones,
 * bordes, textos y calendario sin tocar cada pantalla.
 *
 * Se guardan en la tabla de ajustes, que ya existía para la hora, de modo que
 * los colores sobreviven a cerrar la app.
 */
export function ProveedorTema({ children }: { children: React.ReactNode }) {
  const [colorMarca, setColorMarca] = useState<string>(COLORES_POR_DEFECTO.marca);
  const [colorFondo, setColorFondo] = useState<string>(COLORES_POR_DEFECTO.fondo);

  // Carga inicial. La app pinta con los valores por defecto mientras lee, que
  // además son los que ya había, así que no se nota el parpadeo.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const [marca, fondo] = await Promise.all([
          leerAjuste(CLAVE_COLOR_MARCA),
          leerAjuste(CLAVE_COLOR_FONDO),
        ]);
        if (!vivo) return;
        const m = marca ? normalizarHex(marca) : null;
        const f = fondo ? normalizarHex(fondo) : null;
        if (m) setColorMarca(m);
        if (f) setColorFondo(f);
      } catch {
        // Sin ajustes guardados se queda con los colores por defecto, que es
        // justo lo que debe pasar si la base de datos no está disponible.
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const aplicar = useCallback((marca: string, fondo: string) => {
    setColorMarca(marca);
    setColorFondo(fondo);
    void escribirAjuste(CLAVE_COLOR_MARCA, marca);
    void escribirAjuste(CLAVE_COLOR_FONDO, fondo);
  }, []);

  const cambiarColorMarca = useCallback(
    (color: string) => {
      const normalizado = normalizarHex(color);
      if (normalizado) aplicar(normalizado, colorFondo);
    },
    [aplicar, colorFondo],
  );

  const cambiarColorFondo = useCallback(
    (color: string) => {
      const normalizado = normalizarHex(color);
      if (normalizado) aplicar(colorMarca, normalizado);
    },
    [aplicar, colorMarca],
  );

  const restablecer = useCallback(() => {
    aplicar(COLORES_POR_DEFECTO.marca, COLORES_POR_DEFECTO.fondo);
  }, [aplicar]);

  const colores = useMemo(() => crearColores(colorMarca, colorFondo), [colorMarca, colorFondo]);

  const valor = useMemo<ValorContexto>(
    () => ({ colorMarca, colorFondo, colores, cambiarColorMarca, cambiarColorFondo, restablecer }),
    [colorMarca, colorFondo, colores, cambiarColorMarca, cambiarColorFondo, restablecer],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTema(): ValorContexto {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error('useTema debe usarse dentro de <ProveedorTema>');
  }
  return contexto;
}