import { offsetDe, pagina, type Pagina, type Paginacion } from '../../../../shared/application/pagination';
import type { HistorialItem } from '../../../../shared/application/ports';
import { esGestion, type AuthUser } from '../../../../shared/domain/auth-user';
import { NotFoundError } from '../../../../shared/domain/errors';
import { ESTADOS_ASIGNABLES } from '../../../../shared/domain/estados';
import type { AdjuntoAlmacenado, Solicitud, SolicitudVista } from '../../domain/entities/solicitud';
import type { AsignacionesLectura, FiltroSolicitudes } from '../../domain/interfaces/solicitud.repository';
import { alcanceDe, puedeAportar, puedeVerSolicitud } from '../../domain/rules/acceso';
import { transicionesPermitidas } from '../../domain/rules/transiciones';
import { aVista, umbralPorVencer, type SolicitudDeps, type SolicitudDetalle } from '../dto/solicitud.dto';

export type FiltroListado = Paginacion &
  Omit<FiltroSolicitudes, 'alcance' | 'umbralPorVencerPct' | 'zonaHoraria' | 'limit' | 'offset'>;

/**
 * Carga una solicitud verificando que el usuario puede verla. Si no existe o
 * no le corresponde, la respuesta es la misma (404): no se revela su existencia.
 */
export async function cargarVisible(
  deps: Pick<SolicitudDeps, 'repo'>,
  user: AuthUser,
  id: number,
  bloquear = false,
): Promise<Solicitud> {
  const solicitud = await deps.repo.buscar(id, { bloquear });
  if (!solicitud || !puedeVerSolicitud(user, solicitud)) throw new NotFoundError('Solicitud');
  return solicitud;
}

export class ConsultarSolicitudesUseCase {
  constructor(
    private readonly deps: SolicitudDeps,
    private readonly asignaciones: AsignacionesLectura,
    private readonly zonaHoraria: string,
  ) {}

  /** Listado paginado. El alcance por rol se aplica en la consulta, no después. */
  async listar(user: AuthUser, filtro: FiltroListado): Promise<Pagina<SolicitudVista>> {
    const alcance = alcanceDe(user);
    if (!alcance) return pagina([], 0, filtro);
    const umbral = await umbralPorVencer(this.deps.parametros);
    const { filas, total } = await this.deps.repo.listar({
      ...filtro,
      alcance,
      umbralPorVencerPct: umbral,
      zonaHoraria: this.zonaHoraria,
      offset: offsetDe(filtro),
    });
    const ahora = this.deps.clock.now();
    return pagina(
      filas.map((s) => aVista(s, ahora, umbral)),
      total,
      filtro,
    );
  }

  async detalle(user: AuthUser, id: number): Promise<SolicitudDetalle> {
    const solicitud = await cargarVisible(this.deps, user, id);
    const [adjuntos, asignaciones, umbral] = await Promise.all([
      this.deps.repo.listarAdjuntos(id),
      this.asignaciones.listarPorSolicitud(id),
      umbralPorVencer(this.deps.parametros),
    ]);
    const aporta = puedeAportar(user, solicitud);
    return {
      ...aVista(solicitud, this.deps.clock.now(), umbral),
      adjuntos,
      asignaciones,
      acciones: {
        transiciones: transicionesPermitidas(user, solicitud),
        puedeAsignar: esGestion(user) && ESTADOS_ASIGNABLES.includes(solicitud.estado),
        puedeReabrir: esGestion(user) && solicitud.estado === 'CERRADA',
        puedeComentar: aporta,
        puedeAdjuntar: aporta,
      },
    };
  }

  async historial(user: AuthUser, id: number): Promise<HistorialItem[]> {
    await cargarVisible(this.deps, user, id);
    return this.deps.historial.listar(id);
  }

  async adjunto(user: AuthUser, id: number, adjuntoId: number): Promise<AdjuntoAlmacenado> {
    await cargarVisible(this.deps, user, id);
    const adjunto = await this.deps.repo.buscarAdjunto(id, adjuntoId);
    if (!adjunto) throw new NotFoundError('Adjunto');
    return adjunto;
  }
}
