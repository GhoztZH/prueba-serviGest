import type { AuthUser } from '../../../../shared/domain/auth-user';
import { BusinessRuleError, ConflictError, ForbiddenError, ValidationError, type DetalleValidacion } from '../../../../shared/domain/errors';
import type { ArchivoSubido, SolicitudVista } from '../../domain/entities/solicitud';
import type { AlmacenAdjuntos } from '../../domain/interfaces/solicitud.repository';
import { calcularFechaLimite } from '../../domain/rules/plazo';
import { aVista, resumenEvento, umbralPorVencer, type SolicitudDeps } from '../dto/solicitud.dto';

export interface SolicitudEntrada {
  cliente_id?: number;
  sede_id: number;
  categoria_id: number;
  prioridad_id: number;
  titulo: string;
  descripcion: string;
  equipo_afectado: string;
}

/** Valida y registra los archivos de una solicitud. Compartido por el alta y por "subir adjuntos". */
export async function guardarAdjuntos(
  deps: Pick<SolicitudDeps, 'repo' | 'historial' | 'parametros'>,
  almacen: AlmacenAdjuntos,
  solicitudId: number,
  archivos: ArchivoSubido[],
  usuarioId: number,
): Promise<void> {
  if (!archivos.length) return;
  const maximo = await deps.parametros.numero('MAX_ADJUNTOS_POR_SOLICITUD', 5);
  const existentes = await deps.repo.contarAdjuntos(solicitudId);
  if (existentes + archivos.length > maximo) {
    throw new BusinessRuleError(`Una solicitud admite como máximo ${maximo} archivos adjuntos (ya tiene ${existentes})`);
  }
  for (const archivo of archivos) {
    if (!(await almacen.firmaValida(archivo.nombreArchivo, archivo.mimeType))) {
      throw new BusinessRuleError(`El contenido de "${archivo.nombreOriginal}" no corresponde a su tipo de archivo`);
    }
    await deps.repo.crearAdjunto(solicitudId, archivo, usuarioId);
  }
  await deps.historial.registrar({
    solicitudId,
    usuarioId,
    accion: 'ADJUNTO',
    detalle: { archivos: archivos.map((a) => a.nombreOriginal) },
  });
}

export class RegistrarSolicitudUseCase {
  constructor(
    private readonly deps: SolicitudDeps,
    private readonly almacen: AlmacenAdjuntos,
  ) {}

  async execute(user: AuthUser, entrada: SolicitudEntrada, archivos: ArchivoSubido[] = []): Promise<SolicitudVista> {
    const { repo, historial, eventos, uow, clock, parametros } = this.deps;
    try {
      return await uow.run(async () => {
        const clienteId = this.resolverCliente(user, entrada);
        await this.validarReferencias(clienteId, entrada);

        const duplicada = await repo.buscarDuplicadaAbierta({
          clienteId,
          sedeId: entrada.sede_id,
          categoriaId: entrada.categoria_id,
          equipoAfectado: entrada.equipo_afectado,
        });
        if (duplicada) {
          throw new ConflictError(
            `Ya existe una solicitud abierta para ese equipo en la misma sede y categoría: ${duplicada.codigo}`,
            { solicitud_id: duplicada.id, codigo: duplicada.codigo },
          );
        }

        const ahora = clock.now();
        const horas = (await repo.horasPlazo(entrada.prioridad_id))!;
        const id = await repo.crear({
          clienteId,
          sedeId: entrada.sede_id,
          categoriaId: entrada.categoria_id,
          prioridadId: entrada.prioridad_id,
          titulo: entrada.titulo,
          descripcion: entrada.descripcion,
          equipoAfectado: entrada.equipo_afectado,
          fechaLimite: calcularFechaLimite(ahora, horas),
          creadoPor: user.id,
          creadaEn: ahora,
        });
        await historial.registrar({ solicitudId: id, usuarioId: user.id, accion: 'CREACION', estadoNuevo: 'REGISTRADA' });
        await guardarAdjuntos(this.deps, this.almacen, id, archivos, user.id);

        const creada = (await repo.buscar(id))!;
        await eventos.publicar({ tipo: 'REGISTRO', actorId: user.id, actorNombre: user.nombre, solicitud: resumenEvento(creada) });
        return aVista(creada, ahora, await umbralPorVencer(parametros));
      });
    } catch (error) {
      // La transacción se revirtió: los archivos ya escritos en disco quedarían huérfanos.
      await this.almacen.descartar(archivos.map((a) => a.nombreArchivo));
      throw error;
    }
  }

  /** El CLIENTE registra para su propia empresa; ADMIN y COORDINADOR deben indicar el cliente. */
  private resolverCliente(user: AuthUser, entrada: SolicitudEntrada): number {
    if (user.rol === 'CLIENTE') {
      if (!user.clienteId) throw new ForbiddenError('Su cuenta no está vinculada a una empresa cliente');
      return user.clienteId;
    }
    if (user.rol === 'TECNICO') throw new ForbiddenError();
    if (!entrada.cliente_id) throw ValidationError.campo('cliente_id', 'Indique el cliente de la solicitud');
    return entrada.cliente_id;
  }

  /** Integridad y vigencia de las referencias (regla 8: existencia y coherencia). */
  private async validarReferencias(clienteId: number, entrada: SolicitudEntrada): Promise<void> {
    const ref = await this.deps.repo.referencias({
      clienteId,
      sedeId: entrada.sede_id,
      categoriaId: entrada.categoria_id,
      prioridadId: entrada.prioridad_id,
    });
    const errores: DetalleValidacion[] = [];
    if (!ref.cliente) errores.push({ campo: 'cliente_id', mensaje: 'El cliente no existe' });
    else if (!ref.cliente.activo) errores.push({ campo: 'cliente_id', mensaje: 'El cliente no está vigente' });

    if (!ref.sede || ref.sede.cliente_id !== clienteId) errores.push({ campo: 'sede_id', mensaje: 'La sede no pertenece al cliente' });
    else if (!ref.sede.activo) errores.push({ campo: 'sede_id', mensaje: 'La sede no está vigente' });

    if (!ref.categoria) errores.push({ campo: 'categoria_id', mensaje: 'La categoría no existe' });
    else if (!ref.categoria.activo) errores.push({ campo: 'categoria_id', mensaje: 'La categoría no está vigente' });

    if (!ref.prioridad) errores.push({ campo: 'prioridad_id', mensaje: 'La prioridad no existe' });
    if (errores.length) throw new ValidationError(errores);
  }
}
