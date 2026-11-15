import type { Database } from '../../../../shared/db/database';
import { ESTADOS_CARGA, sqlLista } from '../../../../shared/domain/estados';
import type { FiltroTecnicos, TechnicianRepository, Tecnico, TecnicoAsignable } from '../../domain/technicians';

/** La carga se deriva de las solicitudes: una sola definición para listados, asignación y dashboard. */
const CARGA = `(SELECT COUNT(*)::int
                  FROM solicitudes s JOIN estados e ON e.id = s.estado_id
                 WHERE s.tecnico_id = t.id AND e.codigo IN (${sqlLista(ESTADOS_CARGA)}))`;

const TECNICO = `
  SELECT t.id, t.usuario_id, u.nombre, u.email, t.cedula, t.telefono, t.disponible,
         t.max_solicitudes_activas, t.activo, ${CARGA} AS carga_actual,
         COALESCE((SELECT json_agg(json_build_object('id', es.id, 'nombre', es.nombre) ORDER BY es.nombre)
                     FROM tecnico_especialidades te JOIN especialidades es ON es.id = te.especialidad_id
                    WHERE te.tecnico_id = t.id), '[]'::json) AS especialidades,
         t.created_at, t.updated_at
    FROM tecnicos t
    JOIN usuarios u ON u.id = t.usuario_id`;

const ASIGNABLE = `
  SELECT t.id, t.usuario_id AS "usuarioId", u.nombre, (t.activo AND u.activo) AS activo, t.disponible,
         t.max_solicitudes_activas AS "maxSolicitudesActivas", ${CARGA} AS "cargaActual",
         COALESCE((SELECT array_agg(te.especialidad_id) FROM tecnico_especialidades te WHERE te.tecnico_id = t.id),
                  '{}') AS "especialidadIds"
    FROM tecnicos t
    JOIN usuarios u ON u.id = t.usuario_id`;

export class PgTechnicianRepository implements TechnicianRepository {
  constructor(private readonly db: Database) {}

  async listar(filtro: FiltroTecnicos): Promise<{ filas: Tecnico[]; total: number }> {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (filtro.q) {
      params.push(`%${filtro.q}%`);
      condiciones.push(`(u.nombre ILIKE $${params.length} OR t.cedula ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (filtro.especialidadId) {
      params.push(filtro.especialidadId);
      condiciones.push(`EXISTS (SELECT 1 FROM tecnico_especialidades te WHERE te.tecnico_id = t.id AND te.especialidad_id = $${params.length})`);
    }
    if (filtro.disponible !== undefined) {
      params.push(filtro.disponible);
      condiciones.push(`t.disponible = $${params.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const total = await this.db.one<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM tecnicos t JOIN usuarios u ON u.id = t.usuario_id ${where}`,
      params,
    );
    const filas = await this.db.query<Tecnico>(
      `${TECNICO} ${where} ORDER BY u.nombre ASC, t.id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filtro.limit, filtro.offset],
    );
    return { filas, total: total?.total ?? 0 };
  }

  buscar(id: number): Promise<Tecnico | undefined> {
    return this.db.one<Tecnico>(`${TECNICO} WHERE t.id = $1`, [id]);
  }

  async existeCedula(cedula: string, exceptoId?: number): Promise<boolean> {
    return (await this.db.one(`SELECT 1 FROM tecnicos WHERE cedula = $1 AND id <> $2`, [cedula, exceptoId ?? 0])) !== undefined;
  }

  async especialidadesVigentes(ids: number[]): Promise<number[]> {
    const filas = await this.db.query<{ id: number }>(`SELECT id FROM especialidades WHERE activo AND id = ANY($1::int[])`, [ids]);
    return filas.map((f) => f.id);
  }

  async crear(d: { usuarioId: number; cedula: string; telefono: string | null; maxSolicitudesActivas: number }): Promise<number> {
    const fila = await this.db.one<{ id: number }>(
      `INSERT INTO tecnicos (usuario_id, cedula, telefono, max_solicitudes_activas) VALUES ($1, $2, $3, $4) RETURNING id`,
      [d.usuarioId, d.cedula, d.telefono, d.maxSolicitudesActivas],
    );
    return fila!.id;
  }

  async actualizar(
    id: number,
    c: { cedula?: string; telefono?: string | null; disponible?: boolean; maxSolicitudesActivas?: number; activo?: boolean },
  ): Promise<void> {
    await this.db.execute(
      `UPDATE tecnicos
          SET cedula = COALESCE($2, cedula),
              telefono = CASE WHEN $3 THEN $4 ELSE telefono END,
              disponible = COALESCE($5, disponible),
              max_solicitudes_activas = COALESCE($6, max_solicitudes_activas),
              activo = COALESCE($7, activo)
        WHERE id = $1`,
      [id, c.cedula ?? null, c.telefono !== undefined, c.telefono ?? null, c.disponible ?? null, c.maxSolicitudesActivas ?? null, c.activo ?? null],
    );
  }

  async reemplazarEspecialidades(id: number, especialidadIds: number[]): Promise<void> {
    await this.db.execute(`DELETE FROM tecnico_especialidades WHERE tecnico_id = $1`, [id]);
    await this.db.execute(
      `INSERT INTO tecnico_especialidades (tecnico_id, especialidad_id) SELECT $1, UNNEST($2::int[])`,
      [id, especialidadIds],
    );
  }

  async totalAsignaciones(id: number): Promise<number> {
    const fila = await this.db.one<{ total: number }>(`SELECT COUNT(*)::int AS total FROM asignaciones WHERE tecnico_id = $1`, [id]);
    return fila!.total;
  }

  async eliminar(id: number): Promise<void> {
    await this.db.execute(`DELETE FROM tecnicos WHERE id = $1`, [id]);
  }

  async obtenerAsignable(id: number, bloquear: boolean): Promise<TecnicoAsignable | undefined> {
    if (bloquear) await this.db.query(`SELECT id FROM tecnicos WHERE id = $1 FOR UPDATE`, [id]);
    return this.db.one<TecnicoAsignable>(`${ASIGNABLE} WHERE t.id = $1`, [id]);
  }

  asignablesConEspecialidad(especialidadId: number): Promise<TecnicoAsignable[]> {
    return this.db.query<TecnicoAsignable>(
      `${ASIGNABLE}
        WHERE EXISTS (SELECT 1 FROM tecnico_especialidades te WHERE te.tecnico_id = t.id AND te.especialidad_id = $1)
        ORDER BY u.nombre`,
      [especialidadId],
    );
  }
}
