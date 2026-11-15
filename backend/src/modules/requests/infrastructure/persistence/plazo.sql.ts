import { ESTADOS_ABIERTOS, sqlLista } from '../../../../shared/domain/estados';

/**
 * Fragmentos SQL equivalentes a `domain/rules/plazo.ts`, para filtrar y
 * agregar en la base (listados y dashboard) con el MISMO criterio con el que
 * el dominio etiqueta cada solicitud. Suponen los alias `s` (solicitudes),
 * `e` (estados) y `p` (prioridades).
 */
export const SQL_ABIERTA = `e.codigo IN (${sqlLista(ESTADOS_ABIERTOS)})`;

export const SQL_VENCIDA = `(${SQL_ABIERTA} AND s.fecha_limite < NOW())`;

/** `umbral` es el marcador del parámetro con el porcentaje (p. ej. `$3`). */
export const sqlPorVencer = (umbral: string): string =>
  `(${SQL_ABIERTA} AND s.fecha_limite >= NOW()
     AND s.fecha_limite - NOW() <= make_interval(secs => (p.horas_plazo * 36.0 * ${umbral}::numeric)::double precision))`;
