import type { AuthUser } from '../../../../shared/domain/auth-user';
import { ConflictError, ValidationError } from '../../../../shared/domain/errors';
import type { Estado } from '../../../../shared/domain/estados';
import type { SolicitudVista } from '../../domain/entities/solicitud';
import type { CambiosSolicitud } from '../../domain/interfaces/solicitud.repository';
import { calcularFechaLimite } from '../../domain/rules/plazo';
import { estadoTrasReapertura, validarReapertura, validarTransicion } from '../../domain/rules/transiciones';
import { aVista, resumenEvento, umbralPorVencer, type SolicitudDeps } from '../dto/solicitud.dto';
import { cargarVisible } from './consultar-solicitudes';

export interface CambioEstadoEntrada {
  estado: Estado;
  comentario?: string | null;
  resolucion?: string | null;
  prioridad_id?: number;
  /** Si se envía, activa el control de concurrencia optimista. */
  version?: number;
}

/**
 * Cambio de estado con reglas. Toda la operación es una transacción:
 * bloqueo de la fila → validación contra la máquina de estados → actualización
 * → historial (regla 7) → evento de notificación. Si algo falla, nada se aplica.
 */
export class CambiarEstadoUseCase {
  constructor(private readonly deps: SolicitudDeps) {}

  execute(user: AuthUser, id: number, entrada: CambioEstadoEntrada): Promise<SolicitudVista> {
    const { repo, historial, eventos, uow, clock, parametros } = this.deps;
    return uow.run(async () => {
      // Regla 8: existencia, estado vigente y coherencia bajo bloqueo de fila.
      const actual = await cargarVisible(this.deps, user, id, true);
      if (entrada.version !== undefined && entrada.version !== actual.version) {
        throw new ConflictError('La solicitud fue modificada por otro usuario. Actualice la página e intente de nuevo');
      }
      validarTransicion(user, actual, entrada.estado, entrada);

      const ahora = clock.now();
      const comentario = entrada.comentario?.trim() || null;
      const cambios: CambiosSolicitud = { estado: entrada.estado };
      const detalle: Record<string, unknown> = {};

      if (entrada.estado === 'APROBADA' && entrada.prioridad_id && entrada.prioridad_id !== actual.prioridad_id) {
        // Al aprobar, gestión puede ajustar la prioridad: el plazo se recalcula desde el registro.
        const horas = await repo.horasPlazo(entrada.prioridad_id);
        if (horas === undefined) throw ValidationError.campo('prioridad_id', 'La prioridad no existe');
        cambios.prioridadId = entrada.prioridad_id;
        cambios.fechaLimite = calcularFechaLimite(actual.created_at, horas);
      }
      if (entrada.estado === 'RESUELTA') {
        cambios.resolucion = entrada.resolucion!.trim();
        cambios.fechaResolucion = ahora;
      }
      if (entrada.estado === 'CERRADA') cambios.fechaCierre = ahora;
      if (actual.estado === 'RESUELTA' && entrada.estado === 'EN_PROCESO') {
        // Rechazo de la resolución: deja de estar resuelta; el texto rechazado queda en el historial.
        cambios.resolucion = null;
        cambios.fechaResolucion = null;
        detalle.resolucion_rechazada = actual.resolucion;
      }

      await repo.actualizar(id, cambios);
      const actualizada = (await repo.buscar(id))!;

      await historial.registrar({
        solicitudId: id,
        usuarioId: user.id,
        accion: 'CAMBIO_ESTADO',
        estadoAnterior: actual.estado,
        estadoNuevo: entrada.estado,
        comentario: entrada.estado === 'RESUELTA' ? cambios.resolucion : comentario,
        detalle: Object.keys(detalle).length ? detalle : null,
      });
      if (cambios.prioridadId) {
        await historial.registrar({
          solicitudId: id,
          usuarioId: user.id,
          accion: 'CAMBIO_PRIORIDAD',
          detalle: {
            prioridad_anterior: actual.prioridad,
            prioridad_nueva: actualizada.prioridad,
            fecha_limite_anterior: actual.fecha_limite,
            fecha_limite_nueva: actualizada.fecha_limite,
          },
        });
      }

      await eventos.publicar({
        tipo: 'CAMBIO_ESTADO',
        actorId: user.id,
        actorNombre: user.nombre,
        solicitud: resumenEvento(actualizada),
        estadoAnterior: actual.estado,
        comentario: comentario ?? cambios.resolucion ?? null,
      });
      return aVista(actualizada, ahora, await umbralPorVencer(parametros));
    });
  }
}

/**
 * Regla 4: reapertura autorizada y auditada de una solicitud cerrada.
 * Solo ADMIN/COORDINADOR, con motivo. Queda en el historial inalterable con la
 * resolución y las fechas que tenía, y el plazo se reinicia desde la reapertura.
 */
export class ReabrirSolicitudUseCase {
  constructor(private readonly deps: SolicitudDeps) {}

  execute(user: AuthUser, id: number, motivo: string): Promise<SolicitudVista> {
    const { repo, historial, eventos, uow, clock, parametros } = this.deps;
    return uow.run(async () => {
      const actual = await cargarVisible(this.deps, user, id, true);
      validarReapertura(user, actual, motivo);

      const ahora = clock.now();
      const nuevoEstado = estadoTrasReapertura(actual);
      await repo.actualizar(id, {
        estado: nuevoEstado,
        resolucion: null,
        fechaResolucion: null,
        fechaCierre: null,
        fechaLimite: calcularFechaLimite(ahora, actual.horas_plazo),
      });
      const reabierta = (await repo.buscar(id))!;

      await historial.registrar({
        solicitudId: id,
        usuarioId: user.id,
        accion: 'REAPERTURA',
        estadoAnterior: 'CERRADA',
        estadoNuevo: nuevoEstado,
        comentario: motivo.trim(),
        detalle: {
          resolucion_anterior: actual.resolucion,
          fecha_resolucion_anterior: actual.fecha_resolucion,
          fecha_cierre_anterior: actual.fecha_cierre,
          fecha_limite_anterior: actual.fecha_limite,
          fecha_limite_nueva: reabierta.fecha_limite,
        },
      });
      await eventos.publicar({
        tipo: 'REAPERTURA',
        actorId: user.id,
        actorNombre: user.nombre,
        solicitud: resumenEvento(reabierta),
        estadoAnterior: 'CERRADA',
        comentario: motivo.trim(),
      });
      return aVista(reabierta, ahora, await umbralPorVencer(parametros));
    });
  }
}
