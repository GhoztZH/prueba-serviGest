import path from 'node:path';
import { createApp } from './app';
import { createContainer } from './container';
import { asegurarAdministrador } from './seeds/bootstrap-admin';
import { sembrarDemo } from './seeds/demo-seed';
import { loadConfig } from './shared/config/env';
import { runMigrations } from './shared/db/migrator';

export const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

async function main(): Promise<void> {
  const config = loadConfig();

  // 1) Esquema: solo se aplican las migraciones pendientes (nunca se recrea la base).
  const migraciones = await runMigrations(config.databaseUrl, MIGRATIONS_DIR);
  if (migraciones.applied.length) console.log(`Migraciones aplicadas: ${migraciones.applied.join(', ')}`);

  const container = createContainer(config);

  // 2) Datos iniciales: administrador de arranque y, solo si se pide, datos de demostración.
  await asegurarAdministrador(container.db, container.hasher, config);
  if (config.seedDemo) {
    const sembrado = await sembrarDemo(container.db, container.hasher);
    console.log(sembrado ? 'Datos de demostración cargados' : 'Datos de demostración ya presentes: no se modifican');
  }

  const server = createApp(container).listen(config.port, () => {
    console.log(`ServiGest API escuchando en el puerto ${config.port} (${config.nodeEnv})`);
  });

  const apagar = (senal: string) => {
    console.log(`${senal} recibido: cerrando…`);
    server.close(() => {
      void container.close().finally(() => process.exit(0));
    });
    // Las conexiones SSE son de larga duración: no deben impedir el apagado.
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => apagar('SIGTERM'));
  process.on('SIGINT', () => apagar('SIGINT'));
}

main().catch((error) => {
  console.error('No se pudo iniciar la aplicación:', error instanceof Error ? error.message : error);
  process.exit(1);
});
