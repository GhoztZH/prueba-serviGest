import Button from '@mui/material/Button';
import { AlertTriangle, CircleAlert, CircleCheck, Inbox, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Meta } from '../types/api';

/** Células y organismos de estructura de pantalla (encabezado, tarjeta, KPI, pestañas, estados). */

export function Encabezado({ titulo, subtitulo, children }: { titulo: ReactNode; subtitulo?: ReactNode; children?: ReactNode }) {
  return (
    <header className="encabezado">
      <div style={{ minWidth: 0 }}>
        <h1 className="titulo-pagina">{titulo}</h1>
        {subtitulo && <p className="tenue">{subtitulo}</p>}
      </div>
      {children && <div className="acciones">{children}</div>}
    </header>
  );
}

export function Tarjeta({ titulo, accion, children, className = '' }: { titulo?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`tarjeta ${className}`}>
      {(titulo || accion) && (
        <div className="tarjeta-cabecera">
          {titulo && <h2 className="titulo-tarjeta">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ rotulo, valor, nota, cargando = false }: { rotulo: string; valor: ReactNode; nota?: ReactNode; cargando?: boolean }) {
  return (
    <div className="tarjeta kpi">
      <div className="etiqueta">{rotulo}</div>
      {cargando ? <div className="esqueleto" style={{ height: 32, width: 80, margin: '4px 0' }} /> : <div className="cifra-grande">{valor}</div>}
      <div className="nota">{nota ?? ' '}</div>
    </div>
  );
}

export interface Pestana<T extends string> {
  valor: T;
  texto: string;
}

export function Pestanas<T extends string>({ opciones, valor, alCambiar, etiqueta }: { opciones: Pestana<T>[]; valor: T; alCambiar: (valor: T) => void; etiqueta: string }) {
  return (
    <div className="pestanas" role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" role="tab" className="pestana" aria-selected={o.valor === valor} onClick={() => alCambiar(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

const ICONO_AVISO = { alerta: AlertTriangle, error: CircleAlert, ok: CircleCheck };

/** Aviso destacado. El tono nunca depende solo del color: lleva icono y título. */
export function Aviso({ tono = 'alerta', titulo, children, accion }: { tono?: 'alerta' | 'error' | 'ok'; titulo: ReactNode; children?: ReactNode; accion?: ReactNode }) {
  const Icono = ICONO_AVISO[tono];
  return (
    <div className={`aviso ${tono === 'alerta' ? '' : tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      <Icono aria-hidden="true" />
      <div className="cuerpo">
        <div className="titulo">{titulo}</div>
        {children && <div>{children}</div>}
      </div>
      {accion}
    </div>
  );
}

// ---- Estados de una pantalla o bloque: cargando, error, vacío ----

export function Cargando({ filas = 4 }: { filas?: number }) {
  return (
    <div className="pila md" style={{ padding: 16 }} role="status" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="esqueleto" style={{ height: 20, width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function EstadoError({ mensaje, alReintentar }: { mensaje: string; alReintentar?: () => void }) {
  return (
    <div className="estado" role="alert">
      <CircleAlert aria-hidden="true" />
      <div className="titulo-tarjeta">No se pudo cargar la información</div>
      <div>{mensaje}</div>
      {alReintentar && (
        <Button variant="outlined" onClick={alReintentar} sx={{ mt: 1 }}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function EstadoVacio({ titulo, children, accion }: { titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="estado">
      <Inbox aria-hidden="true" />
      <div className="titulo-tarjeta">{titulo}</div>
      {children && <div>{children}</div>}
      {accion}
    </div>
  );
}

/**
 * Envoltorio de los tres estados de una consulta. Mientras hay datos previos
 * se siguen mostrando (una recarga en vivo no hace parpadear la pantalla).
 */
export function Contenido<T>({ consulta, children, filas }: { consulta: { datos: T | undefined; cargando: boolean; error: string | null; recargar: () => void }; children: (datos: T) => ReactNode; filas?: number }) {
  if (consulta.datos !== undefined && !consulta.error) return <>{children(consulta.datos)}</>;
  if (consulta.error) return <EstadoError mensaje={consulta.error} alReintentar={consulta.recargar} />;
  return <Cargando filas={filas} />;
}

export function Paginacion({ meta, alCambiar, sustantivo = 'registros' }: { meta: Meta; alCambiar: (pagina: number) => void; sustantivo?: string }) {
  const desde = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const hasta = Math.min(meta.total, meta.page * meta.limit);
  return (
    <div className="pie-tabla">
      <span className="tenue">
        Mostrando {desde}–{hasta} de {meta.total} {sustantivo}
      </span>
      <div className="fila">
        <Button variant="text" disabled={meta.page <= 1} onClick={() => alCambiar(meta.page - 1)}>
          Anterior
        </Button>
        <Button variant="outlined" disabled={meta.page >= meta.totalPages} onClick={() => alCambiar(meta.page + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}

export function Buscador({ valor, alCambiar, placeholder = 'Buscar…', ancho = 260 }: { valor: string; alCambiar: (valor: string) => void; placeholder?: string; ancho?: number }) {
  return (
    <label className="busqueda" style={{ width: ancho, maxWidth: '100%' }}>
      <Search aria-hidden="true" />
      <span className="solo-lectores">{placeholder}</span>
      <input type="search" value={valor} placeholder={placeholder} onChange={(e) => alCambiar(e.target.value)} />
    </label>
  );
}
