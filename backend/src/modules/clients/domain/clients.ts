export interface Cliente {
  id: number;
  usuario_id: number | null;
  identificacion: string;
  razon_social: string;
  /** Correo empresarial/comercial. Es independiente del correo de acceso (`cuenta_email`). */
  email: string;
  telefono: string | null;
  direccion: string | null;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
  /** Correo de acceso de la cuenta vinculada, si existe. */
  cuenta_email: string | null;
  total_sedes: number;
  total_solicitudes: number;
}

export interface Sede {
  id: number;
  cliente_id: number;
  nombre: string;
  direccion: string;
  activo: boolean;
  created_at: Date;
  total_solicitudes: number;
}

export interface ClienteDetalle extends Cliente {
  sedes: Sede[];
}

export interface DatosCliente {
  identificacion: string;
  razonSocial: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
}

export interface ClientRepository {
  listar(filtro: { q?: string; activo?: boolean; limit: number; offset: number }): Promise<{ filas: Cliente[]; total: number }>;
  buscar(id: number): Promise<Cliente | undefined>;
  existeIdentificacion(identificacion: string, exceptoId?: number): Promise<boolean>;
  crear(datos: DatosCliente & { usuarioId: number | null }): Promise<number>;
  actualizar(id: number, cambios: Partial<DatosCliente> & { activo?: boolean; usuarioId?: number }): Promise<void>;
  eliminar(id: number): Promise<void>;

  listarSedes(clienteId: number): Promise<Sede[]>;
  buscarSede(clienteId: number, sedeId: number): Promise<Sede | undefined>;
  existeNombreSede(clienteId: number, nombre: string, exceptoId?: number): Promise<boolean>;
  crearSede(clienteId: number, datos: { nombre: string; direccion: string }): Promise<number>;
  actualizarSede(sedeId: number, cambios: { nombre?: string; direccion?: string; activo?: boolean }): Promise<void>;
  eliminarSede(sedeId: number): Promise<void>;
  eliminarSedesDeCliente(clienteId: number): Promise<void>;
}
