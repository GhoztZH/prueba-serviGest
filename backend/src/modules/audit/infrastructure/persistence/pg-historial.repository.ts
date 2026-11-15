import type { EntradaHistorial, HistorialItem, HistorialSolicitudes } from '../../../../shared/application/ports';
import type { Database } from '../../../../shared/db/database';

/**
 * Historial de la solicitud. La tabla es inalterable (trigger que bloquea
 * UPDATE/DELETE): este repositorio solo inserta y consulta.
 */
export class PgHistorialRepository implements HistorialSolicitudes {
  constructor(private readonly db: Database) {}

  async registrar(e: EntradaHistorial): Promise<void> {
    await this.db.execute(
      `INSERT INTO historial_solicitudes
         (solicitud_id, usuario_id, accion, estado_anterior_id, estado_nuevo_id, comentario, detalle)
       VALUES ($1, $2, $3,
               (SELECT id FROM estados WHERE codigo = $4),
               (SELECT id FROM estados WHERE codigo = $5),
               $6, $7)`,
      [
        e.solicitudId,
        e.usuarioId,
        e.accion,
        e.estadoAnterior ?? null,
        e.estadoNuevo ?? null,
        e.comentario ?? null,
        e.detalle ? JSON.stringify(e.detalle) : null,
      ],
    );
  }

  listar(solicitudId: number): Promise<HistorialItem[]> {
    return this.db.query<HistorialItem>(
      `SELECT h.id, h.accion, ea.codigo AS estado_anterior, en.codigo AS estado_nuevo,
              h.comentario, h.detalle, u.nombre AS usuario_nombre, r.codigo AS usuario_rol, h.fecha
         FROM historial_solicitudes h
         JOIN usuarios u ON u.id = h.usuario_id
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN estados ea ON ea.id = h.estado_anterior_id
         LEFT JOIN estados en ON en.id = h.estado_nuevo_id
        WHERE h.solicitud_id = $1
        ORDER BY h.fecha ASC, h.id ASC`,
      [solicitudId],
    );
  }
}
