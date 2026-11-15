import { useParams } from 'react-router-dom';
import { useUsuario } from '../../../app/providers/AuthProvider';
import { Avatar, Badge, Dato, EstadoBadge, Prioridad, Progreso } from '../../../shared/components/atoms';
import { Aviso, Cargando, Contenido, Encabezado, EstadoError, Tarjeta } from '../../../shared/components/layout';
import { useMiga } from '../../../shared/layouts/AppLayout';
import type { SolicitudDetalle } from '../../../shared/types/api';
import { fechaRelativa, formatoFechaHora, NOMBRE_PRIORIDAD, plazoDe } from '../../../shared/utils/format';
import { PanelDecision } from '../../assignments/components/PanelDecision';
import { Adjuntos } from '../components/Adjuntos';
import { Historial } from '../components/Historial';
import { AccionesTecnico, AvisosCliente, BotonCancelar, CajaComentario, PasosEstado } from '../components/PanelesRol';
import { useSolicitud } from '../hooks/useSolicitud';

const TONO_TEXTO = { ok: 'texto-ok', alerta: 'texto-alerta', error: 'texto-error', neutro: 'tenue', rol: '' } as const;

/** Plazo de atención: el estado y las horas restantes vienen calculados del backend. */
function TarjetaPlazo({ s }: { s: SolicitudDetalle }) {
  const plazo = plazoDe(s);
  const abierta = ['A_TIEMPO', 'POR_VENCER', 'VENCIDA'].includes(s.estado_plazo);
  const consumido = Math.min(s.horas_plazo, Math.max(0, s.horas_plazo - s.horas_restantes));
  const titulo = s.estado_plazo === 'A_TIEMPO' ? `Quedan ${plazo.texto}` : plazo.texto;
  return (
    <Tarjeta titulo="Plazo de atención">
      <div className={`titulo-seccion ${TONO_TEXTO[plazo.tono]}`} style={{ marginBottom: 8 }}>
        {titulo}
      </div>
      {abierta && <Progreso valor={consumido} maximo={s.horas_plazo} tono={plazo.tono === 'error' ? 'error' : plazo.tono === 'alerta' ? 'alerta' : undefined} etiqueta="Tiempo de plazo consumido" />}
      <p className="nota" style={{ marginTop: 8 }}>
        {s.estado_plazo === 'NO_APLICA' ? 'La solicitud fue cancelada.' : `Fecha límite: ${formatoFechaHora(s.fecha_limite)} · Prioridad ${NOMBRE_PRIORIDAD[s.prioridad]} (${s.horas_plazo} h)`}
      </p>
    </Tarjeta>
  );
}

function TarjetaTecnico({ s }: { s: SolicitudDetalle }) {
  return (
    <Tarjeta titulo="Técnico asignado">
      {s.tecnico_nombre ? (
        <div className="fila" style={{ gap: 12 }}>
          <Avatar tamano="l" />
          <div>
            <div className="titulo-tarjeta">{s.tecnico_nombre}</div>
            <div className="nota">Asignado {fechaRelativa(s.asignaciones.find((a) => a.activa)?.fecha_asignacion ?? s.created_at).toLowerCase()}</div>
          </div>
        </div>
      ) : (
        <p className="tenue">Aún no se ha asignado un técnico.</p>
      )}
    </Tarjeta>
  );
}

/**
 * Detalle de una solicitud. Una sola pantalla para los cuatro roles:
 * la columna izquierda (datos, adjuntos, historial) es común y la derecha
 * cambia según el rol:
 *  - Coordinador (CO3): decisión, técnicos sugeridos y seguimiento.
 *  - Técnico (T3): plazo y acciones de atención.
 *  - Cliente (C3): etapas, avisos de lo que debe hacer y técnico asignado.
 *  - Administrador (A2): solo consulta.
 * Qué botones aparecen lo decide `acciones`, que calcula el backend.
 */
export function SolicitudDetallePage() {
  const id = Number(useParams().id);
  const usuario = useUsuario();
  const { detalle, historial, recargar } = useSolicitud(id);
  const s = detalle.datos;
  useMiga(s?.codigo);

  if (!s) return detalle.error ? <EstadoError mensaje={detalle.error} alReintentar={detalle.recargar} /> : <Cargando filas={6} />;
  const { rol } = usuario;

  return (
    <>
      <Encabezado titulo={`${s.codigo} · ${s.titulo}`} subtitulo={`Registrada ${fechaRelativa(s.created_at).toLowerCase()} · ${s.cliente_nombre} · Sede ${s.sede_nombre}`}>
        <Prioridad nivel={s.prioridad} />
        <EstadoBadge estado={s.estado} paraCliente={rol === 'CLIENTE'} />
        <Badge>{s.categoria_nombre}</Badge>
        {rol === 'CLIENTE' && <BotonCancelar solicitud={s} alCambiar={recargar} />}
      </Encabezado>

      {rol === 'CLIENTE' && (
        <>
          <PasosEstado estado={s.estado} />
          <AvisosCliente solicitud={s} historial={historial.datos ?? []} alCambiar={recargar} />
        </>
      )}
      {rol === 'ADMIN' && (
        <Aviso tono="ok" titulo="Vista de consulta">
          La aprobación, la asignación y el seguimiento de las solicitudes los realiza el Coordinador.
        </Aviso>
      )}

      <div className="dos-columnas">
        <div className="pila">
          <Tarjeta titulo="Detalle de la solicitud">
            <div className="definiciones" style={{ marginBottom: 12 }}>
              <Dato rotulo="Cliente">{s.cliente_nombre}</Dato>
              <Dato rotulo="Sede">{s.sede_nombre}</Dato>
              <Dato rotulo="Categoría">{s.categoria_nombre}</Dato>
              <Dato rotulo="Equipo">{s.equipo_afectado}</Dato>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: 12 }}>{s.descripcion}</p>
            {s.prioridad !== s.prioridad_solicitada && <p className="nota">Prioridad solicitada por el cliente: {NOMBRE_PRIORIDAD[s.prioridad_solicitada]}.</p>}
            <Adjuntos solicitudId={s.id} adjuntos={s.adjuntos} puedeAdjuntar={s.acciones.puedeAdjuntar && rol !== 'ADMIN'} alCambiar={recargar} />
          </Tarjeta>

          {s.resolucion && (
            <Tarjeta titulo="Resolución">
              <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.resolucion}</p>
              {s.fecha_resolucion && <p className="nota" style={{ marginTop: 8 }}>Resuelta el {formatoFechaHora(s.fecha_resolucion)}</p>}
            </Tarjeta>
          )}

          <Tarjeta titulo="Historial">
            {/* El cliente con una pregunta pendiente responde desde el aviso superior, no aquí. */}
            {rol !== 'ADMIN' && !(rol === 'CLIENTE' && s.estado === 'PENDIENTE_INFO') && <CajaComentario solicitud={s} alCambiar={recargar} />}
            <Contenido consulta={historial}>{(entradas) => <Historial entradas={entradas} />}</Contenido>
          </Tarjeta>
        </div>

        <div className="pila">
          {rol === 'COORDINADOR' && <PanelDecision solicitud={s} alCambiar={recargar} />}
          <TarjetaPlazo s={s} />
          {rol === 'TECNICO' && <AccionesTecnico solicitud={s} alCambiar={recargar} />}
          {rol !== 'TECNICO' && <TarjetaTecnico s={s} />}
        </div>
      </div>
    </>
  );
}
