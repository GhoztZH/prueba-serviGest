import type { RequestHandler, Router } from 'express';
import { systemClock, type AuditLogger, type PasswordHasher } from '../../shared/application/ports';
import type { AppConfig } from '../../shared/config/env';
import type { Database } from '../../shared/db/database';
import {
  ChangePasswordUseCase,
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
  UpdateProfileUseCase,
} from './application/use-cases/password.use-cases';
import { LoginUseCase, LogoutUseCase, ResolveSessionUseCase } from './application/use-cases/session.use-cases';
import type { CredencialesUsuario } from './domain/interfaces/auth.ports';
import { JwtTokenService } from './infrastructure/adapters/security.adapters';
import { PgSessionRepository } from './infrastructure/persistence/pg-session.repository';
import { authRoutes, createAuthenticate } from './presentation/auth.presentation';

export interface AuthModule {
  authenticate: RequestHandler;
  routes(): Router;
}

export function createAuthModule(
  db: Database,
  config: AppConfig,
  cuentas: CredencialesUsuario,
  hasher: PasswordHasher,
  audit: AuditLogger,
): AuthModule {
  const sesiones = new PgSessionRepository(db);
  const tokens = new JwtTokenService(config.jwtSecret, config.jwtExpiresMin);
  const authenticate = createAuthenticate(new ResolveSessionUseCase(cuentas, sesiones, tokens));

  const useCases = {
    login: new LoginUseCase(cuentas, hasher, tokens, audit),
    logout: new LogoutUseCase(sesiones, audit),
    changePassword: new ChangePasswordUseCase(cuentas, hasher, audit, db),
    forgotPassword: new ForgotPasswordUseCase(cuentas, sesiones, systemClock, config.horasExpiracionReset, !config.isProduction),
    resetPassword: new ResetPasswordUseCase(cuentas, sesiones, hasher, audit, db),
    updateProfile: new UpdateProfileUseCase(cuentas, audit, db),
  };

  return { authenticate, routes: () => authRoutes(useCases, authenticate, config.loginRateMax) };
}

export { Argon2Hasher } from './infrastructure/adapters/security.adapters';
