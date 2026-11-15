import type { RequestHandler, Router } from 'express';
import { systemClock, type Clock, type EventosSolicitud, type HistorialSolicitudes, type ParametrosOperativos } from '../../shared/application/ports';
import type { Database } from '../../shared/db/database';
import type { SolicitudDeps } from './application/dto/solicitud.dto';
import { AdjuntarArchivosUseCase, ComentarSolicitudUseCase } from './application/use-cases/aportar-solicitud';
import { CambiarEstadoUseCase, ReabrirSolicitudUseCase } from './application/use-cases/cambiar-estado';
import { ConsultarSolicitudesUseCase } from './application/use-cases/consultar-solicitudes';
import { RegistrarSolicitudUseCase } from './application/use-cases/registrar-solicitud';
import type { AsignacionesLectura, SolicitudRepository } from './domain/interfaces/solicitud.repository';
import { AlmacenAdjuntosDisco } from './infrastructure/adapters/almacen-adjuntos';
import { PgSolicitudRepository } from './infrastructure/persistence/pg-solicitud.repository';
import { solicitudRoutes } from './presentation/routes/solicitud.routes';

export interface RequestsModule {
  repo: SolicitudRepository;
  deps: SolicitudDeps;
  routes(authenticate: RequestHandler): Router;
}

export interface RequestsModuleDeps {
  db: Database;
  historial: HistorialSolicitudes;
  eventos: EventosSolicitud;
  parametros: ParametrosOperativos;
  asignaciones: AsignacionesLectura;
  uploadsDir: string;
  zonaHoraria: string;
  clock?: Clock;
}

export function createRequestsModule(d: RequestsModuleDeps): RequestsModule {
  const repo = new PgSolicitudRepository(d.db);
  const almacen = new AlmacenAdjuntosDisco(d.uploadsDir);
  const deps: SolicitudDeps = {
    repo,
    historial: d.historial,
    eventos: d.eventos,
    parametros: d.parametros,
    uow: d.db,
    clock: d.clock ?? systemClock,
  };
  const useCases = {
    registrar: new RegistrarSolicitudUseCase(deps, almacen),
    consultar: new ConsultarSolicitudesUseCase(deps, d.asignaciones, d.zonaHoraria),
    cambiarEstado: new CambiarEstadoUseCase(deps),
    reabrir: new ReabrirSolicitudUseCase(deps),
    comentar: new ComentarSolicitudUseCase(deps),
    adjuntar: new AdjuntarArchivosUseCase(deps, almacen),
  };
  return { repo, deps, routes: (authenticate) => solicitudRoutes(useCases, almacen, almacen.receptor(), authenticate) };
}

// API pública del módulo para los que colaboran con él (asignaciones, dashboard).
export type { Solicitud, SolicitudVista } from './domain/entities/solicitud';
export type { AsignacionVista, AsignacionesLectura, SolicitudRepository } from './domain/interfaces/solicitud.repository';
export type { SolicitudDeps } from './application/dto/solicitud.dto';
export { aVista, resumenEvento, umbralPorVencer } from './application/dto/solicitud.dto';
export { cargarVisible } from './application/use-cases/consultar-solicitudes';
export { alcanceDe } from './domain/rules/acceso';
export { SQL_ABIERTA, SQL_VENCIDA, sqlPorVencer } from './infrastructure/persistence/plazo.sql';
