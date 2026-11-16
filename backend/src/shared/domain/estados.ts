/** Estados del ciclo de vida de la solicitud (códigos del catálogo `estados`). */
export const ESTADOS = [
  'REGISTRADA',
  'APROBADA',
  'ASIGNADA',
  'EN_PROCESO',
  'PENDIENTE_INFO',
  'RESUELTA',
  'CERRADA',
  'CANCELADA',
] as const;
export type Estado = (typeof ESTADOS)[number];

/** Estados en los que la solicitud ocupa cupo del técnico asignado (carga de trabajo). */
export const ESTADOS_CARGA: readonly Estado[] = ['ASIGNADA', 'EN_PROCESO', 'PENDIENTE_INFO'];

/** Estados "abiertos": la solicitud aún no tiene resolución y su plazo corre. */
export const ESTADOS_ABIERTOS: readonly Estado[] = ['REGISTRADA', 'APROBADA', 'ASIGNADA', 'EN_PROCESO', 'PENDIENTE_INFO'];

/** Lista SQL literal de códigos (constantes del dominio, nunca entrada de usuario). */
export const sqlLista = (estados: readonly Estado[]): string => estados.map((e) => `'${e}'`).join(', ');

/** Estados en los que se puede asignar (APROBADA) o reasignar (los demás) un técnico. */
export const ESTADOS_ASIGNABLES: readonly Estado[] = ['APROBADA', 'ASIGNADA', 'EN_PROCESO', 'PENDIENTE_INFO'];
