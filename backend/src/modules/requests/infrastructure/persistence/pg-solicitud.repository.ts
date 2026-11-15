import type { Database } from '../../../../shared/db/database';
import { ESTADOS_ABIERTOS, sqlLista } from '../../../../shared/domain/estados';
import type { Adjunto, AdjuntoAlmacenado, ArchivoSubido, Solicitud } from '../../domain/entities/solicitud';
import type {
  CambiosSolicitud,
  FiltroSolicitudes,
  ReferenciasSolicitud,
  SolicitudNueva,
  SolicitudRepository,
} from '../../domain/interfaces/solicitud.repository';
import { SQL_VENCIDA, sqlPorVencer } from './plazo.sql';

const DESDE = `
    FROM solicitudes s
    JOIN clientes c ON c.id = s.cliente_id
    JOIN sedes se ON se.id = s.sede_id
    JOIN categorias_servicio cat ON cat.id = s.categoria_id
    JOIN prioridades p ON p.id = s.prioridad_id
    JOIN prioridades ps ON ps.id = s.prioridad_solicitada_id
    JOIN estados e ON e.id = s.estado_id
    LEFT JOIN tecnicos t ON t.id = s.tecnico_id
    LEFT JOIN usuarios ut ON ut.id = t.usuario_id`;

const SOLICITUD = `
  SELECT s.id, s.codigo, s.titulo, s.descripcion, s.equipo_afectado,
         s.cliente_id, c.razon_social AS cliente_nombre, s.sede_id, se.nombre AS sede_nombre,
         s.categoria_id, cat.nombre AS categoria_nombre, cat.especialidad_id,
         s.prioridad_id, p.codigo AS prioridad, ps.codigo AS prioridad_solicitada, p.horas_plazo,
         e.codigo AS estado, s.tecnico_id, ut.nombre AS tecnico_nombre, s.resolucion,
         s.fecha_limite, s.fecha_resolucion, s.fecha_cierre, s.creado_por, s.version, s.created_at
  ${DESDE}`;

const ORDEN: Record<NonNullable<FiltroSolicitudes['orden']>, string> = {
  recientes: 's.created_at DESC, s.id DESC',
  antiguas: 's.created_at ASC, s.id ASC',
  vencimiento: 's.fecha_limite ASC, s.id ASC',
  prioridad: 'p.orden DESC, s.fecha_limite ASC, s.id ASC',
};

/** Columnas que `actualizar` puede tocar (lista cerrada: nunca se interpola entrada del usuario). */
const COLUMNAS: Record<Exclude<keyof CambiosSolicitud, 'estado'>, string> = {
  prioridadId: 'prioridad_id',
  tecnicoId: 'tecnico_id',
  resolucion: 'resolucion',
  fechaLimite: 'fecha_limite',
  fechaResolucion: 'fecha_resolucion',
  fechaCierre: 'fecha_cierre',
};

export class PgSolicitudRepository implements SolicitudRepository {
  constructor(private readonly db: Database) {}

  async buscar(id: number, opciones: { bloquear?: boolean } = {}): Promise<Solicitud | undefined> {
    if (opciones.bloquear) await this.db.query(`SELECT id FROM solicitudes WHERE id = $1 FOR UPDATE`, [id]);
    return this.db.one<Solicitud>(`${SOLICITUD} WHERE s.id = $1`, [id]);
  }

  async listar(f: FiltroSolicitudes): Promise<{ filas: Solicitud[]; total: number }> {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    const param = (valor: unknown): string => {
      params.push(valor);
      return `$${params.length}`;
    };

    // Alcance por rol: siempre presente y combinado con AND.
    if (f.alcance.clienteId) condiciones.push(`s.cliente_id = ${param(f.alcance.clienteId)}`);
    if (f.alcance.tecnicoId) condiciones.push(`s.tecnico_id = ${param(f.alcance.tecnicoId)}`);

    if (f.estados?.length) condiciones.push(`e.codigo = ANY(${param(f.estados)}::text[])`);
    if (f.prioridades?.length) condiciones.push(`p.codigo = ANY(${param(f.prioridades)}::text[])`);
    if (f.categoriaId) condiciones.push(`s.categoria_id = ${param(f.categoriaId)}`);
    if (f.sedeId) condiciones.push(`s.sede_id = ${param(f.sedeId)}`);
    if (f.clienteId) condiciones.push(`s.cliente_id = ${param(f.clienteId)}`);
    if (f.tecnicoId) condiciones.push(`s.tecnico_id = ${param(f.tecnicoId)}`);
    if (f.desde) condiciones.push(`(s.created_at AT TIME ZONE ${param(f.zonaHoraria)})::date >= ${param(f.desde)}::date`);
    if (f.hasta) condiciones.push(`(s.created_at AT TIME ZONE ${param(f.zonaHoraria)})::date <= ${param(f.hasta)}::date`);
    if (f.q) {
      const patron = param(`%${f.q}%`);
      condiciones.push(`(s.codigo ILIKE ${patron} OR s.titulo ILIKE ${patron})`);
    }
    if (f.vencimiento === 'vencida') condiciones.push(SQL_VENCIDA);
    if (f.vencimiento === 'por_vencer') condiciones.push(sqlPorVencer(param(f.umbralPorVencerPct)));

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const total = await this.db.one<{ total: number }>(`SELECT COUNT(*)::int AS total ${DESDE} ${where}`, params);
    const filas = await this.db.query<Solicitud>(
      `${SOLICITUD} ${where} ORDER BY ${ORDEN[f.orden ?? 'recientes']} LIMIT ${param(f.limit)} OFFSET ${param(f.offset)}`,
      params,
    );
    return { filas, total: total?.total ?? 0 };
  }

  async referencias(ids: { clienteId: number; sedeId: number; categoriaId: number; prioridadId: number }): Promise<ReferenciasSolicitud> {
    const fila = await this.db.one<{
      cliente: { activo: boolean } | null;
      sede: { activo: boolean; cliente_id: number } | null;
      categoria: { activo: boolean } | null;
      prioridad: { horas_plazo: number } | null;
    }>(
      `SELECT (SELECT json_build_object('activo', activo) FROM clientes WHERE id = $1) AS cliente,
              (SELECT json_build_object('activo', activo, 'cliente_id', cliente_id) FROM sedes WHERE id = $2) AS sede,
              (SELECT json_build_object('activo', activo) FROM categorias_servicio WHERE id = $3) AS categoria,
              (SELECT json_build_object('horas_plazo', horas_plazo) FROM prioridades WHERE id = $4) AS prioridad`,
      [ids.clienteId, ids.sedeId, ids.categoriaId, ids.prioridadId],
    );
    return {
      cliente: fila?.cliente ?? undefined,
      sede: fila?.sede ?? undefined,
      categoria: fila?.categoria ?? undefined,
      prioridad: fila?.prioridad ?? undefined,
    };
  }

  async horasPlazo(prioridadId: number): Promise<number | undefined> {
    const fila = await this.db.one<{ horas_plazo: number }>(`SELECT horas_plazo FROM prioridades WHERE id = $1`, [prioridadId]);
    return fila?.horas_plazo;
  }

  buscarDuplicadaAbierta(d: {
    clienteId: number;
    sedeId: number;
    categoriaId: number;
    equipoAfectado: string;
  }): Promise<{ id: number; codigo: string } | undefined> {
    return this.db.one<{ id: number; codigo: string }>(
      `SELECT s.id, s.codigo
         FROM solicitudes s JOIN estados e ON e.id = s.estado_id
        WHERE s.cliente_id = $1 AND s.sede_id = $2 AND s.categoria_id = $3
          AND LOWER(TRIM(s.equipo_afectado)) = LOWER(TRIM($4))
          AND e.codigo IN (${sqlLista(ESTADOS_ABIERTOS)})
        ORDER BY s.created_at DESC
        LIMIT 1`,
      [d.clienteId, d.sedeId, d.categoriaId, d.equipoAfectado],
    );
  }

  async crear(d: SolicitudNueva): Promise<number> {
    const fila = await this.db.one<{ id: number }>(
      `INSERT INTO solicitudes
         (codigo, cliente_id, sede_id, categoria_id, prioridad_solicitada_id, prioridad_id, estado_id,
          titulo, descripcion, equipo_afectado, fecha_limite, creado_por, created_at, updated_at)
       VALUES
         ('SOL-' || to_char($10::timestamptz, 'YYYY') || '-' || LPAD(nextval('solicitudes_codigo_seq')::text, 6, '0'),
          $1, $2, $3, $4, $4, (SELECT id FROM estados WHERE codigo = 'REGISTRADA'),
          $5, $6, $7, $8, $9, $10, $10)
       RETURNING id`,
      [d.clienteId, d.sedeId, d.categoriaId, d.prioridadId, d.titulo, d.descripcion, d.equipoAfectado, d.fechaLimite, d.creadoPor, d.creadaEn],
    );
    return fila!.id;
  }

  async actualizar(id: number, cambios: CambiosSolicitud): Promise<void> {
    const sets: string[] = ['version = version + 1'];
    const params: unknown[] = [id];
    if (cambios.estado !== undefined) {
      params.push(cambios.estado);
      sets.push(`estado_id = (SELECT id FROM estados WHERE codigo = $${params.length})`);
    }
    for (const [clave, columna] of Object.entries(COLUMNAS) as Array<[keyof typeof COLUMNAS, string]>) {
      if (cambios[clave] === undefined) continue;
      params.push(cambios[clave]);
      sets.push(`${columna} = $${params.length}`);
    }
    await this.db.execute(`UPDATE solicitudes SET ${sets.join(', ')} WHERE id = $1`, params);
  }

  // ---- Adjuntos ----
  listarAdjuntos(solicitudId: number): Promise<Adjunto[]> {
    return this.db.query<Adjunto>(
      `SELECT a.id, a.solicitud_id, a.nombre_original, a.mime_type, a.tamano_bytes, u.nombre AS subido_por_nombre, a.created_at
         FROM adjuntos a JOIN usuarios u ON u.id = a.subido_por
        WHERE a.solicitud_id = $1
        ORDER BY a.created_at, a.id`,
      [solicitudId],
    );
  }

  async contarAdjuntos(solicitudId: number): Promise<number> {
    const fila = await this.db.one<{ total: number }>(`SELECT COUNT(*)::int AS total FROM adjuntos WHERE solicitud_id = $1`, [solicitudId]);
    return fila!.total;
  }

  async crearAdjunto(solicitudId: number, archivo: ArchivoSubido, subidoPor: number): Promise<void> {
    await this.db.execute(
      `INSERT INTO adjuntos (solicitud_id, nombre_original, nombre_archivo, mime_type, tamano_bytes, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [solicitudId, archivo.nombreOriginal, archivo.nombreArchivo, archivo.mimeType, archivo.tamanoBytes, subidoPor],
    );
  }

  buscarAdjunto(solicitudId: number, adjuntoId: number): Promise<AdjuntoAlmacenado | undefined> {
    return this.db.one<AdjuntoAlmacenado>(
      `SELECT a.id, a.solicitud_id, a.nombre_original, a.nombre_archivo, a.mime_type, a.tamano_bytes,
              u.nombre AS subido_por_nombre, a.created_at
         FROM adjuntos a JOIN usuarios u ON u.id = a.subido_por
        WHERE a.solicitud_id = $1 AND a.id = $2`,
      [solicitudId, adjuntoId],
    );
  }
}
