import type { PasswordHasher } from '../shared/application/ports';
import type { Database } from '../shared/db/database';
import { digitoVerificadorCedula } from '../shared/domain/identificacion';
import type { Estado } from '../shared/domain/estados';

/**
 * DATOS DE DEMOSTRACIÓN (ficticios). Solo se cargan con SEED_DEMO=true y solo
 * una vez: si ya están, no se toca nada. Están separados de los catálogos base
 * (migración 002), que sí forman parte del modelo.
 *
 * Los usuarios y la contraseña son los que el contrato OpenAPI publica como
 * cuentas de prueba; no son credenciales reales.
 */
const PASSWORD_DEMO = 'Servigest2026';
const HORA = 3_600_000;

const cedula = (base9: string) => base9 + digitoVerificadorCedula(base9);

/** RUC de sociedad privada (tercer dígito 9, módulo 11) válido a partir de una base de 9 dígitos. */
function rucSociedad(base9: string): string {
  const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = coeficientes.reduce((acc, c, i) => acc + c * Number(base9[i]), 0);
  const digito = suma % 11 === 0 ? 0 : 11 - (suma % 11);
  if (digito === 10) throw new Error(`Base de RUC sin dígito verificador válido: ${base9}`);
  return `${base9}${digito}001`;
}

const ESPECIALIDADES = ['Redes y conectividad', 'Hardware y equipos', 'Software y sistemas', 'Impresión y periféricos', 'Seguridad electrónica', 'Electricidad'];

/** [nombre, índice de especialidad, títulos de ejemplo, equipos de ejemplo] */
const CATEGORIAS: Array<[string, number, string[], string[]]> = [
  ['Falla de red', 0, ['Sin conexión en el área de ventas', 'Switch del piso 2 no responde', 'Caída de red en bodega'], ['Switch Cisco SG350', 'Switch TP-Link TL-SG1024', 'Rack de comunicaciones B1']],
  ['Internet lento', 0, ['Internet lento en recepción', 'Videollamadas con cortes', 'Wifi inestable en sala de reuniones'], ['Router Mikrotik hEX', 'Access Point UniFi U6', 'Módem del proveedor']],
  ['Equipo no enciende', 1, ['Computador de caja no enciende', 'Monitor parpadea', 'Portátil de gerencia no carga'], ['PC Dell OptiPlex 3080', 'Monitor LG 24MK430', 'Portátil Lenovo ThinkPad E14']],
  ['Mantenimiento preventivo', 1, ['Mantenimiento de equipos de oficina', 'Limpieza interna de servidores', 'Revisión trimestral de UPS'], ['Equipos del área administrativa', 'Servidor HP ProLiant ML30', 'UPS APC Smart 1500']],
  ['Error de software', 2, ['No abre el sistema contable', 'Error al emitir facturas', 'Antivirus bloquea una aplicación'], ['Sistema contable', 'Módulo de facturación', 'Estación de trabajo de contabilidad']],
  ['Impresora o escáner', 3, ['Impresora no imprime', 'Impresora sin tinta', 'Escáner no digitaliza'], ['HP LaserJet M404', 'Epson EcoTank L3250', 'Escáner Brother ADS-2200']],
  ['Cámaras y control de acceso', 4, ['Cámara de seguridad apagada', 'Control de acceso no lee tarjetas', 'Grabador sin espacio'], ['Cámara Hikvision DS-2CD1043', 'Lector ZKTeco F18', 'NVR Dahua 8 canales']],
  ['Instalación eléctrica', 5, ['Tomacorriente sin energía', 'Breaker se dispara en bodega', 'Regulador con ruido'], ['Tomacorriente de recepción', 'Tablero eléctrico de bodega', 'Regulador Forza 1200VA']],
];

const CLIENTES = [
  { razon: 'Comercial Andina S.A.', id: rucSociedad('179001234'), email: 'contacto@comercialandina.ec', tel: '022345678', dir: 'Av. Amazonas N34-120, Quito', cuenta: 'cliente@servigest.ec', sedes: [['Matriz Norte', 'Av. Amazonas N34-120, Quito'], ['Sucursal Centro', 'Venezuela y Chile, Quito'], ['Bodega Sur', 'Av. Maldonado S20-45, Quito']] },
  { razon: 'Farmacias Vida Sana Cía. Ltda.', id: rucSociedad('099005678'), email: 'sistemas@vidasana.ec', tel: '042678901', dir: 'Av. 9 de Octubre 1204, Guayaquil', cuenta: 'vidasana@servigest.ec', sedes: [['Local Centro', 'Av. 9 de Octubre 1204, Guayaquil'], ['Local Norte', 'Av. Francisco de Orellana, Guayaquil']] },
  { razon: 'Estudio Jurídico Loor', id: `${cedula('130456789')}001`, email: 'oficina@estudioloor.ec', tel: '052634120', dir: 'Calle 13 y Av. 24, Manta', cuenta: 'estudioloor@servigest.ec', sedes: [['Oficina principal', 'Calle 13 y Av. 24, Manta']] },
];

/** [nombre, correo, base de cédula, índices de especialidad, máximo, disponible] */
const TECNICOS: Array<[string, string, string, number[], number, boolean]> = [
  ['Carlos Vera', 'tecnico@servigest.ec', '171234567', [0, 1], 5, true],
  ['María Quishpe', 'maria.quishpe@servigest.ec', '092345678', [2, 3], 5, true],
  ['Jorge Intriago', 'jorge.intriago@servigest.ec', '131234567', [4, 5, 1], 4, true],
  ['Paola Zambrano', 'paola.zambrano@servigest.ec', '010234567', [0, 2], 5, false],
];

interface Caso {
  estado: Estado;
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  /** Índice en CATEGORIAS. */
  cat: number;
  /** Horas transcurridas desde el registro. */
  hace: number;
  /** Índice en TECNICOS. */
  tec?: number;
  /** Momento de la resolución como fracción del plazo (>1 = fuera de plazo). */
  factor?: number;
}

const PLAZO = { BAJA: 72, MEDIA: 48, ALTA: 24, CRITICA: 8 } as const;

const CASOS: Caso[] = [
  // Bandeja por aprobar: una crítica por vencer y una alta ya vencida.
  { estado: 'REGISTRADA', prioridad: 'CRITICA', cat: 6, hace: 6.6 },
  { estado: 'REGISTRADA', prioridad: 'BAJA', cat: 5, hace: 2 },
  { estado: 'REGISTRADA', prioridad: 'ALTA', cat: 4, hace: 26 },
  { estado: 'REGISTRADA', prioridad: 'MEDIA', cat: 1, hace: 5 },
  { estado: 'REGISTRADA', prioridad: 'MEDIA', cat: 2, hace: 1 },
  { estado: 'APROBADA', prioridad: 'ALTA', cat: 0, hace: 4 },
  { estado: 'APROBADA', prioridad: 'BAJA', cat: 3, hace: 20 },
  { estado: 'APROBADA', prioridad: 'MEDIA', cat: 7, hace: 9 },
  { estado: 'ASIGNADA', prioridad: 'ALTA', cat: 0, hace: 8, tec: 0 },
  { estado: 'ASIGNADA', prioridad: 'MEDIA', cat: 5, hace: 12, tec: 1 },
  { estado: 'ASIGNADA', prioridad: 'BAJA', cat: 6, hace: 30, tec: 2 },
  { estado: 'EN_PROCESO', prioridad: 'CRITICA', cat: 0, hace: 5, tec: 0 },
  { estado: 'EN_PROCESO', prioridad: 'MEDIA', cat: 4, hace: 40, tec: 1 },
  { estado: 'EN_PROCESO', prioridad: 'ALTA', cat: 2, hace: 30, tec: 2 },
  { estado: 'EN_PROCESO', prioridad: 'BAJA', cat: 4, hace: 50, tec: 3 },
  { estado: 'PENDIENTE_INFO', prioridad: 'MEDIA', cat: 2, hace: 22, tec: 0 },
  { estado: 'PENDIENTE_INFO', prioridad: 'BAJA', cat: 5, hace: 60, tec: 1 },
  { estado: 'RESUELTA', prioridad: 'ALTA', cat: 1, hace: 30, tec: 0, factor: 0.7 },
  { estado: 'RESUELTA', prioridad: 'MEDIA', cat: 4, hace: 60, tec: 1, factor: 0.9 },
  { estado: 'RESUELTA', prioridad: 'CRITICA', cat: 7, hace: 14, tec: 2, factor: 1.4 },
  { estado: 'CANCELADA', prioridad: 'BAJA', cat: 3, hace: 100 },
  { estado: 'CANCELADA', prioridad: 'MEDIA', cat: 5, hace: 200 },
  // Historia cerrada de las últimas cuatro semanas (alimenta cumplimiento, tiempos y evolución).
  ...Array.from({ length: 16 }, (_, i): Caso => {
    const prioridad = (['MEDIA', 'ALTA', 'BAJA', 'CRITICA'] as const)[i % 4]!;
    const cat = [0, 5, 2, 4, 6, 7, 1, 3][i % 8]!;
    return {
      estado: 'CERRADA',
      prioridad,
      cat,
      hace: 24 * (4 + i * 1.5),
      tec: [0, 1, 0, 1, 2, 2, 3, 2][i % 8],
      factor: [0.4, 0.8, 0.55, 1.25, 0.3, 0.9, 1.1, 0.65][i % 8],
    };
  }),
];

export async function sembrarDemo(db: Database, hasher: PasswordHasher): Promise<boolean> {
  return db.run(async () => {
    if (await db.one(`SELECT 1 FROM usuarios WHERE email = 'coordinador@servigest.ec'`)) return false;

    const hash = await hasher.hash(PASSWORD_DEMO);
    const id = async (sql: string, params: unknown[]) => (await db.one<{ id: number }>(sql, params))!.id;
    const usuario = async (email: string, nombre: string, rol: string) => {
      await db.execute(
        `INSERT INTO usuarios (email, password_hash, nombre, rol_id) VALUES ($1, $2, $3, (SELECT id FROM roles WHERE codigo = $4))
         ON CONFLICT (email) DO NOTHING`,
        [email, hash, nombre, rol],
      );
      return id(`SELECT id FROM usuarios WHERE email = $1`, [email]);
    };

    await usuario('admin@servigest.ec', 'Ana Mora', 'ADMIN');
    const coordinador = await usuario('coordinador@servigest.ec', 'Luis Cedeño', 'COORDINADOR');

    const especialidades: number[] = [];
    for (const nombre of ESPECIALIDADES) {
      especialidades.push(await id(`INSERT INTO especialidades (nombre) VALUES ($1) RETURNING id`, [nombre]));
    }
    const categorias: number[] = [];
    for (const [nombre, esp] of CATEGORIAS) {
      categorias.push(await id(`INSERT INTO categorias_servicio (nombre, especialidad_id) VALUES ($1, $2) RETURNING id`, [nombre, especialidades[esp]]));
    }

    const clientes: Array<{ id: number; usuario: number; sedes: number[] }> = [];
    for (const c of CLIENTES) {
      const usuarioId = await usuario(c.cuenta, c.razon, 'CLIENTE');
      const clienteId = await id(
        `INSERT INTO clientes (usuario_id, identificacion, razon_social, email, telefono, direccion) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [usuarioId, c.id, c.razon, c.email, c.tel, c.dir],
      );
      const sedes: number[] = [];
      for (const [nombre, direccion] of c.sedes) {
        sedes.push(await id(`INSERT INTO sedes (cliente_id, nombre, direccion) VALUES ($1, $2, $3) RETURNING id`, [clienteId, nombre, direccion]));
      }
      clientes.push({ id: clienteId, usuario: usuarioId, sedes });
    }

    const tecnicos: Array<{ id: number; usuario: number; nombre: string }> = [];
    for (const [nombre, email, base, esps, maximo, disponible] of TECNICOS) {
      const usuarioId = await usuario(email, nombre, 'TECNICO');
      const tecnicoId = await id(
        `INSERT INTO tecnicos (usuario_id, cedula, telefono, max_solicitudes_activas, disponible) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [usuarioId, cedula(base), `09${base.slice(1, 9)}`, maximo, disponible],
      );
      for (const e of esps) {
        await db.execute(`INSERT INTO tecnico_especialidades (tecnico_id, especialidad_id) VALUES ($1, $2)`, [tecnicoId, especialidades[e]]);
      }
      tecnicos.push({ id: tecnicoId, usuario: usuarioId, nombre });
    }

    const ahora = Date.now();
    for (const [i, caso] of CASOS.entries()) {
      const cliente = clientes[i % clientes.length]!;
      const sede = cliente.sedes[i % cliente.sedes.length]!;
      const [, , titulos, equipos] = CATEGORIAS[caso.cat]!;
      const tecnico = caso.tec === undefined ? undefined : tecnicos[caso.tec]!;
      const t0 = ahora - caso.hace * HORA;
      const en = (horasDesdeRegistro: number) => new Date(t0 + horasDesdeRegistro * HORA);
      const horasResolucion = caso.factor ? caso.factor * PLAZO[caso.prioridad] : undefined;
      // Tramo sobre el que se reparten los pasos intermedios del ciclo de vida.
      const tramo = horasResolucion ?? caso.hace;
      const resolucion = horasResolucion
        ? 'Se revisó el equipo en sitio, se corrigió la causa de la falla y se verificó el funcionamiento con el usuario.'
        : null;
      const cierre = caso.estado === 'CERRADA' ? en(horasResolucion! + Math.min(6, (caso.hace - horasResolucion!) / 2)) : null;

      const solicitudId = await id(
        `INSERT INTO solicitudes
           (codigo, cliente_id, sede_id, categoria_id, prioridad_solicitada_id, prioridad_id, estado_id, tecnico_id,
            titulo, descripcion, equipo_afectado, resolucion, fecha_limite, fecha_resolucion, fecha_cierre,
            creado_por, version, created_at, updated_at)
         VALUES
           ('SOL-' || to_char($1::timestamptz, 'YYYY') || '-' || LPAD(nextval('solicitudes_codigo_seq')::text, 6, '0'),
            $2, $3, $4, (SELECT id FROM prioridades WHERE codigo = $5), (SELECT id FROM prioridades WHERE codigo = $5),
            (SELECT id FROM estados WHERE codigo = $6), $7, $8, $9, $10, $11, $12, $13, $14, $15, 1, $1, $1)
         RETURNING id`,
        [
          en(0),
          cliente.id,
          sede,
          categorias[caso.cat],
          caso.prioridad,
          caso.estado,
          tecnico?.id ?? null,
          titulos[i % titulos.length],
          `${titulos[i % titulos.length]}. El problema se presenta desde el inicio de la jornada y afecta el trabajo del área.`,
          `${equipos[i % equipos.length]} (${i + 1})`,
          resolucion,
          en(PLAZO[caso.prioridad]),
          horasResolucion ? en(horasResolucion) : null,
          cierre,
          cliente.usuario,
        ],
      );

      const paso = (accion: string, usuarioId: number, fecha: Date, de: Estado | null, a: Estado | null, comentario: string | null = null, detalle: unknown = null) =>
        db.execute(
          `INSERT INTO historial_solicitudes (solicitud_id, usuario_id, accion, estado_anterior_id, estado_nuevo_id, comentario, detalle, fecha)
           VALUES ($1, $2, $3, (SELECT id FROM estados WHERE codigo = $4), (SELECT id FROM estados WHERE codigo = $5), $6, $7, $8)`,
          [solicitudId, usuarioId, accion, de, a, comentario, detalle ? JSON.stringify(detalle) : null, fecha],
        );

      await paso('CREACION', cliente.usuario, en(0), null, 'REGISTRADA');
      if (caso.estado === 'REGISTRADA') continue;
      if (caso.estado === 'CANCELADA') {
        await paso('CAMBIO_ESTADO', cliente.usuario, en(tramo * 0.3), 'REGISTRADA', 'CANCELADA', 'El equipo fue reemplazado y ya no se requiere la atención.');
        continue;
      }
      await paso('CAMBIO_ESTADO', coordinador, en(tramo * 0.1), 'REGISTRADA', 'APROBADA');
      if (!tecnico) continue;

      await db.execute(
        `INSERT INTO asignaciones (solicitud_id, tecnico_id, asignado_por, fecha_asignacion) VALUES ($1, $2, $3, $4)`,
        [solicitudId, tecnico.id, coordinador, en(tramo * 0.2)],
      );
      await paso('ASIGNACION', coordinador, en(tramo * 0.2), 'APROBADA', 'ASIGNADA', null, { tecnico_id: tecnico.id, tecnico_nombre: tecnico.nombre });
      if (caso.estado === 'ASIGNADA') continue;

      await paso('CAMBIO_ESTADO', tecnico.usuario, en(tramo * 0.35), 'ASIGNADA', 'EN_PROCESO');
      if (caso.estado === 'PENDIENTE_INFO') {
        await paso('CAMBIO_ESTADO', tecnico.usuario, en(tramo * 0.6), 'EN_PROCESO', 'PENDIENTE_INFO', 'Indique el horario en que se puede acceder al equipo y una persona de contacto en la sede.');
      }
      if (!horasResolucion) continue;

      await paso('CAMBIO_ESTADO', tecnico.usuario, en(horasResolucion), 'EN_PROCESO', 'RESUELTA', resolucion);
      if (cierre) await paso('CAMBIO_ESTADO', cliente.usuario, cierre, 'RESUELTA', 'CERRADA');
    }

    // Avisos iniciales para que la campana no aparezca vacía en la demostración.
    await db.execute(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, solicitud_id, created_at)
       SELECT $1, 'REGISTRO', 'Nueva solicitud por aprobar', s.codigo || ' · ' || s.titulo || ' fue registrada y espera aprobación.', s.id, s.created_at
         FROM solicitudes s JOIN estados e ON e.id = s.estado_id WHERE e.codigo = 'REGISTRADA'`,
      [coordinador],
    );
    await db.execute(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, solicitud_id, created_at)
       SELECT t.usuario_id, 'ASIGNACION', 'Nueva solicitud asignada', 'Se le asignó ' || s.codigo || ' · ' || s.titulo || '.', s.id, a.fecha_asignacion
         FROM solicitudes s
         JOIN estados e ON e.id = s.estado_id
         JOIN asignaciones a ON a.solicitud_id = s.id AND a.activa
         JOIN tecnicos t ON t.id = s.tecnico_id
        WHERE e.codigo = 'ASIGNADA'`,
    );
    await db.execute(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, solicitud_id)
       SELECT c.usuario_id, 'SOLICITUD_INFO', 'Se necesita información', 'El técnico pide información sobre ' || s.codigo || ' · ' || s.titulo || '.', s.id
         FROM solicitudes s JOIN estados e ON e.id = s.estado_id JOIN clientes c ON c.id = s.cliente_id
        WHERE e.codigo = 'PENDIENTE_INFO'`,
    );
    return true;
  });
}
