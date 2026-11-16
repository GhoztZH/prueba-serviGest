import type { RequestHandler, Router } from 'express';
import type { AuditLogger, HistorialSolicitudes } from '../../shared/application/ports';
import type { Database } from '../../shared/db/database';
import { AuditQueryService } from './application/services/audit-query.service';
import { PgAuditRepository } from './infrastructure/persistence/pg-audit.repository';
import { PgHistorialRepository } from './infrastructure/persistence/pg-historial.repository';
import { auditRoutes } from './presentation/routes/audit.routes';

export interface AuditModule {
  audit: AuditLogger;
  historial: HistorialSolicitudes;
  routes(authenticate: RequestHandler): Router;
}

/** Módulo de auditoría: registro general inalterable e historial de solicitudes. */
export function createAuditModule(db: Database): AuditModule {
  const repo = new PgAuditRepository(db);
  const query = new AuditQueryService(repo);
  return {
    audit: repo,
    historial: new PgHistorialRepository(db),
    routes: (authenticate) => auditRoutes(query, authenticate),
  };
}
