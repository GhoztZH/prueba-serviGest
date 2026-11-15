import type { AuditLogger, ParametrosOperativos } from '../../../../shared/application/ports';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work';
import type { AuthUser } from '../../../../shared/domain/auth-user';
import { ConflictError, NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import {
  validarValorParametro,
  type Categoria,
  type CatalogRepository,
  type Especialidad,
  type Estado,
  type Parametro,
  type Prioridad,
} from '../../domain/catalogs';

interface Contexto {
  actor: AuthUser;
  ip?: string | null;
}

/**
 * Catálogos y parámetros operativos. Cada escritura valida duplicidad,
 * vigencia e integridad referencial ANTES de tocar la base, y queda auditada.
 */
export class CatalogService implements ParametrosOperativos {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly audit: AuditLogger,
    private readonly uow: UnitOfWork,
  ) {}

  // ---- Especialidades ----
  listarEspecialidades(activo?: boolean): Promise<Especialidad[]> {
    return this.repo.listarEspecialidades(activo);
  }

  crearEspecialidad(d: { nombre: string; descripcion?: string | null }, ctx: Contexto): Promise<Especialidad> {
    return this.uow.run(async () => {
      if (await this.repo.existeNombreEspecialidad(d.nombre)) throw new ConflictError('Ya existe una especialidad con ese nombre');
      const id = await this.repo.crearEspecialidad({ nombre: d.nombre, descripcion: d.descripcion ?? null });
      const creada = (await this.repo.buscarEspecialidad(id))!;
      await this.auditar(ctx, 'especialidades', id, 'CREAR', undefined, creada);
      return creada;
    });
  }

  actualizarEspecialidad(
    id: number,
    d: { nombre?: string; descripcion?: string | null; activo?: boolean },
    ctx: Contexto,
  ): Promise<Especialidad> {
    return this.uow.run(async () => {
      const antes = await this.repo.buscarEspecialidad(id);
      if (!antes) throw new NotFoundError('Especialidad');
      if (d.nombre && (await this.repo.existeNombreEspecialidad(d.nombre, id))) {
        throw new ConflictError('Ya existe una especialidad con ese nombre');
      }
      if (d.activo === false && antes.activo) {
        const uso = await this.repo.usoEspecialidad(id);
        if (uso.categoriasActivas > 0) {
          throw new ConflictError(
            `No se puede desactivar: ${uso.categoriasActivas} categoría(s) vigente(s) dependen de esta especialidad`,
          );
        }
      }
      await this.repo.actualizarEspecialidad(id, d);
      const despues = (await this.repo.buscarEspecialidad(id))!;
      await this.auditar(ctx, 'especialidades', id, 'ACTUALIZAR', antes, despues);
      return despues;
    });
  }

  eliminarEspecialidad(id: number, ctx: Contexto): Promise<void> {
    return this.uow.run(async () => {
      const antes = await this.repo.buscarEspecialidad(id);
      if (!antes) throw new NotFoundError('Especialidad');
      const uso = await this.repo.usoEspecialidad(id);
      if (uso.categorias > 0 || uso.tecnicos > 0) {
        throw new ConflictError(
          `No se puede eliminar: la usan ${uso.categorias} categoría(s) y ${uso.tecnicos} técnico(s). Desactívela en su lugar`,
        );
      }
      await this.repo.eliminarEspecialidad(id);
      await this.auditar(ctx, 'especialidades', id, 'ELIMINAR', antes, undefined);
    });
  }

  // ---- Categorías ----
  listarCategorias(activo?: boolean): Promise<Categoria[]> {
    return this.repo.listarCategorias(activo);
  }

  crearCategoria(d: { nombre: string; descripcion?: string | null; especialidad_id: number }, ctx: Contexto): Promise<Categoria> {
    return this.uow.run(async () => {
      if (await this.repo.existeNombreCategoria(d.nombre)) throw new ConflictError('Ya existe una categoría con ese nombre');
      await this.exigirEspecialidadVigente(d.especialidad_id);
      const id = await this.repo.crearCategoria({
        nombre: d.nombre,
        descripcion: d.descripcion ?? null,
        especialidadId: d.especialidad_id,
      });
      const creada = (await this.repo.buscarCategoria(id))!;
      await this.auditar(ctx, 'categorias_servicio', id, 'CREAR', undefined, creada);
      return creada;
    });
  }

  actualizarCategoria(
    id: number,
    d: { nombre?: string; descripcion?: string | null; especialidad_id?: number; activo?: boolean },
    ctx: Contexto,
  ): Promise<Categoria> {
    return this.uow.run(async () => {
      const antes = await this.repo.buscarCategoria(id);
      if (!antes) throw new NotFoundError('Categoría');
      if (d.nombre && (await this.repo.existeNombreCategoria(d.nombre, id))) {
        throw new ConflictError('Ya existe una categoría con ese nombre');
      }
      if (d.especialidad_id && d.especialidad_id !== antes.especialidad_id) {
        await this.exigirEspecialidadVigente(d.especialidad_id);
      }
      await this.repo.actualizarCategoria(id, {
        nombre: d.nombre,
        descripcion: d.descripcion,
        especialidadId: d.especialidad_id,
        activo: d.activo,
      });
      const despues = (await this.repo.buscarCategoria(id))!;
      await this.auditar(ctx, 'categorias_servicio', id, 'ACTUALIZAR', antes, despues);
      return despues;
    });
  }

  eliminarCategoria(id: number, ctx: Contexto): Promise<void> {
    return this.uow.run(async () => {
      const antes = await this.repo.buscarCategoria(id);
      if (!antes) throw new NotFoundError('Categoría');
      const solicitudes = await this.repo.solicitudesDeCategoria(id);
      if (solicitudes > 0) {
        throw new ConflictError(`No se puede eliminar: ${solicitudes} solicitud(es) usan esta categoría. Desactívela en su lugar`);
      }
      await this.repo.eliminarCategoria(id);
      await this.auditar(ctx, 'categorias_servicio', id, 'ELIMINAR', antes, undefined);
    });
  }

  // ---- Prioridades y estados ----
  listarPrioridades(): Promise<Prioridad[]> {
    return this.repo.listarPrioridades();
  }

  actualizarPrioridad(id: number, d: { nombre?: string; horas_plazo?: number }, ctx: Contexto): Promise<Prioridad> {
    return this.uow.run(async () => {
      const antes = await this.repo.buscarPrioridad(id);
      if (!antes) throw new NotFoundError('Prioridad');
      await this.repo.actualizarPrioridad(id, { nombre: d.nombre, horasPlazo: d.horas_plazo });
      const despues = (await this.repo.buscarPrioridad(id))!;
      await this.auditar(ctx, 'prioridades', id, 'ACTUALIZAR', antes, despues);
      return despues;
    });
  }

  listarEstados(): Promise<Estado[]> {
    return this.repo.listarEstados();
  }

  // ---- Parámetros ----
  listarParametros(): Promise<Parametro[]> {
    return this.repo.listarParametros();
  }

  actualizarParametro(clave: string, valor: string, ctx: Contexto): Promise<Parametro> {
    return this.uow.run(async () => {
      const antes = await this.repo.buscarParametro(clave);
      if (!antes) throw new NotFoundError('Parámetro');
      await this.repo.actualizarParametro(clave, validarValorParametro(clave, valor));
      const despues = (await this.repo.buscarParametro(clave))!;
      await this.auditar(ctx, 'parametros', clave, 'ACTUALIZAR', { valor: antes.valor }, { valor: despues.valor });
      return despues;
    });
  }

  async numero(clave: string, porDefecto: number): Promise<number> {
    const parametro = await this.repo.buscarParametro(clave);
    const valor = Number(parametro?.valor);
    return Number.isFinite(valor) ? valor : porDefecto;
  }

  // ---- Internos ----
  private async exigirEspecialidadVigente(id: number): Promise<void> {
    const especialidad = await this.repo.buscarEspecialidad(id);
    if (!especialidad) throw ValidationError.campo('especialidad_id', 'La especialidad no existe');
    if (!especialidad.activo) throw ValidationError.campo('especialidad_id', 'La especialidad no está vigente');
  }

  private auditar(ctx: Contexto, entidad: string, id: number | string, accion: string, antes: unknown, despues: unknown) {
    return this.audit.registrar({ usuarioId: ctx.actor.id, entidad, entidadId: id, accion, antes, despues, ip: ctx.ip });
  }
}
