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
import type { TechnicianService } from '../application/services/technician.service';

const filtroSchema = paginacionSchema.extend({
  q: z.string().trim().max(100).optional(),
  especialidad_id: z.coerce.number().int().min(1).optional(),
  disponible: booleanoQuery.optional(),
});

const cedula = z.string({ error: 'La cédula es obligatoria' }).trim().regex(/^\d{10}$/, 'La cédula debe tener 10 dígitos');
const maximo = z.coerce
  .number({ error: 'Debe ser un número' })
  .int('Debe ser un entero')
  .min(1, 'Mínimo 1')
  .max(50, 'Máximo 50');
const especialidades = z
  .array(z.coerce.number().int().min(1), { error: 'Indique las especialidades' })
  .min(1, 'Seleccione al menos una especialidad')
  .max(30);

const tecnicoNuevoSchema = z.object({
  nombre: textoRequerido('El nombre', 3, 120),
  email: emailSchema,
  password: passwordSchema,
  cedula,
  telefono: textoOpcional(20),
  max_solicitudes_activas: maximo.optional(),
  especialidades,
});

const tecnicoActualizarSchema = z.object({
  nombre: textoRequerido('El nombre', 3, 120).optional(),
  email: emailSchema.optional(),
  cedula: cedula.optional(),
  telefono: textoOpcional(20),
  disponible: z.boolean().optional(),
  max_solicitudes_activas: maximo.optional(),
  especialidades: especialidades.optional(),
  activo: z.boolean().optional(),
});

const disponibilidadSchema = z.object({ disponible: z.boolean({ error: 'Indique verdadero o falso' }) });

const ctx = (req: Request) => ({ actor: authOf(req), ip: clientIp(req) });

/** Alta, edición y baja: solo ADMIN. Consulta: ADMIN y COORDINADOR. El técnico cambia solo su disponibilidad. */
export function technicianRoutes(service: TechnicianService, authenticate: RequestHandler): Router {
  const router = Router();
  const soloAdmin = requireRoles('ADMIN');

  router.get('/tecnicos', authenticate, requireRoles('ADMIN', 'COORDINADOR'), async (req, res) => {
    const { especialidad_id, ...filtro } = parse(filtroSchema, req.query);
    res.json(await service.listar({ ...filtro, especialidadId: especialidad_id }));
  });
  router.post('/tecnicos', authenticate, soloAdmin, async (req, res) => {
    res.status(201).json(await service.crear(parse(tecnicoNuevoSchema, req.body), ctx(req)));
  });

  // Debe declararse antes de `/tecnicos/:id` para que "me" no se interprete como un id.
  router.patch('/tecnicos/me/disponibilidad', authenticate, requireRoles('TECNICO'), async (req, res) => {
    const { disponible } = parse(disponibilidadSchema, req.body);
    res.json(await service.cambiarDisponibilidad(disponible, ctx(req)));
  });

  router.get('/tecnicos/:id', authenticate, requireRoles('ADMIN', 'COORDINADOR', 'TECNICO'), async (req, res) => {
    res.json(await service.obtener(idParam(req), authOf(req)));
  });
  router.put('/tecnicos/:id', authenticate, soloAdmin, async (req, res) => {
    res.json(await service.actualizar(idParam(req), parse(tecnicoActualizarSchema, req.body), ctx(req)));
  });
  router.delete('/tecnicos/:id', authenticate, soloAdmin, async (req, res) => {
    await service.eliminar(idParam(req), ctx(req));
    res.status(204).end();
  });

  return router;
}
