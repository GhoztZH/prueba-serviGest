import { describe, expect, it } from 'vitest';
import {
  DATA_ROLE,
  duracion,
  fechaISO,
  horasPromedio,
  NOMBRE_ESTADO,
  NOMBRE_ROL,
  plazoDe,
  porcentaje,
  primerNombre,
  tamanoArchivo,
} from './format';

describe('format.ts', () => {
  it('mapea correctamente nombres y data-role', () => {
    expect(NOMBRE_ROL.ADMIN).toBe('Administrador');
    expect(NOMBRE_ROL.COORDINADOR).toBe('Coordinador');
    expect(NOMBRE_ROL.TECNICO).toBe('Técnico');
    expect(NOMBRE_ROL.CLIENTE).toBe('Cliente');

    expect(DATA_ROLE.ADMIN).toBe('admin');
    expect(DATA_ROLE.COORDINADOR).toBe('coordinador');
    expect(DATA_ROLE.TECNICO).toBe('tecnico');
    expect(DATA_ROLE.CLIENTE).toBe('cliente');
  });

  it('formatea nombres de estado', () => {
    expect(NOMBRE_ESTADO.REGISTRADA).toBe('Registrada');
    expect(NOMBRE_ESTADO.APROBADA).toBe('Aprobada');
    expect(NOMBRE_ESTADO.EN_PROCESO).toBe('En proceso');
    expect(NOMBRE_ESTADO.RESUELTA).toBe('Resuelta');
  });

  it('formatea duracion en minutos, horas y dias', () => {
    expect(duracion(0.5)).toBe('30 min');
    expect(duracion(1)).toBe('1 h');
    expect(duracion(24)).toBe('24 h');
    expect(duracion(72)).toBe('3 días');
  });

  it('evalua el plazo y tono segun estado_plazo', () => {
    const aTiempo = plazoDe({ estado_plazo: 'A_TIEMPO', horas_restantes: 10 });
    expect(aTiempo.tono).toBe('ok');
    expect(aTiempo.texto).toBe('10 h');

    const porVencer = plazoDe({ estado_plazo: 'POR_VENCER', horas_restantes: 2 });
    expect(porVencer.tono).toBe('alerta');
    expect(porVencer.texto).toContain('Vence en 2 h');

    const vencida = plazoDe({ estado_plazo: 'VENCIDA', horas_restantes: -5 });
    expect(vencida.tono).toBe('error');
    expect(vencida.texto).toContain('Vencida hace 5 h');

    const cumplida = plazoDe({ estado_plazo: 'CUMPLIDA', horas_restantes: 0 });
    expect(cumplida.tono).toBe('ok');
    expect(cumplida.texto).toBe('En plazo');

    const incumplida = plazoDe({ estado_plazo: 'INCUMPLIDA', horas_restantes: -1 });
    expect(incumplida.tono).toBe('error');
    expect(incumplida.texto).toBe('Fuera de plazo');

    const noAplica = plazoDe({ estado_plazo: 'NO_APLICA', horas_restantes: 0 });
    expect(noAplica.tono).toBe('neutro');
    expect(noAplica.texto).toBe('No aplica');
  });

  it('tamanoArchivo formatea en bytes, KB y MB', () => {
    expect(tamanoArchivo(500)).toBe('500 B');
    expect(tamanoArchivo(2048)).toBe('2 KB');
    expect(tamanoArchivo(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('horasPromedio y porcentaje manejan nulos y valores numericos', () => {
    expect(horasPromedio(null)).toBe('—');
    expect(horasPromedio(12.5)).toContain('12');

    expect(porcentaje(null)).toBe('—');
    expect(porcentaje(85.4)).toBe('85%');
  });

  it('fechaISO devuelve formato YYYY-MM-DD', () => {
    const d = new Date(2026, 10, 15); // Noviembre es mes 10 (0-indexed)
    expect(fechaISO(d)).toBe('2026-11-15');
  });

  it('primerNombre extrae el primer token', () => {
    expect(primerNombre('Carlos Andres Mendoza')).toBe('Carlos');
    expect(primerNombre('Maria')).toBe('Maria');
  });
});
