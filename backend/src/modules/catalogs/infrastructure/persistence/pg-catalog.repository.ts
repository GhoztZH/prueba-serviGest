import type { Database } from '../../../../shared/db/database';
import type { Categoria, CatalogRepository, Especialidad, Estado, Parametro, Prioridad } from '../../domain/catalogs';

const CATEGORIA = `
  SELECT c.id, c.nombre, c.descripcion, c.especialidad_id, e.nombre AS especialidad_nombre,
         c.activo, c.created_at, c.updated_at
    FROM categorias_servicio c
    JOIN especialidades e ON e.id = c.especialidad_id`;

export class PgCatalogRepository implements CatalogRepository {
  constructor(private readonly db: Database) {}

  // ---- Especialidades ----
  listarEspecialidades(activo?: boolean): Promise<Especialidad[]> {
    return this.db.query<Especialidad>(
      `SELECT * FROM especialidades WHERE ($1::boolean IS NULL OR activo = $1) ORDER BY nombre`,
      [activo ?? null],
    );
  }

  buscarEspecialidad(id: number): Promise<Especialidad | undefined> {
    return this.db.one<Especialidad>(`SELECT * FROM especialidades WHERE id = $1`, [id]);
  }

  async existeNombreEspecialidad(nombre: string, exceptoId?: number): Promise<boolean> {
    return (
      (await this.db.one(`SELECT 1 FROM especialidades WHERE LOWER(nombre) = LOWER($1) AND id <> $2`, [nombre, exceptoId ?? 0])) !==
      undefined
    );
  }

  async crearEspecialidad(d: { nombre: string; descripcion: string | null }): Promise<number> {
    const fila = await this.db.one<{ id: number }>(
      `INSERT INTO especialidades (nombre, descripcion) VALUES ($1, $2) RETURNING id`,
      [d.nombre, d.descripcion],
    );
    return fila!.id;
  }

  async actualizarEspecialidad(id: number, d: { nombre?: string; descripcion?: string | null; activo?: boolean }): Promise<void> {
    await this.db.execute(
      `UPDATE especialidades
          SET nombre = COALESCE($2, nombre),
              descripcion = CASE WHEN $3 THEN $4 ELSE descripcion END,
              activo = COALESCE($5, activo)
        WHERE id = $1`,
      [id, d.nombre ?? null, d.descripcion !== undefined, d.descripcion ?? null, d.activo ?? null],
    );
  }

  async eliminarEspecialidad(id: number): Promise<void> {
    await this.db.execute(`DELETE FROM especialidades WHERE id = $1`, [id]);
  }

  async usoEspecialidad(id: number): Promise<{ categorias: number; categoriasActivas: number; tecnicos: number }> {
    const fila = await this.db.one<{ categorias: number; categorias_activas: number; tecnicos: number }>(
      `SELECT (SELECT COUNT(*)::int FROM categorias_servicio WHERE especialidad_id = $1) AS categorias,
              (SELECT COUNT(*)::int FROM categorias_servicio WHERE especialidad_id = $1 AND activo) AS categorias_activas,
              (SELECT COUNT(*)::int FROM tecnico_especialidades WHERE especialidad_id = $1) AS tecnicos`,
      [id],
    );
    return { categorias: fila!.categorias, categoriasActivas: fila!.categorias_activas, tecnicos: fila!.tecnicos };
  }

  // ---- Categorías ----
  listarCategorias(activo?: boolean): Promise<Categoria[]> {
    return this.db.query<Categoria>(`${CATEGORIA} WHERE ($1::boolean IS NULL OR c.activo = $1) ORDER BY c.nombre`, [activo ?? null]);
  }

  buscarCategoria(id: number): Promise<Categoria | undefined> {
    return this.db.one<Categoria>(`${CATEGORIA} WHERE c.id = $1`, [id]);
  }

  async existeNombreCategoria(nombre: string, exceptoId?: number): Promise<boolean> {
    return (
      (await this.db.one(`SELECT 1 FROM categorias_servicio WHERE LOWER(nombre) = LOWER($1) AND id <> $2`, [
        nombre,
        exceptoId ?? 0,
      ])) !== undefined
    );
  }

  async crearCategoria(d: { nombre: string; descripcion: string | null; especialidadId: number }): Promise<number> {
    const fila = await this.db.one<{ id: number }>(
      `INSERT INTO categorias_servicio (nombre, descripcion, especialidad_id) VALUES ($1, $2, $3) RETURNING id`,
      [d.nombre, d.descripcion, d.especialidadId],
    );
    return fila!.id;
  }

  async actualizarCategoria(
    id: number,
    d: { nombre?: string; descripcion?: string | null; especialidadId?: number; activo?: boolean },
  ): Promise<void> {
    await this.db.execute(
      `UPDATE categorias_servicio
          SET nombre = COALESCE($2, nombre),
              descripcion = CASE WHEN $3 THEN $4 ELSE descripcion END,
              especialidad_id = COALESCE($5, especialidad_id),
              activo = COALESCE($6, activo)
        WHERE id = $1`,
      [id, d.nombre ?? null, d.descripcion !== undefined, d.descripcion ?? null, d.especialidadId ?? null, d.activo ?? null],
    );
  }

  async eliminarCategoria(id: number): Promise<void> {
    await this.db.execute(`DELETE FROM categorias_servicio WHERE id = $1`, [id]);
  }

  async solicitudesDeCategoria(id: number): Promise<number> {
    const fila = await this.db.one<{ total: number }>(`SELECT COUNT(*)::int AS total FROM solicitudes WHERE categoria_id = $1`, [id]);
    return fila!.total;
  }

  // ---- Prioridades, estados y parámetros ----
  listarPrioridades(): Promise<Prioridad[]> {
    return this.db.query<Prioridad>(`SELECT id, codigo, nombre, horas_plazo, orden FROM prioridades ORDER BY orden`);
  }

  buscarPrioridad(id: number): Promise<Prioridad | undefined> {
    return this.db.one<Prioridad>(`SELECT id, codigo, nombre, horas_plazo, orden FROM prioridades WHERE id = $1`, [id]);
  }

  async actualizarPrioridad(id: number, d: { nombre?: string; horasPlazo?: number }): Promise<void> {
    await this.db.execute(
      `UPDATE prioridades SET nombre = COALESCE($2, nombre), horas_plazo = COALESCE($3, horas_plazo) WHERE id = $1`,
      [id, d.nombre ?? null, d.horasPlazo ?? null],
    );
  }

  listarEstados(): Promise<Estado[]> {
    return this.db.query<Estado>(`SELECT id, codigo, nombre, es_final, orden FROM estados ORDER BY orden`);
  }

  listarParametros(): Promise<Parametro[]> {
    return this.db.query<Parametro>(`SELECT clave, valor, descripcion, updated_at FROM parametros ORDER BY clave`);
  }

  buscarParametro(clave: string): Promise<Parametro | undefined> {
    return this.db.one<Parametro>(`SELECT clave, valor, descripcion, updated_at FROM parametros WHERE clave = $1`, [clave]);
  }

  async actualizarParametro(clave: string, valor: string): Promise<void> {
    await this.db.execute(`UPDATE parametros SET valor = $2 WHERE clave = $1`, [clave, valor]);
  }
}
