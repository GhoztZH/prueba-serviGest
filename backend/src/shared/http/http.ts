import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, type ZodType } from 'zod';
import type { AuthUser, Rol } from '../domain/auth-user';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../domain/errors';
import { motivoPasswordInvalida } from '../domain/password-policy';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthUser;
    /** Identificador (jti) y expiración del token presentado; los usa el cierre de sesión. */
    token?: { jti: string; expiraEn: Date };
  }
}

/** Valida una entrada contra un esquema Zod y traduce los fallos al formato del contrato. */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new ValidationError(
    result.error.issues.map((issue) => ({
      campo: issue.path.length ? issue.path.join('.') : 'cuerpo',
      mensaje: issue.message,
    })),
  );
}

const idSchema = z.coerce.number({ error: 'Debe ser un número entero' }).int('Debe ser un número entero').min(1, 'Debe ser mayor que cero');

export function idParam(req: Request, nombre = 'id'): number {
  const result = idSchema.safeParse(req.params[nombre]);
  if (!result.success) throw ValidationError.campo(nombre, 'Identificador inválido');
  return result.data;
}

export function authOf(req: Request): AuthUser {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth;
}

/** Autorización por rol. Siempre va después de `authenticate`. */
export function requireRoles(...roles: Rol[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = authOf(req);
    if (!roles.includes(user.rol)) throw new ForbiddenError();
    next();
  };
}

export function clientIp(req: Request): string | null {
  return req.ip ?? null;
}

// ---- Paginación -----------------------------------------------------------

export const paginacionSchema = z.object({
  page: z.coerce.number({ error: 'Debe ser un número' }).int().min(1, 'Mínimo 1').default(1),
  limit: z.coerce.number({ error: 'Debe ser un número' }).int().min(1, 'Mínimo 1').max(100, 'Máximo 100').default(10),
});

export { offsetDe, pagina, type Meta, type Pagina, type Paginacion } from "../application/pagination";

// ---- Esquemas reutilizables ----------------------------------------------

export const booleanoQuery = z.enum(['true', 'false'], { error: 'Debe ser true o false' }).transform((v) => v === 'true');

export const textoRequerido = (campo: string, min: number, max: number) =>
  z
    .string({ error: `${campo} es obligatorio` })
    .trim()
    .min(min, min === 1 ? `${campo} es obligatorio` : `Mínimo ${min} caracteres`)
    .max(max, `Máximo ${max} caracteres`);

export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const emailSchema = z
  .string({ error: 'El correo es obligatorio' })
  .trim()
  .toLowerCase()
  .max(120, 'Máximo 120 caracteres')
  .email('Correo electrónico inválido');

export const enteroPositivo = (campo: string) =>
  z.coerce.number({ error: `${campo} debe ser un número` }).int(`${campo} debe ser un entero`).min(1, `${campo} es obligatorio`);

export const passwordSchema = z
  .string({ error: 'La contraseña es obligatoria' })
  .superRefine((valor, ctx) => {
    const motivo = motivoPasswordInvalida(valor);
    if (motivo) ctx.addIssue({ code: 'custom', message: motivo });
  });
