export interface FiltroSolicitudes {
  page?: number;
  limit?: number;
  /** Códigos separados por comas, p. ej. `REGISTRADA,APROBADA`. */
  estado?: string;
  prioridad?: string;
  categoria_id?: number | string;
  cliente_id?: number | string;
  tecnico_id?: number | string;
  q?: string;
  vencimiento?: 'vencida' | 'por_vencer' | '';
  orden?: 'recientes' | 'antiguas' | 'vencimiento' | 'prioridad';
}

export interface SolicitudNueva {
  cliente_id?: number;
  sede_id: number;
  categoria_id: number;
  prioridad_id: number;
  titulo: string;
  descripcion: string;
  equipo_afectado: string;
}
