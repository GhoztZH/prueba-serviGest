import type { RequestHandler, Router } from 'express';
import type { Database } from '../../shared/db/database';
import type { AsignacionesLectura, SolicitudDeps } from '../requests';
import { AsignarTecnicoUseCase } from './application/use-cases/asignar-tecnico';
import type { TecnicosParaAsignar } from './domain/asignacion';
import { PgAsignacionRepository } from './infrastructure/pg-asignacion.repository';
import { asignacionRoutes } from './presentation/asignacion.routes';

export interface AssignmentsModule {
  /** Lectura del histórico que consume el detalle de la solicitud. */
  lectura: AsignacionesLectura;
  /** Se completa cuando existe el módulo de solicitudes (evita la dependencia circular). */
  routes(solicitudes: SolicitudDeps, tecnicos: TecnicosParaAsignar, authenticate: RequestHandler): Router;
}

export function createAssignmentsModule(db: Database): AssignmentsModule {
  const repo = new PgAsignacionRepository(db);
  return {
    lectura: repo,
    routes: (solicitudes, tecnicos, authenticate) =>
      asignacionRoutes(new AsignarTecnicoUseCase(solicitudes, repo, tecnicos), authenticate),
  };
}
