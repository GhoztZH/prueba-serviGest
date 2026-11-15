import type { Clock, EventosSolicitud, HistorialSolicitudes, ParametrosOperativos } from '../../../../shared/application/ports';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work';
import type { AuthUser } from '../../../../shared/domain/auth-user';
import type { Estado } from '../../../../shared/domain/estados';
import type { Adjunto, Solicitud, SolicitudVista } from '../../domain/entities/solicitud';
import type { AsignacionVista, SolicitudRepository } from '../../domain/interfaces/solicitud.repository';
import { calcularEstadoPlazo } from '../../domain/rules/plazo';

/** Dependencias comunes de los casos de uso de solicitudes. */
export interface SolicitudDeps {
  repo: SolicitudRepository;
  historial: HistorialSolicitudes;
  eventos: EventosSolicitud;
  parametros: ParametrosOperativos;
  uow: UnitOfWork;
  clock: Clock;
}

export const UMBRAL_POR_DEFECTO = 25;

export function umbralPorVencer(parametros: ParametrosOperativos): Promise<number> {
  return parametros.numero('UMBRAL_POR_VENCER_PCT', UMBRAL_POR_DEFECTO);
}

export function aVista(s: Solicitud, ahora: Date, umbralPct: number): SolicitudVista {
  return { ...s, ...calcularEstadoPlazo(s, ahora, umbralPct) };
}

export interface AccionesSolicitud {
  transiciones: Estado[];
  puedeAsignar: boolean;
  puedeReabrir: boolean;
  puedeComentar: boolean;
  puedeAdjuntar: boolean;
}

export interface SolicitudDetalle extends SolicitudVista {
  adjuntos: Adjunto[];
  asignaciones: AsignacionVista[];
  acciones: AccionesSolicitud;
}

/** Datos mínimos de la solicitud que viajan en un evento de negocio. */
export function resumenEvento(s: Solicitud) {
  return { id: s.id, codigo: s.codigo, titulo: s.titulo, clienteId: s.cliente_id, tecnicoId: s.tecnico_id, estado: s.estado };
}

export type Actor = Pick<AuthUser, 'id' | 'nombre'>;
