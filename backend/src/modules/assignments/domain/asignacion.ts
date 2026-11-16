import { BusinessRuleError, ValidationError } from '../../../shared/domain/errors';
import { ESTADOS_ASIGNABLES, type Estado } from '../../../shared/domain/estados';

/** Técnico visto por las reglas de asignación (lo provee el módulo de técnicos). */
export interface TecnicoCandidato {
  id: number;
  usuarioId: number;
  nombre: string;
  /** Ficha y cuenta de acceso vigentes. */
  activo: boolean;
  disponible: boolean;
  maxSolicitudesActivas: number;
  cargaActual: number;
  especialidadIds: number[];
}

export interface TecnicosParaAsignar {
  /** `bloquear` serializa asignaciones simultáneas al mismo técnico (evita superar su carga máxima). */
  obtenerAsignable(id: number, bloquear: boolean): Promise<TecnicoCandidato | undefined>;
  asignablesConEspecialidad(especialidadId: number): Promise<TecnicoCandidato[]>;
}

export interface AsignacionRepository {
  cerrarActiva(solicitudId: number, fin: Date): Promise<void>;
  crear(datos: { solicitudId: number; tecnicoId: number; asignadoPor: number; motivo: string | null; fecha: Date }): Promise<void>;
}

export type TipoAsignacion = 'ASIGNACION' | 'REASIGNACION';
export const MIN_MOTIVO_REASIGNACION = 10;

/**
 * Regla 5: la asignación valida especialidad, disponibilidad y restricciones
 * de carga. Devuelve TODOS los motivos por los que el técnico no es elegible
 * (lista vacía = elegible), para que quien asigna sepa exactamente qué falla.
 */
export function motivosNoElegible(
  tecnico: TecnicoCandidato,
  especialidadRequeridaId: number,
  tecnicoActualId: number | null = null,
): string[] {
  const motivos: string[] = [];
  if (tecnico.id === tecnicoActualId) motivos.push('El técnico ya tiene asignada esta solicitud');
  if (!tecnico.activo) motivos.push('El técnico no está activo');
  if (!tecnico.disponible) motivos.push('El técnico no está disponible');
  if (!tecnico.especialidadIds.includes(especialidadRequeridaId)) {
    motivos.push('El técnico no tiene la especialidad requerida por la categoría');
  }
  if (tecnico.cargaActual >= tecnico.maxSolicitudesActivas) {
    motivos.push(`El técnico alcanzó su carga máxima (${tecnico.cargaActual} de ${tecnico.maxSolicitudesActivas} solicitudes activas)`);
  }
  return motivos;
}

/** APROBADA → primera asignación; ASIGNADA / EN_PROCESO / PENDIENTE_INFO → reasignación. */
export function tipoDeAsignacion(estado: Estado): TipoAsignacion {
  if (!ESTADOS_ASIGNABLES.includes(estado)) {
    throw new BusinessRuleError(
      estado === 'REGISTRADA'
        ? 'La solicitud debe ser aprobada antes de asignar un técnico'
        : `No se puede asignar un técnico a una solicitud en estado ${estado}`,
    );
  }
  return estado === 'APROBADA' ? 'ASIGNACION' : 'REASIGNACION';
}

/** Una reasignación siempre se justifica. */
export function validarMotivo(tipo: TipoAsignacion, motivo: string | null | undefined): void {
  if (tipo === 'REASIGNACION' && (motivo?.trim().length ?? 0) < MIN_MOTIVO_REASIGNACION) {
    throw ValidationError.campo('motivo', `Justifique la reasignación (mínimo ${MIN_MOTIVO_REASIGNACION} caracteres)`);
  }
}

/** Orden de sugerencia: primero los elegibles y, entre ellos, los de menor ocupación. */
export function compararCandidatos(
  a: { elegible: boolean; carga_actual: number; max_solicitudes_activas: number },
  b: { elegible: boolean; carga_actual: number; max_solicitudes_activas: number },
): number {
  if (a.elegible !== b.elegible) return a.elegible ? -1 : 1;
  return a.carga_actual / a.max_solicitudes_activas - b.carga_actual / b.max_solicitudes_activas;
}
