import type { Database } from '../../../../shared/db/database';
import type { SessionRepository } from '../../domain/interfaces/auth.ports';

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async revocar(jti: string, usuarioId: number, expiraEn: Date): Promise<void> {
    await this.db.execute(
      `INSERT INTO tokens_revocados (jti, usuario_id, expira_en) VALUES ($1, $2, $3)
       ON CONFLICT (jti) DO NOTHING`,
      [jti, usuarioId, expiraEn],
    );
  }

  async estaRevocado(jti: string): Promise<boolean> {
    return (await this.db.one(`SELECT 1 FROM tokens_revocados WHERE jti = $1`, [jti])) !== undefined;
  }

  /** Un token ya expirado no necesita seguir en la lista de revocados. */
  async purgarRevocadosExpirados(): Promise<void> {
    await this.db.execute(`DELETE FROM tokens_revocados WHERE expira_en < NOW()`);
  }

  async crearRestablecimiento(usuarioId: number, tokenHash: string, expiraEn: Date): Promise<void> {
    // Solo queda vigente la solicitud más reciente del usuario.
    await this.db.execute(
      `UPDATE restablecimientos_password SET usado_en = NOW() WHERE usuario_id = $1 AND usado_en IS NULL`,
      [usuarioId],
    );
    await this.db.execute(
      `INSERT INTO restablecimientos_password (usuario_id, token_hash, expira_en) VALUES ($1, $2, $3)`,
      [usuarioId, tokenHash, expiraEn],
    );
  }

  async consumirRestablecimiento(tokenHash: string): Promise<number | undefined> {
    // UPDATE condicional y atómico: dos peticiones simultáneas no pueden usar el mismo token.
    const fila = await this.db.one<{ usuario_id: number }>(
      `UPDATE restablecimientos_password
          SET usado_en = NOW()
        WHERE token_hash = $1 AND usado_en IS NULL AND expira_en > NOW()
        RETURNING usuario_id`,
      [tokenHash],
    );
    return fila?.usuario_id;
  }
}
