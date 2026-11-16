import { offsetDe, pagina, type Pagina, type Paginacion } from '../../../../shared/application/pagination';
import type { AuditLogger, CuentasUsuario } from '../../../../shared/application/ports';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work';
import { esGestion, type AuthUser } from '../../../../shared/domain/auth-user';
import { ConflictError, NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import { esIdentificacionValida } from '../../../../shared/domain/identificacion';
import type { Cliente, ClienteDetalle, ClientRepository, Sede } from '../../domain/clients';

interface Contexto {
  actor: AuthUser;
  ip?: string | null;
}

export interface ClienteEntrada {
  identificacion: string;
  razon_social: string;
  email: string;
  telefono?: string | null;
  direccion?: string | null;
  sedes?: Array<{ nombre: string; direccion: string }>;
  cuenta?: { email: string; password?: string };
}

export class ClientService {
  constructor(
    private readonly repo: ClientRepository,
    private readonly cuentas: CuentasUsuario,
    private readonly audit: AuditLogger,
    private readonly uow: UnitOfWork,
  ) {}

  async listar(filtro: Paginacion & { q?: string; activo?: boolean }): Promise<Pagina<Cliente>> {
    const { filas, total } = await this.repo.listar({ ...filtro, offset: offsetDe(filtro) });
    return pagina(filas, total, filtro);
  }

  /** Un CLIENTE solo puede consultar su propia empresa; cualquier otra responde 404. */
  async obtener(id: number, actor: AuthUser): Promise<ClienteDetalle> {
    const cliente = await this.exigirAcceso(id, actor);
    return { ...cliente, sedes: await this.repo.listarSedes(id) };
  }

  async listarSedes(id: number, actor: AuthUser): Promise<Sede[]> {
    await this.exigirAcceso(id, actor);
    return this.repo.listarSedes(id);
  }

  crear(datos: ClienteEntrada, ctx: Contexto): Promise<ClienteDetalle> {
    return this.uow.run(async () => {
      this.validarIdentificacion(datos.identificacion);
      if (await this.repo.existeIdentificacion(datos.identificacion)) {
        throw new ConflictError('Ya existe un cliente con esa identificación');
      }
      const sedes = datos.sedes ?? [];
      const nombres = new Set(sedes.map((s) => s.nombre.toLowerCase()));
      if (nombres.size !== sedes.length) throw ValidationError.campo('sedes', 'Hay sedes con el mismo nombre');

      let usuarioId: number | null = null;
      if (datos.cuenta) {
        if (!datos.cuenta.password) throw ValidationError.campo('cuenta.password', 'La contraseña es obligatoria');
        usuarioId = await this.cuentas.crear({
          email: datos.cuenta.email,
          password: datos.cuenta.password,
          nombre: datos.razon_social,
          rol: 'CLIENTE',
        });
      }
      const id = await this.repo.crear({
        usuarioId,
        identificacion: datos.identificacion,
        razonSocial: datos.razon_social,
        email: datos.email,
        telefono: datos.telefono ?? null,
        direccion: datos.direccion ?? null,
      });
      for (const sede of sedes) await this.repo.crearSede(id, sede);

      const creado = await this.detalle(id);
      await this.auditar(ctx, 'clientes', id, 'CREAR', undefined, creado);
      return creado;
    });
  }

  actualizar(id: number, datos: Partial<ClienteEntrada> & { activo?: boolean }, ctx: Contexto): Promise<ClienteDetalle> {
    return this.uow.run(async () => {
      const antes = await this.repo.buscar(id);
      if (!antes) throw new NotFoundError('Cliente');

      if (datos.identificacion && datos.identificacion !== antes.identificacion) {
        this.validarIdentificacion(datos.identificacion);
        if (await this.repo.existeIdentificacion(datos.identificacion, id)) {
          throw new ConflictError('Ya existe un cliente con esa identificación');
        }
      }

      let usuarioId = antes.usuario_id ?? undefined;
      if (datos.cuenta) {
        if (usuarioId) {
          await this.cuentas.actualizar(usuarioId, { email: datos.cuenta.email });
        } else {
          if (!datos.cuenta.password) throw ValidationError.campo('cuenta.password', 'La contraseña es obligatoria');
          usuarioId = await this.cuentas.crear({
            email: datos.cuenta.email,
            password: datos.cuenta.password,
            nombre: datos.razon_social ?? antes.razon_social,
            rol: 'CLIENTE',
          });
        }
      }
      // La vigencia del cliente arrastra la de su cuenta de acceso (contrato).
      if (usuarioId && (datos.activo !== undefined || datos.razon_social)) {
        await this.cuentas.actualizar(usuarioId, { activo: datos.activo, nombre: datos.razon_social });
      }

      await this.repo.actualizar(id, {
        identificacion: datos.identificacion,
        razonSocial: datos.razon_social,
        email: datos.email,
        telefono: datos.telefono,
        direccion: datos.direccion,
        activo: datos.activo,
        usuarioId: usuarioId !== (antes.usuario_id ?? undefined) ? usuarioId : undefined,
      });
      const despues = await this.detalle(id);
      await this.auditar(ctx, 'clientes', id, 'ACTUALIZAR', antes, despues);
      return despues;
    });
  }

  eliminar(id: number, ctx: Contexto): Promise<void> {
    return this.uow.run(async () => {
      const antes = await this.repo.buscar(id);
      if (!antes) throw new NotFoundError('Cliente');
      if (antes.total_solicitudes > 0) {
        throw new ConflictError(
          `No se puede eliminar: el cliente tiene ${antes.total_solicitudes} solicitud(es) registradas. Desactívelo en su lugar`,
        );
      }
      await this.repo.eliminarSedesDeCliente(id);
      await this.repo.eliminar(id);
      if (antes.usuario_id) await this.cuentas.eliminarODesactivar(antes.usuario_id);
      await this.auditar(ctx, 'clientes', id, 'ELIMINAR', antes, undefined);
    });
  }

  // ---- Sedes ----
  crearSede(clienteId: number, datos: { nombre: string; direccion: string }, ctx: Contexto): Promise<Sede> {
    return this.uow.run(async () => {
      if (!(await this.repo.buscar(clienteId))) throw new NotFoundError('Cliente');
      if (await this.repo.existeNombreSede(clienteId, datos.nombre)) {
        throw new ConflictError('El cliente ya tiene una sede con ese nombre');
      }
      const id = await this.repo.crearSede(clienteId, datos);
      const sede = (await this.repo.buscarSede(clienteId, id))!;
      await this.auditar(ctx, 'sedes', id, 'CREAR', undefined, sede);
      return sede;
    });
  }

  actualizarSede(
    clienteId: number,
    sedeId: number,
    cambios: { nombre?: string; direccion?: string; activo?: boolean },
    ctx: Contexto,
  ): Promise<Sede> {
    return this.uow.run(async () => {
      const antes = await this.repo.buscarSede(clienteId, sedeId);
      if (!antes) throw new NotFoundError('Sede');
      if (cambios.nombre && (await this.repo.existeNombreSede(clienteId, cambios.nombre, sedeId))) {
        throw new ConflictError('El cliente ya tiene una sede con ese nombre');
      }
      await this.repo.actualizarSede(sedeId, cambios);
      const despues = (await this.repo.buscarSede(clienteId, sedeId))!;
      await this.auditar(ctx, 'sedes', sedeId, 'ACTUALIZAR', antes, despues);
      return despues;
    });
  }

  eliminarSede(clienteId: number, sedeId: number, ctx: Contexto): Promise<void> {
    return this.uow.run(async () => {
      const antes = await this.repo.buscarSede(clienteId, sedeId);
      if (!antes) throw new NotFoundError('Sede');
      if (antes.total_solicitudes > 0) {
        throw new ConflictError(
          `No se puede eliminar: la sede tiene ${antes.total_solicitudes} solicitud(es) registradas. Desactívela en su lugar`,
        );
      }
      await this.repo.eliminarSede(sedeId);
      await this.auditar(ctx, 'sedes', sedeId, 'ELIMINAR', antes, undefined);
    });
  }

  // ---- Internos ----
  private async exigirAcceso(id: number, actor: AuthUser): Promise<Cliente> {
    const autorizado = esGestion(actor) || (actor.rol === 'CLIENTE' && actor.clienteId === id);
    const cliente = autorizado ? await this.repo.buscar(id) : undefined;
    if (!cliente) throw new NotFoundError('Cliente');
    return cliente;
  }

  private async detalle(id: number): Promise<ClienteDetalle> {
    const cliente = (await this.repo.buscar(id))!;
    return { ...cliente, sedes: await this.repo.listarSedes(id) };
  }

  private validarIdentificacion(identificacion: string): void {
    if (!esIdentificacionValida(identificacion)) {
      throw ValidationError.campo('identificacion', 'La cédula o el RUC no es válido');
    }
  }

  private auditar(ctx: Contexto, entidad: string, id: number, accion: string, antes: unknown, despues: unknown) {
    return this.audit.registrar({ usuarioId: ctx.actor.id, entidad, entidadId: id, accion, antes, despues, ip: ctx.ip });
  }
}
