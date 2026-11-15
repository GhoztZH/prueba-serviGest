import { EstadoVacio } from '../../../shared/components/layout';
import type { Historial as Entrada } from '../../../shared/types/api';
import { fechaRelativa, formatoFechaHora, NOMBRE_ESTADO, NOMBRE_PRIORIDAD, NOMBRE_ROL } from '../../../shared/utils/format';

/** Título legible de cada entrada del historial inalterable de la solicitud. */
function tituloDe(e: Entrada): string {
  const d = e.detalle ?? {};
  switch (e.accion) {
    case 'CREACION':
      return 'Registrada';
    case 'ASIGNACION':
      return `Asignada a ${String(d.tecnico_nombre ?? 'un técnico')}`;
    case 'REASIGNACION':
      return `Reasignada a ${String(d.tecnico_nombre ?? 'otro técnico')}`;
    case 'COMENTARIO':
      return 'Comentario';
    case 'REAPERTURA':
      return 'Reabierta';
    case 'ADJUNTO':
      return `Archivos adjuntos: ${Array.isArray(d.archivos) ? d.archivos.join(', ') : ''}`;
    case 'CAMBIO_PRIORIDAD': {
      const nombre = (codigo: unknown) => NOMBRE_PRIORIDAD[codigo as keyof typeof NOMBRE_PRIORIDAD] ?? String(codigo);
      return `Prioridad ajustada: ${nombre(d.prioridad_anterior)} → ${nombre(d.prioridad_nueva)}`;
    }
    default:
      if (e.estado_anterior === 'RESUELTA' && e.estado_nuevo === 'EN_PROCESO') return 'Resolución rechazada: vuelve a En proceso';
      return e.estado_nuevo ? NOMBRE_ESTADO[e.estado_nuevo] : 'Cambio de estado';
  }
}

/** Línea de tiempo: lo más reciente arriba. Cada paso muestra quién lo hizo y cuándo. */
export function Historial({ entradas }: { entradas: Entrada[] }) {
  if (!entradas.length) return <EstadoVacio titulo="Sin eventos todavía" />;
  return (
    <ol className="historial">
      {[...entradas].reverse().map((e) => (
        <li key={e.id}>
          <div className="cuerpo-medio">{tituloDe(e)}</div>
          <div className="nota">
            {NOMBRE_ROL[e.usuario_rol]} {e.usuario_nombre} · <time dateTime={e.fecha} title={formatoFechaHora(e.fecha)}>{fechaRelativa(e.fecha)}</time>
          </div>
          {e.comentario && <div className="cita">{e.comentario}</div>}
        </li>
      ))}
    </ol>
  );
}
