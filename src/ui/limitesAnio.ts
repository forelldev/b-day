/**
 * Rango de años que ofrece el selector de cumpleaños.
 *
 * Vive aparte del componente porque los tests lo necesitan y el runner de Node
 * no puede importar un archivo TSX sin configurar JSX.
 */

export const ANIO_MINIMO = 1900;

/**
 * Último año de la lista: el año en curso.
 *
 * Nadie nace en el futuro, así que ofrecer 2027 o 2036 solo sirve para que
 * alguien apunte un año equivocado sin darse cuenta. Y como la edad solo se
 * deduce cuando el año guardado es anterior al actual, elegir uno de esos años
 * a futuro deja la edad en blanco.
 */
export function anioMaximo(): number {
  return new Date().getFullYear();
}
