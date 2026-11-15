export interface FiltroIndicadores {
  desde: string;
  hasta: string;
  categoriaId?: number;
  prioridadId?: number;
  clienteId?: number;
  tecnicoId?: number;
}

export interface ConteosGenerales {
  total: number;
  abiertas: number;
  resueltas: number;
  cerradas: number;
  canceladas: number;
  a_tiempo: number;
  fuera_de_plazo: number;
  vencidas: number;
  por_vencer: number;
  horas_promedio: number | null;
}

export interface Indicadores {
  filtros: FiltroIndicadores;
  resumen: { total: number; abiertas: number; resueltas: number; cerradas: number; canceladas: number };
  porEstado: Array<{ codigo: string; nombre: string; total: number }>;
  /** Incluye el cumplimiento de plazos de cada prioridad (misma fórmula que el global). */
  porPrioridad: Array<{ codigo: string; nombre: string; total: number; aTiempo: number; fueraDePlazo: number; cumplimiento: number | null }>;
  cargaPorTecnico: Array<{ tecnico_id: number; nombre: string; activas: number; maximo: number; disponible: boolean; resueltas: number }>;
  tiempoResolucion: { global: number | null; porPrioridad: Array<{ codigo: string; nombre: string; horas: number | null; resueltas: number }> };
  cumplimiento: { aTiempo: number; fueraDePlazo: number; porcentaje: number | null };
  vencimientos: { vencidas: number; por_vencer: number; abiertas: number };
  evolucion: Array<{ fecha: string; creadas: number; resueltas: number }>;
}

export interface FilaPrioridad {
  codigo: string;
  nombre: string;
  total: number;
  horas: number | null;
  resueltas: number;
  a_tiempo: number;
  fuera_de_plazo: number;
}

export interface DashboardRepository {
  generales(f: FiltroIndicadores, umbralPct: number): Promise<ConteosGenerales>;
  porEstado(f: FiltroIndicadores): Promise<Indicadores['porEstado']>;
  porPrioridad(f: FiltroIndicadores): Promise<FilaPrioridad[]>;
  cargaPorTecnico(f: FiltroIndicadores): Promise<Indicadores['cargaPorTecnico']>;
  evolucion(f: FiltroIndicadores): Promise<Indicadores['evolucion']>;
}

/**
 * Cumplimiento de plazos (%) = a tiempo / (a tiempo + fuera de plazo) × 100.
 * - a tiempo: solicitudes con resolución registrada dentro de su fecha límite.
 * - fuera de plazo: resueltas después de la fecha límite + abiertas ya vencidas
 *   (una solicitud vencida sin resolver ya incumplió su plazo).
 * Sin solicitudes evaluables no hay porcentaje (null), en lugar de un 0 % o 100 % engañoso.
 */
export function porcentajeCumplimiento(aTiempo: number, fueraDePlazo: number): number | null {
  const evaluables = aTiempo + fueraDePlazo;
  return evaluables === 0 ? null : Math.round((aTiempo / evaluables) * 1000) / 10;
}

export const RANGO_MAXIMO_DIAS = 366;
export const DIAS_POR_DEFECTO = 30;

/** Fecha local (AAAA-MM-DD) de un instante en la zona horaria de operación. */
export function fechaLocal(instante: Date, zonaHoraria: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instante);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}
