import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import { authOf, booleanoQuery, clientIp, enteroPositivo, idParam, parse, requireRoles, textoOpcional, textoRequerido } from '../../../shared/http/http';
import type { CatalogService } from '../application/services/catalog.service';

const filtroSchema = z.object({ activo: booleanoQuery.optional() });

const especialidadNuevaSchema = z.object({
  nombre: textoRequerido('El nombre', 2, 80),
  descripcion: textoOpcional(255),
});
const especialidadActualizarSchema = especialidadNuevaSchema.partial().extend({ activo: z.boolean().optional() });

const categoriaNuevaSchema = z.object({
  nombre: textoRequerido('El nombre', 2, 80),
  descripcion: textoOpcional(255),
  especialidad_id: enteroPositivo('La especialidad'),
});
const categoriaActualizarSchema = categoriaNuevaSchema.partial().extend({ activo: z.boolean().optional() });

const prioridadSchema = z
  .object({
    nombre: textoRequerido('El nombre', 2, 40).optional(),
    horas_plazo: z.coerce
      .number({ error: 'El plazo debe ser un número' })
      .int('El plazo debe ser un número entero de horas')
      .min(1, 'El plazo mínimo es 1 hora')
      .max(8760, 'El plazo máximo es 8760 horas')
      .optional(),
  })
  .refine((v) => v.nombre !== undefined || v.horas_plazo !== undefined, { message: 'Indique el nombre o el plazo' });

const parametroSchema = z.object({
  valor: z.string({ error: 'El valor es obligatorio' }).trim().min(1, 'El valor es obligatorio').max(255, 'Máximo 255 caracteres'),
});

const ctx = (req: Request) => ({ actor: authOf(req), ip: clientIp(req) });

/**
 * Consulta: cualquier usuario autenticado (parámetros: ADMIN y COORDINADOR).
 * Alta, edición y baja: solo ADMIN; el COORDINADOR recibe 403.
 */
export function catalogRoutes(service: CatalogService, authenticate: RequestHandler): Router {
  const router = Router();
  const soloAdmin = requireRoles('ADMIN');

  router.get('/especialidades', authenticate, async (req, res) => {
    res.json(await service.listarEspecialidades(parse(filtroSchema, req.query).activo));
  });
  router.post('/especialidades', authenticate, soloAdmin, async (req, res) => {
    res.status(201).json(await service.crearEspecialidad(parse(especialidadNuevaSchema, req.body), ctx(req)));
  });
  router.put('/especialidades/:id', authenticate, soloAdmin, async (req, res) => {
    res.json(await service.actualizarEspecialidad(idParam(req), parse(especialidadActualizarSchema, req.body), ctx(req)));
  });
  router.delete('/especialidades/:id', authenticate, soloAdmin, async (req, res) => {
    await service.eliminarEspecialidad(idParam(req), ctx(req));
    res.status(204).end();
  });

  router.get('/categorias', authenticate, async (req, res) => {
    res.json(await service.listarCategorias(parse(filtroSchema, req.query).activo));
  });
  router.post('/categorias', authenticate, soloAdmin, async (req, res) => {
    res.status(201).json(await service.crearCategoria(parse(categoriaNuevaSchema, req.body), ctx(req)));
  });
  router.put('/categorias/:id', authenticate, soloAdmin, async (req, res) => {
    res.json(await service.actualizarCategoria(idParam(req), parse(categoriaActualizarSchema, req.body), ctx(req)));
  });
  router.delete('/categorias/:id', authenticate, soloAdmin, async (req, res) => {
    await service.eliminarCategoria(idParam(req), ctx(req));
    res.status(204).end();
  });

  router.get('/prioridades', authenticate, async (_req, res) => {
    res.json(await service.listarPrioridades());
  });
  router.put('/prioridades/:id', authenticate, soloAdmin, async (req, res) => {
    res.json(await service.actualizarPrioridad(idParam(req), parse(prioridadSchema, req.body), ctx(req)));
  });

  router.get('/estados', authenticate, async (_req, res) => {
    res.json(await service.listarEstados());
  });

  router.get('/parametros', authenticate, requireRoles('ADMIN', 'COORDINADOR'), async (_req, res) => {
    res.json(await service.listarParametros());
  });
  router.put('/parametros/:clave', authenticate, soloAdmin, async (req, res) => {
    const { valor } = parse(parametroSchema, req.body);
    res.json(await service.actualizarParametro(String(req.params.clave), valor, ctx(req)));
  });

  return router;
}
