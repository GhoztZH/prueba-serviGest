export const ROLES = ['ADMIN', 'COORDINADOR', 'TECNICO', 'CLIENTE'] as const;
export type Rol = (typeof ROLES)[number];

/** Roles de gestión: ven y operan sobre todas las solicitudes. */
export const ROLES_GESTION: readonly Rol[] = ['ADMIN', 'COORDINADOR'];

/**
 * Identidad autenticada que viaja por los casos de uso. La resuelve el
 * servidor en cada petición a partir del token; nunca se confía en datos de
 * identidad enviados por el cliente.
 */
export interface AuthUser {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  /** Empresa a la que pertenece la cuenta (solo rol CLIENTE). */
  clienteId: number | null;
  /** Ficha de técnico de la cuenta (solo rol TECNICO). */
  tecnicoId: number | null;
}

export function esGestion(user: Pick<AuthUser, 'rol'>): boolean {
  return ROLES_GESTION.includes(user.rol);
}
