import { offsetDe, pagina, type Pagina, type Paginacion } from '../../../shared/application/pagination';
import type { EventoSolicitud, EventosSolicitud } from '../../../shared/application/ports';
import type { UnitOfWork } from '../../../shared/application/unit-of-work';
import { NotFoundError } from '../../../shared/domain/errors';
import {
  audienciaEnVivo,
  planificarNotificaciones,
  type CanalTiempoReal,
  type Notificacion,
  type NotificationRepository,
} from '../domain/notificaciones';

export class NotificationService implements EventosSolicitud {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly canal: CanalTiempoReal,
    private readonly uow: UnitOfWork,
  ) {}

  /**
   * Las notificaciones se persisten DENTRO de la transacción del evento (si la
   * operación se revierte, no queda un aviso de algo que no ocurrió) y se
   * empujan a los navegadores SOLO tras el commit.
   */
  async publicar(evento: EventoSolicitud): Promise<void> {
    const audiencia = await this.repo.audiencia({
      clienteId: evento.solicitud.clienteId,
      tecnicoId: evento.solicitud.tecnicoId,
      tecnicoAnteriorId: evento.tecnicoAnteriorId,
    });
    const creadas = await this.repo.crear(planificarNotificaciones(evento, audiencia));

    this.uow.afterCommit(() => {
      for (const notificacion of creadas) this.canal.emitir([notificacion.usuario_id], 'notificacion', notificacion);
      this.canal.emitir(audienciaEnVivo(audiencia), 'solicitud:actualizada', {
        id: evento.solicitud.id,
        codigo: evento.solicitud.codigo,
        estado: evento.solicitud.estado,
        tipo: evento.tipo,
      });
    });
  }

  async listar(usuarioId: number, filtro: Paginacion & { noLeidas?: boolean }): Promise<Pagina<Notificacion> & { noLeidas: number }> {
    const { filas, total } = await this.repo.listar(usuarioId, { ...filtro, offset: offsetDe(filtro) });
    return { ...pagina(filas, total, filtro), noLeidas: await this.repo.contarNoLeidas(usuarioId) };
  }

  async marcarLeida(id: number, usuarioId: number): Promise<void> {
    if (!(await this.repo.marcarLeida(id, usuarioId))) throw new NotFoundError('Notificación');
  }

  async marcarTodasLeidas(usuarioId: number): Promise<{ actualizadas: number }> {
    return { actualizadas: await this.repo.marcarTodasLeidas(usuarioId) };
  }
}
