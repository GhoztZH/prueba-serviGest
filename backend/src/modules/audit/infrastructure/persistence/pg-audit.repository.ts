import type { RegistroAuditoria } from '../../../../shared/application/ports';
import type { Database } from '../../../../shared/db/database';
import type { AuditRepository, FiltroAuditoria, RegistroAuditoriaVista } from '../../domain/interfaces/audit.repository';

/** Auditoría general. La tabla es inalterable (trigger): solo se inserta y se consulta. */
export class PgAuditRepository implements AuditRepository {
  constructor(private readonly db: Database) {}

  async registrar(r: RegistroAuditoria): Promise<void> {
    await this.db.execute(
      `INSERT INTO auditoria (usuario_id, entidad, entidad_id, accion, datos_antes, datos_despues, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        r.usuarioId,
        r.entidad,
        r.entidadId == null ? null : String(r.entidadId),
        r.accion,
        r.antes === undefined ? null : JSON.stringify(r.antes),
        r.despues === undefined ? null : JSON.stringify(r.despues),
        r.ip ?? null,
      ],
    );
  }

  async listar(filtro: FiltroAuditoria): Promise<{ filas: RegistroAuditoriaVista[]; total: number }> {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (filtro.entidad) {
      params.push(filtro.entidad);
      condiciones.push(`a.entidad = $${params.length}`);
    }
    if (filtro.usuarioId) {
      params.push(filtro.usuarioId);
      condiciones.push(`a.usuario_id = $${params.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const total = await this.db.one<{ total: number }>(`SELECT COUNT(*)::int AS total FROM auditoria a ${where}`, params);
    const filas = await this.db.query<RegistroAuditoriaVista>(
      `SELECT a.id, a.usuario_id, u.nombre AS usuario_nombre, a.entidad, a.entidad_id, a.accion,
              a.datos_antes, a.datos_despues, a.ip, a.fecha
         FROM auditoria a
         LEFT JOIN usuarios u ON u.id = a.usuario_id
         ${where}
        ORDER BY a.fecha DESC, a.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filtro.limit, filtro.offset],
    );
    return { filas, total: total?.total ?? 0 };
  }
}
