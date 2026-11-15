import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { authOf, enteroPositivo, idParam, parse, requireRoles } from '../../../shared/http/http';
import type { AsignarTecnicoUseCase } from '../application/use-cases/asignar-tecnico';

const asignacionSchema = z.object({
  tecnico_id: enteroPositivo('El técnico'),
  motivo: z.string().trim().max(500, 'Máximo 500 caracteres').nullish(),
});

export function asignacionRoutes(asignar: AsignarTecnicoUseCase, authenticate: RequestHandler): Router {
  const router = Router();
  const gestion = requireRoles('ADMIN', 'COORDINADOR');

  router.post('/solicitudes/:id/asignaciones', authenticate, gestion, async (req, res) => {
    res.status(201).json(await asignar.execute(authOf(req), idParam(req), parse(asignacionSchema, req.body)));
  });

  router.get('/solicitudes/:id/tecnicos-sugeridos', authenticate, gestion, async (req, res) => {
    res.json(await asignar.sugerir(authOf(req), idParam(req)));
  });

  return router;
}
