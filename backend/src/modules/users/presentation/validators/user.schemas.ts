import { z } from 'zod';
import { ROLES } from '../../../../shared/domain/auth-user';
import { booleanoQuery, emailSchema, paginacionSchema, passwordSchema, textoRequerido } from '../../../../shared/http/http';
import { ROLES_INTERNOS } from '../../domain/entities/usuario';

export const filtroUsuariosSchema = paginacionSchema.extend({
  q: z.string().trim().max(100).optional(),
  rol: z.enum(ROLES, { error: 'Rol inválido' }).optional(),
  activo: booleanoQuery.optional(),
});

export const usuarioNuevoSchema = z.object({
  nombre: textoRequerido('El nombre', 3, 120),
  email: emailSchema,
  password: passwordSchema,
  rol: z.enum(ROLES_INTERNOS, { error: 'El rol debe ser ADMIN o COORDINADOR' }),
});

export const usuarioActualizarSchema = z
  .object({
    nombre: textoRequerido('El nombre', 3, 120).optional(),
    email: emailSchema.optional(),
    activo: z.boolean({ error: 'Debe ser verdadero o falso' }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Indique al menos un campo a actualizar' });

export const resetPasswordSchema = z.object({ password: passwordSchema });
