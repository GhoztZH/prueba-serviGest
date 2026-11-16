import { describe, expect, it } from 'vitest';
import { motivosNoElegible, tipoDeAsignacion, validarMotivo, compararCandidatos, type TecnicoCandidato } from '../../src/modules/assignments/domain/asignacion';
import { validarValorParametro } from '../../src/modules/catalogs/domain/catalogs';
import { diasEntre, fechaLocal, porcentajeCumplimiento, sumarDias } from '../../src/modules/dashboard/domain/indicadores';
import { audienciaEnVivo, planificarNotificaciones, type Audiencia } from '../../src/modules/notifications/domain/notificaciones';
import { alcanceDe, puedeAportar, puedeVerSolicitud } from '../../src/modules/requests/domain/rules/acceso';
import { calcularEstadoPlazo, calcularFechaLimite } from '../../src/modules/requests/domain/rules/plazo';
import type { EventoSolicitud } from '../../src/shared/application/ports';
import type { AuthUser } from '../../src/shared/domain/auth-user';
import { BusinessRuleError, ValidationError } from '../../src/shared/domain/errors';
import { digitoVerificadorCedula, esCedulaValida, esIdentificacionValida, esRucValido } from '../../src/shared/domain/identificacion';
import { motivoPasswordInvalida } from '../../src/shared/domain/password-policy';

const usuario = (rol: AuthUser['rol'], extra: Partial<AuthUser> = {}): AuthUser => ({
  id: 1, email: 'u@test.ec', nombre: 'Usuario', rol, clienteId: null, tecnicoId: null, ...extra,
});

describe('Regla 3 · alcance de consulta por recurso', () => {
  const solicitud = { cliente_id: 3, tecnico_id: 7, estado: 'EN_PROCESO' as const };

  it('un cliente solo ve las solicitudes de su empresa', () => {
    expect(puedeVerSolicitud(usuario('CLIENTE', { clienteId: 3 }), solicitud)).toBe(true);
    expect(puedeVerSolicitud(usuario('CLIENTE', { clienteId: 4 }), solicitud)).toBe(false);
    expect(puedeVerSolicitud(usuario('CLIENTE'), solicitud)).toBe(false);
  });

  it('un técnico solo ve las solicitudes asignadas a él', () => {
    expect(puedeVerSolicitud(usuario('TECNICO', { tecnicoId: 7 }), solicitud)).toBe(true);
    expect(puedeVerSolicitud(usuario('TECNICO', { tecnicoId: 8 }), solicitud)).toBe(false);
    expect(puedeVerSolicitud(usuario('TECNICO', { tecnicoId: 7 }), { ...solicitud, tecnico_id: null })).toBe(false);
  });

  it('administrador y coordinador ven todas', () => {
    expect(puedeVerSolicitud(usuario('ADMIN'), solicitud)).toBe(true);
    expect(puedeVerSolicitud(usuario('COORDINADOR'), solicitud)).toBe(true);
  });

  it('el alcance de los listados se impone por rol', () => {
    expect(alcanceDe(usuario('COORDINADOR'))).toEqual({});
    expect(alcanceDe(usuario('CLIENTE', { clienteId: 3 }))).toEqual({ clienteId: 3 });
    expect(alcanceDe(usuario('TECNICO', { tecnicoId: 7 }))).toEqual({ tecnicoId: 7 });
    // Una cuenta sin perfil asociado no ve nada (en lugar de verlo todo).
    expect(alcanceDe(usuario('CLIENTE'))).toBeNull();
    expect(alcanceDe(usuario('TECNICO'))).toBeNull();
  });

  it('no se comenta ni se adjunta en solicitudes finalizadas', () => {
    const dueno = usuario('CLIENTE', { clienteId: 3 });
    expect(puedeAportar(dueno, solicitud)).toBe(true);
    expect(puedeAportar(dueno, { ...solicitud, estado: 'CERRADA' })).toBe(false);
    expect(puedeAportar(dueno, { ...solicitud, estado: 'CANCELADA' })).toBe(false);
  });
});

describe('Regla 5 · la asignación valida especialidad, disponibilidad y carga', () => {
  const tecnico = (extra: Partial<TecnicoCandidato> = {}): TecnicoCandidato => ({
    id: 7, usuarioId: 70, nombre: 'Técnico', activo: true, disponible: true, maxSolicitudesActivas: 5, cargaActual: 2, especialidadIds: [1, 2], ...extra,
  });

  it('un técnico que cumple todo es elegible', () => {
    expect(motivosNoElegible(tecnico(), 1)).toEqual([]);
  });

  it('rechaza al técnico sin la especialidad de la categoría', () => {
    expect(motivosNoElegible(tecnico(), 9)).toEqual(['El técnico no tiene la especialidad requerida por la categoría']);
  });

  it('rechaza al técnico no disponible', () => {
    expect(motivosNoElegible(tecnico({ disponible: false }), 1)).toEqual(['El técnico no está disponible']);
  });

  it('rechaza al técnico inactivo', () => {
    expect(motivosNoElegible(tecnico({ activo: false }), 1)).toEqual(['El técnico no está activo']);
  });

  it('rechaza al técnico que alcanzó su carga máxima', () => {
    expect(motivosNoElegible(tecnico({ cargaActual: 5 }), 1)[0]).toContain('carga máxima (5 de 5');
    expect(motivosNoElegible(tecnico({ cargaActual: 4 }), 1)).toEqual([]);
  });

  it('no permite reasignar al mismo técnico', () => {
    expect(motivosNoElegible(tecnico(), 1, 7)).toEqual(['El técnico ya tiene asignada esta solicitud']);
  });

  it('informa todos los incumplimientos a la vez', () => {
    expect(motivosNoElegible(tecnico({ disponible: false, cargaActual: 5 }), 9)).toHaveLength(3);
  });

  it('solo se asigna desde APROBADA y se reasigna desde estados con técnico', () => {
    expect(tipoDeAsignacion('APROBADA')).toBe('ASIGNACION');
    expect(tipoDeAsignacion('ASIGNADA')).toBe('REASIGNACION');
    expect(tipoDeAsignacion('EN_PROCESO')).toBe('REASIGNACION');
    expect(tipoDeAsignacion('PENDIENTE_INFO')).toBe('REASIGNACION');
    for (const estado of ['REGISTRADA', 'RESUELTA', 'CERRADA', 'CANCELADA'] as const) {
      expect(() => tipoDeAsignacion(estado)).toThrow(BusinessRuleError);
    }
  });

  it('la reasignación exige justificación; la primera asignación no', () => {
    expect(() => validarMotivo('ASIGNACION', undefined)).not.toThrow();
    expect(() => validarMotivo('REASIGNACION', 'corto')).toThrow(ValidationError);
    expect(() => validarMotivo('REASIGNACION', 'Vacaciones del técnico anterior')).not.toThrow();
  });

  it('sugiere primero a los elegibles con menor ocupación', () => {
    const candidatos = [
      { id: 1, elegible: true, carga_actual: 4, max_solicitudes_activas: 5 },
      { id: 2, elegible: false, carga_actual: 0, max_solicitudes_activas: 5 },
      { id: 3, elegible: true, carga_actual: 1, max_solicitudes_activas: 5 },
    ].sort(compararCandidatos);
    expect(candidatos.map((c) => c.id)).toEqual([3, 1, 2]);
  });
});

describe('Regla 6 · los plazos y el cumplimiento se calculan en backend', () => {
  const t0 = new Date('2026-03-02T08:00:00Z');
  const horas = (n: number) => new Date(t0.getTime() + n * 3_600_000);
  const abierta = { estado: 'EN_PROCESO' as const, fecha_limite: horas(24), fecha_resolucion: null, horas_plazo: 24 };

  it('la fecha límite es el registro más las horas de plazo de la prioridad', () => {
    expect(calcularFechaLimite(t0, 8).toISOString()).toBe('2026-03-02T16:00:00.000Z');
  });

  it('a tiempo mientras queda más del umbral del plazo', () => {
    expect(calcularEstadoPlazo(abierta, horas(10), 25)).toEqual({ estado_plazo: 'A_TIEMPO', horas_restantes: 14 });
  });

  it('por vencer cuando queda el 25 % o menos', () => {
    expect(calcularEstadoPlazo(abierta, horas(18), 25).estado_plazo).toBe('POR_VENCER');
    expect(calcularEstadoPlazo(abierta, horas(17.9), 25).estado_plazo).toBe('A_TIEMPO');
  });

  it('vencida cuando pasó la fecha límite, con horas restantes negativas', () => {
    expect(calcularEstadoPlazo(abierta, horas(26), 25)).toEqual({ estado_plazo: 'VENCIDA', horas_restantes: -2 });
  });

  it('cumplida o incumplida según cuándo se resolvió', () => {
    const resuelta = { ...abierta, estado: 'CERRADA' as const };
    expect(calcularEstadoPlazo({ ...resuelta, fecha_resolucion: horas(20) }, horas(100), 25).estado_plazo).toBe('CUMPLIDA');
    expect(calcularEstadoPlazo({ ...resuelta, fecha_resolucion: horas(30) }, horas(100), 25).estado_plazo).toBe('INCUMPLIDA');
  });

  it('una solicitud cancelada no tiene plazo', () => {
    expect(calcularEstadoPlazo({ ...abierta, estado: 'CANCELADA' }, horas(50), 25).estado_plazo).toBe('NO_APLICA');
  });

  it('porcentaje de cumplimiento = a tiempo / evaluables', () => {
    expect(porcentajeCumplimiento(14, 7)).toBe(66.7);
    expect(porcentajeCumplimiento(5, 0)).toBe(100);
    expect(porcentajeCumplimiento(0, 0)).toBeNull();
  });

  it('las fechas del período se resuelven en la zona horaria de operación', () => {
    // 03:00 UTC del día 5 todavía es día 4 en Ecuador (UTC-5).
    expect(fechaLocal(new Date('2026-03-05T03:00:00Z'), 'America/Guayaquil')).toBe('2026-03-04');
    expect(sumarDias('2026-03-01', -29)).toBe('2026-01-31');
    expect(diasEntre('2026-03-01', '2026-03-31')).toBe(30);
  });
});

describe('Notificaciones · a quién se avisa en cada evento', () => {
  const audiencia: Audiencia = { operacion: [10, 11], gestion: [10, 11, 1], cliente: 20, tecnico: 30, tecnicoAnterior: 31 };
  const evento = (extra: Partial<EventoSolicitud>): EventoSolicitud => ({
    tipo: 'REGISTRO', actorId: 20, actorNombre: 'Cliente',
    solicitud: { id: 5, codigo: 'SOL-2026-000005', titulo: 'Sin red', clienteId: 3, tecnicoId: 7, estado: 'REGISTRADA' },
    ...extra,
  });
  const destinatarios = (e: EventoSolicitud) => planificarNotificaciones(e, audiencia).map((n) => n.usuarioId).sort();

  it('el registro avisa a la operación y nunca a quien lo originó', () => {
    expect(destinatarios(evento({}))).toEqual([10, 11]);
  });

  it('la asignación avisa al técnico y al cliente', () => {
    expect(destinatarios(evento({ tipo: 'ASIGNACION', actorId: 10 }))).toEqual([20, 30]);
  });

  it('la reasignación avisa también al técnico anterior', () => {
    expect(destinatarios(evento({ tipo: 'REASIGNACION', actorId: 10 }))).toEqual([20, 30, 31]);
  });

  it('la solicitud de información avisa al cliente con su tipo propio', () => {
    const [n] = planificarNotificaciones(
      evento({ tipo: 'CAMBIO_ESTADO', actorId: 30, comentario: 'Indique el horario', solicitud: { ...evento({}).solicitud, estado: 'PENDIENTE_INFO' } }),
      audiencia,
    );
    expect(n).toMatchObject({ usuarioId: 20, tipo: 'SOLICITUD_INFO' });
    expect(n!.mensaje).toContain('Indique el horario');
  });

  it('el cierre avisa al técnico y a la operación', () => {
    expect(destinatarios(evento({ tipo: 'CAMBIO_ESTADO', actorId: 20, solicitud: { ...evento({}).solicitud, estado: 'CERRADA' } }))).toEqual([10, 11, 30]);
  });

  it('nadie recibe dos avisos por el mismo evento y un adjunto no genera aviso', () => {
    const unica: Audiencia = { ...audiencia, operacion: [20], cliente: 20 };
    expect(planificarNotificaciones(evento({ actorId: 99 }), unica)).toHaveLength(1);
    expect(planificarNotificaciones(evento({ tipo: 'ADJUNTO' }), audiencia)).toEqual([]);
  });

  it('la actualización en vivo llega a gestión y a los involucrados, sin repetidos', () => {
    expect(audienciaEnVivo({ ...audiencia, tecnicoAnterior: null }).sort()).toEqual([1, 10, 11, 20, 30]);
  });
});

describe('Validaciones de dominio compartidas', () => {
  it('valida cédulas ecuatorianas por dígito verificador', () => {
    const valida = '171234567' + digitoVerificadorCedula('171234567');
    expect(esCedulaValida(valida)).toBe(true);
    expect(esCedulaValida(valida.slice(0, 9) + ((Number(valida[9]) + 1) % 10))).toBe(false);
    expect(esCedulaValida('9912345678')).toBe(false); // provincia inexistente
    expect(esCedulaValida('17123')).toBe(false);
  });

  it('valida RUC de persona natural y de sociedad', () => {
    const cedula = '171234567' + digitoVerificadorCedula('171234567');
    expect(esRucValido(`${cedula}001`)).toBe(true);
    expect(esRucValido(`${cedula}002`)).toBe(false);
    expect(esRucValido('1790012345001')).toBe(false); // dígito verificador incorrecto
    expect(esIdentificacionValida(cedula)).toBe(true);
    expect(esIdentificacionValida('1234567890123')).toBe(false);
  });

  it('aplica la política de contraseñas', () => {
    expect(motivoPasswordInvalida('corta1')).toContain('al menos 8');
    expect(motivoPasswordInvalida('sololetras')).toContain('una letra y un número');
    expect(motivoPasswordInvalida('12345678')).toContain('una letra y un número');
    expect(motivoPasswordInvalida('Servigest2026')).toBeNull();
  });

  it('los parámetros operativos respetan su rango', () => {
    expect(validarValorParametro('UMBRAL_POR_VENCER_PCT', ' 30 ')).toBe('30');
    expect(() => validarValorParametro('UMBRAL_POR_VENCER_PCT', '95')).toThrow(ValidationError);
    expect(() => validarValorParametro('UMBRAL_POR_VENCER_PCT', 'mucho')).toThrow(ValidationError);
    expect(() => validarValorParametro('MAX_SOLICITUDES_ACTIVAS_DEFECTO', '0')).toThrow(ValidationError);
  });
});
