import type { Database } from '../../../shared/db/database';
import type { Audiencia, Notificacion, NotificacionNueva, NotificationRepository } from '../domain/notificaciones';

const NOTIFICACION = `
  SELECT n.id, n.usuario_id, n.tipo, n.titulo, n.mensaje, n.solicitud_id, s.codigo AS solicitud_codigo, n.leida, n.created_at
    FROM notificaciones n
    LEFT JOIN solicitudes s ON s.id = n.solicitud_id`;

export class PgNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Database) {}

  async audiencia(s: { clienteId: number; tecnicoId: number | null; tecnicoAnteriorId?: number | null }): Promise<Audiencia> {
    const fila = await this.db.one<{
      coordinadores: number[];
      admins: number[];
      cliente: number | null;
      tecnico: number | null;
      tecnico_anterior: number | null;
    }>(
      `SELECT
         COALESCE((SELECT array_agg(u.id) FROM usuarios u JOIN roles r ON r.id = u.rol_id
                    WHERE u.activo AND r.codigo = 'COORDINADOR'), '{}') AS coordinadores,
         COALESCE((SELECT array_agg(u.id) FROM usuarios u JOIN roles r ON r.id = u.rol_id
                    WHERE u.activo AND r.codigo = 'ADMIN'), '{}') AS admins,
         (SELECT u.id FROM clientes c JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = $1 AND u.activo) AS cliente,
         (SELECT u.id FROM tecnicos t JOIN usuarios u ON u.id = t.usuario_id WHERE t.id = $2 AND u.activo) AS tecnico,
         (SELECT u.id FROM tecnicos t JOIN usuarios u ON u.id = t.usuario_id WHERE t.id = $3 AND u.activo) AS tecnico_anterior`,
      [s.clienteId, s.tecnicoId, s.tecnicoAnteriorId ?? null],
    );
    const coordinadores = fila?.coordinadores ?? [];
    const admins = fila?.admins ?? [];
    return {
      operacion: coordinadores.length ? coordinadores : admins,
      gestion: [...coordinadores, ...admins],
      cliente: fila?.cliente ?? null,
      tecnico: fila?.tecnico ?? null,
      tecnicoAnterior: fila?.tecnico_anterior ?? null,
    };
  }

  async crear(nuevas: NotificacionNueva[]): Promise<Notificacion[]> {
    if (!nuevas.length) return [];
    return this.db.query<Notificacion>(
      `WITH creadas AS (
         INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, solicitud_id)
         SELECT * FROM UNNEST($1::int[], $2::text[], $3::text[], $4::text[], $5::int[])
         RETURNING *
       )
       SELECT n.id, n.usuario_id, n.tipo, n.titulo, n.mensaje, n.solicitud_id, s.codigo AS solicitud_codigo, n.leida, n.created_at
         FROM creadas n LEFT JOIN solicitudes s ON s.id = n.solicitud_id`,
      [
        nuevas.map((n) => n.usuarioId),
        nuevas.map((n) => n.tipo),
        nuevas.map((n) => n.titulo),
        nuevas.map((n) => n.mensaje),
        nuevas.map((n) => n.solicitudId),
      ],
    );
  }

  async listar(
    usuarioId: number,
    filtro: { noLeidas?: boolean; limit: number; offset: number },
  ): Promise<{ filas: Notificacion[]; total: number }> {
    const where = `WHERE n.usuario_id = $1 AND ($2::boolean IS NULL OR n.leida = NOT $2)`;
    const params = [usuarioId, filtro.noLeidas ?? null];
    const total = await this.db.one<{ total: number }>(`SELECT COUNT(*)::int AS total FROM notificaciones n ${where}`, params);
    const filas = await this.db.query<Notificacion>(
      `${NOTIFICACION} ${where} ORDER BY n.created_at DESC, n.id DESC LIMIT $3 OFFSET $4`,
      [...params, filtro.limit, filtro.offset],
    );
    return { filas, total: total?.total ?? 0 };
  }

  async contarNoLeidas(usuarioId: number): Promise<number> {
    const fila = await this.db.one<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM notificaciones WHERE usuario_id = $1 AND NOT leida`,
      [usuarioId],
    );
    return fila?.total ?? 0;
  }

  /** El filtro por `usuario_id` impide marcar notificaciones ajenas. */
  async marcarLeida(id: number, usuarioId: number): Promise<boolean> {
    return (await this.db.execute(`UPDATE notificaciones SET leida = TRUE WHERE id = $1 AND usuario_id = $2`, [id, usuarioId])) > 0;
  }

  marcarTodasLeidas(usuarioId: number): Promise<number> {
    return this.db.execute(`UPDATE notificaciones SET leida = TRUE WHERE usuario_id = $1 AND NOT leida`, [usuarioId]);
  }
}
