import type { AuditLogger, PasswordHasher } from '../../../../shared/application/ports';
import type { AuthUser } from '../../../../shared/domain/auth-user';
import { ForbiddenError, UnauthorizedError } from '../../../../shared/domain/errors';
import {
  aAuthUser,
  aPerfil,
  type CredencialesUsuario,
  type Perfil,
  type SessionRepository,
  type TokenService,
  type TokenVerificado,
} from '../../domain/interfaces/auth.ports';

const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos';

export class LoginUseCase {
  private hashSenuelo?: Promise<string>;

  constructor(
    private readonly cuentas: CredencialesUsuario,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly audit: AuditLogger,
  ) {}

  async execute(email: string, password: string, ip?: string | null): Promise<{ token: string; usuario: Perfil }> {
    const cuenta = await this.cuentas.buscarCredencialesPorEmail(email);

    // Se verifica siempre un hash (real o señuelo) para que el tiempo de
    // respuesta no revele si el correo existe.
    const hash = cuenta?.password_hash ?? (await (this.hashSenuelo ??= this.hasher.hash('senuelo-sin-uso-0')));
    const coincide = await this.hasher.verify(hash, password);

    if (!cuenta || !coincide) {
      await this.audit.registrar({
        usuarioId: cuenta?.id ?? null,
        entidad: 'sesion',
        accion: 'LOGIN_FALLIDO',
        despues: { email },
        ip,
      });
      throw new UnauthorizedError(CREDENCIALES_INVALIDAS);
    }
    if (!cuenta.activo) throw new ForbiddenError('La cuenta está inactiva. Contacte al administrador');

    await this.cuentas.registrarAcceso(cuenta.id);
    await this.audit.registrar({ usuarioId: cuenta.id, entidad: 'sesion', entidadId: cuenta.id, accion: 'LOGIN', ip });
    return { token: this.tokens.emitir(cuenta.id).token, usuario: aPerfil(cuenta) };
  }
}

/**
 * Resuelve la identidad de una petición a partir de su token. Se consulta la
 * base en cada petición: así un cierre de sesión (revocación) o la
 * desactivación de la cuenta surten efecto de inmediato, sin esperar a que
 * el token expire.
 */
export class ResolveSessionUseCase {
  constructor(
    private readonly cuentas: CredencialesUsuario,
    private readonly sesiones: SessionRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(token: string): Promise<{ user: AuthUser; token: TokenVerificado }> {
    const verificado = this.tokens.verificar(token);
    if (await this.sesiones.estaRevocado(verificado.jti)) throw new UnauthorizedError('La sesión fue cerrada');
    const cuenta = await this.cuentas.buscarCredencialesPorId(verificado.usuarioId);
    if (!cuenta || !cuenta.activo) throw new UnauthorizedError('La sesión ya no es válida');
    return { user: aAuthUser(cuenta), token: verificado };
  }
}

export class LogoutUseCase {
  constructor(
    private readonly sesiones: SessionRepository,
    private readonly audit: AuditLogger,
  ) {}

  async execute(user: AuthUser, token: { jti: string; expiraEn: Date }, ip?: string | null): Promise<void> {
    await this.sesiones.revocar(token.jti, user.id, token.expiraEn);
    await this.sesiones.purgarRevocadosExpirados();
    await this.audit.registrar({ usuarioId: user.id, entidad: 'sesion', entidadId: user.id, accion: 'LOGOUT', ip });
  }
}
