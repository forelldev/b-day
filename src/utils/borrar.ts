import { Alert } from 'react-native';

import { eliminarCumpleanero, type Cumpleanero } from '../db/cumpleaneros';

/**
 * Borrado con confirmación. Vive aquí porque lo usan dos pantallas (la ficha y
 * la lista) y tiene que comportarse igual en las dos: mismo texto, mismos
 * botones y mismo aviso si la base de datos falla.
 */
export function confirmarBorrado(
  cumpleanero: Pick<Cumpleanero, 'id' | 'nombre' | 'apellido'>,
  alBorrar: () => Promise<void>,
): void {
  const nombre = `${cumpleanero.nombre} ${cumpleanero.apellido}`.trim();

  Alert.alert(
    `¿Eliminar a ${nombre}?`,
    'Se borrará de la lista y también sus recordatorios ya programados.',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await eliminarCumpleanero(cumpleanero.id);
            await alBorrar();
          } catch (e) {
            Alert.alert('No se pudo eliminar', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ],
  );
}