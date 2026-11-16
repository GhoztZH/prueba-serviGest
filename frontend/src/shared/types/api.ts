/** Tipos del contrato de la API (docs/api/openapi.yaml). Las fechas llegan como texto ISO. */

export type Rol = 'ADMIN' | 'COORDINADOR' | 'TECNICO' | 'CLIENTE';

export interface Perfil {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  clienteId: number | null;
  tecnicoId: number | null;
}

export type Estado =
  | 'REGISTRADA'
  | 'APROBADA'
  | 'ASIGNADA'
  | 'EN_PROCESO'
  | 'PENDIENTE_INFO'
  | 'RESUELTA'
  | 'CERRADA'
  | 'CANCELADA';

export type CodigoPrioridad = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type EstadoPlazo = 'A_TIEMPO' | 'POR_VENCER' | 'VENCIDA' | 'CUMPLIDA' | 'INCUMPLIDA' | 'NO_APLICA';

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Pagina<T> {
  data: T[];
  meta: Meta;
}

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
  prioridad_id: number;
  prioridad: CodigoPrioridad;
  prioridad_solicitada: CodigoPrioridad;
  horas_plazo: number;
  estado: Estado;
  tecnico_id: number | null;
  tecnico_nombre: string | null;
  resolucion: string | null;
  fecha_limite: string;
  fecha_resolucion: string | null;
  fecha_cierre: string | null;
  estado_plazo: EstadoPlazo;
  horas_restantes: number;
  version: number;
  created_at: string;
}

export interface Adjunto {
  id: number;
  nombre_original: string;
  mime_type: string;
  tamano_bytes: number;
  subido_por_nombre: string;
  created_at: string;
}

export interface Asignacion {
  id: number;
  tecnico_id: number;
  tecnico_nombre: string;
  asignado_por_nombre: string;
  motivo: string | null;
  activa: boolean;
  fecha_asignacion: string;
  fecha_fin: string | null;
}

/** Lo que el usuario actual puede hacer con la solicitud; lo decide el backend. */
export interface Acciones {
  transiciones: Estado[];
  puedeAsignar: boolean;
  puedeReabrir: boolean;
  puedeComentar: boolean;
  puedeAdjuntar: boolean;
}

export interface SolicitudDetalle extends Solicitud {
  adjuntos: Adjunto[];
  asignaciones: Asignacion[];
  acciones: Acciones;
}

export type AccionHistorial =
  | 'CREACION'
  | 'CAMBIO_ESTADO'
  | 'ASIGNACION'
  | 'REASIGNACION'
  | 'COMENTARIO'
  | 'REAPERTURA'
  | 'ADJUNTO'
  | 'CAMBIO_PRIORIDAD';

export interface Historial {
  id: number;
  accion: AccionHistorial;
  estado_anterior: Estado | null;
  estado_nuevo: Estado | null;
  comentario: string | null;
  detalle: Record<string, unknown> | null;
  usuario_nombre: string;
  usuario_rol: Rol;
  fecha: string;
}

export interface CandidatoSugerido {
  id: number;
  nombre: string;
  carga_actual: number;
  max_solicitudes_activas: number;
  disponible: boolean;
  elegible: boolean;
  motivos: string[];
}

export interface Notificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  solicitud_id: number | null;
  solicitud_codigo: string | null;
  leida: boolean;
  created_at: string;
}

export interface PaginaNotificaciones extends Pagina<Notificacion> {
  noLeidas: number;
}

export interface Sede {
  id: number;
  cliente_id: number;
  nombre: string;
  direccion: string;
  activo: boolean;
  total_solicitudes: number;
}

export interface Cliente {
  id: number;
  identificacion: string;
  razon_social: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  activo: boolean;
  cuenta_email: string | null;
  total_sedes: number;
  total_solicitudes: number;
}

export interface ClienteDetalle extends Cliente {
  sedes: Sede[];
}

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
  carga_actual: number;
  especialidades: Array<{ id: number; nombre: string }>;
}

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  ultimo_acceso: string | null;
  created_at: string;
}

export interface Especialidad {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  especialidad_id: number;
  especialidad_nombre: string;
  activo: boolean;
}

export interface Prioridad {
  id: number;
  codigo: CodigoPrioridad;
  nombre: string;
  horas_plazo: number;
  orden: number;
}

export interface Parametro {
  clave: string;
  valor: string;
  descripcion: string | null;
  updated_at: string;
}

export interface RegistroAuditoria {
  id: number;
  usuario_nombre: string | null;
  entidad: string;
  entidad_id: string | null;
  accion: string;
  datos_antes: unknown;
  datos_despues: unknown;
  ip: string | null;
  fecha: string;
}

export interface Indicadores {
  filtros: { desde: string; hasta: string };
  resumen: { total: number; abiertas: number; resueltas: number; cerradas: number; canceladas: number };
  porEstado: Array<{ codigo: Estado; nombre: string; total: number }>;
  porPrioridad: Array<{ codigo: CodigoPrioridad; nombre: string; total: number; aTiempo: number; fueraDePlazo: number; cumplimiento: number | null }>;
  cargaPorTecnico: Array<{ tecnico_id: number; nombre: string; activas: number; maximo: number; disponible: boolean; resueltas: number }>;
  tiempoResolucion: { global: number | null; porPrioridad: Array<{ codigo: CodigoPrioridad; nombre: string; horas: number | null; resueltas: number }> };
  cumplimiento: { aTiempo: number; fueraDePlazo: number; porcentaje: number | null };
  vencimientos: { vencidas: number; por_vencer: number; abiertas: number };
  evolucion: Array<{ fecha: string; creadas: number; resueltas: number }>;
}
