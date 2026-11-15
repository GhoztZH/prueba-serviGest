import type { Database } from '../../../shared/db/database';
import type { AsignacionVista, AsignacionesLectura } from '../../requests';
import type { AsignacionRepository } from '../domain/asignacion';

/**
 * Histórico de asignaciones. El índice único parcial `ux_asignaciones_activa`
 * garantiza en la base que una solicitud tenga como máximo una asignación activa.
 */
export class PgAsignacionRepository implements AsignacionRepository, AsignacionesLectura {
  constructor(private readonly db: Database) {}

  async cerrarActiva(solicitudId: number, fin: Date): Promise<void> {
    await this.db.execute(`UPDATE asignaciones SET activa = FALSE, fecha_fin = $2 WHERE solicitud_id = $1 AND activa`, [solicitudId, fin]);
  }

  async crear(d: { solicitudId: number; tecnicoId: number; asignadoPor: number; motivo: string | null; fecha: Date }): Promise<void> {
    await this.db.execute(
      `INSERT INTO asignaciones (solicitud_id, tecnico_id, asignado_por, motivo, fecha_asignacion) VALUES ($1, $2, $3, $4, $5)`,
      [d.solicitudId, d.tecnicoId, d.asignadoPor, d.motivo, d.fecha],
    );
  }

  listarPorSolicitud(solicitudId: number): Promise<AsignacionVista[]> {
    return this.db.query<AsignacionVista>(
      `SELECT a.id, a.tecnico_id, ut.nombre AS tecnico_nombre, ua.nombre AS asignado_por_nombre,
              a.motivo, a.activa, a.fecha_asignacion, a.fecha_fin
         FROM asignaciones a
         JOIN tecnicos t ON t.id = a.tecnico_id
         JOIN usuarios ut ON ut.id = t.usuario_id
         JOIN usuarios ua ON ua.id = a.asignado_por
        WHERE a.solicitud_id = $1
        ORDER BY a.fecha_asignacion DESC, a.id DESC`,
      [solicitudId],
    );
  }
}
