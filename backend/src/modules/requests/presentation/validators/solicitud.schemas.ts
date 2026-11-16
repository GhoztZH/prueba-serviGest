import { z } from 'zod';
import { ESTADOS, type Estado } from '../../../../shared/domain/estados';
import { enteroPositivo, paginacionSchema, textoRequerido } from '../../../../shared/http/http';
import { MIN_MOTIVO_REAPERTURA } from '../../domain/rules/transiciones';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use el formato AAAA-MM-DD');
const idOpcional = z.coerce.number({ error: 'Debe ser un número' }).int().min(1).optional();

/** Lista separada por comas (p. ej. `REGISTRADA,APROBADA`) validada contra un catálogo cerrado. */
const listaDe = <T extends string>(permitidos: readonly T[], mensaje: string) =>
  z
    .string()
    .transform((v) => v.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))
    .refine((valores) => valores.every((v) => (permitidos as readonly string[]).includes(v)), { message: mensaje })
    .transform((valores) => valores as T[]);

export const filtroSolicitudesSchema = paginacionSchema
  .extend({
    estado: listaDe<Estado>(ESTADOS, 'Estado inválido').optional(),
    prioridad: listaDe(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const, 'Prioridad inválida').optional(),
    categoria_id: idOpcional,
    sede_id: idOpcional,
    cliente_id: idOpcional,
    tecnico_id: idOpcional,
    desde: fecha.optional(),
    hasta: fecha.optional(),
    q: z.string().trim().max(100).optional(),
    vencimiento: z.enum(['vencida', 'por_vencer'], { error: 'Use vencida o por_vencer' }).optional(),
    orden: z.enum(['recientes', 'antiguas', 'vencimiento', 'prioridad'], { error: 'Orden inválido' }).optional(),
  })
  .refine((f) => !f.desde || !f.hasta || f.desde <= f.hasta, { path: ['hasta'], message: 'Debe ser posterior a la fecha inicial' });

/** Sirve para JSON y para `multipart/form-data` (donde los números llegan como texto). */
export const solicitudNuevaSchema = z.object({
  cliente_id: idOpcional,
  sede_id: enteroPositivo('La sede'),
  categoria_id: enteroPositivo('La categoría'),
  prioridad_id: enteroPositivo('La prioridad'),
  titulo: textoRequerido('El título', 5, 150),
  descripcion: textoRequerido('La descripción', 10, 5000),
  equipo_afectado: textoRequerido('El equipo o recurso afectado', 2, 150),
});

export const cambioEstadoSchema = z.object({
  estado: z.enum(ESTADOS, { error: 'Estado inválido' }),
  comentario: z.string().trim().max(2000, 'Máximo 2000 caracteres').nullish(),
  resolucion: z.string().trim().max(5000, 'Máximo 5000 caracteres').nullish(),
  prioridad_id: idOpcional,
  version: z.coerce.number().int().min(1).optional(),
});

export const reaperturaSchema = z.object({
  motivo: textoRequerido('El motivo', MIN_MOTIVO_REAPERTURA, 2000),
});

export const comentarioSchema = z.object({
  comentario: textoRequerido('El comentario', 2, 2000),
});
