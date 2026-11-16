import type { HistorialItem } from '../../../../shared/application/ports';
import type { AuthUser } from '../../../../shared/domain/auth-user';
import { BadRequestError, BusinessRuleError } from '../../../../shared/domain/errors';
import type { Adjunto, ArchivoSubido } from '../../domain/entities/solicitud';
import type { AlmacenAdjuntos } from '../../domain/interfaces/solicitud.repository';
import { puedeAportar } from '../../domain/rules/acceso';
import { resumenEvento, type SolicitudDeps } from '../dto/solicitud.dto';
import { cargarVisible } from './consultar-solicitudes';
import { guardarAdjuntos } from './registrar-solicitud';

const SOLICITUD_FINALIZADA = 'La solicitud está cerrada o cancelada y ya no admite cambios';

/** Comentario sobre la solicitud: notas de seguimiento y respuestas a una solicitud de información. */
export class ComentarSolicitudUseCase {
  constructor(private readonly deps: SolicitudDeps) {}

  execute(user: AuthUser, id: number, comentario: string): Promise<HistorialItem[]> {
    const { historial, eventos, uow } = this.deps;
    return uow.run(async () => {
      const solicitud = await cargarVisible(this.deps, user, id, true);
      if (!puedeAportar(user, solicitud)) throw new BusinessRuleError(SOLICITUD_FINALIZADA);

      await historial.registrar({ solicitudId: id, usuarioId: user.id, accion: 'COMENTARIO', comentario });
      await eventos.publicar({
        tipo: 'COMENTARIO',
        actorId: user.id,
        actorNombre: user.nombre,
        solicitud: resumenEvento(solicitud),
        comentario,
      });
      return historial.listar(id);
    });
  }
}

export class AdjuntarArchivosUseCase {
  constructor(
    private readonly deps: SolicitudDeps,
    private readonly almacen: AlmacenAdjuntos,
  ) {}

  async execute(user: AuthUser, id: number, archivos: ArchivoSubido[]): Promise<Adjunto[]> {
    const { repo, eventos, uow } = this.deps;
    try {
      return await uow.run(async () => {
        if (!archivos.length) throw new BadRequestError('Adjunte al menos un archivo en el campo "adjuntos"');
        const solicitud = await cargarVisible(this.deps, user, id, true);
        if (!puedeAportar(user, solicitud)) throw new BusinessRuleError(SOLICITUD_FINALIZADA);

        await guardarAdjuntos(this.deps, this.almacen, id, archivos, user.id);
        await eventos.publicar({ tipo: 'ADJUNTO', actorId: user.id, actorNombre: user.nombre, solicitud: resumenEvento(solicitud) });
        return repo.listarAdjuntos(id);
      });
    } catch (error) {
      await this.almacen.descartar(archivos.map((a) => a.nombreArchivo));
      throw error;
    }
  }
}
