import type { Rol } from '../../../../shared/domain/auth-user';
import type { Database } from '../../../../shared/db/database';
import type { Usuario, UsuarioConCredenciales } from '../../domain/entities/usuario';
import type { FiltroUsuarios, UserRepository } from '../../domain/interfaces/user.repository';

const COLUMNAS = `u.id, u.email, u.nombre, r.codigo AS rol, u.activo, u.ultimo_acceso, u.created_at, u.updated_at`;
const DESDE = `FROM usuarios u JOIN roles r ON r.id = u.rol_id`;
const CREDENCIALES = `
  SELECT ${COLUMNAS}, u.password_hash, c.id AS cliente_id, t.id AS tecnico_id
    ${DESDE}
    LEFT JOIN clientes c ON c.usuario_id = u.id
    LEFT JOIN tecnicos t ON t.usuario_id = u.id`;

export class PgUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async listar(filtro: FiltroUsuarios): Promise<{ filas: Usuario[]; total: number }> {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (filtro.q) {
      params.push(`%${filtro.q}%`);
      condiciones.push(`(u.nombre ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (filtro.rol) {
      params.push(filtro.rol);
      condiciones.push(`r.codigo = $${params.length}`);
    }
    if (filtro.activo !== undefined) {
      params.push(filtro.activo);
      condiciones.push(`u.activo = $${params.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const total = await this.db.one<{ total: number }>(`SELECT COUNT(*)::int AS total ${DESDE} ${where}`, params);
    const filas = await this.db.query<Usuario>(
      `SELECT ${COLUMNAS} ${DESDE} ${where}
        ORDER BY u.nombre ASC, u.id ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filtro.limit, filtro.offset],
    );
    return { filas, total: total?.total ?? 0 };
  }

  buscarPorId(id: number): Promise<Usuario | undefined> {
    return this.db.one<Usuario>(`SELECT ${COLUMNAS} ${DESDE} WHERE u.id = $1`, [id]);
  }

  buscarCredencialesPorEmail(email: string): Promise<UsuarioConCredenciales | undefined> {
    return this.db.one<UsuarioConCredenciales>(`${CREDENCIALES} WHERE u.email = $1`, [email]);
  }

  buscarCredencialesPorId(id: number): Promise<UsuarioConCredenciales | undefined> {
    return this.db.one<UsuarioConCredenciales>(`${CREDENCIALES} WHERE u.id = $1`, [id]);
  }

  async existeEmail(email: string, exceptoId?: number): Promise<boolean> {
    const fila = await this.db.one(`SELECT 1 FROM usuarios WHERE email = $1 AND id <> $2`, [email, exceptoId ?? 0]);
    return fila !== undefined;
  }

  async crear(datos: { email: string; passwordHash: string; nombre: string; rol: Rol }): Promise<number> {
    const fila = await this.db.one<{ id: number }>(
      `INSERT INTO usuarios (email, password_hash, nombre, rol_id)
       VALUES ($1, $2, $3, (SELECT id FROM roles WHERE codigo = $4))
       RETURNING id`,
      [datos.email, datos.passwordHash, datos.nombre, datos.rol],
    );
    return fila!.id;
  }

  async actualizar(id: number, cambios: { nombre?: string; email?: string; activo?: boolean }): Promise<void> {
    await this.db.execute(
      `UPDATE usuarios
          SET nombre = COALESCE($2, nombre),
              email  = COALESCE($3, email),
              activo = COALESCE($4, activo)
        WHERE id = $1`,
      [id, cambios.nombre ?? null, cambios.email ?? null, cambios.activo ?? null],
    );
  }

  async cambiarPassword(id: number, passwordHash: string): Promise<void> {
    await this.db.execute(`UPDATE usuarios SET password_hash = $2 WHERE id = $1`, [id, passwordHash]);
  }

  async registrarAcceso(id: number): Promise<void> {
    await this.db.execute(`UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1`, [id]);
  }

  async contarAdminsActivos(exceptoId?: number): Promise<number> {
    const fila = await this.db.one<{ total: number }>(
      `SELECT COUNT(*)::int AS total ${DESDE} WHERE r.codigo = 'ADMIN' AND u.activo AND u.id <> $1`,
      [exceptoId ?? 0],
    );
    return fila?.total ?? 0;
  }

  async eliminarSiSinRastro(id: number): Promise<boolean> {
    const eliminadas = await this.db.execute(
      `DELETE FROM usuarios u
        WHERE u.id = $1
          AND NOT EXISTS (SELECT 1 FROM historial_solicitudes h WHERE h.usuario_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM solicitudes s WHERE s.creado_por = u.id)
          AND NOT EXISTS (SELECT 1 FROM asignaciones a WHERE a.asignado_por = u.id)
          AND NOT EXISTS (SELECT 1 FROM adjuntos ad WHERE ad.subido_por = u.id)
          AND NOT EXISTS (SELECT 1 FROM clientes c WHERE c.usuario_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM tecnicos t WHERE t.usuario_id = u.id)`,
      [id],
    );
    return eliminadas > 0;
  }

  async idsActivosPorRol(roles: Rol[]): Promise<number[]> {
    const filas = await this.db.query<{ id: number }>(
      `SELECT u.id ${DESDE} WHERE u.activo AND r.codigo = ANY($1::text[])`,
      [roles],
    );
    return filas.map((f) => f.id);
  }
}
