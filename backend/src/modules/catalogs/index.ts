import type { RequestHandler, Router } from 'express';
import type { AuditLogger } from '../../shared/application/ports';
import type { Database } from '../../shared/db/database';
import { CatalogService } from './application/services/catalog.service';
import { PgCatalogRepository } from './infrastructure/persistence/pg-catalog.repository';
import { catalogRoutes } from './presentation/catalog.routes';

export interface CatalogsModule {
  service: CatalogService;
  routes(authenticate: RequestHandler): Router;
}

export function createCatalogsModule(db: Database, audit: AuditLogger): CatalogsModule {
  const service = new CatalogService(new PgCatalogRepository(db), audit, db);
  return { service, routes: (authenticate) => catalogRoutes(service, authenticate) };
}
