import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { como, iniciar, solicitudValida, type Entorno } from './helpers';

let e: Entorno;
beforeAll(async () => { e = await iniciar(); });
afterAll(() => e.cerrar());

const RESOLUCION = 'Se reemplazó el patch cord dañado y se verificó la conexión con el usuario.';
const estado = (rol: Parameters<typeof como>[1], id: number, cuerpo: object) => como(e, rol).patch(`/solicitudes/${id}/estado`, cuerpo);

describe('Flujo completo: registro → aprobación → asignación → atención → resolución → cierre → reapertura', () => {
  let id: number;

  it('el cliente registra la solicitud; el backend calcula código, estado y fecha límite', async () => {
    const antes = Date.now();
    const res = await como(e, 'cliente').post('/solicitudes', solicitudValida(e, { equipo_afectado: 'Switch principal' }));
    expect(res.status).toBe(201);
    id = res.body.id;
    expect(res.body).toMatchObject({
      codigo: expect.stringMatching(/^SOL-\d{4}-\d{6}$/),
      estado: 'REGISTRADA', prioridad: 'ALTA', prioridad_solicitada: 'ALTA',
      cliente_id: e.ids.clienteA, tecnico_id: null, estado_plazo: 'A_TIEMPO', version: 1,
    });
    // ALTA = 24 h de plazo desde el registro.
    const plazoMs = new Date(res.body.fecha_limite).getTime() - new Date(res.body.created_at).getTime();
    expect(plazoMs).toBe(24 * 3_600_000);
    expect(new Date(res.body.created_at).getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(res.body.horas_restantes).toBeCloseTo(24, 0);
  });

  it('409 al registrar un duplicado abierto (mismo cliente, sede, categoría y equipo)', async () => {
    const res = await como(e, 'cliente').post('/solicitudes', solicitudValida(e, { equipo_afectado: '  switch PRINCIPAL ' }));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'CONFLICTO', details: { solicitud_id: id } });
  });

  it('no se puede asignar antes de aprobar', async () => {
    const res = await como(e, 'coordinador').post(`/solicitudes/${id}/asignaciones`, { tecnico_id: e.ids.tecRedes });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('La solicitud debe ser aprobada antes de asignar un técnico');
  });

  it('el coordinador aprueba', async () => {
    const res = await estado('coordinador', id, { estado: 'APROBADA' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'APROBADA', version: 2 });
  });

  it('sugiere técnicos con la especialidad, explicando quién es elegible', async () => {
    const res = await como(e, 'coordinador').get(`/solicitudes/${id}/tecnicos-sugeridos`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ id: e.ids.tecRedes, elegible: true, motivos: [], carga_actual: 0 }),
      expect.objectContaining({ id: e.ids.tecNoDisponible, elegible: false, motivos: ['El técnico no está disponible'] }),
    ]);
  });

  it('422 al asignar un técnico sin la especialidad o no disponible, con los motivos', async () => {
    const sinEspecialidad = await como(e, 'coordinador').post(`/solicitudes/${id}/asignaciones`, { tecnico_id: e.ids.tecSoftware });
    expect(sinEspecialidad.status).toBe(422);
    expect(sinEspecialidad.body.error).toMatchObject({
      code: 'REGLA_NEGOCIO',
      details: { motivos: ['El técnico no tiene la especialidad requerida por la categoría'] },
    });
    const noDisponible = await como(e, 'coordinador').post(`/solicitudes/${id}/asignaciones`, { tecnico_id: e.ids.tecNoDisponible });
    expect(noDisponible.body.error.details.motivos).toEqual(['El técnico no está disponible']);
    const inexistente = await como(e, 'coordinador').post(`/solicitudes/${id}/asignaciones`, { tecnico_id: 9999 });
    expect(inexistente.status).toBe(422);
  });

  it('el coordinador asigna: la solicitud queda ASIGNADA con una asignación activa', async () => {
    const res = await como(e, 'coordinador').post(`/solicitudes/${id}/asignaciones`, { tecnico_id: e.ids.tecRedes });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ estado: 'ASIGNADA', tecnico_id: e.ids.tecRedes, tecnico_nombre: 'Técnico Redes' });

    const detalle = await como(e, 'coordinador').get(`/solicitudes/${id}`);
    expect(detalle.body.asignaciones).toEqual([
      expect.objectContaining({ tecnico_id: e.ids.tecRedes, activa: true, asignado_por_nombre: 'Coordinador Prueba', fecha_fin: null }),
    ]);
  });

  it('restricción de carga: el técnico ya está en su máximo y no admite otra solicitud', async () => {
    const otra = await como(e, 'cliente').post('/solicitudes', solicitudValida(e));
    await estado('coordinador', otra.body.id, { estado: 'APROBADA' });
    const res = await como(e, 'coordinador').post(`/solicitudes/${otra.body.id}/asignaciones`, { tecnico_id: e.ids.tecRedes });
    expect(res.status).toBe(422);
    expect(res.body.error.details.motivos[0]).toContain('carga máxima (1 de 1');
    // La solicitud rechazada sigue aprobada y sin técnico: nada quedó a medias.
    expect((await como(e, 'coordinador').get(`/solicitudes/${otra.body.id}`)).body).toMatchObject({ estado: 'APROBADA', tecnico_id: null });
  });

  it('el técnico asignado inicia la atención y pide información (con comentario obligatorio)', async () => {
    expect((await estado('tecnico', id, { estado: 'EN_PROCESO' })).body.estado).toBe('EN_PROCESO');
    const sinComentario = await estado('tecnico', id, { estado: 'PENDIENTE_INFO' });
    expect(sinComentario.status).toBe(422);
    expect(sinComentario.body.error.details[0].campo).toBe('comentario');
    const res = await estado('tecnico', id, { estado: 'PENDIENTE_INFO', comentario: 'Indique el horario de acceso a la sede.' });
    expect(res.body.estado).toBe('PENDIENTE_INFO');
  });

  it('el cliente responde con un comentario y el técnico retoma', async () => {
    const res = await como(e, 'cliente').post(`/solicitudes/${id}/comentarios`, { comentario: 'Pueden ingresar de 9h00 a 17h00.' });
    expect(res.status).toBe(201);
    expect(res.body.at(-1)).toMatchObject({ accion: 'COMENTARIO', usuario_rol: 'CLIENTE', comentario: 'Pueden ingresar de 9h00 a 17h00.' });
    expect((await estado('tecnico', id, { estado: 'EN_PROCESO' })).status).toBe(200);
  });

  it('no se puede cerrar sin pasar por una resolución documentada', async () => {
    const directo = await estado('coordinador', id, { estado: 'CERRADA' });
    expect(directo.status).toBe(422);
    expect(directo.body.error).toMatchObject({ code: 'REGLA_NEGOCIO', message: 'Transición no permitida: EN_PROCESO → CERRADA' });
    const sinResolucion = await estado('tecnico', id, { estado: 'RESUELTA' });
    expect(sinResolucion.status).toBe(422);
    expect(sinResolucion.body.error.details[0].campo).toBe('resolucion');
  });

  it('el técnico resuelve documentando la solución', async () => {
    const res = await estado('tecnico', id, { estado: 'RESUELTA', resolucion: RESOLUCION });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'RESUELTA', resolucion: RESOLUCION, estado_plazo: 'CUMPLIDA' });
    expect(res.body.fecha_resolucion).not.toBeNull();
  });

  it('el cliente cierra su solicitud', async () => {
    const res = await estado('cliente', id, { estado: 'CERRADA' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('CERRADA');
    expect(res.body.fecha_cierre).not.toBeNull();
  });

  it('una solicitud cerrada no cambia de estado, no admite comentarios ni asignación', async () => {
    const cambio = await estado('admin', id, { estado: 'EN_PROCESO', comentario: 'Reabrir por favor' });
    expect(cambio.status).toBe(422);
    expect(cambio.body.error.message).toContain('reapertura autorizada');
    expect((await como(e, 'cliente').post(`/solicitudes/${id}/comentarios`, { comentario: 'Sigue fallando' })).status).toBe(422);
    expect((await como(e, 'coordinador').post(`/solicitudes/${id}/asignaciones`, { tecnico_id: e.ids.tecRedes, motivo: 'Cambio de técnico' })).status).toBe(422);
  });

  it('la reapertura solo la autoriza gestión, con motivo, y queda auditada', async () => {
    const reabrir = (rol: Parameters<typeof como>[1], motivo: string) => como(e, rol).post(`/solicitudes/${id}/reapertura`, { motivo });
    expect((await reabrir('cliente', 'El problema volvió a presentarse')).status).toBe(403);
    expect((await reabrir('tecnico', 'El problema volvió a presentarse')).status).toBe(403);
    expect((await reabrir('coordinador', 'corto')).status).toBe(422);

    const res = await reabrir('coordinador', 'El problema volvió a presentarse');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'EN_PROCESO', resolucion: null, fecha_cierre: null, tecnico_id: e.ids.tecRedes });
    expect(new Date(res.body.fecha_limite).getTime()).toBeGreaterThan(Date.now());
  });

  it('el historial registra cada paso con usuario, fecha y cambio de estado', async () => {
    const res = await como(e, 'cliente').get(`/solicitudes/${id}/historial`);
    expect(res.status).toBe(200);
    expect(res.body.map((h: { accion: string; estado_nuevo: string | null }) => `${h.accion}:${h.estado_nuevo ?? '-'}`)).toEqual([
      'CREACION:REGISTRADA', 'CAMBIO_ESTADO:APROBADA', 'ASIGNACION:ASIGNADA', 'CAMBIO_ESTADO:EN_PROCESO',
      'CAMBIO_ESTADO:PENDIENTE_INFO', 'COMENTARIO:-', 'CAMBIO_ESTADO:EN_PROCESO', 'CAMBIO_ESTADO:RESUELTA',
      'CAMBIO_ESTADO:CERRADA', 'REAPERTURA:EN_PROCESO',
    ]);
    const reapertura = res.body.at(-1);
    expect(reapertura).toMatchObject({
      estado_anterior: 'CERRADA', usuario_nombre: 'Coordinador Prueba', usuario_rol: 'COORDINADOR',
      comentario: 'El problema volvió a presentarse',
      detalle: expect.objectContaining({ resolucion_anterior: RESOLUCION }),
    });
    expect(res.body.every((h: { fecha: string }) => !Number.isNaN(Date.parse(h.fecha)))).toBe(true);
  });

  it('el historial es inalterable también a nivel de base de datos', async () => {
    await expect(e.db.execute(`UPDATE historial_solicitudes SET comentario = 'alterado' WHERE solicitud_id = $1`, [id])).rejects.toThrow(/inalterable/);
    await expect(e.db.execute(`DELETE FROM historial_solicitudes WHERE solicitud_id = $1`, [id])).rejects.toThrow(/inalterable/);
  });

  it('reasignación justificada: cambia el técnico, cierra la asignación anterior y vuelve a ASIGNADA', async () => {
    // Se habilita al técnico en pausa para tener un destino válido.
    await e.db.execute(`UPDATE tecnicos SET disponible = TRUE WHERE id = $1`, [e.ids.tecNoDisponible]);
    const sinMotivo = await como(e, 'coordinador').post(`/solicitudes/${id}/asignaciones`, { tecnico_id: e.ids.tecNoDisponible });
    expect(sinMotivo.status).toBe(422);
    expect(sinMotivo.body.error.details[0].campo).toBe('motivo');
    const mismo = await como(e, 'coordinador').post(`/solicitudes/${id}/asignaciones`, { tecnico_id: e.ids.tecRedes, motivo: 'Reasignación de prueba' });
    expect(mismo.body.error.details.motivos).toContain('El técnico ya tiene asignada esta solicitud');

    const res = await como(e, 'coordinador').post(`/solicitudes/${id}/asignaciones`, { tecnico_id: e.ids.tecNoDisponible, motivo: 'Vacaciones del técnico anterior.' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ estado: 'ASIGNADA', tecnico_id: e.ids.tecNoDisponible });

    const { asignaciones } = (await como(e, 'coordinador').get(`/solicitudes/${id}`)).body;
    expect(asignaciones.map((a: { activa: boolean }) => a.activa)).toEqual([true, false]);
    expect(asignaciones[1].fecha_fin).not.toBeNull();
    // El técnico anterior pierde el acceso a la solicitud.
    expect((await como(e, 'tecnico').get(`/solicitudes/${id}`)).status).toBe(404);
  });
});

describe('Reglas de estado y concurrencia', () => {
  it('rechaza transiciones arbitrarias', async () => {
    const { body } = await como(e, 'cliente').post('/solicitudes', solicitudValida(e));
    const res = await estado('coordinador', body.id, { estado: 'RESUELTA', resolucion: RESOLUCION });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Transición no permitida: REGISTRADA → RESUELTA');
    expect((await estado('coordinador', body.id, { estado: 'ASIGNADA' })).status).toBe(422);
    expect((await estado('coordinador', body.id, { estado: 'INVENTADO' })).status).toBe(422);
  });

  it('409 si la versión enviada ya no es la vigente (concurrencia optimista)', async () => {
    const { body } = await como(e, 'cliente').post('/solicitudes', solicitudValida(e));
    expect((await estado('coordinador', body.id, { estado: 'APROBADA', version: 1 })).status).toBe(200);
    const res = await estado('admin', body.id, { estado: 'CANCELADA', comentario: 'Duplicada por error', version: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICTO');
  });

  it('dos aprobaciones simultáneas: solo una se aplica', async () => {
    const { body } = await como(e, 'cliente').post('/solicitudes', solicitudValida(e));
    const [a, b] = await Promise.all([
      estado('coordinador', body.id, { estado: 'APROBADA' }),
      estado('admin', body.id, { estado: 'APROBADA' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    const historial = await como(e, 'admin').get(`/solicitudes/${body.id}/historial`);
    expect(historial.body.filter((h: { estado_nuevo: string }) => h.estado_nuevo === 'APROBADA')).toHaveLength(1);
  });

  it('al aprobar, gestión puede ajustar la prioridad y el plazo se recalcula', async () => {
    const { body } = await como(e, 'cliente').post('/solicitudes', solicitudValida(e, { prioridad_id: e.ids.prioridad.BAJA }));
    const res = await estado('coordinador', body.id, { estado: 'APROBADA', prioridad_id: e.ids.prioridad.CRITICA });
    expect(res.body).toMatchObject({ prioridad: 'CRITICA', prioridad_solicitada: 'BAJA' });
    expect(new Date(res.body.fecha_limite).getTime() - new Date(res.body.created_at).getTime()).toBe(8 * 3_600_000);
  });

  it('el cliente cancela su solicitud con motivo; después no admite cambios', async () => {
    const { body } = await como(e, 'cliente').post('/solicitudes', solicitudValida(e));
    expect((await estado('cliente', body.id, { estado: 'CANCELADA' })).status).toBe(422);
    const res = await estado('cliente', body.id, { estado: 'CANCELADA', comentario: 'Ya no se requiere' });
    expect(res.body).toMatchObject({ estado: 'CANCELADA', estado_plazo: 'NO_APLICA' });
    expect((await estado('coordinador', body.id, { estado: 'APROBADA' })).status).toBe(422);
  });
});

describe('Validación de entradas al registrar', () => {
  it('422 con los campos inválidos identificados', async () => {
    const res = await como(e, 'cliente').post('/solicitudes', { titulo: 'abc', descripcion: 'corta', sede_id: 'x' });
    expect(res.status).toBe(422);
    const campos = res.body.error.details.map((d: { campo: string }) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['sede_id', 'categoria_id', 'prioridad_id', 'titulo', 'descripcion', 'equipo_afectado']));
  });

  it('422 si la sede no pertenece al cliente o las referencias no existen', async () => {
    const sedeAjena = await como(e, 'cliente').post('/solicitudes', solicitudValida(e, { sede_id: e.ids.sedeB }));
    expect(sedeAjena.status).toBe(422);
    expect(sedeAjena.body.error.details).toEqual([{ campo: 'sede_id', mensaje: 'La sede no pertenece al cliente' }]);
    const inexistentes = await como(e, 'cliente').post('/solicitudes', solicitudValida(e, { categoria_id: 999, prioridad_id: 999 }));
    expect(inexistentes.body.error.details.map((d: { campo: string }) => d.campo)).toEqual(['categoria_id', 'prioridad_id']);
  });

  it('422 si la categoría no está vigente', async () => {
    await e.db.execute(`UPDATE categorias_servicio SET activo = FALSE WHERE id = $1`, [e.ids.catSoftware]);
    const res = await como(e, 'cliente').post('/solicitudes', solicitudValida(e, { categoria_id: e.ids.catSoftware }));
    expect(res.body.error.details).toEqual([{ campo: 'categoria_id', mensaje: 'La categoría no está vigente' }]);
    await e.db.execute(`UPDATE categorias_servicio SET activo = TRUE WHERE id = $1`, [e.ids.catSoftware]);
  });

  it('el cliente no puede registrar a nombre de otra empresa: cliente_id se ignora', async () => {
    const res = await como(e, 'cliente').post('/solicitudes', solicitudValida(e, { cliente_id: e.ids.clienteB }));
    expect(res.status).toBe(201);
    expect(res.body.cliente_id).toBe(e.ids.clienteA);
  });

  it('gestión debe indicar el cliente', async () => {
    const sin = await como(e, 'coordinador').post('/solicitudes', solicitudValida(e));
    expect(sin.status).toBe(422);
    const con = await como(e, 'coordinador').post('/solicitudes', solicitudValida(e, { cliente_id: e.ids.clienteB, sede_id: e.ids.sedeB }));
    expect(con.status).toBe(201);
    expect(con.body.cliente_id).toBe(e.ids.clienteB);
  });

  it('un fallo a mitad de la operación no deja datos a medias (atomicidad)', async () => {
    const antes = (await e.db.one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM solicitudes`))!.n;
    // El adjunto se valida DESPUÉS de insertar la solicitud y su historial, dentro de la misma
    // transacción: al fallar (contenido que no es un PDF) debe revertirse todo lo anterior.
    const peticion = request(e.app).post('/api/solicitudes').set('Authorization', `Bearer ${e.tokens.cliente}`);
    for (const [clave, valor] of Object.entries(solicitudValida(e))) peticion.field(clave, String(valor));
    const res = await peticion.attach('adjuntos', Buffer.from('no soy un pdf'), { filename: 'falso.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REGLA_NEGOCIO');
    expect((await e.db.one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM solicitudes`))!.n).toBe(antes);
    expect(await e.db.one(`SELECT 1 FROM historial_solicitudes h LEFT JOIN solicitudes s ON s.id = h.solicitud_id WHERE s.id IS NULL`)).toBeUndefined();
  });
});

describe('Listado paginado y filtros', () => {
  it('pagina y devuelve metadatos', async () => {
    const res = await como(e, 'coordinador').get('/solicitudes?limit=2&page=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 2, limit: 2 });
    expect(res.body.meta.totalPages).toBe(Math.ceil(res.body.meta.total / 2));
    expect(res.body.data[0]).toHaveProperty('estado_plazo');
  });

  it('filtra por estado, prioridad, texto y cliente', async () => {
    const porEstado = await como(e, 'coordinador').get('/solicitudes?estado=CANCELADA,APROBADA&limit=100');
    expect(porEstado.body.data.length).toBeGreaterThan(0);
    expect(new Set(porEstado.body.data.map((s: { estado: string }) => s.estado))).toEqual(new Set(['CANCELADA', 'APROBADA']));

    const porPrioridad = await como(e, 'coordinador').get('/solicitudes?prioridad=CRITICA');
    expect(porPrioridad.body.data.every((s: { prioridad: string }) => s.prioridad === 'CRITICA')).toBe(true);

    const porTexto = await como(e, 'coordinador').get(`/solicitudes?q=${encodeURIComponent('SOL-')}&limit=1`);
    expect(porTexto.body.meta.total).toBeGreaterThan(0);

    const porCliente = await como(e, 'coordinador').get(`/solicitudes?cliente_id=${e.ids.clienteB}`);
    expect(porCliente.body.data.every((s: { cliente_id: number }) => s.cliente_id === e.ids.clienteB)).toBe(true);
  });

  it('identifica las solicitudes vencidas y próximas a vencer con el criterio del backend', async () => {
    // Se envejece una solicitud abierta para que quede vencida y otra para que quede por vencer (ALTA: 24 h; umbral 25 % = 6 h).
    const [vencida, porVencer] = await Promise.all([
      como(e, 'cliente').post('/solicitudes', solicitudValida(e)),
      como(e, 'cliente').post('/solicitudes', solicitudValida(e)),
    ]);
    const mover = (id: number, horas: number) =>
      e.db.execute(`UPDATE solicitudes SET created_at = created_at - make_interval(hours => $2), fecha_limite = fecha_limite - make_interval(hours => $2) WHERE id = $1`, [id, horas]);
    await mover(vencida.body.id, 30);
    await mover(porVencer.body.id, 20);

    const vencidas = await como(e, 'coordinador').get('/solicitudes?vencimiento=vencida&limit=100');
    expect(vencidas.body.data.map((s: { id: number }) => s.id)).toContain(vencida.body.id);
    expect(vencidas.body.data.every((s: { estado_plazo: string }) => s.estado_plazo === 'VENCIDA')).toBe(true);

    const proximas = await como(e, 'coordinador').get('/solicitudes?vencimiento=por_vencer&limit=100');
    expect(proximas.body.data.map((s: { id: number }) => s.id)).toEqual([porVencer.body.id]);
    expect(proximas.body.data[0]).toMatchObject({ estado_plazo: 'POR_VENCER' });
    expect(proximas.body.data[0].horas_restantes).toBeCloseTo(4, 0);
  });

  it('422 con filtros inválidos', async () => {
    expect((await como(e, 'coordinador').get('/solicitudes?limit=500')).status).toBe(422);
    expect((await como(e, 'coordinador').get('/solicitudes?estado=NOEXISTE')).status).toBe(422);
    expect((await como(e, 'coordinador').get('/solicitudes?desde=ayer')).status).toBe(422);
  });

  it('404 si la solicitud no existe y 422 si el id no es válido', async () => {
    expect((await como(e, 'coordinador').get('/solicitudes/999999')).status).toBe(404);
    expect((await como(e, 'coordinador').get('/solicitudes/abc')).status).toBe(422);
  });
});

describe('Adjuntos', () => {
  let id: number;
  beforeAll(async () => {
    id = (await como(e, 'cliente').post('/solicitudes', solicitudValida(e))).body.id;
  });
  const subir = (rol: Parameters<typeof como>[1], nombre: string, contenido: Buffer, tipo: string) =>
    request(e.app).post(`/api/solicitudes/${id}/adjuntos`).set('Authorization', `Bearer ${e.tokens[rol]}`).attach('adjuntos', contenido, { filename: nombre, contentType: tipo });

  it('sube un archivo permitido y lo descarga quien tiene acceso', async () => {
    const res = await subir('cliente', 'evidencia.txt', Buffer.from('El switch muestra luces en ámbar.'), 'text/plain');
    expect(res.status).toBe(201);
    expect(res.body).toEqual([expect.objectContaining({ nombre_original: 'evidencia.txt', mime_type: 'text/plain', subido_por_nombre: 'Cliente A' })]);
    expect(res.body[0]).not.toHaveProperty('nombre_archivo');

    const descarga = await como(e, 'cliente').get(`/solicitudes/${id}/adjuntos/${res.body[0].id}`);
    expect(descarga.status).toBe(200);
    expect(descarga.headers['content-disposition']).toContain('attachment');
    expect(descarga.text).toBe('El switch muestra luces en ámbar.');
    // Otro cliente no puede descargarlo.
    expect((await como(e, 'cliente2').get(`/solicitudes/${id}/adjuntos/${res.body[0].id}`)).status).toBe(404);
  });

  it('400 con un tipo no permitido y 422 si el contenido no corresponde al tipo declarado', async () => {
    const ejecutable = await subir('cliente', 'script.exe', Buffer.from('MZ'), 'application/octet-stream');
    expect(ejecutable.status).toBe(400);
    expect(ejecutable.body.error.code).toBe('SOLICITUD_INVALIDA');
    const falsoPdf = await subir('cliente', 'informe.pdf', Buffer.from('esto no es un pdf'), 'application/pdf');
    expect(falsoPdf.status).toBe(422);
    expect((await como(e, 'cliente').get(`/solicitudes/${id}`)).body.adjuntos).toHaveLength(1);
  });

  it('registra la solicitud con adjuntos en una sola petición multipart', async () => {
    const cuerpo = solicitudValida(e);
    const peticion = request(e.app).post('/api/solicitudes').set('Authorization', `Bearer ${e.tokens.cliente}`);
    for (const [clave, valor] of Object.entries(cuerpo)) peticion.field(clave, String(valor));
    const res = await peticion.attach('adjuntos', Buffer.from('%PDF-1.4 contenido'), { filename: 'foto.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    const detalle = await como(e, 'cliente').get(`/solicitudes/${res.body.id}`);
    expect(detalle.body.adjuntos).toHaveLength(1);
  });
});
