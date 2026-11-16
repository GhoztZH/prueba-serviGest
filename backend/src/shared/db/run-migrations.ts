import path from 'node:path';
import { loadConfig } from '../config/env';
import { runMigrations } from './migrator';

/** `npm run migrate`: aplica las migraciones pendientes y termina. */
async function main(): Promise<void> {
  const config = loadConfig();
  const resultado = await runMigrations(config.databaseUrl, path.resolve(__dirname, '..', '..', '..', 'migrations'));
  console.log(`Aplicadas: ${resultado.applied.join(', ') || 'ninguna'}`);
  console.log(`Ya presentes: ${resultado.skipped.join(', ') || 'ninguna'}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
