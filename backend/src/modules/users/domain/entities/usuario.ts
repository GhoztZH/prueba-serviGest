import type { Rol } from '../../../../shared/domain/auth-user';

/** Cuenta de acceso. Nunca incluye el hash de la contraseña. */
export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  ultimo_acceso: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Vista interna para autenticación: añade credenciales y vínculos de perfil. */
export interface UsuarioConCredenciales extends Usuario {
  password_hash: string;
  cliente_id: number | null;
  tecnico_id: number | null;
}

/** Roles que se administran desde el módulo de usuarios (cuentas internas). */
export const ROLES_INTERNOS = ['ADMIN', 'COORDINADOR'] as const;
export type RolInterno = (typeof ROLES_INTERNOS)[number];
