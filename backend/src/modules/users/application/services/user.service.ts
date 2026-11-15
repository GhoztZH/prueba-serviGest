import { offsetDe, pagina, type Pagina, type Paginacion } from '../../../../shared/application/pagination';
import type { AuditLogger, CuentaNueva, CuentasUsuario, PasswordHasher } from '../../../../shared/application/ports';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work';
import type { AuthUser, Rol } from '../../../../shared/domain/auth-user';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../../../shared/domain/errors';
import type { RolInterno, Usuario } from '../../domain/entities/usuario';
import type { UserRepository } from '../../domain/interfaces/user.repository';

export interface Contexto {
  actor: AuthUser;
  ip?: string | null;
}

/**
 * Gestión de cuentas. Implementa además `CuentasUsuario`, el contrato que
 * consumen clientes y técnicos para crear la cuenta de acceso de sus perfiles
 * dentro de la misma transacción.
 */
export class UserService implements CuentasUsuario {
  constructor(
    private readonly repo: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditLogger,
    private readonly uow: UnitOfWork,
  ) {}

  async listar(filtro: Paginacion & { q?: string; rol?: Rol; activo?: boolean }): Promise<Pagina<Usuario>> {
    const { filas, total } = await this.repo.listar({ ...filtro, offset: offsetDe(filtro) });
    return pagina(filas, total, filtro);
  }

  async obtener(id: number): Promise<Usuario> {
    const usuario = await this.repo.buscarPorId(id);
    if (!usuario) throw new NotFoundError('Usuario');
    return usuario;
  }

  /** Alta de una cuenta interna (ADMIN o COORDINADOR). */
  crearInterno(datos: { nombre: string; email: string; password: string; rol: RolInterno }, ctx: Contexto): Promise<Usuario> {
    return this.uow.run(async () => {
      const id = await this.crear(datos);
      const usuario = await this.obtener(id);
      await this.audit.registrar({
        usuarioId: ctx.actor.id,
        entidad: 'usuarios',
        entidadId: id,
        accion: 'CREAR',
        despues: usuario,
        ip: ctx.ip,
      });
      return usuario;
    });
  }

  actualizarInterno(id: number, cambios: { nombre?: string; email?: string; activo?: boolean }, ctx: Contexto): Promise<Usuario> {
    return this.uow.run(async () => {
      const antes = await this.obtener(id);
      if (cambios.activo === false) {
        if (id === ctx.actor.id) throw new BusinessRuleError('No puede desactivar su propia cuenta');
        if (antes.rol === 'ADMIN' && (await this.repo.contarAdminsActivos(id)) === 0) {
          throw new BusinessRuleError('Debe existir al menos un administrador activo');
        }
      }
      await this.actualizar(id, cambios);
      const despues = await this.obtener(id);
      await this.audit.registrar({
        usuarioId: ctx.actor.id,
        entidad: 'usuarios',
        entidadId: id,
        accion: 'ACTUALIZAR',
        antes,
        despues,
        ip: ctx.ip,
      });
      return despues;
    });
  }

  /** Restablecimiento controlado por el administrador. */
  restablecerPassword(id: number, password: string, ctx: Contexto): Promise<void> {
    return this.uow.run(async () => {
      await this.obtener(id);
      await this.repo.cambiarPassword(id, await this.hasher.hash(password));
      await this.audit.registrar({
        usuarioId: ctx.actor.id,
        entidad: 'usuarios',
        entidadId: id,
        accion: 'RESTABLECER_PASSWORD',
        ip: ctx.ip,
      });
    });
  }

  // ---- CuentasUsuario (contrato para otros módulos) ------------------------

  async crear(cuenta: CuentaNueva): Promise<number> {
    if (await this.repo.existeEmail(cuenta.email)) {
      throw new ConflictError('Ya existe una cuenta con ese correo de acceso');
    }
    return this.repo.crear({
      email: cuenta.email,
      passwordHash: await this.hasher.hash(cuenta.password),
      nombre: cuenta.nombre,
      rol: cuenta.rol,
    });
  }

  async actualizar(id: number, cambios: { nombre?: string; email?: string; activo?: boolean }): Promise<void> {
    if (cambios.email && (await this.repo.existeEmail(cambios.email, id))) {
      throw new ConflictError('Ya existe una cuenta con ese correo de acceso');
    }
    await this.repo.actualizar(id, cambios);
  }

  async eliminarODesactivar(id: number): Promise<void> {
    const eliminada = await this.repo.eliminarSiSinRastro(id);
    if (!eliminada) await this.repo.actualizar(id, { activo: false });
  }
}
