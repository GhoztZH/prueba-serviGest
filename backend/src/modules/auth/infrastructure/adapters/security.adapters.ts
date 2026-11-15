import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { PasswordHasher } from '../../../../shared/application/ports';
import { UnauthorizedError } from '../../../../shared/domain/errors';
import type { TokenEmitido, TokenService, TokenVerificado } from '../../domain/interfaces/auth.ports';

/**
 * Argon2id con los parámetros por defecto de la librería (m=64 MiB, t=3, p=4),
 * por encima del mínimo recomendado por OWASP. El hash codificado mide 97
 * caracteres y cabe en `usuarios.password_hash VARCHAR(100)`.
 */
export class Argon2Hasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false; // hash con formato desconocido: se trata como no coincidente
    }
  }
}

/**
 * JWT firmado con HS256. Cada token lleva un `jti` único que permite
 * revocarlo al cerrar sesión (tabla `tokens_revocados`).
 */
export class JwtTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly minutosVigencia: number,
  ) {}

  emitir(usuarioId: number): TokenEmitido {
    const jti = randomUUID();
    const expiraEn = new Date(Date.now() + this.minutosVigencia * 60_000);
    const token = jwt.sign({}, this.secret, {
      algorithm: 'HS256',
      subject: String(usuarioId),
      jwtid: jti,
      expiresIn: this.minutosVigencia * 60,
    });
    return { token, jti, expiraEn };
  }

  verificar(token: string): TokenVerificado {
    try {
      // Se fija el algoritmo para impedir ataques de confusión (alg=none, RS/HS).
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || !payload.sub || !payload.jti || !payload.exp) throw new Error('claims');
      const usuarioId = Number(payload.sub);
      if (!Number.isInteger(usuarioId)) throw new Error('sub');
      return { usuarioId, jti: payload.jti, expiraEn: new Date(payload.exp * 1000) };
    } catch {
      throw new UnauthorizedError('El token no es válido o ha expirado');
    }
  }
}
