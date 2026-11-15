import { createHash, randomBytes } from 'node:crypto';
import type { AuditLogger, Clock, PasswordHasher } from '../../../../shared/application/ports';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work';
import type { AuthUser } from '../../../../shared/domain/auth-user';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import { aPerfil, type CredencialesUsuario, type Perfil, type SessionRepository } from '../../domain/interfaces/auth.ports';

const sha256 = (valor: string) => createHash('sha256').update(valor).digest('hex');

export class ChangePasswordUseCase {
  constructor(
    private readonly cuentas: CredencialesUsuario,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditLogger,
    private readonly uow: UnitOfWork,
  ) {}

  execute(user: AuthUser, actual: string, nueva: string, ip?: string | null): Promise<void> {
    return this.uow.run(async () => {
      const cuenta = await this.cuentas.buscarCredencialesPorId(user.id);
      if (!cuenta) throw new NotFoundError('Usuario');
      if (!(await this.hasher.verify(cuenta.password_hash, actual))) {
        throw ValidationError.campo('actual', 'La contraseña actual no es correcta');
      }
      if (actual === nueva) throw ValidationError.campo('nueva', 'La nueva contraseña debe ser distinta de la actual');
      await this.cuentas.cambiarPassword(user.id, await this.hasher.hash(nueva));
      await this.audit.registrar({ usuarioId: user.id, entidad: 'usuarios', entidadId: user.id, accion: 'CAMBIAR_PASSWORD', ip });
    });
  }
}

/**
 * Restablecimiento controlado: se genera un token aleatorio de un solo uso y
 * en la base solo se guarda su hash SHA-256. La respuesta es idéntica exista o
 * no el correo, para no permitir enumerar cuentas.
 */
export class ForgotPasswordUseCase {
  constructor(
    private readonly cuentas: CredencialesUsuario,
    private readonly sesiones: SessionRepository,
    private readonly clock: Clock,
    private readonly horasVigencia: number,
    private readonly exponerToken: boolean,
  ) {}

  async execute(email: string): Promise<{ message: string; tokenDesarrollo?: string }> {
    const message = 'Si el correo está registrado, recibirá instrucciones para restablecer su contraseña';
    const cuenta = await this.cuentas.buscarCredencialesPorEmail(email);
    if (!cuenta || !cuenta.activo) return { message };

    const token = randomBytes(32).toString('hex');
    const expiraEn = new Date(this.clock.now().getTime() + this.horasVigencia * 3_600_000);
    await this.sesiones.crearRestablecimiento(cuenta.id, sha256(token), expiraEn);
    // El proyecto no integra servidor de correo: fuera de producción el token
    // se devuelve para poder completar el flujo (contrato OpenAPI).
    return this.exponerToken ? { message, tokenDesarrollo: token } : { message };
  }
}

export class ResetPasswordUseCase {
  constructor(
    private readonly cuentas: CredencialesUsuario,
    private readonly sesiones: SessionRepository,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditLogger,
    private readonly uow: UnitOfWork,
  ) {}

  execute(token: string, password: string, ip?: string | null): Promise<void> {
    return this.uow.run(async () => {
      const usuarioId = await this.sesiones.consumirRestablecimiento(sha256(token));
      if (!usuarioId) throw new BusinessRuleError('El enlace de restablecimiento no es válido o ya expiró');
      await this.cuentas.cambiarPassword(usuarioId, await this.hasher.hash(password));
      await this.audit.registrar({ usuarioId, entidad: 'usuarios', entidadId: usuarioId, accion: 'RESTABLECER_PASSWORD_TOKEN', ip });
    });
  }
}

/** Gestión del propio perfil: solo el nombre (el correo y el rol los administra el ADMIN). */
export class UpdateProfileUseCase {
  constructor(
    private readonly cuentas: CredencialesUsuario,
    private readonly audit: AuditLogger,
    private readonly uow: UnitOfWork,
  ) {}

  execute(user: AuthUser, nombre: string, ip?: string | null): Promise<Perfil> {
    return this.uow.run(async () => {
      await this.cuentas.actualizar(user.id, { nombre });
      const cuenta = await this.cuentas.buscarCredencialesPorId(user.id);
      if (!cuenta) throw new NotFoundError('Usuario');
      await this.audit.registrar({
        usuarioId: user.id,
        entidad: 'usuarios',
        entidadId: user.id,
        accion: 'ACTUALIZAR_PERFIL',
        antes: { nombre: user.nombre },
        despues: { nombre },
        ip,
      });
      return aPerfil(cuenta);
    });
  }
}
