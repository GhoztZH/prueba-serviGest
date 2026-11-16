import type { RequestHandler, Router } from 'express';
import type { AuditLogger, CuentasUsuario } from '../../shared/application/ports';
import type { Database } from '../../shared/db/database';
import { ClientService } from './application/services/client.service';
import { PgClientRepository } from './infrastructure/persistence/pg-client.repository';
import { clientRoutes } from './presentation/client.routes';

export interface ClientsModule {
  service: ClientService;
  routes(authenticate: RequestHandler): Router;
}

export function createClientsModule(db: Database, cuentas: CuentasUsuario, audit: AuditLogger): ClientsModule {
  const service = new ClientService(new PgClientRepository(db), cuentas, audit, db);
  return { service, routes: (authenticate) => clientRoutes(service, authenticate) };
}
