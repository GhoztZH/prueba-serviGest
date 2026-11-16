import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { paginacionSchema, parse, requireRoles } from '../../../../shared/http/http';
import type { AuditQueryService } from '../../application/services/audit-query.service';

const filtroSchema = paginacionSchema.extend({
  entidad: z.string().trim().max(50).optional(),
  usuario_id: z.coerce.number().int().min(1).optional(),
});

export function auditRoutes(service: AuditQueryService, authenticate: RequestHandler): Router {
  const router = Router();
  router.get('/auditoria', authenticate, requireRoles('ADMIN'), async (req, res) => {
    const { usuario_id, ...filtro } = parse(filtroSchema, req.query);
    res.json(await service.listar({ ...filtro, usuarioId: usuario_id }));
  });
  return router;
}
