import type { Router } from 'express';
import { createAssignmentsModule } from './modules/assignments';
import { createAuditModule } from './modules/audit';
import { Argon2Hasher, createAuthModule } from './modules/auth';
import { createCatalogsModule } from './modules/catalogs';
import { createClientsModule } from './modules/clients';
import { createDashboardModule } from './modules/dashboard';
import { createNotificationsModule } from './modules/notifications';
import { createRequestsModule } from './modules/requests';
import { createTechniciansModule } from './modules/technicians';
import { createUsersModule } from './modules/users';
import type { AppConfig } from './shared/config/env';
import { Database } from './shared/db/database';

export interface Container {
  config: AppConfig;
  db: Database;
  hasher: Argon2Hasher;
  /** Routers de los módulos, en orden de montaje bajo `/api`. */
  routers: Router[];
  close(): Promise<void>;
}

/**
 * Raíz de composición: el ÚNICO lugar que conoce las implementaciones
 * concretas. Cada módulo recibe por constructor las abstracciones que necesita
 * de los demás (inyección de dependencias manual, sin contenedor ni decoradores).
 *
 * Grafo de dependencias (sin ciclos):
 *   audit ← users ← auth
 *   audit ← catalogs ← technicians → users
 *   audit ← clients → users
 *   notifications, assignments(lectura) ← requests → audit(historial), catalogs(parámetros)
 *   requests ← assignments(casos de uso) → technicians
 *   requests, catalogs ← dashboard
 */
export function createContainer(config: AppConfig, db: Database = Database.connect(config.databaseUrl)): Container {
  const hasher = new Argon2Hasher();

  const audit = createAuditModule(db);
  const users = createUsersModule(db, hasher, audit.audit);
  const auth = createAuthModule(db, config, users.repo, hasher, audit.audit);
  const catalogs = createCatalogsModule(db, audit.audit);
  const clients = createClientsModule(db, users.service, audit.audit);
  const technicians = createTechniciansModule(db, users.service, catalogs.service, audit.audit);
  const notifications = createNotificationsModule(db);
  const assignments = createAssignmentsModule(db);
  const requests = createRequestsModule({
    db,
    historial: audit.historial,
    eventos: notifications.eventos,
    parametros: catalogs.service,
    asignaciones: assignments.lectura,
    uploadsDir: config.uploadsDir,
    zonaHoraria: config.timezone,
  });
  const dashboard = createDashboardModule(db, catalogs.service, config.timezone);

  const { authenticate } = auth;
  return {
    config,
    db,
    hasher,
    routers: [
      auth.routes(),
      users.routes(authenticate),
      catalogs.routes(authenticate),
      clients.routes(authenticate),
      technicians.routes(authenticate),
      // Antes que `requests`: comparten el prefijo /solicitudes/:id/...
      assignments.routes(requests.deps, technicians.repo, authenticate),
      requests.routes(authenticate),
      notifications.routes(authenticate),
      dashboard.routes(authenticate),
      audit.routes(authenticate),
    ],
    close: async () => {
      notifications.hub.cerrar();
      await db.close();
    },
  };
}
