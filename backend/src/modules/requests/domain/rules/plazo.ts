import { ESTADOS_ABIERTOS, type Estado } from '../../../../shared/domain/estados';
import type { EstadoPlazo } from '../entities/solicitud';

const MS_HORA = 3_600_000;

/**
 * Regla 6: los plazos se calculan en el backend.
 * fecha límite = instante de partida + horas de plazo (SLA) de la prioridad.
 */
export function calcularFechaLimite(desde: Date, horasPlazo: number): Date {
  return new Date(desde.getTime() + horasPlazo * MS_HORA);
}

export interface DatosPlazo {
  estado: Estado;
  fecha_limite: Date;
  fecha_resolucion: Date | null;
  horas_plazo: number;
}

/**
 * Estado del plazo de una solicitud:
 * - CANCELADA                     → NO_APLICA
 * - con resolución (RESUELTA/CERRADA) → CUMPLIDA si se resolvió dentro del plazo; si no, INCUMPLIDA
 * - abierta y fuera de plazo      → VENCIDA
 * - abierta y le queda ≤ umbral % del plazo de su prioridad → POR_VENCER
 * - abierta en otro caso          → A_TIEMPO
 *
 * `horas_restantes` es negativa cuando la solicitud abierta ya venció y 0 cuando el plazo ya no corre.
 */
export function calcularEstadoPlazo(
  s: DatosPlazo,
  ahora: Date,
  umbralPorVencerPct: number,
): { estado_plazo: EstadoPlazo; horas_restantes: number } {
  if (s.estado === 'CANCELADA') return { estado_plazo: 'NO_APLICA', horas_restantes: 0 };

  if (!ESTADOS_ABIERTOS.includes(s.estado)) {
    const resueltaEn = s.fecha_resolucion ?? ahora;
    return {
      estado_plazo: resueltaEn.getTime() <= s.fecha_limite.getTime() ? 'CUMPLIDA' : 'INCUMPLIDA',
      horas_restantes: 0,
    };
  }

  const restanteMs = s.fecha_limite.getTime() - ahora.getTime();
  const horas_restantes = Math.round((restanteMs / MS_HORA) * 10) / 10;
  if (restanteMs < 0) return { estado_plazo: 'VENCIDA', horas_restantes };
  const umbralMs = s.horas_plazo * MS_HORA * (umbralPorVencerPct / 100);
  return { estado_plazo: restanteMs <= umbralMs ? 'POR_VENCER' : 'A_TIEMPO', horas_restantes };
}
