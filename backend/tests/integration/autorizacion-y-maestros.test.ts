import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cedula, como, iniciar, solicitudValida, type Entorno } from './helpers';

let e: Entorno;
let solicitudA: number; // del cliente A, asignada al técnico de redes
let solicitudB: number; // del cliente B, sin asignar

beforeAll(async () => {
  e = await iniciar();
  solicitudA = (await como(e, 'cliente').post('/solicitudes', solicitudValida(e))).body.id;
  solicitudB = (await como(e, 'cliente2').post('/solicitudes', solicitudValida(e, { sede_id: e.ids.sedeB }))).body.id;
  await como(e, 'coordinador').patch(`/solicitudes/${solicitudA}/estado`, { estado: 'APROBADA' });
  await como(e, 'coordinador').post(`/solicitudes/${solicitudA}/asignaciones`, { tecnico_id: e.ids.tecRedes });
});
afterAll(() => e.cerrar());

describe('Regla 3 · un cliente solo consulta sus propios registros', () => {
  it('su listado solo contiene solicitudes de su empresa, aunque pida otra', async () => {
    const res = await como(e, 'cliente').get(`/solicitudes?cliente_id=${e.ids.clienteB}&limit=100`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]); // el alcance del rol se combina con AND: no ve nada ajeno
    const propias = await como(e, 'cliente').get('/solicitudes?limit=100');
    expect(propias.body.data.map((s: { id: number }) => s.id)).toEqual([solicitudA]);
  });

  it('404 al consultar detalle, historial o comentar una solicitud ajena', async () => {
    expect((await como(e, 'cliente').get(`/solicitudes/${solicitudB}`)).status).toBe(404);
    expect((await como(e, 'cliente').get(`/solicitudes/${solicitudB}/historial`)).status).toBe(404);
    expect((await como(e, 'cliente').post(`/solicitudes/${solicitudB}/comentarios`, { comentario: 'Hola' })).status).toBe(404);
    expect((await como(e, 'cliente').patch(`/solicitudes/${solicitudB}/estado`, { estado: 'CANCELADA', comentario: 'No procede' })).status).toBe(404);
  });

  it('solo ve los datos y sedes de su propia empresa', async () => {
    expect((await como(e, 'cliente').get(`/clientes/${e.ids.clienteA}`)).status).toBe(200);
    expect((await como(e, 'cliente').get(`/clientes/${e.ids.clienteB}`)).status).toBe(404);
    expect((await como(e, 'cliente').get(`/clientes/${e.ids.clienteB}/sedes`)).status).toBe(404);
    expect((await como(e, 'cliente').get('/clientes')).status).toBe(403);
  });

  it('los indicadores del cliente se limitan a su empresa y no exponen la carga del equipo', async () => {
    const res = await como(e, 'cliente').get(`/dashboard/indicadores?cliente_id=${e.ids.clienteB}`);
    expect(res.status).toBe(200);
    expect(res.body.resumen.total).toBe(1);
    expect(res.body.filtros.clienteId).toBe(e.ids.clienteA);
    expect(res.body.cargaPorTecnico).toEqual([]);
  });
});

describe('Regla 2 · un técnico solo accede a las solicitudes asignadas a su cargo', () => {
  it('ve la suya y recibe 404 en las demás', async () => {
    expect((await como(e, 'tecnico').get(`/solicitudes/${solicitudA}`)).status).toBe(200);
    expect((await como(e, 'tecnico').get(`/solicitudes/${solicitudB}`)).status).toBe(404);
    expect((await como(e, 'tecnico2').get(`/solicitudes/${solicitudA}`)).status).toBe(404);
    const lista = await como(e, 'tecnico2').get('/solicitudes');
    expect(lista.body.meta.total).toBe(0);
  });

  it('otro técnico no puede modificar una solicitud que no tiene asignada', async () => {
    const res = await como(e, 'tecnico2').patch(`/solicitudes/${solicitudA}/estado`, { estado: 'EN_PROCESO' });
    expect(res.status).toBe(404);
    expect((await como(e, 'coordinador').get(`/solicitudes/${solicitudA}`)).body.estado).toBe('ASIGNADA');
  });

  it('el técnico no registra solicitudes, no asigna y no aprueba', async () => {
    expect((await como(e, 'tecnico').post('/solicitudes', solicitudValida(e))).status).toBe(403);
    expect((await como(e, 'tecnico').post(`/solicitudes/${solicitudA}/asignaciones`, { tecnico_id: e.ids.tecRedes })).status).toBe(403);
    expect((await como(e, 'tecnico').get(`/solicitudes/${solicitudA}/tecnicos-sugeridos`)).status).toBe(403);
  });

  it('las acciones del detalle reflejan lo que cada rol puede hacer', async () => {
    const tecnico = (await como(e, 'tecnico').get(`/solicitudes/${solicitudA}`)).body.acciones;
    expect(tecnico).toEqual({ transiciones: ['EN_PROCESO'], puedeAsignar: false, puedeReabrir: false, puedeComentar: true, puedeAdjuntar: true });
    const coordinador = (await como(e, 'coordinador').get(`/solicitudes/${solicitudA}`)).body.acciones;
    expect(coordinador).toMatchObject({ transiciones: ['EN_PROCESO', 'CANCELADA'], puedeAsignar: true });
    const cliente = (await como(e, 'cliente').get(`/solicitudes/${solicitudA}`)).body.acciones;
    expect(cliente).toMatchObject({ transiciones: [], puedeAsignar: false });
  });

  it('el técnico cambia solo su propia disponibilidad y consulta solo su ficha', async () => {
    const res = await como(e, 'tecnico').patch('/tecnicos/me/disponibilidad', { disponible: false });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: e.ids.tecRedes, disponible: false, carga_actual: 1 });
    await como(e, 'tecnico').patch('/tecnicos/me/disponibilidad', { disponible: true });
    expect((await como(e, 'tecnico').get(`/tecnicos/${e.ids.tecRedes}`)).status).toBe(200);
    expect((await como(e, 'tecnico').get(`/tecnicos/${e.ids.tecSoftware}`)).status).toBe(404);
    expect((await como(e, 'coordinador').patch('/tecnicos/me/disponibilidad', { disponible: false })).status).toBe(403);
  });
});

describe('Reparto ADMIN / COORDINADOR: datos maestros solo los escribe el ADMIN', () => {
  const clienteNuevo = { identificacion: cedula('170000050'), razon_social: 'Cliente Nuevo', email: 'nuevo@empresa.ec' };
  const escrituras: Array<[string, 'post' | 'put' | 'delete', string, object?]> = [
    ['crear cliente', 'post', '/clientes', clienteNuevo],
    ['editar cliente', 'put', '/clientes/1', { razon_social: 'Otro nombre' }],
    ['eliminar cliente', 'delete', '/clientes/1'],
    ['crear sede', 'post', '/clientes/1/sedes', { nombre: 'Sucursal', direccion: 'Calle 1 y 2' }],
    ['crear técnico', 'post', '/tecnicos', {}],
    ['editar técnico', 'put', '/tecnicos/1', { disponible: false }],
    ['crear especialidad', 'post', '/especialidades', { nombre: 'Nueva' }],
    ['crear categoría', 'post', '/categorias', { nombre: 'Nueva', especialidad_id: 1 }],
    ['editar prioridad', 'put', '/prioridades/1', { horas_plazo: 10 }],
    ['editar parámetro', 'put', '/parametros/UMBRAL_POR_VENCER_PCT', { valor: '30' }],
    ['crear usuario', 'post', '/usuarios', {}],
  ];

  it.each(escrituras)('el COORDINADOR recibe 403 al %s', async (_nombre, metodo, ruta, cuerpo) => {
    const cliente = como(e, 'coordinador');
    const res = metodo === 'delete' ? await cliente.delete(ruta) : await cliente[metodo](ruta, cuerpo);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PROHIBIDO');
  });

  it('el COORDINADOR sí consulta técnicos, clientes, catálogos y parámetros', async () => {
    for (const ruta of ['/tecnicos', '/clientes', `/clientes/${e.ids.clienteA}`, '/categorias', '/especialidades', '/prioridades', '/estados', '/parametros']) {
      expect((await como(e, 'coordinador').get(ruta)).status, ruta).toBe(200);
    }
  });

  it('usuarios y auditoría son exclusivos del ADMIN', async () => {
    for (const rol of ['coordinador', 'tecnico', 'cliente'] as const) {
      expect((await como(e, rol).get('/usuarios')).status).toBe(403);
      expect((await como(e, rol).get('/auditoria')).status).toBe(403);
    }
    expect((await como(e, 'admin').get('/usuarios')).status).toBe(200);
  });

  it('técnicos y clientes no ven parámetros ni el listado de técnicos', async () => {
    expect((await como(e, 'cliente').get('/parametros')).status).toBe(403);
    expect((await como(e, 'cliente').get('/tecnicos')).status).toBe(403);
    expect((await como(e, 'tecnico').get('/tecnicos')).status).toBe(403);
  });
});

describe('Clientes y sedes (ADMIN)', () => {
  let nuevo: number;

  it('crea un cliente con sedes y cuenta de acceso en una sola operación', async () => {
    const res = await como(e, 'admin').post('/clientes', {
      identificacion: cedula('170000060') + '001', razon_social: 'Distribuidora Sur', email: 'ventas@distribuidorasur.ec',
      sedes: [{ nombre: 'Matriz', direccion: 'Av. Central 100' }, { nombre: 'Bodega', direccion: 'Km 5 vía a la costa' }],
      cuenta: { email: 'Acceso@DistribuidoraSur.ec', password: 'Acceso2026x' },
    });
    expect(res.status).toBe(201);
    nuevo = res.body.id;
    expect(res.body).toMatchObject({ razon_social: 'Distribuidora Sur', email: 'ventas@distribuidorasur.ec', cuenta_email: 'acceso@distribuidorasur.ec', activo: true });
    expect(res.body.sedes).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('422 con identificación inválida y 409 con identificación o correo de acceso duplicados', async () => {
    const invalida = await como(e, 'admin').post('/clientes', { identificacion: '1700000009', razon_social: 'Empresa X', email: 'x@empresa.ec' });
    expect(invalida.status).toBe(422);
    expect(invalida.body.error.details[0]).toEqual({ campo: 'identificacion', mensaje: 'La cédula o el RUC no es válido' });

    const duplicada = await como(e, 'admin').post('/clientes', { identificacion: cedula('170000001'), razon_social: 'Empresa X', email: 'x@empresa.ec' });
    expect(duplicada.status).toBe(409);
    expect(duplicada.body.error.message).toBe('Ya existe un cliente con esa identificación');

    const antes = (await como(e, 'admin').get('/clientes?limit=100')).body.meta.total;
    const cuentaDuplicada = await como(e, 'admin').post('/clientes', {
      identificacion: cedula('170000070'), razon_social: 'Empresa Y', email: 'y@empresa.ec', cuenta: { email: 'cliente@test.ec', password: 'Acceso2026x' },
    });
    expect(cuentaDuplicada.status).toBe(409);
    // La transacción se revirtió completa: no quedó un cliente sin su cuenta.
    expect((await como(e, 'admin').get('/clientes?limit=100')).body.meta.total).toBe(antes);
  });

  it('desactivar el cliente desactiva también su cuenta de acceso', async () => {
    const res = await como(e, 'admin').put(`/clientes/${nuevo}`, { activo: false });
    expect(res.body.activo).toBe(false);
    const cuenta = await e.db.one<{ activo: boolean }>(`SELECT activo FROM usuarios WHERE email = 'acceso@distribuidorasur.ec'`);
    expect(cuenta!.activo).toBe(false);
    await como(e, 'admin').put(`/clientes/${nuevo}`, { activo: true });
  });

  it('gestiona sedes evitando nombres duplicados', async () => {
    const duplicada = await como(e, 'admin').post(`/clientes/${nuevo}/sedes`, { nombre: 'matriz', direccion: 'Otra dirección 55' });
    expect(duplicada.status).toBe(409);
    const creada = await como(e, 'admin').post(`/clientes/${nuevo}/sedes`, { nombre: 'Sucursal Norte', direccion: 'Av. del Norte 200' });
    expect(creada.status).toBe(201);
    const editada = await como(e, 'admin').put(`/clientes/${nuevo}/sedes/${creada.body.id}`, { activo: false });
    expect(editada.body.activo).toBe(false);
    expect((await como(e, 'admin').delete(`/clientes/${nuevo}/sedes/${creada.body.id}`)).status).toBe(204);
  });

  it('409 al eliminar un cliente o una sede con solicitudes; 204 si no tienen', async () => {
    const conSolicitudes = await como(e, 'admin').delete(`/clientes/${e.ids.clienteA}`);
    expect(conSolicitudes.status).toBe(409);
    expect(conSolicitudes.body.error.message).toContain('solicitud(es) registradas');
    expect((await como(e, 'admin').delete(`/clientes/${e.ids.clienteA}/sedes/${e.ids.sedeA}`)).status).toBe(409);

    expect((await como(e, 'admin').delete(`/clientes/${nuevo}`)).status).toBe(204);
    expect((await como(e, 'admin').get(`/clientes/${nuevo}`)).status).toBe(404);
    expect(await e.db.one(`SELECT 1 FROM usuarios WHERE email = 'acceso@distribuidorasur.ec'`)).toBeUndefined();
  });
});

describe('Técnicos, catálogos, parámetros y usuarios (ADMIN)', () => {
  it('crea un técnico con su cuenta y especialidades; valida cédula y duplicados', async () => {
    const datos = { nombre: 'Rosa Paz', email: 'rosa.paz@test.ec', password: 'Tecnica2026x', cedula: cedula('170000080'), especialidades: [e.ids.espRedes, e.ids.espSoftware] };
    const res = await como(e, 'admin').post('/tecnicos', datos);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'Rosa Paz', max_solicitudes_activas: 5, carga_actual: 0, disponible: true });
    expect(res.body.especialidades.map((x: { nombre: string }) => x.nombre)).toEqual(['Redes', 'Software']);

    expect((await como(e, 'admin').post('/tecnicos', { ...datos, email: 'otra@test.ec' })).status).toBe(409);
    const cedulaMala = await como(e, 'admin').post('/tecnicos', { ...datos, email: 'otra@test.ec', cedula: '1700000809' });
    expect(cedulaMala.status).toBe(422);
    const espInexistente = await como(e, 'admin').post('/tecnicos', { ...datos, email: 'otra@test.ec', cedula: cedula('170000081'), especialidades: [999] });
    expect(espInexistente.body.error.details[0].campo).toBe('especialidades');

    expect((await como(e, 'admin').delete(`/tecnicos/${res.body.id}`)).status).toBe(204);
  });

  it('409 al eliminar o desactivar un técnico con solicitudes a su cargo', async () => {
    expect((await como(e, 'admin').delete(`/tecnicos/${e.ids.tecRedes}`)).status).toBe(409);
    const desactivar = await como(e, 'admin').put(`/tecnicos/${e.ids.tecRedes}`, { activo: false });
    expect(desactivar.status).toBe(409);
    expect(desactivar.body.error.message).toContain('Reasígnelas primero');
  });

  it('especialidades y categorías: duplicidad, vigencia e integridad referencial', async () => {
    expect((await como(e, 'admin').post('/especialidades', { nombre: 'redes' })).status).toBe(409);
    const esp = await como(e, 'admin').post('/especialidades', { nombre: 'Climatización', descripcion: 'Aires acondicionados' });
    expect(esp.status).toBe(201);

    const cat = await como(e, 'admin').post('/categorias', { nombre: 'Aire acondicionado', especialidad_id: esp.body.id });
    expect(cat.status).toBe(201);
    expect(cat.body.especialidad_nombre).toBe('Climatización');

    // No se elimina ni se desactiva una especialidad en uso.
    expect((await como(e, 'admin').delete(`/especialidades/${esp.body.id}`)).status).toBe(409);
    expect((await como(e, 'admin').put(`/especialidades/${esp.body.id}`, { activo: false })).status).toBe(409);
    // No se elimina una categoría con solicitudes.
    expect((await como(e, 'admin').delete(`/categorias/${e.ids.catRedes}`)).status).toBe(409);

    expect((await como(e, 'admin').delete(`/categorias/${cat.body.id}`)).status).toBe(204);
    expect((await como(e, 'admin').put(`/especialidades/${esp.body.id}`, { activo: false })).body.activo).toBe(false);
    // Una especialidad no vigente no admite categorías nuevas.
    expect((await como(e, 'admin').post('/categorias', { nombre: 'Otra', especialidad_id: esp.body.id })).status).toBe(422);
    expect((await como(e, 'admin').delete(`/especialidades/${esp.body.id}`)).status).toBe(204);
  });

  it('el plazo de una prioridad y los parámetros se validan y quedan auditados', async () => {
    expect((await como(e, 'admin').put(`/prioridades/${e.ids.prioridad.BAJA}`, { horas_plazo: 0 })).status).toBe(422);
    expect((await como(e, 'admin').put(`/prioridades/${e.ids.prioridad.BAJA}`, { horas_plazo: 96 })).body.horas_plazo).toBe(96);

    expect((await como(e, 'admin').put('/parametros/UMBRAL_POR_VENCER_PCT', { valor: '150' })).status).toBe(422);
    expect((await como(e, 'admin').put('/parametros/NO_EXISTE', { valor: '1' })).status).toBe(404);
    expect((await como(e, 'admin').put('/parametros/UMBRAL_POR_VENCER_PCT', { valor: '40' })).body.valor).toBe('40');

    const auditoria = await como(e, 'admin').get('/auditoria?entidad=parametros');
    expect(auditoria.body.data[0]).toMatchObject({
      entidad: 'parametros', entidad_id: 'UMBRAL_POR_VENCER_PCT', accion: 'ACTUALIZAR',
      datos_antes: { valor: '25' }, datos_despues: { valor: '40' }, usuario_nombre: 'Admin Prueba',
    });
    await como(e, 'admin').put('/parametros/UMBRAL_POR_VENCER_PCT', { valor: '25' });
  });

  it('la auditoría es inalterable a nivel de base de datos', async () => {
    await expect(e.db.execute(`DELETE FROM auditoria`)).rejects.toThrow(/inalterable/);
  });

  it('usuarios internos: alta, duplicado, edición y protecciones', async () => {
    const res = await como(e, 'admin').post('/usuarios', { nombre: 'Coord Dos', email: 'coord2@test.ec', password: 'Coord2026xx', rol: 'COORDINADOR' });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('password_hash');
    expect((await como(e, 'admin').post('/usuarios', { nombre: 'Coord Dos', email: 'coord2@test.ec', password: 'Coord2026xx', rol: 'COORDINADOR' })).status).toBe(409);
    expect((await como(e, 'admin').post('/usuarios', { nombre: 'Tec', email: 't9@test.ec', password: 'Coord2026xx', rol: 'TECNICO' })).status).toBe(422);

    expect((await como(e, 'admin').put(`/usuarios/${res.body.id}`, { activo: false })).body.activo).toBe(false);
    expect((await como(e, 'admin').post(`/usuarios/${res.body.id}/reset-password`, { password: 'debil' })).status).toBe(422);
    expect((await como(e, 'admin').post(`/usuarios/${res.body.id}/reset-password`, { password: 'Reiniciada2026' })).status).toBe(204);

    const yo = (await como(e, 'admin').get('/auth/me')).body.id;
    const propia = await como(e, 'admin').put(`/usuarios/${yo}`, { activo: false });
    expect(propia.status).toBe(422);
    expect(propia.body.error.message).toBe('No puede desactivar su propia cuenta');
  });
});

describe('Dashboard: indicadores calculados desde los datos persistidos', () => {
  it('los conteos coinciden con una consulta directa a la base', async () => {
    const res = await como(e, 'coordinador').get('/dashboard/indicadores');
    expect(res.status).toBe(200);
    const real = await e.db.query<{ codigo: string; total: number }>(
      `SELECT e.codigo, COUNT(s.id)::int AS total FROM estados e LEFT JOIN solicitudes s ON s.estado_id = e.id GROUP BY e.codigo, e.orden ORDER BY e.orden`,
    );
    expect(res.body.porEstado.map(({ codigo, total }: { codigo: string; total: number }) => ({ codigo, total }))).toEqual(real);
    expect(res.body.resumen.total).toBe(real.reduce((n, r) => n + r.total, 0));
    expect(res.body.porPrioridad.map((p: { codigo: string }) => p.codigo)).toEqual(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']);
    expect(res.body.evolucion).toHaveLength(30);
    expect(res.body.evolucion.at(-1).creadas).toBe(res.body.resumen.total);
  });

  it('cumplimiento, tiempo de resolución y vencimientos reaccionan a los datos', async () => {
    // Se resuelve la solicitud A dentro de plazo y se envejece la B hasta dejarla vencida.
    await como(e, 'tecnico').patch(`/solicitudes/${solicitudA}/estado`, { estado: 'EN_PROCESO' });
    await como(e, 'tecnico').patch(`/solicitudes/${solicitudA}/estado`, { estado: 'RESUELTA', resolucion: 'Se configuró nuevamente el puerto del switch.' });
    await e.db.execute(
      `UPDATE solicitudes SET created_at = created_at - INTERVAL '30 hours', fecha_limite = fecha_limite - INTERVAL '30 hours' WHERE id = $1`,
      [solicitudB],
    );
    const { body } = await como(e, 'coordinador').get('/dashboard/indicadores');
    expect(body.cumplimiento).toEqual({ aTiempo: 1, fueraDePlazo: 1, porcentaje: 50 });
    expect(body.vencimientos).toMatchObject({ vencidas: 1, por_vencer: 0 });
    expect(body.tiempoResolucion.global).toEqual(expect.any(Number));
    const carga = body.cargaPorTecnico.find((t: { tecnico_id: number }) => t.tecnico_id === e.ids.tecRedes);
    expect(carga).toMatchObject({ activas: 0, maximo: 1, resueltas: 1 });
  });

  it('filtra por dimensión y valida el período', async () => {
    const porCliente = await como(e, 'coordinador').get(`/dashboard/indicadores?cliente_id=${e.ids.clienteB}`);
    expect(porCliente.body.resumen.total).toBe(1);
    const sinDatos = await como(e, 'coordinador').get('/dashboard/indicadores?desde=2020-01-01&hasta=2020-01-31');
    expect(sinDatos.body.resumen.total).toBe(0);
    expect(sinDatos.body.cumplimiento.porcentaje).toBeNull();
    expect((await como(e, 'coordinador').get('/dashboard/indicadores?desde=2026-02-01&hasta=2026-01-01')).status).toBe(422);
    expect((await como(e, 'coordinador').get('/dashboard/indicadores?desde=2020-01-01&hasta=2026-01-01')).status).toBe(422);
  });

  it('el técnico solo ve indicadores de sus solicitudes', async () => {
    const { body } = await como(e, 'tecnico').get('/dashboard/indicadores');
    expect(body.resumen.total).toBe(1);
    expect(body.cargaPorTecnico.map((t: { tecnico_id: number }) => t.tecnico_id)).toEqual([e.ids.tecRedes]);
  });
});

describe('Notificaciones persistidas y actualización en vivo', () => {
  it('cada evento deja notificaciones a los interesados, nunca a quien lo originó', async () => {
    const coordinador = await como(e, 'coordinador').get('/notificaciones?limit=50');
    expect(coordinador.status).toBe(200);
    const tipos = coordinador.body.data.map((n: { tipo: string }) => n.tipo);
    expect(tipos).toEqual(expect.arrayContaining(['REGISTRO', 'RESOLUCION']));
    expect(coordinador.body.noLeidas).toBe(coordinador.body.meta.total);
    expect(coordinador.body.data[0]).toMatchObject({ leida: false, solicitud_codigo: expect.stringMatching(/^SOL-/) });

    const tecnico = await como(e, 'tecnico').get('/notificaciones');
    expect(tecnico.body.data.map((n: { tipo: string }) => n.tipo)).toEqual(['ASIGNACION']);
    const cliente = await como(e, 'cliente').get('/notificaciones');
    expect(cliente.body.data.map((n: { titulo: string }) => n.titulo)).toEqual(
      expect.arrayContaining(['Solicitud aprobada', 'Técnico asignado', 'Solicitud en atención', 'Solicitud resuelta']),
    );
    // El administrador no recibe avisos operativos mientras haya un coordinador.
    expect((await como(e, 'admin').get('/notificaciones')).body.meta.total).toBe(0);
  });

  it('marca como leída solo las propias; 404 con las ajenas', async () => {
    const { body } = await como(e, 'tecnico').get('/notificaciones');
    const id = body.data[0].id;
    expect((await como(e, 'cliente').patch(`/notificaciones/${id}/leida`)).status).toBe(404);
    expect((await como(e, 'tecnico').patch(`/notificaciones/${id}/leida`)).status).toBe(204);
    expect((await como(e, 'tecnico').get('/notificaciones?no_leidas=true')).body.meta.total).toBe(0);

    const todas = await como(e, 'cliente').patch('/notificaciones/leer-todas');
    expect(todas.status).toBe(200);
    expect(todas.body.actualizadas).toBeGreaterThan(0);
    expect((await como(e, 'cliente').get('/notificaciones')).body.noLeidas).toBe(0);
  });

  it('SSE: el navegador conectado recibe la notificación y la actualización sin recargar', async () => {
    const servidor = e.app.listen(0);
    const puerto = (servidor.address() as AddressInfo).port;
    try {
      expect((await fetch(`http://127.0.0.1:${puerto}/api/eventos`)).status).toBe(401);

      // El coordinador abre el flujo de eventos…
      const recibido = new Promise<string>((resolve, reject) => {
        const req = http.get(
          { host: '127.0.0.1', port: puerto, path: '/api/eventos', headers: { Authorization: `Bearer ${e.tokens.coordinador}` } },
          (res) => {
            expect(res.headers['content-type']).toContain('text/event-stream');
            let datos = '';
            res.on('data', (parte: Buffer) => {
              datos += parte.toString();
              if (datos.includes('event: notificacion') && datos.includes('event: solicitud:actualizada')) {
                req.destroy();
                resolve(datos);
              }
            });
          },
        );
        req.on('error', (err: NodeJS.ErrnoException) => (err.code === 'ECONNRESET' ? undefined : reject(err)));
        setTimeout(() => { req.destroy(); reject(new Error('No llegaron los eventos SSE')); }, 8000);
      });
      await new Promise((r) => setTimeout(r, 300));

      // …y un cliente registra una solicitud en otra "pestaña".
      const nueva = await como(e, 'cliente2').post('/solicitudes', solicitudValida(e, { sede_id: e.ids.sedeB, titulo: 'Evento en vivo' }));
      const flujo = await recibido;
      expect(flujo).toContain('event: conectado');
      expect(flujo).toContain('"titulo":"Nueva solicitud por aprobar"');
      expect(flujo).toContain(`"id":${nueva.body.id}`);
      expect(flujo).toContain('"estado":"REGISTRADA"');
    } finally {
      servidor.closeAllConnections();
      servidor.close();
    }
  });
});

describe('Respuestas de error consistentes', () => {
  it('404 con formato de contrato para rutas inexistentes', async () => {
    const res = await como(e, 'admin').get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NO_ENCONTRADO', message: 'Ruta no encontrada' } });
  });

  it('expone cabeceras de seguridad y no revela la tecnología', async () => {
    const res = await como(e, 'admin').get('/auth/me');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('CORS solo admite los orígenes configurados', async () => {
    const permitido = await como(e, 'admin').get('/auth/me').set('Origin', 'http://localhost:5173');
    expect(permitido.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const ajeno = await como(e, 'admin').get('/auth/me').set('Origin', 'https://sitio-malicioso.example');
    expect(ajeno.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('GET /api/health informa el estado sin autenticación', async () => {
    const res = await como(e, 'admin').get('/health');
    expect(res.body).toEqual({ status: 'ok' });
  });
});
