import type { RequestHandler, Router } from 'express';
import type { AuditLogger, CuentasUsuario, ParametrosOperativos } from '../../shared/application/ports';
import type { Database } from '../../shared/db/database';
import { TechnicianService } from './application/services/technician.service';
import type { TechnicianRepository } from './domain/technicians';
import { PgTechnicianRepository } from './infrastructure/persistence/pg-technician.repository';
import { technicianRoutes } from './presentation/technician.routes';

export interface TechniciansModule {
  repo: TechnicianRepository;
  service: TechnicianService;
  routes(authenticate: RequestHandler): Router;
}

export function createTechniciansModule(
  db: Database,
  cuentas: CuentasUsuario,
  parametros: ParametrosOperativos,
  audit: AuditLogger,
): TechniciansModule {
  const repo = new PgTechnicianRepository(db);
  const service = new TechnicianService(repo, cuentas, parametros, audit, db);
  return { repo, service, routes: (authenticate) => technicianRoutes(service, authenticate) };
}

export type { TecnicoAsignable } from './domain/technicians';
