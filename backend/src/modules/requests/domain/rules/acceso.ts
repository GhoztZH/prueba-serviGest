import { esGestion, type AuthUser } from '../../../../shared/domain/auth-user';
import type { Estado } from '../../../../shared/domain/estados';

export interface DatosAcceso {
  cliente_id: number;
  tecnico_id: number | null;
  estado: Estado;
}

export function esClienteDueno(user: AuthUser, s: DatosAcceso): boolean {
  return user.rol === 'CLIENTE' && user.clienteId !== null && user.clienteId === s.cliente_id;
}

export function esTecnicoAsignado(user: AuthUser, s: DatosAcceso): boolean {
  return user.rol === 'TECNICO' && user.tecnicoId !== null && user.tecnicoId === s.tecnico_id;
}

/**
 * Alcance de consulta por recurso:
 * - Regla 3: un cliente únicamente ve los registros de su propia empresa.
 * - Regla 2: un técnico únicamente accede a las solicitudes asignadas a su cargo.
 * - ADMIN y COORDINADOR ven todas.
 * Cuando esto devuelve `false` la API responde 404, para no revelar que el recurso existe.
 */
export function puedeVerSolicitud(user: AuthUser, s: DatosAcceso): boolean {
  return esGestion(user) || esClienteDueno(user, s) || esTecnicoAsignado(user, s);
}

/** Comentarios y adjuntos: quien ve la solicitud, mientras no esté en un estado final. */
export function puedeAportar(user: AuthUser, s: DatosAcceso): boolean {
  return puedeVerSolicitud(user, s) && s.estado !== 'CERRADA' && s.estado !== 'CANCELADA';
}

/**
 * Filtro de alcance para listados e indicadores. Devuelve `null` cuando el
 * usuario no puede ver nada (cuenta de cliente o técnico sin perfil asociado).
 */
export function alcanceDe(user: AuthUser): { clienteId?: number; tecnicoId?: number } | null {
  if (esGestion(user)) return {};
  if (user.rol === 'CLIENTE') return user.clienteId ? { clienteId: user.clienteId } : null;
  return user.tecnicoId ? { tecnicoId: user.tecnicoId } : null;
}
