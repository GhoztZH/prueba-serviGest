import type { PasswordHasher } from '../shared/application/ports';
import type { AppConfig } from '../shared/config/env';
import type { Database } from '../shared/db/database';
import { motivoPasswordInvalida } from '../shared/domain/password-policy';

/**
 * Crea el primer administrador a partir de ADMIN_EMAIL / ADMIN_PASSWORD, solo
 * si todavía no existe ningún ADMIN. La contraseña se toma del entorno y se
 * guarda hasheada: en el repositorio no hay credenciales ni hashes.
 */
export async function asegurarAdministrador(db: Database, hasher: PasswordHasher, config: AppConfig): Promise<void> {
  if (!config.adminEmail || !config.adminPassword) return;
  const existe = await db.one(`SELECT 1 FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE r.codigo = 'ADMIN' LIMIT 1`);
  if (existe) return;

  const motivo = motivoPasswordInvalida(config.adminPassword);
  if (motivo) throw new Error(`ADMIN_PASSWORD no cumple la política: ${motivo}`);

  await db.execute(
    `INSERT INTO usuarios (email, password_hash, nombre, rol_id)
     VALUES ($1, $2, 'Administrador', (SELECT id FROM roles WHERE codigo = 'ADMIN'))
     ON CONFLICT (email) DO NOTHING`,
    [config.adminEmail.toLowerCase(), await hasher.hash(config.adminPassword)],
  );
  console.log(`Administrador inicial creado: ${config.adminEmail}`);
}
