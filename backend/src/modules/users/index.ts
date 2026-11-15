import type { RequestHandler, Router } from 'express';
import type { AuditLogger, PasswordHasher } from '../../shared/application/ports';
import type { Database } from '../../shared/db/database';
import { UserService } from './application/services/user.service';
import type { UserRepository } from './domain/interfaces/user.repository';
import { PgUserRepository } from './infrastructure/persistence/pg-user.repository';
import { userRoutes } from './presentation/routes/user.routes';

export interface UsersModule {
  repo: UserRepository;
  service: UserService;
  routes(authenticate: RequestHandler): Router;
}

export function createUsersModule(db: Database, hasher: PasswordHasher, audit: AuditLogger): UsersModule {
  const repo = new PgUserRepository(db);
  const service = new UserService(repo, hasher, audit, db);
  return { repo, service, routes: (authenticate) => userRoutes(service, authenticate) };
}

export type { Usuario, UsuarioConCredenciales } from './domain/entities/usuario';
export type { UserRepository } from './domain/interfaces/user.repository';
