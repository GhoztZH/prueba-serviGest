import { describe, expect, it } from 'vitest';
import { agruparEvolucion } from './Graficos';

describe('Graficos.tsx - agruparEvolucion', () => {
  it('devuelve dias individuales si la serie tiene hasta 14 elementos', () => {
    const serie = [
      { fecha: '2026-11-01', creadas: 3, resueltas: 2 },
      { fecha: '2026-11-02', creadas: 1, resueltas: 4 },
    ];
    const resultado = agruparEvolucion(serie);
    expect(resultado).toHaveLength(2);
    expect(resultado[0]?.creadas).toBe(3);
    expect(resultado[0]?.resueltas).toBe(2);
    expect(resultado[1]?.creadas).toBe(1);
    expect(resultado[1]?.resueltas).toBe(4);
  });

  it('agrupa por semanas de 7 dias si la serie excede 14 elementos', () => {
    // 21 dias -> 3 semanas
    const serie = Array.from({ length: 21 }, (_, i) => ({
      fecha: `2026-11-${String(i + 1).padStart(2, '0')}`,
      creadas: 2,
      resueltas: 1,
    }));

    const resultado = agruparEvolucion(serie);
    expect(resultado).toHaveLength(3);
    // Cada semana debe acumular 7 * 2 = 14 creadas y 7 * 1 = 7 resueltas
    expect(resultado[0]?.creadas).toBe(14);
    expect(resultado[0]?.resueltas).toBe(7);
    expect(resultado[1]?.creadas).toBe(14);
    expect(resultado[1]?.resueltas).toBe(7);
    expect(resultado[2]?.creadas).toBe(14);
    expect(resultado[2]?.resueltas).toBe(7);
    expect(resultado[0]?.etiqueta).toContain('Sem.');
  });
});
