import { Router, type RequestHandler } from 'express';
import { authOf, booleanoQuery, idParam, paginacionSchema, parse } from '../../../shared/http/http';
import type { NotificationService } from '../application/notification.service';
import type { SseHub } from '../infrastructure/sse-hub';

const filtroSchema = paginacionSchema.extend({ no_leidas: booleanoQuery.optional() });

export function notificationRoutes(service: NotificationService, hub: SseHub, authenticate: RequestHandler): Router {
  const router = Router();

  router.get('/notificaciones', authenticate, async (req, res) => {
    const { no_leidas, ...filtro } = parse(filtroSchema, req.query);
    res.json(await service.listar(authOf(req).id, { ...filtro, noLeidas: no_leidas }));
  });

  // Antes de `/:id/leida` para que "leer-todas" no se interprete como un id.
  router.patch('/notificaciones/leer-todas', authenticate, async (req, res) => {
    res.json(await service.marcarTodasLeidas(authOf(req).id));
  });

  router.patch('/notificaciones/:id/leida', authenticate, async (req, res) => {
    await service.marcarLeida(idParam(req), authOf(req).id);
    res.status(204).end();
  });

  /**
   * Flujo SSE del usuario autenticado. Eventos: `notificacion` y
   * `solicitud:actualizada`. El cliente lo consume con `fetch` en streaming
   * para poder enviar `Authorization: Bearer` (EventSource no admite cabeceras
   * y obligaría a exponer el token en la URL).
   */
  router.get('/eventos', authenticate, (req, res) => {
    hub.suscribir(authOf(req).id, res, req.token!.expiraEn);
  });

  return router;
}
