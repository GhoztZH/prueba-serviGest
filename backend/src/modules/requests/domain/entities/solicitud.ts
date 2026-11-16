import type { Estado } from '../../../../shared/domain/estados';

/** Solicitud de servicio tal como la entrega la persistencia (con nombres de sus referencias). */
export interface Solicitud {
  id: number;
  codigo: string;
  titulo: string;
  descripcion: string;
  equipo_afectado: string;
  cliente_id: number;
  cliente_nombre: string;
  sede_id: number;
  sede_nombre: string;
  categoria_id: number;
  categoria_nombre: string;
  /** Especialidad que exige la categoría; la usa la asignación. */
  especialidad_id: number;
  prioridad_id: number;
  prioridad: string;
  prioridad_solicitada: string;
  /** Plazo de atención (horas) de la prioridad vigente. */
  horas_plazo: number;
  estado: Estado;
  tecnico_id: number | null;
  tecnico_nombre: string | null;
  resolucion: string | null;
  fecha_limite: Date;
  fecha_resolucion: Date | null;
  fecha_cierre: Date | null;
  creado_por: number;
  version: number;
  created_at: Date;
}

export type EstadoPlazo = 'A_TIEMPO' | 'POR_VENCER' | 'VENCIDA' | 'CUMPLIDA' | 'INCUMPLIDA' | 'NO_APLICA';

/** Solicitud con los indicadores de plazo calculados en el backend. */
export interface SolicitudVista extends Solicitud {
  estado_plazo: EstadoPlazo;
  horas_restantes: number;
}

export interface Adjunto {
  id: number;
  solicitud_id: number;
  nombre_original: string;
  mime_type: string;
  tamano_bytes: number;
  subido_por_nombre: string;
  created_at: Date;
}

export interface AdjuntoAlmacenado extends Adjunto {
  /** Nombre interno en disco. Nunca se expone por la API. */
  nombre_archivo: string;
}

export interface ArchivoSubido {
  nombreOriginal: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
}
