import type { AuthUser, Rol } from '../../../../shared/domain/auth-user';

/** Lo que auth necesita de las cuentas (lo implementa el repositorio de usuarios). */
export interface CuentaConCredenciales {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  password_hash: string;
  cliente_id: number | null;
  tecnico_id: number | null;
}

export interface CredencialesUsuario {
  buscarCredencialesPorEmail(email: string): Promise<CuentaConCredenciales | undefined>;
  buscarCredencialesPorId(id: number): Promise<CuentaConCredenciales | undefined>;
  cambiarPassword(id: number, passwordHash: string): Promise<void>;
  registrarAcceso(id: number): Promise<void>;
  actualizar(id: number, cambios: { nombre?: string }): Promise<void>;
}

export interface TokenEmitido {
  token: string;
  jti: string;
  expiraEn: Date;
}

export interface TokenVerificado {
  usuarioId: number;
  jti: string;
  expiraEn: Date;
}

export interface TokenService {
  emitir(usuarioId: number): TokenEmitido;
  /** Lanza `UnauthorizedError` si la firma, el formato o la vigencia no son válidos. */
  verificar(token: string): TokenVerificado;
}

/** Persistencia de revocaciones de token y de restablecimientos de contraseña. */
export interface SessionRepository {
  revocar(jti: string, usuarioId: number, expiraEn: Date): Promise<void>;
  estaRevocado(jti: string): Promise<boolean>;
  purgarRevocadosExpirados(): Promise<void>;
  crearRestablecimiento(usuarioId: number, tokenHash: string, expiraEn: Date): Promise<void>;
  /** Marca el token como usado si es válido y vigente; devuelve el usuario dueño. */
  consumirRestablecimiento(tokenHash: string): Promise<number | undefined>;
}

export interface Perfil {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  clienteId: number | null;
  tecnicoId: number | null;
}

export function aPerfil(c: CuentaConCredenciales): Perfil {
  return { id: c.id, email: c.email, nombre: c.nombre, rol: c.rol, clienteId: c.cliente_id, tecnicoId: c.tecnico_id };
}

export function aAuthUser(c: CuentaConCredenciales): AuthUser {
  return aPerfil(c);
}
