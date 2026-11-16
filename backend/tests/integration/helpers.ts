import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { createApp } from '../../src/app';
import { createContainer, type Container } from '../../src/container';
import { loadConfig } from '../../src/shared/config/env';
import type { Database } from '../../src/shared/db/database';
import { runMigrations } from '../../src/shared/db/migrator';
import { digitoVerificadorCedula } from '../../src/shared/domain/identificacion';

/**
 * Entorno de pruebas de integración: API real + PostgreSQL real.
 * Cada archivo de pruebas parte de una base `*_test` recién migrada con un
 * conjunto mínimo de datos. NUNCA toca la base de desarrollo: se exige que el
 * nombre termine en `_test` antes de vaciarla.
 */
const envFile = path.resolve(__dirname, '..', '..', '..', '.env');
if (!process.env.TEST_DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);

export const PASSWORD = 'Prueba2026x';
export const cedula = (base9: string) => base9 + digitoVerificadorCedula(base9);

export interface Entorno {
  app: Express;
  db: Database;
  container: Container;
  tokens: Record<'admin' | 'coordinador' | 'tecnico' | 'tecnico2' | 'cliente' | 'cliente2', string>;
  ids: {
    clienteA: number; clienteB: number; sedeA: number; sedeB: number;
    catRedes: number; catSoftware: number; espRedes: number; espSoftware: number;
    tecRedes: number; tecSoftware: number; tecNoDisponible: number;
    prioridad: Record<'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA', number>;
  };
  cerrar(): Promise<void>;
}

async function prepararBase(url: string): Promise<void> {
  const nombre = new URL(url).pathname.slice(1);
  if (!nombre.endsWith('_test')) throw new Error(`La base de pruebas debe terminar en _test (recibido: ${nombre})`);

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const mantenimiento = new Client({ connectionString: admin.toString() });
  await mantenimiento.connect();
  const existe = await mantenimiento.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
  if (!existe.rowCount) await mantenimiento.query(`CREATE DATABASE "${nombre}"`);
  await mantenimiento.end();

  const base = new Client({ connectionString: url });
  await base.connect();
  await base.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await base.end();
  await runMigrations(url, path.resolve(__dirname, '..', '..', 'migrations'));
}

export async function iniciar(extra: Record<string, string> = {}): Promise<Entorno> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Defina TEST_DATABASE_URL (ver .env.example) para ejecutar las pruebas de integración');
  await prepararBase(url);

  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    JWT_SECRET: 'secreto-solo-para-pruebas-automatizadas-0123456789',
    LOGIN_RATE_MAX: '1000',
    UPLOADS_DIR: mkdtempSync(path.join(tmpdir(), 'servigest-adjuntos-')),
    ...extra,
  });
  const container = createContainer(config);
  const { db } = container;
  const hash = await container.hasher.hash(PASSWORD);

  const id = async (sql: string, params: unknown[] = []) => (await db.one<{ id: number }>(sql, params))!.id;
  const usuario = (email: string, nombre: string, rol: string) =>
    id(`INSERT INTO usuarios (email, password_hash, nombre, rol_id) VALUES ($1, $2, $3, (SELECT id FROM roles WHERE codigo = $4)) RETURNING id`, [email, hash, nombre, rol]);

  await usuario('admin@test.ec', 'Admin Prueba', 'ADMIN');
  await usuario('coordinador@test.ec', 'Coordinador Prueba', 'COORDINADOR');
  const espRedes = await id(`INSERT INTO especialidades (nombre) VALUES ('Redes') RETURNING id`);
  const espSoftware = await id(`INSERT INTO especialidades (nombre) VALUES ('Software') RETURNING id`);
  const catRedes = await id(`INSERT INTO categorias_servicio (nombre, especialidad_id) VALUES ('Falla de red', $1) RETURNING id`, [espRedes]);
  const catSoftware = await id(`INSERT INTO categorias_servicio (nombre, especialidad_id) VALUES ('Error de software', $1) RETURNING id`, [espSoftware]);

  const cliente = async (email: string, razon: string, base: string) => {
    const u = await usuario(email, razon, 'CLIENTE');
    const c = await id(`INSERT INTO clientes (usuario_id, identificacion, razon_social, email) VALUES ($1, $2, $3, $4) RETURNING id`, [u, cedula(base), razon, `info-${email}`]);
    const s = await id(`INSERT INTO sedes (cliente_id, nombre, direccion) VALUES ($1, 'Matriz', 'Av. Principal 123') RETURNING id`, [c]);
    return { c, s };
  };
  const a = await cliente('cliente@test.ec', 'Cliente A', '170000001');
  const b = await cliente('cliente2@test.ec', 'Cliente B', '170000002');

  const tecnico = async (email: string, nombre: string, base: string, esp: number, maximo: number, disponible = true) => {
    const u = await usuario(email, nombre, 'TECNICO');
    const t = await id(`INSERT INTO tecnicos (usuario_id, cedula, max_solicitudes_activas, disponible) VALUES ($1, $2, $3, $4) RETURNING id`, [u, cedula(base), maximo, disponible]);
    await db.execute(`INSERT INTO tecnico_especialidades (tecnico_id, especialidad_id) VALUES ($1, $2)`, [t, esp]);
    return t;
  };
  // El técnico de redes admite UNA sola solicitud activa: permite probar el límite de carga.
  const tecRedes = await tecnico('tecnico@test.ec', 'Técnico Redes', '170000003', espRedes, 1);
  const tecSoftware = await tecnico('tecnico2@test.ec', 'Técnico Software', '170000004', espSoftware, 5);
  const tecNoDisponible = await tecnico('tecnico3@test.ec', 'Técnico En Pausa', '170000005', espRedes, 5, false);

  const prioridades = await db.query<{ id: number; codigo: string }>('SELECT id, codigo FROM prioridades');
  const prioridad = Object.fromEntries(prioridades.map((p) => [p.codigo, p.id])) as Entorno['ids']['prioridad'];

  const app = createApp(container);
  const login = async (email: string) => {
    const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    if (res.status !== 200) throw new Error(`No se pudo iniciar sesión como ${email}: ${res.status}`);
    return res.body.token as string;
  };

  return {
    app,
    db,
    container,
    tokens: {
      admin: await login('admin@test.ec'),
      coordinador: await login('coordinador@test.ec'),
      tecnico: await login('tecnico@test.ec'),
      tecnico2: await login('tecnico2@test.ec'),
      cliente: await login('cliente@test.ec'),
      cliente2: await login('cliente2@test.ec'),
    },
    ids: { clienteA: a.c, clienteB: b.c, sedeA: a.s, sedeB: b.s, catRedes, catSoftware, espRedes, espSoftware, tecRedes, tecSoftware, tecNoDisponible, prioridad },
    cerrar: () => container.close(),
  };
}

/** Cliente HTTP con el token ya puesto. */
export function como(e: Entorno, rol: keyof Entorno['tokens']) {
  const auth = { Authorization: `Bearer ${e.tokens[rol]}` };
  return {
    get: (ruta: string) => request(e.app).get(`/api${ruta}`).set(auth),
    post: (ruta: string, cuerpo?: object) => request(e.app).post(`/api${ruta}`).set(auth).send(cuerpo),
    put: (ruta: string, cuerpo?: object) => request(e.app).put(`/api${ruta}`).set(auth).send(cuerpo),
    patch: (ruta: string, cuerpo?: object) => request(e.app).patch(`/api${ruta}`).set(auth).send(cuerpo),
    delete: (ruta: string) => request(e.app).delete(`/api${ruta}`).set(auth),
  };
}

let serie = 0;
/** Cuerpo válido de una solicitud nueva; cada llamada usa un equipo distinto para no chocar con la regla de duplicados. */
export function solicitudValida(e: Entorno, cambios: Record<string, unknown> = {}) {
  serie += 1;
  return {
    sede_id: e.ids.sedeA,
    categoria_id: e.ids.catRedes,
    prioridad_id: e.ids.prioridad.ALTA,
    titulo: 'Sin conexión en ventas',
    descripcion: 'El área de ventas no tiene conexión a la red desde esta mañana.',
    equipo_afectado: `Switch de prueba ${serie}`,
    ...cambios,
  };
}
