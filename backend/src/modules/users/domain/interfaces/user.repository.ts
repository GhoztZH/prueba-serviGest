import type { Rol } from '../../../../shared/domain/auth-user';
import type { Usuario, UsuarioConCredenciales } from '../entities/usuario';

export interface FiltroUsuarios {
  q?: string;
  rol?: Rol;
  activo?: boolean;
  limit: number;
  offset: number;
}

export interface UserRepository {
  listar(filtro: FiltroUsuarios): Promise<{ filas: Usuario[]; total: number }>;
  buscarPorId(id: number): Promise<Usuario | undefined>;
  buscarCredencialesPorEmail(email: string): Promise<UsuarioConCredenciales | undefined>;
  buscarCredencialesPorId(id: number): Promise<UsuarioConCredenciales | undefined>;
  existeEmail(email: string, exceptoId?: number): Promise<boolean>;
  crear(datos: { email: string; passwordHash: string; nombre: string; rol: Rol }): Promise<number>;
  actualizar(id: number, cambios: { nombre?: string; email?: string; activo?: boolean }): Promise<void>;
  cambiarPassword(id: number, passwordHash: string): Promise<void>;
  registrarAcceso(id: number): Promise<void>;
  contarAdminsActivos(exceptoId?: number): Promise<number>;
  /** Borra la cuenta solo si no dejó rastro operativo. Devuelve si se eliminó. */
  eliminarSiSinRastro(id: number): Promise<boolean>;
  idsActivosPorRol(roles: Rol[]): Promise<number[]>;
}
