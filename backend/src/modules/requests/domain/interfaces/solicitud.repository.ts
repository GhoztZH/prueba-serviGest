import type { Estado } from '../../../../shared/domain/estados';
import type { Adjunto, AdjuntoAlmacenado, ArchivoSubido, Solicitud } from '../entities/solicitud';

export type OrdenSolicitudes = 'recientes' | 'antiguas' | 'vencimiento' | 'prioridad';

export interface FiltroSolicitudes {
  estados?: Estado[];
  prioridades?: string[];
  categoriaId?: number;
  sedeId?: number;
  clienteId?: number;
  tecnicoId?: number;
  desde?: string;
  hasta?: string;
  q?: string;
  vencimiento?: 'vencida' | 'por_vencer';
  orden?: OrdenSolicitudes;
  /** Alcance impuesto por el rol; se combina con AND sobre los filtros anteriores. */
  alcance: { clienteId?: number; tecnicoId?: number };
  umbralPorVencerPct: number;
  zonaHoraria: string;
  limit: number;
  offset: number;
}

export interface ReferenciasSolicitud {
  cliente?: { activo: boolean };
  sede?: { activo: boolean; cliente_id: number };
  categoria?: { activo: boolean };
  prioridad?: { horas_plazo: number };
}

export interface SolicitudNueva {
  clienteId: number;
  sedeId: number;
  categoriaId: number;
  prioridadId: number;
  titulo: string;
  descripcion: string;
  equipoAfectado: string;
  fechaLimite: Date;
  creadoPor: number;
  creadaEn: Date;
}

/** Cambios sobre la solicitud. Una clave presente con valor `null` borra el dato. */
export interface CambiosSolicitud {
  estado?: Estado;
  prioridadId?: number;
  tecnicoId?: number | null;
  resolucion?: string | null;
  fechaLimite?: Date;
  fechaResolucion?: Date | null;
  fechaCierre?: Date | null;
}

export interface SolicitudRepository {
  /** `bloquear` toma un bloqueo de fila (FOR UPDATE) para serializar cambios concurrentes. */
  buscar(id: number, opciones?: { bloquear?: boolean }): Promise<Solicitud | undefined>;
  listar(filtro: FiltroSolicitudes): Promise<{ filas: Solicitud[]; total: number }>;
  referencias(ids: { clienteId: number; sedeId: number; categoriaId: number; prioridadId: number }): Promise<ReferenciasSolicitud>;
  horasPlazo(prioridadId: number): Promise<number | undefined>;
  buscarDuplicadaAbierta(datos: {
    clienteId: number;
    sedeId: number;
    categoriaId: number;
    equipoAfectado: string;
  }): Promise<{ id: number; codigo: string } | undefined>;
  crear(datos: SolicitudNueva): Promise<number>;
  /** Aplica los cambios e incrementa `version` (control de concurrencia optimista). */
  actualizar(id: number, cambios: CambiosSolicitud): Promise<void>;

  listarAdjuntos(solicitudId: number): Promise<Adjunto[]>;
  contarAdjuntos(solicitudId: number): Promise<number>;
  crearAdjunto(solicitudId: number, archivo: ArchivoSubido, subidoPor: number): Promise<void>;
  buscarAdjunto(solicitudId: number, adjuntoId: number): Promise<AdjuntoAlmacenado | undefined>;
}

export interface AsignacionVista {
  id: number;
  tecnico_id: number;
  tecnico_nombre: string;
  asignado_por_nombre: string;
  motivo: string | null;
  activa: boolean;
  fecha_asignacion: Date;
  fecha_fin: Date | null;
}

/** Lo que el detalle de la solicitud necesita del módulo de asignaciones. */
export interface AsignacionesLectura {
  listarPorSolicitud(solicitudId: number): Promise<AsignacionVista[]>;
}

/** Almacén físico de adjuntos (disco, volumen Docker). */
export interface AlmacenAdjuntos {
  rutaDe(nombreArchivo: string): string;
  descartar(nombresArchivo: string[]): Promise<void>;
  /** Verifica que el contenido del archivo corresponde al tipo declarado. */
  firmaValida(nombreArchivo: string, mimeType: string): Promise<boolean>;
}
