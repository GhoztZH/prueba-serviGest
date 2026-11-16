import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  authOf,
  booleanoQuery,
  clientIp,
  emailSchema,
  idParam,
  paginacionSchema,
  parse,
  passwordSchema,
  requireRoles,
  textoOpcional,
  textoRequerido,
} from '../../../shared/http/http';
import type { ClientService } from '../application/services/client.service';

const filtroSchema = paginacionSchema.extend({
  q: z.string().trim().max(100).optional(),
  activo: booleanoQuery.optional(),
});

const sedeSchema = z.object({
  nombre: textoRequerido('El nombre de la sede', 2, 100),
  direccion: textoRequerido('La dirección de la sede', 5, 255),
});
const sedeActualizarSchema = sedeSchema.partial().extend({ activo: z.boolean().optional() });

const base = {
  identificacion: z
    .string({ error: 'La identificación es obligatoria' })
    .trim()
    .regex(/^(\d{10}|\d{13})$/, 'Debe ser una cédula (10 dígitos) o un RUC (13 dígitos)'),
  razon_social: textoRequerido('La razón social', 3, 150),
  email: emailSchema,
  telefono: textoOpcional(20),
  direccion: textoOpcional(255),
};

const clienteNuevoSchema = z.object({
  ...base,
  sedes: z.array(sedeSchema).max(50, 'Máximo 50 sedes').optional(),
  cuenta: z.object({ email: emailSchema, password: passwordSchema }).optional(),
});

const clienteActualizarSchema = z.object({
  identificacion: base.identificacion.optional(),
  razon_social: base.razon_social.optional(),
  email: base.email.optional(),
  telefono: base.telefono,
  direccion: base.direccion,
  activo: z.boolean().optional(),
  cuenta: z.object({ email: emailSchema, password: passwordSchema.optional() }).optional(),
});

const ctx = (req: Request) => ({ actor: authOf(req), ip: clientIp(req) });

/** Alta, edición y baja de clientes y sedes: solo ADMIN. Consulta: ADMIN y COORDINADOR; el CLIENTE, solo la suya. */
export function clientRoutes(service: ClientService, authenticate: RequestHandler): Router {
  const router = Router();
  const soloAdmin = requireRoles('ADMIN');
  const lectura = requireRoles('ADMIN', 'COORDINADOR', 'CLIENTE');

  router.get('/clientes', authenticate, requireRoles('ADMIN', 'COORDINADOR'), async (req, res) => {
    res.json(await service.listar(parse(filtroSchema, req.query)));
  });
  router.post('/clientes', authenticate, soloAdmin, async (req, res) => {
    res.status(201).json(await service.crear(parse(clienteNuevoSchema, req.body), ctx(req)));
  });
  router.get('/clientes/:id', authenticate, lectura, async (req, res) => {
    res.json(await service.obtener(idParam(req), authOf(req)));
  });
  router.put('/clientes/:id', authenticate, soloAdmin, async (req, res) => {
    res.json(await service.actualizar(idParam(req), parse(clienteActualizarSchema, req.body), ctx(req)));
  });
  router.delete('/clientes/:id', authenticate, soloAdmin, async (req, res) => {
    await service.eliminar(idParam(req), ctx(req));
    res.status(204).end();
  });

  router.get('/clientes/:id/sedes', authenticate, lectura, async (req, res) => {
    res.json(await service.listarSedes(idParam(req), authOf(req)));
  });
  router.post('/clientes/:id/sedes', authenticate, soloAdmin, async (req, res) => {
    res.status(201).json(await service.crearSede(idParam(req), parse(sedeSchema, req.body), ctx(req)));
  });
  router.put('/clientes/:id/sedes/:sedeId', authenticate, soloAdmin, async (req, res) => {
    res.json(await service.actualizarSede(idParam(req), idParam(req, 'sedeId'), parse(sedeActualizarSchema, req.body), ctx(req)));
  });
  router.delete('/clientes/:id/sedes/:sedeId', authenticate, soloAdmin, async (req, res) => {
    await service.eliminarSede(idParam(req), idParam(req, 'sedeId'), ctx(req));
    res.status(204).end();
  });

  return router;
}
