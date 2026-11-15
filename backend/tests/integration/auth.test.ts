import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { como, iniciar, PASSWORD, type Entorno } from './helpers';

let e: Entorno;
beforeAll(async () => { e = await iniciar(); });
afterAll(() => e.cerrar());

const login = (email: string, password: string) => request(e.app).post('/api/auth/login').send({ email, password });

describe('POST /api/auth/login', () => {
  it('inicia sesión y devuelve token y perfil sin datos sensibles', async () => {
    const res = await login('cliente@test.ec', PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toEqual({
      id: expect.any(Number), email: 'cliente@test.ec', nombre: 'Cliente A', rol: 'CLIENTE', clienteId: e.ids.clienteA, tecnicoId: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('acepta el correo sin distinguir mayúsculas', async () => {
    expect((await login('  Cliente@Test.EC ', PASSWORD)).status).toBe(200);
  });

  it('401 con contraseña incorrecta y el mismo mensaje si el correo no existe', async () => {
    const mala = await login('cliente@test.ec', 'Incorrecta123');
    const inexistente = await login('nadie@test.ec', 'Incorrecta123');
    expect(mala.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(mala.body).toEqual(inexistente.body);
    expect(mala.body.error.code).toBe('NO_AUTENTICADO');
  });

  it('422 con entrada inválida, indicando el campo', async () => {
    const res = await login('no-es-correo', '');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDACION');
    expect(res.body.error.details.map((d: { campo: string }) => d.campo)).toEqual(['email', 'password']);
  });

  it('400 con JSON mal formado', async () => {
    const res = await request(e.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SOLICITUD_INVALIDA');
  });

  it('403 si la cuenta está inactiva', async () => {
    await e.db.execute(`UPDATE usuarios SET activo = FALSE WHERE email = 'tecnico3@test.ec'`);
    const res = await login('tecnico3@test.ec', PASSWORD);
    expect(res.status).toBe(403);
    await e.db.execute(`UPDATE usuarios SET activo = TRUE WHERE email = 'tecnico3@test.ec'`);
  });

  it('registra en auditoría los accesos correctos y fallidos', async () => {
    const filas = await e.db.query<{ accion: string }>(`SELECT DISTINCT accion FROM auditoria WHERE entidad = 'sesion' ORDER BY accion`);
    expect(filas.map((f) => f.accion)).toEqual(expect.arrayContaining(['LOGIN', 'LOGIN_FALLIDO']));
  });

  it('las contraseñas se guardan con hash Argon2id, nunca en claro', async () => {
    const fila = await e.db.one<{ password_hash: string }>(`SELECT password_hash FROM usuarios WHERE email = 'cliente@test.ec'`);
    expect(fila!.password_hash).toMatch(/^\$argon2id\$/);
    expect(fila!.password_hash).not.toContain(PASSWORD);
  });
});

describe('Sesión y token', () => {
  it('401 sin token, con token mal formado o firmado con otro secreto', async () => {
    expect((await request(e.app).get('/api/auth/me')).status).toBe(401);
    expect((await request(e.app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401);
    // Token "alg: none" forjado a mano: debe rechazarse.
    const forjado = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"1","jti":"x","exp":9999999999}').toString('base64url')}.`;
    expect((await request(e.app).get('/api/auth/me').set('Authorization', `Bearer ${forjado}`)).status).toBe(401);
  });

  it('GET /auth/me devuelve el perfil del token', async () => {
    const res = await como(e, 'tecnico').get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ rol: 'TECNICO', tecnicoId: e.ids.tecRedes, clienteId: null });
  });

  it('el cierre de sesión revoca el token de inmediato', async () => {
    const { body } = await login('cliente2@test.ec', PASSWORD);
    const auth = { Authorization: `Bearer ${body.token}` };
    expect((await request(e.app).get('/api/auth/me').set(auth)).status).toBe(200);
    expect((await request(e.app).post('/api/auth/logout').set(auth)).status).toBe(204);
    const despues = await request(e.app).get('/api/auth/me').set(auth);
    expect(despues.status).toBe(401);
    expect(despues.body.error.message).toBe('La sesión fue cerrada');
  });

  it('desactivar la cuenta invalida sus sesiones abiertas', async () => {
    const { body } = await login('tecnico3@test.ec', PASSWORD);
    await e.db.execute(`UPDATE usuarios SET activo = FALSE WHERE email = 'tecnico3@test.ec'`);
    expect((await request(e.app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`)).status).toBe(401);
    await e.db.execute(`UPDATE usuarios SET activo = TRUE WHERE email = 'tecnico3@test.ec'`);
  });
});

describe('Contraseñas', () => {
  it('cambia la contraseña propia verificando la actual', async () => {
    const { body } = await login('tecnico3@test.ec', PASSWORD);
    const auth = { Authorization: `Bearer ${body.token}` };
    const cambiar = (actual: string, nueva: string) => request(e.app).patch('/api/auth/me/password').set(auth).send({ actual, nueva });

    expect((await cambiar('NoEsLaActual1', 'NuevaClave2026')).status).toBe(422);
    expect((await cambiar(PASSWORD, 'debil')).status).toBe(422);
    expect((await cambiar(PASSWORD, 'NuevaClave2026')).status).toBe(204);
    expect((await login('tecnico3@test.ec', PASSWORD)).status).toBe(401);
    expect((await login('tecnico3@test.ec', 'NuevaClave2026')).status).toBe(200);
  });

  it('restablecimiento con token de un solo uso; responde igual exista o no el correo', async () => {
    const olvide = (email: string) => request(e.app).post('/api/auth/olvide-password').send({ email });
    const existente = await olvide('cliente@test.ec');
    const inexistente = await olvide('nadie@test.ec');
    expect(existente.status).toBe(202);
    expect(inexistente.status).toBe(202);
    expect(existente.body.message).toBe(inexistente.body.message);
    expect(inexistente.body.tokenDesarrollo).toBeUndefined();

    const token = existente.body.tokenDesarrollo as string;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // En la base solo está el hash del token.
    expect(await e.db.one(`SELECT 1 FROM restablecimientos_password WHERE token_hash = $1`, [token])).toBeUndefined();

    const restablecer = (t: string, password: string) => request(e.app).post('/api/auth/restablecer-password').send({ token: t, password });
    expect((await restablecer('f'.repeat(64), 'OtraClave2026')).status).toBe(422);
    expect((await restablecer(token, 'OtraClave2026')).status).toBe(204);
    expect((await restablecer(token, 'OtraClave2027')).status).toBe(422); // ya usado
    expect((await login('cliente@test.ec', 'OtraClave2026')).status).toBe(200);
  });

  it('el usuario puede actualizar su nombre de perfil', async () => {
    const res = await como(e, 'tecnico2').patch('/auth/me', { nombre: 'Técnico Software Editado' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Técnico Software Editado');
  });
});

describe('Límite de intentos', () => {
  it('429 al superar los intentos de inicio de sesión permitidos', async () => {
    const limitado = await iniciar({ LOGIN_RATE_MAX: '8' }); // 6 inicios de sesión del propio entorno + 2
    try {
      const intento = () => request(limitado.app).post('/api/auth/login').send({ email: 'cliente@test.ec', password: 'Incorrecta123' });
      expect((await intento()).status).toBe(401);
      expect((await intento()).status).toBe(401);
      const bloqueado = await intento();
      expect(bloqueado.status).toBe(429);
      expect(bloqueado.body.error.code).toBe('DEMASIADOS_INTENTOS');
    } finally {
      await limitado.cerrar();
    }
  });
});
