import type { EventoSolicitud } from '../../../shared/application/ports';

export interface Notificacion {
  id: number;
  usuario_id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  solicitud_id: number | null;
  solicitud_codigo: string | null;
  leida: boolean;
  created_at: Date;
}

export interface NotificacionNueva {
  usuarioId: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  solicitudId: number | null;
}

/** Cuentas interesadas en una solicitud. Los ids son de `usuarios`. */
export interface Audiencia {
  /** Quien opera la bandeja: coordinadores activos (o administradores si no hay ninguno). */
  operacion: number[];
  /** Toda la gestión (ADMIN + COORDINADOR): reciben la actualización en vivo de sus listados. */
  gestion: number[];
  cliente: number | null;
  tecnico: number | null;
  tecnicoAnterior: number | null;
}

export interface NotificationRepository {
  audiencia(solicitud: { clienteId: number; tecnicoId: number | null; tecnicoAnteriorId?: number | null }): Promise<Audiencia>;
  crear(nuevas: NotificacionNueva[]): Promise<Notificacion[]>;
  listar(usuarioId: number, filtro: { noLeidas?: boolean; limit: number; offset: number }): Promise<{ filas: Notificacion[]; total: number }>;
  contarNoLeidas(usuarioId: number): Promise<number>;
  marcarLeida(id: number, usuarioId: number): Promise<boolean>;
  marcarTodasLeidas(usuarioId: number): Promise<number>;
}

/** Canal de actualización dinámica hacia los navegadores conectados (SSE). */
export interface CanalTiempoReal {
  emitir(usuarioIds: number[], evento: string, datos: unknown): void;
}

type Destino = 'operacion' | 'cliente' | 'tecnico' | 'tecnicoAnterior';
interface Aviso {
  para: Destino[];
  tipo: string;
  titulo: string;
  mensaje: string;
}

const recortar = (texto: string, max = 500) => (texto.length > max ? `${texto.slice(0, max - 1)}…` : texto);

/** Qué avisos genera cada evento de negocio y a quién van dirigidos. */
function avisosDe(e: EventoSolicitud): Aviso[] {
  const ref = `${e.solicitud.codigo} · ${e.solicitud.titulo}`;
  const nota = e.comentario ? ` Motivo: ${e.comentario}` : '';

  switch (e.tipo) {
    case 'REGISTRO':
      return [
        { para: ['operacion'], tipo: 'REGISTRO', titulo: 'Nueva solicitud por aprobar', mensaje: `${ref} fue registrada y espera aprobación.` },
        { para: ['cliente'], tipo: 'REGISTRO', titulo: 'Solicitud registrada', mensaje: `Se registró la solicitud ${ref} a nombre de su empresa.` },
      ];
    case 'ASIGNACION':
      return [
        { para: ['tecnico'], tipo: 'ASIGNACION', titulo: 'Nueva solicitud asignada', mensaje: `Se le asignó ${ref}.` },
        { para: ['cliente'], tipo: 'ASIGNACION', titulo: 'Técnico asignado', mensaje: `Su solicitud ${ref} ya tiene un técnico asignado.` },
      ];
    case 'REASIGNACION':
      return [
        { para: ['tecnico'], tipo: 'REASIGNACION', titulo: 'Solicitud reasignada a usted', mensaje: `Se le reasignó ${ref}.${nota}` },
        { para: ['tecnicoAnterior'], tipo: 'REASIGNACION', titulo: 'Solicitud reasignada', mensaje: `${ref} fue reasignada a otro técnico.${nota}` },
        { para: ['cliente'], tipo: 'REASIGNACION', titulo: 'Cambio de técnico', mensaje: `Su solicitud ${ref} fue reasignada a otro técnico.` },
      ];
    case 'COMENTARIO':
      return [
        {
          // Sin técnico todavía, el comentario lo atiende quien opera la bandeja.
          para: e.solicitud.tecnicoId ? ['cliente', 'tecnico'] : ['cliente', 'operacion'],
          tipo: 'COMENTARIO',
          titulo: 'Nuevo comentario',
          mensaje: `${e.actorNombre} comentó en ${ref}: ${e.comentario ?? ''}`,
        },
      ];
    case 'REAPERTURA':
      return [
        { para: ['cliente', 'tecnico', 'operacion'], tipo: 'REAPERTURA', titulo: 'Solicitud reabierta', mensaje: `${ref} fue reabierta.${nota}` },
      ];
    case 'CAMBIO_ESTADO':
      return avisosDeCambioEstado(e, ref, nota);
    default:
      return []; // ADJUNTO: solo actualización en vivo, sin aviso.
  }
}

function avisosDeCambioEstado(e: EventoSolicitud, ref: string, nota: string): Aviso[] {
  switch (e.solicitud.estado) {
    case 'APROBADA':
      return [{ para: ['cliente'], tipo: 'CAMBIO_ESTADO', titulo: 'Solicitud aprobada', mensaje: `Su solicitud ${ref} fue aprobada y será asignada a un técnico.` }];
    case 'EN_PROCESO':
      if (e.estadoAnterior === 'RESUELTA') {
        return [{ para: ['tecnico', 'operacion'], tipo: 'CAMBIO_ESTADO', titulo: 'Resolución rechazada', mensaje: `La resolución de ${ref} no fue aceptada.${nota}` }];
      }
      return [{ para: ['cliente'], tipo: 'CAMBIO_ESTADO', titulo: 'Solicitud en atención', mensaje: `El técnico está trabajando en ${ref}.` }];
    case 'PENDIENTE_INFO':
      return [{ para: ['cliente'], tipo: 'SOLICITUD_INFO', titulo: 'Se necesita información', mensaje: `El técnico pide información sobre ${ref}: ${e.comentario ?? ''}` }];
    case 'RESUELTA':
      return [
        { para: ['cliente'], tipo: 'RESOLUCION', titulo: 'Solicitud resuelta', mensaje: `${ref} fue resuelta. Revise la solución y confirme el cierre.` },
        { para: ['operacion'], tipo: 'RESOLUCION', titulo: 'Solicitud resuelta', mensaje: `${ref} fue resuelta y espera el cierre.` },
      ];
    case 'CERRADA':
      return [{ para: ['tecnico', 'operacion'], tipo: 'CIERRE', titulo: 'Solicitud cerrada', mensaje: `${ref} fue cerrada.` }];
    case 'CANCELADA':
      return [{ para: ['cliente', 'tecnico', 'operacion'], tipo: 'CANCELACION', titulo: 'Solicitud cancelada', mensaje: `${ref} fue cancelada.${nota}` }];
    default:
      return [];
  }
}

/**
 * Convierte un evento en las notificaciones a persistir. Función pura:
 * nunca se notifica a quien originó el evento y nadie recibe dos avisos por
 * el mismo evento.
 */
export function planificarNotificaciones(evento: EventoSolicitud, audiencia: Audiencia): NotificacionNueva[] {
  const notificados = new Set<number>([evento.actorId]);
  const resultado: NotificacionNueva[] = [];
  for (const aviso of avisosDe(evento)) {
    const destinatarios = aviso.para.flatMap((destino) => {
      const valor = audiencia[destino];
      return Array.isArray(valor) ? valor : valor === null ? [] : [valor];
    });
    for (const usuarioId of destinatarios) {
      if (notificados.has(usuarioId)) continue;
      notificados.add(usuarioId);
      resultado.push({
        usuarioId,
        tipo: aviso.tipo,
        titulo: aviso.titulo,
        mensaje: recortar(aviso.mensaje),
        solicitudId: evento.solicitud.id,
      });
    }
  }
  return resultado;
}

/** Todos los que deben ver refrescada la solicitud en pantalla. */
export function audienciaEnVivo(a: Audiencia): number[] {
  return [...new Set([...a.gestion, a.cliente, a.tecnico, a.tecnicoAnterior].filter((id): id is number => id !== null))];
}
