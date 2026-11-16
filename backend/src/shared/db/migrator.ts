import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Migraciones reproducibles e idempotentes.
 *
 * - Cada archivo `NNN_nombre.sql` se aplica UNA sola vez, dentro de una
 *   transacción, y queda registrado en `schema_migrations` con su checksum.
 * - Un advisory lock evita que dos instancias migren a la vez.
 * - Si un archivo ya aplicado cambia de contenido se aborta: las migraciones
 *   son inmutables; un cambio de esquema va en un archivo nuevo.
 *
 * Así el script original de `docs/` (copiado como 001) nunca se vuelve a
 * ejecutar contra una base con datos.
 */
export async function runMigrations(connectionString: string, dir: string): Promise<MigrationResult> {
  const client = new Client({ connectionString });
  await client.connect();
  const result: MigrationResult = { applied: [], skipped: [] };
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nombre      VARCHAR(255) PRIMARY KEY,
        checksum    CHAR(64)     NOT NULL,
        aplicada_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )`);

    const files = (await readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
    const { rows } = await client.query<{ nombre: string; checksum: string }>(
      'SELECT nombre, checksum FROM schema_migrations',
    );
    const done = new Map(rows.map((r) => [r.nombre, r.checksum]));

    for (const file of files) {
      const sql = await readFile(path.join(dir, file), 'utf8');
      // Se normalizan los finales de línea para que el checksum no dependa del SO.
      const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
      const previous = done.get(file);
      if (previous) {
        if (previous.trim() !== checksum) {
          throw new Error(`La migración ${file} ya fue aplicada y su contenido cambió. Cree una migración nueva.`);
        }
        result.skipped.push(file);
        continue;
      }
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nombre, checksum) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
        result.applied.push(file);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Fallo al aplicar ${file}: ${(error as Error).message}`, { cause: error });
      }
    }
    return result;
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
    await client.end();
  }
}
