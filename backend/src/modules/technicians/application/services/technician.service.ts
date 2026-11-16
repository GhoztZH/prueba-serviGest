import { offsetDe, pagina, type Pagina, type Paginacion } from '../../../../shared/application/pagination';
import type { AuditLogger, CuentasUsuario, ParametrosOperativos } from '../../../../shared/application/ports';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work';
import { esGestion, type AuthUser } from '../../../../shared/domain/auth-user';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import { esCedulaValida } from '../../../../shared/domain/identificacion';
import type { TechnicianRepository, Tecnico } from '../../domain/technicians';

interface Contexto {
  actor: AuthUser;
  ip?: string | null;
}

export interface TecnicoNuevo {
  nombre: string;
  email: string;
  password: string;
  cedula: string;
  telefono?: string | null;
  max_solicitudes_activas?: number;
  especialidades: number[];
}

export interface TecnicoCambios {
  nombre?: string;
  email?: string;
  cedula?: string;
  telefono?: string | null;
  disponible?: boolean;
  max_solicitudes_activas?: number;
  especialidades?: number[];
  activo?: boolean;
}

export class TechnicianService {
  constructor(
    private readonly repo: TechnicianRepository,
    private readonly cuentas: CuentasUsuario,
    private readonly parametros: ParametrosOperativos,
    private readonly audit: AuditLogger,
    private readonly uow: UnitOfWork,
  ) {}

  async listar(filtro: Paginacion & { q?: string; especialidadId?: number; disponible?: boolean }): Promise<Pagina<Tecnico>> {
    const { filas, total } = await this.repo.listar({ ...filtro, offset: offsetDe(filtro) });
    return pagina(filas, total, filtro);
  }

  /** Gestión ve cualquier técnico; un TECNICO solo su propia ficha. */
  async obtener(id: number, actor: AuthUser): Promise<Tecnico> {
    const autorizado = esGestion(actor) || (actor.rol === 'TECNICO' && actor.tecnicoId === id);
    const tecnico = autorizado ? await this.repo.buscar(id) : undefined;
    if (!tecnico) throw new NotFoundError('Técnico');
    return tecnico;
  }

  crear(datos: TecnicoNuevo, ctx: Contexto): Promise<Tecnico> {
    return this.uow.run(async () => {
      if (!esCedulaValida(datos.cedula)) throw ValidationError.campo('cedula', 'La cédula no es válida');
      if (await this.repo.existeCedula(datos.cedula)) throw new ConflictError('Ya existe un técnico con esa cédula');
      const especialidades = await this.validarEspecialidades(datos.especialidades);

      const usuarioId = await this.cuentas.crear({
        email: datos.email,
        password: datos.password,
        nombre: datos.nombre,
        rol: 'TECNICO',
      });
      const id = await this.repo.crear({
        usuarioId,
        cedula: datos.cedula,
        telefono: datos.telefono ?? null,
        maxSolicitudesActivas:
          datos.max_solicitudes_activas ?? (await this.parametros.numero('MAX_SOLICITUDES_ACTIVAS_DEFECTO', 5)),
      });
      await this.repo.reemplazarEspecialidades(id, especialidades);

      const creado = (await this.repo.buscar(id))!;
      await this.auditar(ctx, id, 'CREAR', undefined, creado);
      return creado;
    });
  }

  actualizar(id: number, cambios: TecnicoCambios, ctx: Contexto): Promise<Tecnico> {
    return this.uow.run(async () => {
      const antes = await this.repo.buscar(id);
      if (!antes) throw new NotFoundError('Técnico');

      if (cambios.cedula && cambios.cedula !== antes.cedula) {
        if (!esCedulaValida(cambios.cedula)) throw ValidationError.campo('cedula', 'La cédula no es válida');
        if (await this.repo.existeCedula(cambios.cedula, id)) throw new ConflictError('Ya existe un técnico con esa cédula');
      }
      if (cambios.activo === false && antes.carga_actual > 0) {
        throw new ConflictError(
          `No se puede desactivar: el técnico tiene ${antes.carga_actual} solicitud(es) activas. Reasígnelas primero`,
        );
      }
      if (cambios.especialidades) {
        await this.repo.reemplazarEspecialidades(id, await this.validarEspecialidades(cambios.especialidades));
      }
      if (cambios.nombre !== undefined || cambios.email !== undefined || cambios.activo !== undefined) {
        await this.cuentas.actualizar(antes.usuario_id, { nombre: cambios.nombre, email: cambios.email, activo: cambios.activo });
      }
      await this.repo.actualizar(id, {
        cedula: cambios.cedula,
        telefono: cambios.telefono,
        disponible: cambios.disponible,
        maxSolicitudesActivas: cambios.max_solicitudes_activas,
        activo: cambios.activo,
      });

      const despues = (await this.repo.buscar(id))!;
      await this.auditar(ctx, id, 'ACTUALIZAR', antes, despues);
      return despues;
    });
  }

  eliminar(id: number, ctx: Contexto): Promise<void> {
    return this.uow.run(async () => {
      const antes = await this.repo.buscar(id);
      if (!antes) throw new NotFoundError('Técnico');
      const asignaciones = await this.repo.totalAsignaciones(id);
      if (asignaciones > 0) {
        throw new ConflictError(
          `No se puede eliminar: el técnico figura en ${asignaciones} asignación(es). Desactívelo en su lugar`,
        );
      }
      await this.repo.eliminar(id);
      await this.cuentas.eliminarODesactivar(antes.usuario_id);
      await this.auditar(ctx, id, 'ELIMINAR', antes, undefined);
    });
  }

  /** El técnico autenticado cambia su propia disponibilidad. */
  cambiarDisponibilidad(disponible: boolean, ctx: Contexto): Promise<Tecnico> {
    return this.uow.run(async () => {
      const id = ctx.actor.tecnicoId;
      if (ctx.actor.rol !== 'TECNICO' || !id) throw new ForbiddenError();
      const antes = await this.repo.buscar(id);
      if (!antes) throw new NotFoundError('Técnico');
      await this.repo.actualizar(id, { disponible });
      const despues = (await this.repo.buscar(id))!;
      await this.auditar(ctx, id, 'CAMBIAR_DISPONIBILIDAD', { disponible: antes.disponible }, { disponible });
      return despues;
    });
  }

  private async validarEspecialidades(ids: number[]): Promise<number[]> {
    const unicos = [...new Set(ids)];
    const vigentes = await this.repo.especialidadesVigentes(unicos);
    if (vigentes.length !== unicos.length) {
      throw ValidationError.campo('especialidades', 'Alguna especialidad no existe o no está vigente');
    }
    return unicos;
  }

  private auditar(ctx: Contexto, id: number, accion: string, antes: unknown, despues: unknown) {
    return this.audit.registrar({ usuarioId: ctx.actor.id, entidad: 'tecnicos', entidadId: id, accion, antes, despues, ip: ctx.ip });
  }
}
