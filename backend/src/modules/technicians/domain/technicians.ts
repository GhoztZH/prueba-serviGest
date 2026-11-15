export interface Tecnico {
  id: number;
  usuario_id: number;
  nombre: string;
  email: string;
  cedula: string;
  telefono: string | null;
  disponible: boolean;
  max_solicitudes_activas: number;
  activo: boolean;
  /** Solicitudes que hoy ocupan cupo (ASIGNADA, EN_PROCESO, PENDIENTE_INFO). Se calcula, no se almacena. */
  carga_actual: number;
  especialidades: Array<{ id: number; nombre: string }>;
  created_at: Date;
  updated_at: Date;
}

/** Vista mínima que necesita el módulo de asignaciones para aplicar sus reglas. */
export interface TecnicoAsignable {
  id: number;
  usuarioId: number;
  nombre: string;
  activo: boolean;
  disponible: boolean;
  maxSolicitudesActivas: number;
  cargaActual: number;
  especialidadIds: number[];
}

export interface FiltroTecnicos {
  q?: string;
  especialidadId?: number;
  disponible?: boolean;
  limit: number;
  offset: number;
}

export interface TechnicianRepository {
  listar(filtro: FiltroTecnicos): Promise<{ filas: Tecnico[]; total: number }>;
  buscar(id: number): Promise<Tecnico | undefined>;
  existeCedula(cedula: string, exceptoId?: number): Promise<boolean>;
  especialidadesVigentes(ids: number[]): Promise<number[]>;
  crear(datos: { usuarioId: number; cedula: string; telefono: string | null; maxSolicitudesActivas: number }): Promise<number>;
  actualizar(
    id: number,
    cambios: { cedula?: string; telefono?: string | null; disponible?: boolean; maxSolicitudesActivas?: number; activo?: boolean },
  ): Promise<void>;
  reemplazarEspecialidades(id: number, especialidadIds: number[]): Promise<void>;
  totalAsignaciones(id: number): Promise<number>;
  eliminar(id: number): Promise<void>;

  /** `bloquear` toma un bloqueo de fila para serializar asignaciones concurrentes al mismo técnico. */
  obtenerAsignable(id: number, bloquear: boolean): Promise<TecnicoAsignable | undefined>;
  asignablesConEspecialidad(especialidadId: number): Promise<TecnicoAsignable[]>;
}
