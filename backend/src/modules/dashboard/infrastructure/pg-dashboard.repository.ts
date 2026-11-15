import type { Database } from '../../../shared/db/database';
import { ESTADOS_CARGA, sqlLista } from '../../../shared/domain/estados';
import { SQL_ABIERTA, SQL_VENCIDA, sqlPorVencer } from '../../requests';
import type { ConteosGenerales, DashboardRepository, FiltroIndicadores, Indicadores } from '../domain/indicadores';

const BASE = `
    FROM solicitudes s
    JOIN estados e ON e.id = s.estado_id
    JOIN prioridades p ON p.id = s.prioridad_id`;

const RESUELTA_EN_HORAS = `EXTRACT(EPOCH FROM (s.fecha_resolucion - s.created_at)) / 3600`;

/**
 * Indicadores agregados directamente en PostgreSQL a partir de las solicitudes
 * persistidas. No hay valores estáticos ni cálculos en el navegador.
 */
export class PgDashboardRepository implements DashboardRepository {
  constructor(
    private readonly db: Database,
    private readonly zonaHoraria: string,
  ) {}

  /**
   * Condiciones del filtro. `conFechas` añade el período (por fecha de
   * registro, en la zona horaria de operación); las dimensiones se aplican siempre.
   */
  private filtro(f: FiltroIndicadores, conFechas = true): { where: string; params: unknown[] } {
    const params: unknown[] = [this.zonaHoraria];
    const condiciones: string[] = [];
    const param = (valor: unknown) => {
      params.push(valor);
      return `$${params.length}`;
    };
    if (conFechas) {
      condiciones.push(`(s.created_at AT TIME ZONE $1)::date BETWEEN ${param(f.desde)}::date AND ${param(f.hasta)}::date`);
    }
    if (f.categoriaId) condiciones.push(`s.categoria_id = ${param(f.categoriaId)}`);
    if (f.prioridadId) condiciones.push(`s.prioridad_id = ${param(f.prioridadId)}`);
    if (f.clienteId) condiciones.push(`s.cliente_id = ${param(f.clienteId)}`);
    if (f.tecnicoId) condiciones.push(`s.tecnico_id = ${param(f.tecnicoId)}`);
    // `$1 IS NOT NULL` mantiene el parámetro de zona horaria en uso aunque no haya filtro de fechas.
    return { where: `WHERE $1::text IS NOT NULL${condiciones.map((c) => ` AND ${c}`).join('')}`, params };
  }

  async generales(f: FiltroIndicadores, umbralPct: number): Promise<ConteosGenerales> {
    const { where, params } = this.filtro(f);
    const umbral = `$${params.length + 1}`;
    const fila = await this.db.one<ConteosGenerales>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE ${SQL_ABIERTA})::int AS abiertas,
              COUNT(*) FILTER (WHERE e.codigo = 'RESUELTA')::int AS resueltas,
              COUNT(*) FILTER (WHERE e.codigo = 'CERRADA')::int AS cerradas,
              COUNT(*) FILTER (WHERE e.codigo = 'CANCELADA')::int AS canceladas,
              COUNT(*) FILTER (WHERE s.fecha_resolucion IS NOT NULL AND s.fecha_resolucion <= s.fecha_limite)::int AS a_tiempo,
              COUNT(*) FILTER (WHERE (s.fecha_resolucion IS NOT NULL AND s.fecha_resolucion > s.fecha_limite)
                                  OR ${SQL_VENCIDA})::int AS fuera_de_plazo,
              COUNT(*) FILTER (WHERE ${SQL_VENCIDA})::int AS vencidas,
              COUNT(*) FILTER (WHERE ${sqlPorVencer(umbral)})::int AS por_vencer,
              ROUND((AVG(${RESUELTA_EN_HORAS}) FILTER (WHERE s.fecha_resolucion IS NOT NULL))::numeric, 1) AS horas_promedio
       ${BASE} ${where}`,
      [...params, umbralPct],
    );
    return fila!;
  }

  porEstado(f: FiltroIndicadores): Promise<Indicadores['porEstado']> {
    const { where, params } = this.filtro(f);
    return this.db.query(
      `SELECT est.codigo, est.nombre, COALESCE(x.total, 0)::int AS total
         FROM estados est
         LEFT JOIN (SELECT s.estado_id, COUNT(*) AS total ${BASE} ${where} GROUP BY s.estado_id) x ON x.estado_id = est.id
        ORDER BY est.orden`,
      params,
    );
  }

  porPrioridad(f: FiltroIndicadores) {
    const { where, params } = this.filtro(f);
    return this.db.query<{ codigo: string; nombre: string; total: number; horas: number | null; resueltas: number }>(
      `SELECT pr.codigo, pr.nombre, COALESCE(x.total, 0)::int AS total, x.horas, COALESCE(x.resueltas, 0)::int AS resueltas
         FROM prioridades pr
         LEFT JOIN (SELECT s.prioridad_id, COUNT(*) AS total,
                           COUNT(s.fecha_resolucion) AS resueltas,
                           ROUND((AVG(${RESUELTA_EN_HORAS}) FILTER (WHERE s.fecha_resolucion IS NOT NULL))::numeric, 1) AS horas
                    ${BASE} ${where} GROUP BY s.prioridad_id) x ON x.prioridad_id = pr.id
        ORDER BY pr.orden`,
      params,
    );
  }

  /**
   * `activas` es la carga ACTUAL del técnico (no depende del período: es su
   * ocupación de hoy frente a su máximo); `resueltas` sí respeta el filtro.
   */
  cargaPorTecnico(f: FiltroIndicadores): Promise<Indicadores['cargaPorTecnico']> {
    const { where, params } = this.filtro(f);
    const soloTecnico = f.tecnicoId ? `AND t.id = $${params.length + 1}` : '';
    return this.db.query(
      `SELECT t.id AS tecnico_id, u.nombre, t.max_solicitudes_activas AS maximo, t.disponible,
              (SELECT COUNT(*)::int FROM solicitudes sa JOIN estados ea ON ea.id = sa.estado_id
                WHERE sa.tecnico_id = t.id AND ea.codigo IN (${sqlLista(ESTADOS_CARGA)})) AS activas,
              (SELECT COUNT(*)::int ${BASE} ${where} AND s.tecnico_id = t.id AND s.fecha_resolucion IS NOT NULL) AS resueltas
         FROM tecnicos t
         JOIN usuarios u ON u.id = t.usuario_id
        WHERE t.activo ${soloTecnico}
        ORDER BY activas DESC, u.nombre`,
      f.tecnicoId ? [...params, f.tecnicoId] : params,
    );
  }

  /** Serie diaria completa (los días sin movimiento aparecen en cero). */
  evolucion(f: FiltroIndicadores): Promise<Indicadores['evolucion']> {
    const { where, params } = this.filtro(f, false);
    const desde = `$${params.length + 1}`;
    const hasta = `$${params.length + 2}`;
    return this.db.query(
      `SELECT to_char(d.dia, 'YYYY-MM-DD') AS fecha,
              (SELECT COUNT(*)::int ${BASE} ${where} AND (s.created_at AT TIME ZONE $1)::date = d.dia) AS creadas,
              (SELECT COUNT(*)::int ${BASE} ${where} AND s.fecha_resolucion IS NOT NULL
                  AND (s.fecha_resolucion AT TIME ZONE $1)::date = d.dia) AS resueltas
         FROM (SELECT generate_series(${desde}::date, ${hasta}::date, INTERVAL '1 day')::date AS dia) d
        ORDER BY d.dia`,
      [...params, f.desde, f.hasta],
    );
  }
}
