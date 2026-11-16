import { describe, expect, it } from 'vitest';
import {
  estadoTrasReapertura,
  TRANSICIONES,
  transicionesPermitidas,
  validarReapertura,
  validarTransicion,
  type DatosTransicion,
} from '../../src/modules/requests/domain/rules/transiciones';
import type { AuthUser } from '../../src/shared/domain/auth-user';
import { BusinessRuleError, ForbiddenError, ValidationError } from '../../src/shared/domain/errors';
import { ESTADOS, type Estado } from '../../src/shared/domain/estados';

const usuario = (rol: AuthUser['rol'], extra: Partial<AuthUser> = {}): AuthUser => ({
  id: 1, email: 'u@test.ec', nombre: 'Usuario', rol, clienteId: null, tecnicoId: null, ...extra,
});
const coordinador = usuario('COORDINADOR');
const admin = usuario('ADMIN');
const tecnicoAsignado = usuario('TECNICO', { tecnicoId: 7 });
const otroTecnico = usuario('TECNICO', { tecnicoId: 8 });
const clienteDueno = usuario('CLIENTE', { clienteId: 3 });
const otroCliente = usuario('CLIENTE', { clienteId: 4 });

const solicitud = (estado: Estado, extra: Partial<DatosTransicion> = {}): DatosTransicion => ({
  estado, cliente_id: 3, tecnico_id: 7, resolucion: null, ...extra,
});
const RESOLUCION = 'Se reemplazó el cable dañado y se verificó la conexión.';

describe('Regla 1 · no cerrar solicitudes sin una resolución documentada', () => {
  it('rechaza RESUELTA sin texto de resolución', () => {
    expect(() => validarTransicion(tecnicoAsignado, solicitud('EN_PROCESO'), 'RESUELTA', {})).toThrow(ValidationError);
  });

  it('rechaza una resolución demasiado corta', () => {
    expect(() => validarTransicion(tecnicoAsignado, solicitud('EN_PROCESO'), 'RESUELTA', { resolucion: 'Listo' })).toThrow(ValidationError);
  });

  it('rechaza cerrar una solicitud que no conserva resolución', () => {
    expect(() => validarTransicion(coordinador, solicitud('RESUELTA', { resolucion: '  ' }), 'CERRADA', {})).toThrow(
      'No se puede cerrar una solicitud sin una resolución documentada',
    );
  });

  it('permite cerrar cuando la resolución está documentada', () => {
    expect(validarTransicion(clienteDueno, solicitud('RESUELTA', { resolucion: RESOLUCION }), 'CERRADA', {}).a).toBe('CERRADA');
  });

  it('no existe ninguna transición directa a CERRADA que no pase por RESUELTA', () => {
    expect(TRANSICIONES.filter((t) => t.a === 'CERRADA').map((t) => t.de)).toEqual(['RESUELTA']);
  });
});

describe('Regla 2 · un técnico solo modifica solicitudes asignadas a su cargo', () => {
  it('el técnico asignado puede iniciar la atención', () => {
    expect(validarTransicion(tecnicoAsignado, solicitud('ASIGNADA'), 'EN_PROCESO', {}).a).toBe('EN_PROCESO');
  });

  it('otro técnico no puede cambiar el estado', () => {
    expect(() => validarTransicion(otroTecnico, solicitud('ASIGNADA'), 'EN_PROCESO', {})).toThrow(ForbiddenError);
    expect(() => validarTransicion(otroTecnico, solicitud('EN_PROCESO'), 'RESUELTA', { resolucion: RESOLUCION })).toThrow(ForbiddenError);
  });

  it('a un técnico ajeno no se le ofrece ninguna transición', () => {
    expect(transicionesPermitidas(otroTecnico, solicitud('EN_PROCESO'))).toEqual([]);
  });

  it('el técnico no aprueba ni cancela (son decisiones de gestión)', () => {
    expect(() => validarTransicion(tecnicoAsignado, solicitud('REGISTRADA'), 'APROBADA', {})).toThrow(ForbiddenError);
    expect(() => validarTransicion(tecnicoAsignado, solicitud('ASIGNADA'), 'CANCELADA', { comentario: 'No procede' })).toThrow(ForbiddenError);
  });
});

describe('Regla 3 · un cliente solo actúa sobre sus propias solicitudes', () => {
  it('el dueño puede cancelar su solicitud registrada, con motivo', () => {
    expect(validarTransicion(clienteDueno, solicitud('REGISTRADA'), 'CANCELADA', { comentario: 'Ya no se necesita' }).a).toBe('CANCELADA');
  });

  it('exige el motivo de la cancelación', () => {
    expect(() => validarTransicion(clienteDueno, solicitud('REGISTRADA'), 'CANCELADA', {})).toThrow(ValidationError);
  });

  it('otro cliente no puede cancelar ni cerrar', () => {
    expect(() => validarTransicion(otroCliente, solicitud('REGISTRADA'), 'CANCELADA', { comentario: 'Ya no se necesita' })).toThrow(ForbiddenError);
    expect(() => validarTransicion(otroCliente, solicitud('RESUELTA', { resolucion: RESOLUCION }), 'CERRADA', {})).toThrow(ForbiddenError);
  });
});

describe('Regla 4 · una solicitud cerrada no retrocede sin reapertura autorizada', () => {
  it.each(ESTADOS)('desde CERRADA no se puede pasar a %s por cambio de estado', (destino) => {
    expect(() => validarTransicion(admin, solicitud('CERRADA', { resolucion: RESOLUCION }), destino, { comentario: 'Reabrir por favor' })).toThrow(
      BusinessRuleError,
    );
  });

  it('solo ADMIN o COORDINADOR pueden reabrir', () => {
    const cerrada = solicitud('CERRADA');
    expect(() => validarReapertura(admin, cerrada, 'El problema volvió a presentarse')).not.toThrow();
    expect(() => validarReapertura(coordinador, cerrada, 'El problema volvió a presentarse')).not.toThrow();
    expect(() => validarReapertura(clienteDueno, cerrada, 'El problema volvió a presentarse')).toThrow(ForbiddenError);
    expect(() => validarReapertura(tecnicoAsignado, cerrada, 'El problema volvió a presentarse')).toThrow(ForbiddenError);
  });

  it('la reapertura exige un motivo y solo aplica a solicitudes cerradas', () => {
    expect(() => validarReapertura(admin, solicitud('CERRADA'), 'corto')).toThrow(ValidationError);
    expect(() => validarReapertura(admin, solicitud('RESUELTA'), 'El problema volvió a presentarse')).toThrow(BusinessRuleError);
  });

  it('vuelve al técnico si lo conserva; si no, queda lista para asignar', () => {
    expect(estadoTrasReapertura({ tecnico_id: 7 })).toBe('EN_PROCESO');
    expect(estadoTrasReapertura({ tecnico_id: null })).toBe('APROBADA');
  });
});

describe('Máquina de estados · no se permiten cambios arbitrarios', () => {
  it('ASIGNADA nunca se alcanza por cambio de estado (solo por asignación)', () => {
    expect(() => validarTransicion(coordinador, solicitud('APROBADA'), 'ASIGNADA', {})).toThrow(
      'El estado ASIGNADA solo se obtiene asignando un técnico a la solicitud',
    );
    expect(TRANSICIONES.some((t) => t.a === 'ASIGNADA')).toBe(false);
  });

  it('CANCELADA es terminal', () => {
    expect(TRANSICIONES.some((t) => t.de === 'CANCELADA')).toBe(false);
  });

  it('rechaza todo par origen → destino que no esté en la tabla', () => {
    const datos = { comentario: 'Comentario suficiente', resolucion: RESOLUCION };
    for (const de of ESTADOS) {
      for (const a of ESTADOS) {
        const definida = TRANSICIONES.some((t) => t.de === de && t.a === a);
        const intento = () => validarTransicion(admin, solicitud(de, { resolucion: RESOLUCION }), a, datos);
        if (definida) expect(intento, `${de} → ${a}`).not.toThrow();
        else expect(intento, `${de} → ${a}`).toThrow(BusinessRuleError);
      }
    }
  });

  it('pedir información y rechazar una resolución exigen comentario', () => {
    expect(() => validarTransicion(tecnicoAsignado, solicitud('EN_PROCESO'), 'PENDIENTE_INFO', {})).toThrow(ValidationError);
    expect(() => validarTransicion(clienteDueno, solicitud('RESUELTA', { resolucion: RESOLUCION }), 'EN_PROCESO', {})).toThrow(ValidationError);
  });

  it('ofrece a cada actor solo sus transiciones', () => {
    expect(transicionesPermitidas(coordinador, solicitud('REGISTRADA'))).toEqual(['APROBADA', 'CANCELADA']);
    expect(transicionesPermitidas(clienteDueno, solicitud('REGISTRADA'))).toEqual(['CANCELADA']);
    expect(transicionesPermitidas(tecnicoAsignado, solicitud('EN_PROCESO'))).toEqual(['PENDIENTE_INFO', 'RESUELTA']);
    expect(transicionesPermitidas(clienteDueno, solicitud('RESUELTA'))).toEqual(['CERRADA', 'EN_PROCESO']);
  });
});
