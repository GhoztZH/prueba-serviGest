import { esGestion, type AuthUser } from '../../../../shared/domain/auth-user';
import { BusinessRuleError, ForbiddenError, ValidationError } from '../../../../shared/domain/errors';
import type { Estado } from '../../../../shared/domain/estados';
import { esClienteDueno, esTecnicoAsignado, type DatosAcceso } from './acceso';

/** Papel del usuario RESPECTO A UNA SOLICITUD concreta (no solo su rol global). */
export type Actor = 'GESTION' | 'TECNICO_ASIGNADO' | 'CLIENTE_DUENO';

export interface ReglaTransicion {
  de: Estado;
  a: Estado;
  actores: readonly Actor[];
  requiere?: 'comentario' | 'resolucion';
}

export const MIN_COMENTARIO = 5;
export const MIN_RESOLUCION = 20;
export const MIN_MOTIVO_REAPERTURA = 10;

const ATENCION: readonly Actor[] = ['GESTION', 'TECNICO_ASIGNADO'];

/**
 * Máquina de estados de la solicitud. Es la ÚNICA fuente de las transiciones
 * permitidas (contrato OpenAPI, `PATCH /solicitudes/{id}/estado`): lo que no
 * está en esta tabla no se puede hacer.
 *
 * Fuera de la tabla, a propósito:
 * - `ASIGNADA` solo se alcanza mediante una asignación (valida especialidad,
 *   disponibilidad y carga).
 * - Desde `CERRADA` no sale ninguna transición: solo la reapertura autorizada.
 * - `CANCELADA` es terminal.
 */
export const TRANSICIONES: readonly ReglaTransicion[] = [
  { de: 'REGISTRADA', a: 'APROBADA', actores: ['GESTION'] },
  { de: 'REGISTRADA', a: 'CANCELADA', actores: ['GESTION', 'CLIENTE_DUENO'], requiere: 'comentario' },
  { de: 'APROBADA', a: 'CANCELADA', actores: ['GESTION', 'CLIENTE_DUENO'], requiere: 'comentario' },
  { de: 'ASIGNADA', a: 'EN_PROCESO', actores: ATENCION },
  { de: 'ASIGNADA', a: 'CANCELADA', actores: ['GESTION'], requiere: 'comentario' },
  { de: 'EN_PROCESO', a: 'PENDIENTE_INFO', actores: ATENCION, requiere: 'comentario' },
  { de: 'EN_PROCESO', a: 'RESUELTA', actores: ATENCION, requiere: 'resolucion' },
  { de: 'PENDIENTE_INFO', a: 'EN_PROCESO', actores: ATENCION },
  { de: 'PENDIENTE_INFO', a: 'CANCELADA', actores: ['GESTION'], requiere: 'comentario' },
  { de: 'RESUELTA', a: 'CERRADA', actores: ['GESTION', 'CLIENTE_DUENO'] },
  { de: 'RESUELTA', a: 'EN_PROCESO', actores: ['GESTION', 'CLIENTE_DUENO'], requiere: 'comentario' },
];

export interface DatosTransicion extends DatosAcceso {
  resolucion: string | null;
}

export function actoresDe(user: AuthUser, s: DatosAcceso): Actor[] {
  const actores: Actor[] = [];
  if (esGestion(user)) actores.push('GESTION');
  if (esTecnicoAsignado(user, s)) actores.push('TECNICO_ASIGNADO');
  if (esClienteDueno(user, s)) actores.push('CLIENTE_DUENO');
  return actores;
}

/** Estados a los que ESTE usuario puede llevar ESTA solicitud (para que la interfaz solo ofrezca lo permitido). */
export function transicionesPermitidas(user: AuthUser, s: DatosAcceso): Estado[] {
  const actores = actoresDe(user, s);
  return TRANSICIONES.filter((t) => t.de === s.estado && t.actores.some((a) => actores.includes(a))).map((t) => t.a);
}

/**
 * Valida un cambio de estado solicitado. Lanza:
 * - REGLA_NEGOCIO (422) si la transición no existe;
 * - PROHIBIDO (403) si existe pero el usuario no puede ejecutarla;
 * - VALIDACION (422) si falta el comentario o la resolución que exige.
 */
export function validarTransicion(
  user: AuthUser,
  s: DatosTransicion,
  destino: Estado,
  datos: { comentario?: string | null; resolucion?: string | null },
): ReglaTransicion {
  if (s.estado === 'CERRADA') {
    // Regla 4: una solicitud cerrada no retrocede sin reapertura autorizada y auditada.
    throw new BusinessRuleError('Una solicitud cerrada solo puede cambiar mediante una reapertura autorizada');
  }
  if (destino === 'ASIGNADA') {
    throw new BusinessRuleError('El estado ASIGNADA solo se obtiene asignando un técnico a la solicitud');
  }
  const regla = TRANSICIONES.find((t) => t.de === s.estado && t.a === destino);
  if (!regla) throw new BusinessRuleError(`Transición no permitida: ${s.estado} → ${destino}`);

  const actores = actoresDe(user, s);
  if (!regla.actores.some((a) => actores.includes(a))) {
    // Regla 2: el técnico solo modifica solicitudes asignadas a su cargo.
    throw new ForbiddenError('No tiene permisos para realizar este cambio de estado');
  }

  if (regla.requiere === 'comentario' && (datos.comentario?.trim().length ?? 0) < MIN_COMENTARIO) {
    throw ValidationError.campo('comentario', `Indique el motivo (mínimo ${MIN_COMENTARIO} caracteres)`);
  }
  if (regla.requiere === 'resolucion' && (datos.resolucion?.trim().length ?? 0) < MIN_RESOLUCION) {
    throw ValidationError.campo('resolucion', `Documente la resolución (mínimo ${MIN_RESOLUCION} caracteres)`);
  }
  if (destino === 'CERRADA' && !s.resolucion?.trim()) {
    // Regla 1: no se cierra una solicitud sin resolución documentada.
    throw new BusinessRuleError('No se puede cerrar una solicitud sin una resolución documentada');
  }
  return regla;
}

/** Regla 4: la reapertura es exclusiva de ADMIN/COORDINADOR, solo sobre solicitudes cerradas y con motivo. */
export function validarReapertura(user: AuthUser, s: DatosAcceso, motivo: string): void {
  if (!esGestion(user)) throw new ForbiddenError('Solo un administrador o coordinador puede reabrir una solicitud');
  if (s.estado !== 'CERRADA') throw new BusinessRuleError('Solo se puede reabrir una solicitud cerrada');
  if (motivo.trim().length < MIN_MOTIVO_REAPERTURA) {
    throw ValidationError.campo('motivo', `Justifique la reapertura (mínimo ${MIN_MOTIVO_REAPERTURA} caracteres)`);
  }
}

/** La solicitud reabierta vuelve a manos del técnico si conserva uno; si no, queda lista para asignar. */
export function estadoTrasReapertura(s: Pick<DatosAcceso, 'tecnico_id'>): Estado {
  return s.tecnico_id ? 'EN_PROCESO' : 'APROBADA';
}
