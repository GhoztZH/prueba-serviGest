import { esGestion, type AuthUser } from '../../../../shared/domain/auth-user';
import { BusinessRuleError, ForbiddenError, ValidationError } from '../../../../shared/domain/errors';
import { aVista, cargarVisible, resumenEvento, umbralPorVencer, type SolicitudDeps, type SolicitudVista } from '../../../requests';
import {
  compararCandidatos,
  motivosNoElegible,
  tipoDeAsignacion,
  validarMotivo,
  type AsignacionRepository,
  type TecnicosParaAsignar,
} from '../../domain/asignacion';

export interface CandidatoSugerido {
  id: number;
  nombre: string;
  carga_actual: number;
  max_solicitudes_activas: number;
  disponible: boolean;
  elegible: boolean;
  motivos: string[];
}

/**
 * Asignación y reasignación de técnico. No es un cambio de campo: en una sola
 * transacción bloquea la solicitud y al técnico, valida las reglas del negocio,
 * cierra la asignación vigente, crea la nueva, deja la solicitud en ASIGNADA y
 * registra responsable, fecha y motivo en el historial.
 */
export class AsignarTecnicoUseCase {
  constructor(
    private readonly solicitudes: SolicitudDeps,
    private readonly asignaciones: AsignacionRepository,
    private readonly tecnicos: TecnicosParaAsignar,
  ) {}

  execute(user: AuthUser, solicitudId: number, entrada: { tecnico_id: number; motivo?: string | null }): Promise<SolicitudVista> {
    const { repo, historial, eventos, uow, clock, parametros } = this.solicitudes;
    return uow.run(async () => {
      if (!esGestion(user)) throw new ForbiddenError();
      const solicitud = await cargarVisible(this.solicitudes, user, solicitudId, true);
      const tipo = tipoDeAsignacion(solicitud.estado);
      validarMotivo(tipo, entrada.motivo);

      const tecnico = await this.tecnicos.obtenerAsignable(entrada.tecnico_id, true);
      if (!tecnico) throw ValidationError.campo('tecnico_id', 'El técnico no existe');
      const motivos = motivosNoElegible(tecnico, solicitud.especialidad_id, solicitud.tecnico_id);
      if (motivos.length) throw new BusinessRuleError('El técnico no cumple las condiciones de asignación', { motivos });

      const ahora = clock.now();
      const motivo = entrada.motivo?.trim() || null;
      await this.asignaciones.cerrarActiva(solicitudId, ahora);
      await this.asignaciones.crear({ solicitudId, tecnicoId: tecnico.id, asignadoPor: user.id, motivo, fecha: ahora });
      await repo.actualizar(solicitudId, { estado: 'ASIGNADA', tecnicoId: tecnico.id });

      await historial.registrar({
        solicitudId,
        usuarioId: user.id,
        accion: tipo,
        estadoAnterior: solicitud.estado,
        estadoNuevo: 'ASIGNADA',
        comentario: motivo,
        detalle: {
          tecnico_id: tecnico.id,
          tecnico_nombre: tecnico.nombre,
          tecnico_anterior_id: solicitud.tecnico_id,
          tecnico_anterior_nombre: solicitud.tecnico_nombre,
        },
      });

      const asignada = (await repo.buscar(solicitudId))!;
      await eventos.publicar({
        tipo,
        actorId: user.id,
        actorNombre: user.nombre,
        solicitud: resumenEvento(asignada),
        estadoAnterior: solicitud.estado,
        tecnicoAnteriorId: solicitud.tecnico_id,
        comentario: motivo,
      });
      return aVista(asignada, ahora, await umbralPorVencer(parametros));
    });
  }

  /** Técnicos con la especialidad de la categoría, con su elegibilidad explicada y ordenados por ocupación. */
  async sugerir(user: AuthUser, solicitudId: number): Promise<CandidatoSugerido[]> {
    if (!esGestion(user)) throw new ForbiddenError();
    const solicitud = await cargarVisible(this.solicitudes, user, solicitudId);
    const candidatos = await this.tecnicos.asignablesConEspecialidad(solicitud.especialidad_id);
    return candidatos
      .map((t) => {
        const motivos = motivosNoElegible(t, solicitud.especialidad_id, solicitud.tecnico_id);
        return {
          id: t.id,
          nombre: t.nombre,
          carga_actual: t.cargaActual,
          max_solicitudes_activas: t.maxSolicitudesActivas,
          disponible: t.disponible,
          elegible: motivos.length === 0,
          motivos,
        };
      })
      .sort(compararCandidatos);
  }
}
