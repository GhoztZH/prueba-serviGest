import { Router, type RequestHandler } from 'express';
import { authOf, clientIp, idParam, parse, requireRoles } from '../../../../shared/http/http';
import type { UserService } from '../../application/services/user.service';
import {
  filtroUsuariosSchema,
  resetPasswordSchema,
  usuarioActualizarSchema,
  usuarioNuevoSchema,
} from '../validators/user.schemas';

/** Todo el grupo `/usuarios` es exclusivo del ADMIN (contrato OpenAPI). */
export function userRoutes(service: UserService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use('/usuarios', authenticate, requireRoles('ADMIN'));

  router.get('/usuarios', async (req, res) => {
    res.json(await service.listar(parse(filtroUsuariosSchema, req.query)));
  });

  router.post('/usuarios', async (req, res) => {
    const datos = parse(usuarioNuevoSchema, req.body);
    res.status(201).json(await service.crearInterno(datos, { actor: authOf(req), ip: clientIp(req) }));
  });

  router.get('/usuarios/:id', async (req, res) => {
    res.json(await service.obtener(idParam(req)));
  });

  router.put('/usuarios/:id', async (req, res) => {
    const cambios = parse(usuarioActualizarSchema, req.body);
    res.json(await service.actualizarInterno(idParam(req), cambios, { actor: authOf(req), ip: clientIp(req) }));
  });

  router.post('/usuarios/:id/reset-password', async (req, res) => {
    const { password } = parse(resetPasswordSchema, req.body);
    await service.restablecerPassword(idParam(req), password, { actor: authOf(req), ip: clientIp(req) });
    res.status(204).end();
  });

  return router;
}
