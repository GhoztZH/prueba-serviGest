import type { RequestHandler, Router } from 'express';
import type { EventosSolicitud } from '../../shared/application/ports';
import type { Database } from '../../shared/db/database';
import { NotificationService } from './application/notification.service';
import { PgNotificationRepository } from './infrastructure/pg-notification.repository';
import { SseHub } from './infrastructure/sse-hub';
import { notificationRoutes } from './presentation/notification.routes';

export interface NotificationsModule {
  eventos: EventosSolicitud;
  hub: SseHub;
  routes(authenticate: RequestHandler): Router;
}

export function createNotificationsModule(db: Database): NotificationsModule {
  const hub = new SseHub();
  const service = new NotificationService(new PgNotificationRepository(db), hub, db);
  return { eventos: service, hub, routes: (authenticate) => notificationRoutes(service, hub, authenticate) };
}
