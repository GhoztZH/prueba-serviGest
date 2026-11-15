import { User } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CodigoPrioridad, Estado, Solicitud } from '../types/api';
import { NOMBRE_ESTADO, NOMBRE_PRIORIDAD, plazoDe, TONO_ESTADO, type Tono } from '../utils/format';

/** Átomos del sistema de diseño (DS · Átomos en Figma). Solo presentación. */

export function Avatar({ tamano = 'm' }: { tamano?: 's' | 'm' | 'l' | 'xl' }) {
  return (
    <span className={`avatar ${tamano}`} aria-hidden="true">
      <User />
    </span>
  );
}

export function Badge({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`badge ${tono === 'neutro' ? '' : tono}`}>{children}</span>;
}

/** Estado de la solicitud. `paraCliente` usa el lenguaje del cliente ("Falta tu respuesta"). */
export function EstadoBadge({ estado, paraCliente = false }: { estado: Estado; paraCliente?: boolean }) {
  const texto = paraCliente && estado === 'PENDIENTE_INFO' ? 'Falta tu respuesta' : NOMBRE_ESTADO[estado];
  return <Badge tono={TONO_ESTADO[estado]}>{texto}</Badge>;
}

/** Plazo de atención: el estado lo calcula el backend; aquí solo se elige texto y tono. */
export function PlazoBadge({ solicitud }: { solicitud: Pick<Solicitud, 'estado_plazo' | 'horas_restantes'> }) {
  const { texto, tono } = plazoDe(solicitud);
  return <Badge tono={tono}>{texto}</Badge>;
}

export function ActivoBadge({ activo, textoInactivo = 'Inactivo' }: { activo: boolean; textoInactivo?: string }) {
  return <Badge tono={activo ? 'ok' : 'alerta'}>{activo ? 'Activo' : textoInactivo}</Badge>;
}

const BARRAS: Record<CodigoPrioridad, number> = { BAJA: 1, MEDIA: 2, ALTA: 3, CRITICA: 3 };

/** Prioridad por barras: se lee por el número de barras; solo "Crítica" lleva color. */
export function Prioridad({ nivel, sinTexto = false }: { nivel: CodigoPrioridad; sinTexto?: boolean }) {
  return (
    <span className={`prioridad ${nivel === 'CRITICA' ? 'critica' : ''}`}>
      <span className="barras" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <i key={n} className={n <= BARRAS[nivel] ? 'llena' : ''} />
        ))}
      </span>
      {sinTexto ? <span className="solo-lectores">Prioridad {NOMBRE_PRIORIDAD[nivel]}</span> : NOMBRE_PRIORIDAD[nivel]}
    </span>
  );
}

/** Barra de progreso. `tono` cambia a ámbar o rojo cuando el valor exige atención. */
export function Progreso({ valor, maximo, tono, etiqueta }: { valor: number; maximo: number; tono?: 'alerta' | 'error'; etiqueta: string }) {
  const pct = maximo > 0 ? Math.min(100, Math.max(0, (valor / maximo) * 100)) : 0;
  return (
    <div className={`progreso ${tono ?? ''}`} role="progressbar" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={maximo} aria-label={etiqueta}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Fila de carga: 5 segmentos que representan la ocupación del técnico.
 * Color del rol para la carga, ámbar al llegar al límite, gris si está en pausa.
 */
export function Segmentos({ carga, maximo, enPausa = false }: { carga: number; maximo: number; enPausa?: boolean }) {
  const TOTAL = 5;
  const llenos = maximo > 0 ? Math.min(TOTAL, Math.ceil((carga / maximo) * TOTAL)) : 0;
  const estado = enPausa ? 'pausa' : carga >= maximo ? 'limite' : '';
  return (
    <span className={`segmentos ${estado}`} role="img" aria-label={`${carga} de ${maximo} solicitudes activas`}>
      {Array.from({ length: TOTAL }, (_, i) => (
        <i key={i} className={i < llenos ? 'llena' : ''} />
      ))}
    </span>
  );
}

/** Etiqueta de disponibilidad en solo lectura: Disponible / Al límite / En pausa. */
export function DisponibilidadBadge({ disponible, carga, maximo, activo = true }: { disponible: boolean; carga: number; maximo: number; activo?: boolean }) {
  if (!activo) return <Badge tono="alerta">Inactivo</Badge>;
  if (!disponible) return <Badge>En pausa</Badge>;
  if (carga >= maximo) return <Badge tono="alerta">Al límite</Badge>;
  return <Badge tono="ok">Disponible</Badge>;
}

export function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="dato">
      <div className="rotulo">{rotulo}</div>
      <div className="valor">{children}</div>
    </div>
  );
}

export function Par({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="par">
      <span className="tenue">{rotulo}</span>
      <span>{children}</span>
    </div>
  );
}
