import type { Rol } from '../domain/auth-user';

/**
 * Contratos entre módulos. Un módulo que necesita algo de otro depende de la
 * interfaz declarada aquí (o en su propio dominio), nunca de la implementación:
 * el cableado concreto ocurre en `container.ts`.
 */

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Auditoría general (tabla `auditoria`): catálogos, usuarios y seguridad. */
export interface RegistroAuditoria {
  usuarioId: number | null;
  entidad: string;
  entidadId?: string | number | null;
  accion: string;
  antes?: unknown;
  despues?: unknown;
  ip?: string | null;
}

export interface AuditLogger {
  registrar(registro: RegistroAuditoria): Promise<void>;
}

/** Historial inalterable de la solicitud (tabla `historial_solicitudes`). */
export type AccionHistorial =
  | 'CREACION'
  | 'CAMBIO_ESTADO'
  | 'ASIGNACION'
  | 'REASIGNACION'
  | 'COMENTARIO'
  | 'REAPERTURA'
  | 'ADJUNTO'
  | 'CAMBIO_PRIORIDAD';

export interface EntradaHistorial {
  solicitudId: number;
  usuarioId: number;
  accion: AccionHistorial;
  estadoAnterior?: string | null;
  estadoNuevo?: string | null;
  comentario?: string | null;
  detalle?: Record<string, unknown> | null;
}

export interface HistorialItem {
  id: number;
  accion: AccionHistorial;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  comentario: string | null;
  detalle: Record<string, unknown> | null;
  usuario_nombre: string;
  usuario_rol: Rol;
  fecha: Date;
}

export interface HistorialSolicitudes {
  registrar(entrada: EntradaHistorial): Promise<void>;
  listar(solicitudId: number): Promise<HistorialItem[]>;
}

/** Evento de negocio sobre una solicitud; lo consume el módulo de notificaciones. */
export type TipoEventoSolicitud =
  | 'REGISTRO'
  | 'CAMBIO_ESTADO'
  | 'ASIGNACION'
  | 'REASIGNACION'
  | 'COMENTARIO'
  | 'REAPERTURA'
  | 'ADJUNTO';

export interface EventoSolicitud {
  tipo: TipoEventoSolicitud;
  actorId: number;
  actorNombre: string;
  solicitud: {
    id: number;
    codigo: string;
    titulo: string;
    clienteId: number;
    tecnicoId: number | null;
    estado: string;
  };
  estadoAnterior?: string;
  tecnicoAnteriorId?: number | null;
  comentario?: string | null;
}

export interface EventosSolicitud {
  /** Se invoca dentro de la transacción de la operación que origina el evento. */
  publicar(evento: EventoSolicitud): Promise<void>;
}

/** Gestión de cuentas de acceso que otros módulos (clientes, técnicos) necesitan. */
export interface CuentaNueva {
  email: string;
  password: string;
  nombre: string;
  rol: Rol;
}

export interface CuentasUsuario {
  crear(cuenta: CuentaNueva): Promise<number>;
  actualizar(id: number, cambios: { nombre?: string; email?: string; activo?: boolean }): Promise<void>;
  /** Elimina la cuenta si no dejó rastro operativo; en caso contrario la desactiva. */
  eliminarODesactivar(id: number): Promise<void>;
}

/** Lectura de parámetros operativos. */
export interface ParametrosOperativos {
  numero(clave: string, porDefecto: number): Promise<number>;
}
