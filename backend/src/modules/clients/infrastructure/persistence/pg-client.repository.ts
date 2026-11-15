import type { Database } from '../../../../shared/db/database';
import type { Cliente, ClientRepository, DatosCliente, Sede } from '../../domain/clients';

const CLIENTE = `
  SELECT c.id, c.usuario_id, c.identificacion, c.razon_social, c.email, c.telefono, c.direccion,
         c.activo, c.created_at, c.updated_at, u.email AS cuenta_email,
         (SELECT COUNT(*)::int FROM sedes s WHERE s.cliente_id = c.id) AS total_sedes,
         (SELECT COUNT(*)::int FROM solicitudes so WHERE so.cliente_id = c.id) AS total_solicitudes
    FROM clientes c
    LEFT JOIN usuarios u ON u.id = c.usuario_id`;

const SEDE = `
  SELECT s.id, s.cliente_id, s.nombre, s.direccion, s.activo, s.created_at,
         (SELECT COUNT(*)::int FROM solicitudes so WHERE so.sede_id = s.id) AS total_solicitudes
    FROM sedes s`;

export class PgClientRepository implements ClientRepository {
  constructor(private readonly db: Database) {}

  async listar(filtro: { q?: string; activo?: boolean; limit: number; offset: number }): Promise<{ filas: Cliente[]; total: number }> {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (filtro.q) {
      params.push(`%${filtro.q}%`);
      condiciones.push(`(c.razon_social ILIKE $${params.length} OR c.identificacion ILIKE $${params.length} OR c.email ILIKE $${params.length})`);
    }
    if (filtro.activo !== undefined) {
      params.push(filtro.activo);
      condiciones.push(`c.activo = $${params.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const total = await this.db.one<{ total: number }>(`SELECT COUNT(*)::int AS total FROM clientes c ${where}`, params);
    const filas = await this.db.query<Cliente>(
      `${CLIENTE} ${where} ORDER BY c.razon_social ASC, c.id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filtro.limit, filtro.offset],
    );
    return { filas, total: total?.total ?? 0 };
  }

  buscar(id: number): Promise<Cliente | undefined> {
    return this.db.one<Cliente>(`${CLIENTE} WHERE c.id = $1`, [id]);
  }

  async existeIdentificacion(identificacion: string, exceptoId?: number): Promise<boolean> {
    return (
      (await this.db.one(`SELECT 1 FROM clientes WHERE identificacion = $1 AND id <> $2`, [identificacion, exceptoId ?? 0])) !== undefined
    );
  }

  async crear(d: DatosCliente & { usuarioId: number | null }): Promise<number> {
    const fila = await this.db.one<{ id: number }>(
      `INSERT INTO clientes (usuario_id, identificacion, razon_social, email, telefono, direccion)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [d.usuarioId, d.identificacion, d.razonSocial, d.email, d.telefono, d.direccion],
    );
    return fila!.id;
  }

  async actualizar(id: number, c: Partial<DatosCliente> & { activo?: boolean; usuarioId?: number }): Promise<void> {
    await this.db.execute(
      `UPDATE clientes
          SET identificacion = COALESCE($2, identificacion),
              razon_social   = COALESCE($3, razon_social),
              email          = COALESCE($4, email),
              telefono       = CASE WHEN $5 THEN $6 ELSE telefono END,
              direccion      = CASE WHEN $7 THEN $8 ELSE direccion END,
              activo         = COALESCE($9, activo),
              usuario_id     = COALESCE($10, usuario_id)
        WHERE id = $1`,
      [
        id,
        c.identificacion ?? null,
        c.razonSocial ?? null,
        c.email ?? null,
        c.telefono !== undefined,
        c.telefono ?? null,
        c.direccion !== undefined,
        c.direccion ?? null,
        c.activo ?? null,
        c.usuarioId ?? null,
      ],
    );
  }

  async eliminar(id: number): Promise<void> {
    await this.db.execute(`DELETE FROM clientes WHERE id = $1`, [id]);
  }

  listarSedes(clienteId: number): Promise<Sede[]> {
    return this.db.query<Sede>(`${SEDE} WHERE s.cliente_id = $1 ORDER BY s.nombre`, [clienteId]);
  }

  buscarSede(clienteId: number, sedeId: number): Promise<Sede | undefined> {
    return this.db.one<Sede>(`${SEDE} WHERE s.cliente_id = $1 AND s.id = $2`, [clienteId, sedeId]);
  }

  async existeNombreSede(clienteId: number, nombre: string, exceptoId?: number): Promise<boolean> {
    return (
      (await this.db.one(`SELECT 1 FROM sedes WHERE cliente_id = $1 AND LOWER(nombre) = LOWER($2) AND id <> $3`, [
        clienteId,
        nombre,
        exceptoId ?? 0,
      ])) !== undefined
    );
  }

  async crearSede(clienteId: number, d: { nombre: string; direccion: string }): Promise<number> {
    const fila = await this.db.one<{ id: number }>(
      `INSERT INTO sedes (cliente_id, nombre, direccion) VALUES ($1, $2, $3) RETURNING id`,
      [clienteId, d.nombre, d.direccion],
    );
    return fila!.id;
  }

  async actualizarSede(sedeId: number, c: { nombre?: string; direccion?: string; activo?: boolean }): Promise<void> {
    await this.db.execute(
      `UPDATE sedes SET nombre = COALESCE($2, nombre), direccion = COALESCE($3, direccion), activo = COALESCE($4, activo) WHERE id = $1`,
      [sedeId, c.nombre ?? null, c.direccion ?? null, c.activo ?? null],
    );
  }

  async eliminarSede(sedeId: number): Promise<void> {
    await this.db.execute(`DELETE FROM sedes WHERE id = $1`, [sedeId]);
  }

  async eliminarSedesDeCliente(clienteId: number): Promise<void> {
    await this.db.execute(`DELETE FROM sedes WHERE cliente_id = $1`, [clienteId]);
  }
}
