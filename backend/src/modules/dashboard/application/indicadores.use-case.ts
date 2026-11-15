import type { Clock, ParametrosOperativos } from '../../../shared/application/ports';
import type { AuthUser } from '../../../shared/domain/auth-user';
import { ValidationError } from '../../../shared/domain/errors';
import { alcanceDe, umbralPorVencer } from '../../requests';
import {
  DIAS_POR_DEFECTO,
  RANGO_MAXIMO_DIAS,
  diasEntre,
  fechaLocal,
  porcentajeCumplimiento,
  sumarDias,
  type DashboardRepository,
  type FiltroIndicadores,
  type Indicadores,
} from '../domain/indicadores';

export interface IndicadoresEntrada {
  desde?: string;
  hasta?: string;
  categoriaId?: number;
  prioridadId?: number;
  clienteId?: number;
  tecnicoId?: number;
}

export class IndicadoresUseCase {
  constructor(
    private readonly repo: DashboardRepository,
    private readonly parametros: ParametrosOperativos,
    private readonly clock: Clock,
    private readonly zonaHoraria: string,
  ) {}

  async execute(user: AuthUser, entrada: IndicadoresEntrada): Promise<Indicadores> {
    const filtros = this.resolverFiltros(user, entrada);
    if (!filtros) return this.vacio(entrada);

    const umbral = await umbralPorVencer(this.parametros);
    const [g, porEstado, prioridades, cargaPorTecnico, evolucion] = await Promise.all([
      this.repo.generales(filtros, umbral),
      this.repo.porEstado(filtros),
      this.repo.porPrioridad(filtros),
      // La carga del equipo es información operativa interna: no se expone al cliente.
      user.rol === 'CLIENTE' ? Promise.resolve([]) : this.repo.cargaPorTecnico(filtros),
      this.repo.evolucion(filtros),
    ]);

    return {
      filtros,
      resumen: { total: g.total, abiertas: g.abiertas, resueltas: g.resueltas, cerradas: g.cerradas, canceladas: g.canceladas },
      porEstado,
      porPrioridad: prioridades.map(({ codigo, nombre, total }) => ({ codigo, nombre, total })),
      cargaPorTecnico,
      tiempoResolucion: {
        global: g.horas_promedio,
        porPrioridad: prioridades.map(({ codigo, nombre, horas, resueltas }) => ({ codigo, nombre, horas, resueltas })),
      },
      cumplimiento: {
        aTiempo: g.a_tiempo,
        fueraDePlazo: g.fuera_de_plazo,
        porcentaje: porcentajeCumplimiento(g.a_tiempo, g.fuera_de_plazo),
      },
      vencimientos: { vencidas: g.vencidas, por_vencer: g.por_vencer, abiertas: g.abiertas },
      evolucion,
    };
  }

  /**
   * Período por defecto: últimos 30 días. El alcance por rol se IMPONE sobre
   * lo que pida el cliente HTTP: un CLIENTE siempre ve su empresa y un TECNICO
   * sus solicitudes, aunque envíen otro `cliente_id` / `tecnico_id`.
   */
  private resolverFiltros(user: AuthUser, e: IndicadoresEntrada): FiltroIndicadores | null {
    const alcance = alcanceDe(user);
    if (!alcance) return null;

    const hasta = e.hasta ?? fechaLocal(this.clock.now(), this.zonaHoraria);
    const desde = e.desde ?? sumarDias(hasta, -(DIAS_POR_DEFECTO - 1));
    const dias = diasEntre(desde, hasta);
    if (dias < 0) throw ValidationError.campo('hasta', 'Debe ser posterior a la fecha inicial');
    if (dias > RANGO_MAXIMO_DIAS) throw ValidationError.campo('desde', `El período máximo es de ${RANGO_MAXIMO_DIAS} días`);

    return {
      desde,
      hasta,
      categoriaId: e.categoriaId,
      prioridadId: e.prioridadId,
      clienteId: alcance.clienteId ?? (user.rol === 'TECNICO' ? undefined : e.clienteId),
      tecnicoId: alcance.tecnicoId ?? (user.rol === 'CLIENTE' ? undefined : e.tecnicoId),
    };
  }

  private vacio(e: IndicadoresEntrada): Indicadores {
    const hasta = e.hasta ?? fechaLocal(this.clock.now(), this.zonaHoraria);
    return {
      filtros: { desde: e.desde ?? sumarDias(hasta, -(DIAS_POR_DEFECTO - 1)), hasta },
      resumen: { total: 0, abiertas: 0, resueltas: 0, cerradas: 0, canceladas: 0 },
      porEstado: [],
      porPrioridad: [],
      cargaPorTecnico: [],
      tiempoResolucion: { global: null, porPrioridad: [] },
      cumplimiento: { aTiempo: 0, fueraDePlazo: 0, porcentaje: null },
      vencimientos: { vencidas: 0, por_vencer: 0, abiertas: 0 },
      evolucion: [],
    };
  }
}
