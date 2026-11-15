import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { UnauthorizedError } from '../../../shared/domain/errors';
import { authOf, clientIp, emailSchema, parse, passwordSchema, textoRequerido } from '../../../shared/http/http';
import type {
  ChangePasswordUseCase,
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
  UpdateProfileUseCase,
} from '../application/use-cases/password.use-cases';
import type { LoginUseCase, LogoutUseCase, ResolveSessionUseCase } from '../application/use-cases/session.use-cases';

// ---- Validadores ------------------------------------------------------------

const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'La contraseña es obligatoria' }).min(1, 'La contraseña es obligatoria').max(200),
});
const cambiarPasswordSchema = z.object({
  actual: z.string({ error: 'La contraseña actual es obligatoria' }).min(1, 'La contraseña actual es obligatoria'),
  nueva: passwordSchema,
});
const olvideSchema = z.object({ email: emailSchema });
const restablecerSchema = z.object({
  token: z.string({ error: 'El token es obligatorio' }).regex(/^[0-9a-f]{64}$/, 'Token inválido'),
  password: passwordSchema,
});
const perfilSchema = z.object({ nombre: textoRequerido('El nombre', 3, 120) });

// ---- Middleware de autenticación -------------------------------------------

/** Exige `Authorization: Bearer <token>` y deja la identidad en `req.auth`. */
export function createAuthenticate(resolveSession: ResolveSessionUseCase): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedError();
    const sesion = await resolveSession.execute(token);
    req.auth = sesion.user;
    req.token = { jti: sesion.token.jti, expiraEn: sesion.token.expiraEn };
    next();
  };
}

// ---- Rutas --------------------------------------------------------------------

export interface AuthUseCases {
  login: LoginUseCase;
  logout: LogoutUseCase;
  changePassword: ChangePasswordUseCase;
  forgotPassword: ForgotPasswordUseCase;
  resetPassword: ResetPasswordUseCase;
  updateProfile: UpdateProfileUseCase;
}

export function authRoutes(uc: AuthUseCases, authenticate: RequestHandler, loginRateMax: number): Router {
  const router = Router();

  // Freno a la fuerza bruta: por IP, en las rutas públicas de credenciales.
  const limitador = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: loginRateMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'DEMASIADOS_INTENTOS', message: 'Demasiados intentos. Espere unos minutos e intente de nuevo' },
      });
    },
  });

  router.post('/auth/login', limitador, async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    res.json(await uc.login.execute(email, password, clientIp(req)));
  });

  router.post('/auth/olvide-password', limitador, async (req, res) => {
    const { email } = parse(olvideSchema, req.body);
    res.status(202).json(await uc.forgotPassword.execute(email));
  });

  router.post('/auth/restablecer-password', limitador, async (req, res) => {
    const { token, password } = parse(restablecerSchema, req.body);
    await uc.resetPassword.execute(token, password, clientIp(req));
    res.status(204).end();
  });

  router.post('/auth/logout', authenticate, async (req, res) => {
    await uc.logout.execute(authOf(req), req.token!, clientIp(req));
    res.status(204).end();
  });

  router.get('/auth/me', authenticate, (req, res) => {
    res.json(authOf(req));
  });

  router.patch('/auth/me', authenticate, async (req, res) => {
    const { nombre } = parse(perfilSchema, req.body);
    res.json(await uc.updateProfile.execute(authOf(req), nombre, clientIp(req)));
  });

  router.patch('/auth/me/password', authenticate, async (req, res) => {
    const { actual, nueva } = parse(cambiarPasswordSchema, req.body);
    await uc.changePassword.execute(authOf(req), actual, nueva, clientIp(req));
    res.status(204).end();
  });

  return router;
}
