import { beforeEach, describe, expect, it } from 'vitest';
import { AsignarTecnicoUseCase } from '../../src/modules/assignments/application/use-cases/asignar-tecnico';
import type { TecnicoCandidato } from '../../src/modules/assignments/domain/asignacion';
import type { SolicitudDeps } from '../../src/modules/requests/application/dto/solicitud.dto';
import { CambiarEstadoUseCase, ReabrirSolicitudUseCase } from '../../src/modules/requests/application/use-cases/cambiar-estado';
import type { Solicitud } from '../../src/modules/requests/domain/entities/solicitud';
import type { CambiosSolicitud, SolicitudRepository } from '../../src/modules/requests/domain/interfaces/solicitud.repository';
import type { EntradaHistorial, EventoSolicitud } from '../../src/shared/application/ports';
import type { AuthUser } from '../../src/shared/domain/auth-user';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../src/shared/domain/errors';

/**
 * Casos de uso probados SIN base de datos ni HTTP: los repositorios y puertos
 * se sustituyen por dobles en memoria (posible gracias a la inversión de
 * dependencias). Verifican la orquestación: qué se persiste, qué se audita y
 * qué eventos se emiten.
 */
const AHORA = new Date('2026-03-02T15:00:00Z');

function base(extra: Partial<Solicitud> = {}): Solicitud {
  return {
    id: 1, codigo: 'SOL-2026-000001', titulo: 'Sin red', descripcion: 'No hay red en ventas', equipo_afectado: 'Switch',
    cliente_id: 3, cliente_nombre: 'Cliente A', sede_id: 1, sede_nombre: 'Matriz', categoria_id: 1, categoria_nombre: 'Falla de red',
    especialidad_id: 1, prioridad_id: 3, prioridad: 'ALTA', prioridad_solicitada: 'ALTA', horas_plazo: 24, estado: 'EN_PROCESO',
    tecnico_id: 7, tecnico_nombre: 'Técnico Redes', resolucion: null, fecha_limite: new Date('2026-03-03T08:00:00Z'),
    fecha_resolucion: null, fecha_cierre: null, creado_por: 20, version: 4, created_at: new Date('2026-03-02T08:00:00Z'), ...extra,
  };
}

function escenario(inicial: Solicitud) {
  let solicitud = inicial;
  const historial: EntradaHistorial[] = [];
  const eventos: EventoSolicitud[] = [];
  const bloqueos: boolean[] = [];
  let transacciones = 0;

  const repo = {
    buscar: async (id: number, o?: { bloquear?: boolean }) => {
      bloqueos.push(Boolean(o?.bloquear));
      return id === solicitud.id ? solicitud : undefined;
    },
    actualizar: async (_id: number, c: CambiosSolicitud) => {
      solicitud = {
        ...solicitud,
        version: solicitud.version + 1,
        ...(c.estado !== undefined && { estado: c.estado }),
        ...(c.tecnicoId !== undefined && { tecnico_id: c.tecnicoId }),
        ...(c.resolucion !== undefined && { resolucion: c.resolucion }),
        ...(c.fechaLimite !== undefined && { fecha_limite: c.fechaLimite }),
        ...(c.fechaResolucion !== undefined && { fecha_resolucion: c.fechaResolucion }),
        ...(c.fechaCierre !== undefined && { fecha_cierre: c.fechaCierre }),
        ...(c.prioridadId !== undefined && { prioridad_id: c.prioridadId, prioridad: 'CRITICA', horas_plazo: 8 }),
      };
    },
    horasPlazo: async (id: number) => (id === 4 ? 8 : undefined),
  } as unknown as SolicitudRepository;

  const deps: SolicitudDeps = {
    repo,
    historial: { registrar: async (e) => void historial.push(e), listar: async () => [] },
    eventos: { publicar: async (e) => void eventos.push(e) },
    parametros: { numero: async (_clave, porDefecto) => porDefecto },
    uow: { run: async (work) => { transacciones += 1; return work(); }, afterCommit: () => undefined },
    clock: { now: () => AHORA },
  };
  return { deps, historial, eventos, bloqueos, actual: () => solicitud, transacciones: () => transacciones };
}

const tecnico: AuthUser = { id: 70, email: 't@test.ec', nombre: 'Técnico Redes', rol: 'TECNICO', clienteId: null, tecnicoId: 7 };
const coordinador: AuthUser = { id: 10, email: 'c@test.ec', nombre: 'Coordinador', rol: 'COORDINADOR', clienteId: null, tecnicoId: null };
const cliente: AuthUser = { id: 20, email: 'cl@test.ec', nombre: 'Cliente A', rol: 'CLIENTE', clienteId: 3, tecnicoId: null };
const RESOLUCION = 'Se reemplazó el patch cord dañado y se verificó la conexión.';

describe('CambiarEstadoUseCase', () => {
  let e: ReturnType<typeof escenario>;
  beforeEach(() => { e = escenario(base()); });

  it('Regla 7 · toda transición genera auditoría con usuario y cambio', async () => {
    const resultado = await new CambiarEstadoUseCase(e.deps).execute(tecnico, 1, { estado: 'RESUELTA', resolucion: RESOLUCION });

    expect(resultado.estado).toBe('RESUELTA');
    expect(e.historial).toEqual([
      expect.objectContaining({ solicitudId: 1, usuarioId: 70, accion: 'CAMBIO_ESTADO', estadoAnterior: 'EN_PROCESO', estadoNuevo: 'RESUELTA', comentario: RESOLUCION }),
    ]);
    expect(e.eventos).toEqual([expect.objectContaining({ tipo: 'CAMBIO_ESTADO', actorId: 70, estadoAnterior: 'EN_PROCESO' })]);
  });

  it('resolver guarda la resolución y la fecha, y deja el plazo como cumplido', async () => {
    const resultado = await new CambiarEstadoUseCase(e.deps).execute(tecnico, 1, { estado: 'RESUELTA', resolucion: RESOLUCION });
    expect(e.actual()).toMatchObject({ resolucion: RESOLUCION, fecha_resolucion: AHORA, version: 5 });
    expect(resultado.estado_plazo).toBe('CUMPLIDA');
  });

  it('Regla 8 · opera dentro de una transacción y bloquea la fila antes de validar', async () => {
    await new CambiarEstadoUseCase(e.deps).execute(tecnico, 1, { estado: 'PENDIENTE_INFO', comentario: 'Indique el horario de acceso' });
    expect(e.transacciones()).toBe(1);
    expect(e.bloqueos[0]).toBe(true);
  });

  it('una transición inválida no persiste nada ni emite eventos', async () => {
    await expect(new CambiarEstadoUseCase(e.deps).execute(tecnico, 1, { estado: 'CERRADA' })).rejects.toThrow(BusinessRuleError);
    expect(e.actual().estado).toBe('EN_PROCESO');
    expect(e.historial).toHaveLength(0);
    expect(e.eventos).toHaveLength(0);
  });

  it('quien no puede ver la solicitud recibe "no encontrado", no "prohibido"', async () => {
    const ajeno: AuthUser = { ...tecnico, tecnicoId: 99 };
    await expect(new CambiarEstadoUseCase(e.deps).execute(ajeno, 1, { estado: 'RESUELTA', resolucion: RESOLUCION })).rejects.toThrow(NotFoundError);
    await expect(new CambiarEstadoUseCase(e.deps).execute(tecnico, 999, { estado: 'RESUELTA', resolucion: RESOLUCION })).rejects.toThrow(NotFoundError);
  });

  it('detecta la modificación concurrente por versión', async () => {
    await expect(
      new CambiarEstadoUseCase(e.deps).execute(tecnico, 1, { estado: 'RESUELTA', resolucion: RESOLUCION, version: 3 }),
    ).rejects.toThrow(ConflictError);
  });

  it('al aprobar con otra prioridad recalcula el plazo desde el registro y lo audita', async () => {
    e = escenario(base({ estado: 'REGISTRADA', tecnico_id: null }));
    await new CambiarEstadoUseCase(e.deps).execute(coordinador, 1, { estado: 'APROBADA', prioridad_id: 4 });
    expect(e.actual().fecha_limite.toISOString()).toBe('2026-03-02T16:00:00.000Z'); // registro 08:00 + 8 h
    expect(e.historial.map((h) => h.accion)).toEqual(['CAMBIO_ESTADO', 'CAMBIO_PRIORIDAD']);
  });

  it('rechazar una resolución la borra y conserva el texto rechazado en el historial', async () => {
    e = escenario(base({ estado: 'RESUELTA', resolucion: RESOLUCION, fecha_resolucion: AHORA }));
    await new CambiarEstadoUseCase(e.deps).execute(cliente, 1, { estado: 'EN_PROCESO', comentario: 'El problema continúa' });
    expect(e.actual()).toMatchObject({ estado: 'EN_PROCESO', resolucion: null, fecha_resolucion: null });
    expect(e.historial[0]!.detalle).toEqual({ resolucion_rechazada: RESOLUCION });
  });
});

describe('ReabrirSolicitudUseCase · Regla 4', () => {
  const cerrada = base({ estado: 'CERRADA', resolucion: RESOLUCION, fecha_resolucion: new Date('2026-03-02T12:00:00Z'), fecha_cierre: new Date('2026-03-02T13:00:00Z') });

  it('reabre con motivo, reinicia el plazo y deja constancia en el historial', async () => {
    const e = escenario(cerrada);
    const resultado = await new ReabrirSolicitudUseCase(e.deps).execute(coordinador, 1, 'El problema volvió a presentarse hoy');

    expect(resultado.estado).toBe('EN_PROCESO');
    expect(e.actual()).toMatchObject({ resolucion: null, fecha_cierre: null, fecha_resolucion: null });
    expect(e.actual().fecha_limite.toISOString()).toBe('2026-03-03T15:00:00.000Z'); // reapertura + 24 h
    expect(e.historial[0]).toMatchObject({
      accion: 'REAPERTURA', usuarioId: 10, estadoAnterior: 'CERRADA', estadoNuevo: 'EN_PROCESO',
      comentario: 'El problema volvió a presentarse hoy',
      detalle: expect.objectContaining({ resolucion_anterior: RESOLUCION }),
    });
    expect(e.eventos[0]!.tipo).toBe('REAPERTURA');
  });

  it('un cliente no puede reabrir y la solicitud queda intacta', async () => {
    const e = escenario(cerrada);
    await expect(new ReabrirSolicitudUseCase(e.deps).execute(cliente, 1, 'El problema volvió a presentarse hoy')).rejects.toThrow(
      'Solo un administrador o coordinador puede reabrir una solicitud',
    );
    expect(e.actual().estado).toBe('CERRADA');
    expect(e.historial).toHaveLength(0);
  });
});

describe('AsignarTecnicoUseCase · Regla 5', () => {
  const candidato = (extra: Partial<TecnicoCandidato> = {}): TecnicoCandidato => ({
    id: 8, usuarioId: 80, nombre: 'Técnica Nueva', activo: true, disponible: true, maxSolicitudesActivas: 5, cargaActual: 1, especialidadIds: [1], ...extra,
  });
  function montar(solicitud: Solicitud, tecnicoDisponible: TecnicoCandidato | undefined) {
    const e = escenario(solicitud);
    const asignaciones: string[] = [];
    const uc = new AsignarTecnicoUseCase(
      e.deps,
      { cerrarActiva: async () => void asignaciones.push('cerrar'), crear: async (d) => void asignaciones.push(`crear:${d.tecnicoId}`) },
      { obtenerAsignable: async () => tecnicoDisponible, asignablesConEspecialidad: async () => (tecnicoDisponible ? [tecnicoDisponible] : []) },
    );
    return { e, uc, asignaciones };
  }

  it('asigna: cierra la asignación vigente, crea la nueva y registra responsable', async () => {
    const { e, uc, asignaciones } = montar(base({ estado: 'APROBADA', tecnico_id: null, tecnico_nombre: null }), candidato());
    const resultado = await uc.execute(coordinador, 1, { tecnico_id: 8 });

    expect(resultado).toMatchObject({ estado: 'ASIGNADA', tecnico_id: 8 });
    expect(asignaciones).toEqual(['cerrar', 'crear:8']);
    expect(e.historial[0]).toMatchObject({ accion: 'ASIGNACION', usuarioId: 10, estadoAnterior: 'APROBADA', estadoNuevo: 'ASIGNADA' });
    expect(e.eventos[0]).toMatchObject({ tipo: 'ASIGNACION', tecnicoAnteriorId: null });
  });

  it('rechaza al técnico que no cumple y explica los motivos, sin cambiar nada', async () => {
    const { e, uc, asignaciones } = montar(base({ estado: 'APROBADA', tecnico_id: null }), candidato({ especialidadIds: [2], cargaActual: 5 }));
    const error = await uc.execute(coordinador, 1, { tecnico_id: 8 }).catch((err) => err);

    expect(error).toBeInstanceOf(BusinessRuleError);
    expect(error.details.motivos).toHaveLength(2);
    expect(asignaciones).toEqual([]);
    expect(e.actual().estado).toBe('APROBADA');
    expect(e.historial).toHaveLength(0);
  });

  it('la reasignación exige motivo y avisa del técnico anterior', async () => {
    const { e, uc } = montar(base({ estado: 'EN_PROCESO' }), candidato());
    await expect(uc.execute(coordinador, 1, { tecnico_id: 8 })).rejects.toThrow('Los datos enviados no son válidos');

    await uc.execute(coordinador, 1, { tecnico_id: 8, motivo: 'Vacaciones del técnico anterior' });
    expect(e.historial[0]).toMatchObject({ accion: 'REASIGNACION', comentario: 'Vacaciones del técnico anterior' });
    expect(e.eventos[0]).toMatchObject({ tipo: 'REASIGNACION', tecnicoAnteriorId: 7 });
  });

  it('no se asigna una solicitud que aún no fue aprobada', async () => {
    const { uc } = montar(base({ estado: 'REGISTRADA', tecnico_id: null }), candidato());
    await expect(uc.execute(coordinador, 1, { tecnico_id: 8 })).rejects.toThrow('La solicitud debe ser aprobada antes de asignar un técnico');
  });

  it('un técnico no puede asignar', async () => {
    const { uc } = montar(base({ estado: 'APROBADA' }), candidato());
    await expect(uc.execute(tecnico, 1, { tecnico_id: 8 })).rejects.toThrow('No tiene permisos');
  });
});
