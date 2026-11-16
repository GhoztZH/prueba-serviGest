import type { CodigoPrioridad, Estado, EstadoPlazo, Rol, Solicitud } from '../types/api';

/**
 * Textos y formatos de presentación. Aquí NO hay reglas de negocio: el estado
 * del plazo, las horas restantes y las acciones permitidas llegan calculados
 * del backend; el frontend solo decide cómo mostrarlos.
 */
export type Tono = 'neutro' | 'rol' | 'ok' | 'alerta' | 'error';

export const NOMBRE_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  COORDINADOR: 'Coordinador',
  TECNICO: 'Técnico',
  CLIENTE: 'Cliente',
};

/** Valor de `data-role` (docs/design/tokens.css) que fija el color de identidad del rol. */
export const DATA_ROLE: Record<Rol, string> = {
  ADMIN: 'admin',
  COORDINADOR: 'coordinador',
  TECNICO: 'tecnico',
  CLIENTE: 'cliente',
};

export const ESTADOS: Estado[] = ['REGISTRADA', 'APROBADA', 'ASIGNADA', 'EN_PROCESO', 'PENDIENTE_INFO', 'RESUELTA', 'CERRADA', 'CANCELADA'];

export const NOMBRE_ESTADO: Record<Estado, string> = {
  REGISTRADA: 'Registrada',
  APROBADA: 'Aprobada',
  ASIGNADA: 'Asignada',
  EN_PROCESO: 'En proceso',
  PENDIENTE_INFO: 'Pendiente de información',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
  CANCELADA: 'Cancelada',
};

export const ESTADO_CORTO: Record<Estado, string> = {
  REGISTRADA: 'Registr.',
  APROBADA: 'Aprob.',
  ASIGNADA: 'Asign.',
  EN_PROCESO: 'Proceso',
  PENDIENTE_INFO: 'Pend. info',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
  CANCELADA: 'Cancel.',
};

/** El color de estado solo marca estados: verde = correcto, ámbar = requiere atención, rojo = error. */
export const TONO_ESTADO: Record<Estado, Tono> = {
  REGISTRADA: 'neutro',
  APROBADA: 'neutro',
  ASIGNADA: 'neutro',
  EN_PROCESO: 'rol',
  PENDIENTE_INFO: 'alerta',
  RESUELTA: 'ok',
  CERRADA: 'neutro',
  CANCELADA: 'error',
};

export const PRIORIDADES: CodigoPrioridad[] = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
export const NOMBRE_PRIORIDAD: Record<CodigoPrioridad, string> = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta', CRITICA: 'Crítica' };

const fechaHora = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const soloFecha = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
const soloHora = new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit' });
const diaMes = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: '2-digit' });

export const formatoFechaHora = (iso: string) => fechaHora.format(new Date(iso));
export const formatoFecha = (iso: string) => soloFecha.format(new Date(iso));
export const formatoDiaMes = (fecha: string) => diaMes.format(new Date(`${fecha}T12:00:00`));

/** "Hace 10 min", "Hoy 09:40", "Ayer 15:20", "Hace 3 días" o la fecha completa. */
export function fechaRelativa(iso: string, ahora = new Date()): string {
  const fecha = new Date(iso);
  const minutos = Math.round((ahora.getTime() - fecha.getTime()) / 60_000);
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `Hace ${minutos} min`;
  const dias = diasDeCalendario(fecha, ahora);
  if (dias === 0) return `Hoy ${soloHora.format(fecha)}`;
  if (dias === 1) return `Ayer ${soloHora.format(fecha)}`;
  if (dias < 7) return `Hace ${dias} días`;
  return soloFecha.format(fecha);
}

function diasDeCalendario(desde: Date, hasta: Date): number {
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((inicio(hasta) - inicio(desde)) / 86_400_000);
}

/** 1.4 → "1 h", 30 → "30 h", 72 → "3 días". */
export function duracion(horas: number): string {
  const h = Math.abs(horas);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} días`;
}

/** Etiqueta y tono del plazo, a partir del `estado_plazo` que calcula el backend. */
export function plazoDe(s: Pick<Solicitud, 'estado_plazo' | 'horas_restantes'>): { texto: string; tono: Tono } {
  const mapa: Record<EstadoPlazo, { texto: string; tono: Tono }> = {
    A_TIEMPO: { texto: duracion(s.horas_restantes), tono: 'ok' },
    POR_VENCER: { texto: `Vence en ${duracion(s.horas_restantes)}`, tono: 'alerta' },
    VENCIDA: { texto: `Vencida hace ${duracion(s.horas_restantes)}`, tono: 'error' },
    CUMPLIDA: { texto: 'En plazo', tono: 'ok' },
    INCUMPLIDA: { texto: 'Fuera de plazo', tono: 'error' },
    NO_APLICA: { texto: 'No aplica', tono: 'neutro' },
  };
  return mapa[s.estado_plazo];
}

export function tamanoArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 25.7 → "25,7 h"; null → "—". */
export function horasPromedio(horas: number | null): string {
  return horas === null ? '—' : `${horas.toLocaleString('es-EC', { maximumFractionDigits: 1 })} h`;
}

export const porcentaje = (valor: number | null) => (valor === null ? '—' : `${Math.round(valor)}%`);

/** Fecha local AAAA-MM-DD (para los filtros de período). */
export function fechaISO(fecha: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}
