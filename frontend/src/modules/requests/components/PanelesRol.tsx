import Button from '@mui/material/Button';
import { useState } from 'react';
import { Badge } from '../../../shared/components/atoms';
import { Campo, Confirmacion } from '../../../shared/components/forms';
import { Aviso, Tarjeta } from '../../../shared/components/layout';
import type { Estado, Historial, SolicitudDetalle } from '../../../shared/types/api';
import { cambiarEstado, useOperacion } from '../hooks/useSolicitud';
import { solicitudService } from '../services/solicitud.service';

const MIN_RESOLUCION = 20;

interface PanelProps {
  solicitud: SolicitudDetalle;
  alCambiar: () => void;
}

/**
 * Acciones del técnico (T3). Solo se ofrecen las transiciones que el backend
 * declara permitidas en `acciones.transiciones`; la interfaz no decide permisos.
 */
export function AccionesTecnico({ solicitud, alCambiar }: PanelProps) {
  const { operar, enviando } = useOperacion(alCambiar);
  const [resolucion, setResolucion] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const puede = (estado: Estado) => solicitud.acciones.transiciones.includes(estado);

  if (!solicitud.acciones.transiciones.length) {
    return (
      <Tarjeta titulo="Acciones">
        <p className="tenue">No hay acciones pendientes de tu parte en este estado.</p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Acciones">
      <div className="pila md">
        {solicitud.estado === 'ASIGNADA' && puede('EN_PROCESO') && (
          <Button fullWidth disabled={enviando} onClick={() => void operar(() => cambiarEstado(solicitud, { estado: 'EN_PROCESO' }), 'Atención iniciada')}>
            Iniciar atención
          </Button>
        )}
        {solicitud.estado === 'PENDIENTE_INFO' && puede('EN_PROCESO') && (
          <>
            <p className="tenue">Esperando la respuesta del cliente. Cuando tengas la información, retoma la atención.</p>
            <Button fullWidth disabled={enviando} onClick={() => void operar(() => cambiarEstado(solicitud, { estado: 'EN_PROCESO' }), 'Atención retomada')}>
              Retomar atención
            </Button>
          </>
        )}
        {puede('RESUELTA') && (
          <>
            <Campo
              etiqueta="Descripción de la solución"
              multiline
              minRows={4}
              value={resolucion}
              onChange={(e) => setResolucion(e.target.value)}
              placeholder="Explica qué se hizo para resolver el problema…"
              ayuda={`Mínimo ${MIN_RESOLUCION} caracteres (${resolucion.trim().length}). El cliente verá este texto.`}
            />
            <Button
              fullWidth
              disabled={enviando || resolucion.trim().length < MIN_RESOLUCION}
              onClick={() => void operar(() => cambiarEstado(solicitud, { estado: 'RESUELTA', resolucion: resolucion.trim() }), 'Solicitud marcada como resuelta')}
            >
              Marcar como resuelta
            </Button>
          </>
        )}
        {puede('PENDIENTE_INFO') && (
          <Button variant="outlined" fullWidth disabled={enviando} onClick={() => setPidiendo(true)}>
            Pedir información al cliente
          </Button>
        )}
      </div>
      <Confirmacion
        abierta={pidiendo}
        titulo="Pedir información al cliente"
        textoConfirmar="Enviar pregunta"
        motivo={{ etiqueta: '¿Qué necesitas saber?', minimo: 5, placeholder: 'Ej.: ¿En qué horario podemos ingresar a la sede?' }}
        enviando={enviando}
        alCerrar={() => setPidiendo(false)}
        alConfirmar={(comentario) =>
          void operar(() => cambiarEstado(solicitud, { estado: 'PENDIENTE_INFO', comentario }), 'Pregunta enviada al cliente').then((ok) => ok && setPidiendo(false))
        }
      >
        El cliente recibirá un aviso y la solicitud quedará pendiente de su respuesta.
      </Confirmacion>
    </Tarjeta>
  );
}

const PASOS: Estado[] = ['REGISTRADA', 'APROBADA', 'ASIGNADA', 'EN_PROCESO', 'RESUELTA', 'CERRADA'];
const TEXTO_PASO: Record<string, string> = { REGISTRADA: 'Registrada', APROBADA: 'Aprobada', ASIGNADA: 'Asignada', EN_PROCESO: 'En proceso', RESUELTA: 'Resuelta', CERRADA: 'Cerrada' };

/** Pasos de estado (C3): el cliente ve en qué etapa va su solicitud. */
export function PasosEstado({ estado }: { estado: Estado }) {
  if (estado === 'CANCELADA') return <Badge tono="error">Solicitud cancelada</Badge>;
  const actual = PASOS.indexOf(estado === 'PENDIENTE_INFO' ? 'EN_PROCESO' : estado);
  return (
    <ol className="pasos tarjeta" style={{ listStyle: 'none', margin: '0 0 16px' }} aria-label="Etapas de la solicitud">
      {PASOS.map((paso, i) => (
        <li key={paso} style={{ display: 'contents' }}>
          {i > 0 && <span className={`linea ${i <= actual ? 'hecha' : ''}`} aria-hidden="true" />}
          <span className={`paso ${i <= actual ? 'hecho' : ''} ${i === actual ? 'actual' : ''}`} aria-current={i === actual ? 'step' : undefined}>
            <span className="punto" aria-hidden="true" />
            {TEXTO_PASO[paso]}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Lo que el cliente debe hacer ahora (C3): responder al técnico, confirmar el
 * cierre de una solicitud resuelta o indicar que el problema continúa.
 */
export function AvisosCliente({ solicitud, historial, alCambiar }: PanelProps & { historial: Historial[] }) {
  const { operar, enviando } = useOperacion(alCambiar);
  const [respuesta, setRespuesta] = useState('');
  const [rechazando, setRechazando] = useState(false);
  const puede = (estado: Estado) => solicitud.acciones.transiciones.includes(estado);
  const pregunta = [...historial].reverse().find((h) => h.estado_nuevo === 'PENDIENTE_INFO')?.comentario;

  if (solicitud.estado === 'PENDIENTE_INFO' && solicitud.acciones.puedeComentar) {
    return (
      <Aviso titulo="El técnico necesita más información">
        {pregunta && <p style={{ margin: '4px 0 12px' }}>“{pregunta}”</p>}
        <form
          className="fila"
          style={{ alignItems: 'flex-end' }}
          onSubmit={(e) => {
            e.preventDefault();
            void operar(() => solicitudService.comentar(solicitud.id, respuesta.trim()), 'Respuesta enviada').then((ok) => ok && setRespuesta(''));
          }}
        >
          <Campo etiqueta="Tu respuesta" value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Escribe aquí tu respuesta…" className="crece" style={{ flex: 1, minWidth: 220 }} />
          <Button type="submit" disabled={enviando || respuesta.trim().length < 2}>
            Enviar respuesta
          </Button>
        </form>
      </Aviso>
    );
  }

  if (solicitud.estado === 'RESUELTA' && puede('CERRADA')) {
    return (
      <>
        <Aviso
          tono="ok"
          titulo="Tu solicitud fue resuelta"
          accion={
            <div className="fila">
              <Button variant="outlined" disabled={enviando} onClick={() => setRechazando(true)}>
                El problema continúa
              </Button>
              <Button disabled={enviando} onClick={() => void operar(() => cambiarEstado(solicitud, { estado: 'CERRADA' }), 'Solicitud cerrada. ¡Gracias!')}>
                Confirmar y cerrar
              </Button>
            </div>
          }
        >
          <p style={{ marginTop: 4 }}>“{solicitud.resolucion}”</p>
        </Aviso>
        <Confirmacion
          abierta={rechazando}
          titulo="El problema continúa"
          textoConfirmar="Enviar al técnico"
          motivo={{ etiqueta: '¿Qué sigue fallando?', minimo: 5 }}
          enviando={enviando}
          alCerrar={() => setRechazando(false)}
          alConfirmar={(comentario) =>
            void operar(() => cambiarEstado(solicitud, { estado: 'EN_PROCESO', comentario }), 'La solicitud volvió a atención').then((ok) => ok && setRechazando(false))
          }
        >
          La solicitud volverá al técnico para que la revise de nuevo.
        </Confirmacion>
      </>
    );
  }
  return null;
}

/** Botón "Cancelar solicitud" con motivo obligatorio (cliente dueño o gestión, según permita el backend). */
export function BotonCancelar({ solicitud, alCambiar }: PanelProps) {
  const { operar, enviando } = useOperacion(alCambiar);
  const [abierto, setAbierto] = useState(false);
  if (!solicitud.acciones.transiciones.includes('CANCELADA')) return null;
  return (
    <>
      <Button variant="text" onClick={() => setAbierto(true)}>
        Cancelar solicitud
      </Button>
      <Confirmacion
        abierta={abierto}
        titulo={`Cancelar ${solicitud.codigo}`}
        textoConfirmar="Cancelar solicitud"
        motivo={{ etiqueta: 'Motivo de la cancelación', minimo: 5 }}
        enviando={enviando}
        alCerrar={() => setAbierto(false)}
        alConfirmar={(comentario) => void operar(() => cambiarEstado(solicitud, { estado: 'CANCELADA', comentario }), 'Solicitud cancelada').then((ok) => ok && setAbierto(false))}
      >
        Esta acción no se puede deshacer: una solicitud cancelada ya no admite cambios.
      </Confirmacion>
    </>
  );
}

/** Caja para dejar un comentario en el historial (notas de seguimiento). */
export function CajaComentario({ solicitud, alCambiar }: PanelProps) {
  const { operar, enviando } = useOperacion(alCambiar);
  const [texto, setTexto] = useState('');
  if (!solicitud.acciones.puedeComentar) return null;
  return (
    <form
      className="fila"
      style={{ alignItems: 'flex-end', marginBottom: 16 }}
      onSubmit={(e) => {
        e.preventDefault();
        void operar(() => solicitudService.comentar(solicitud.id, texto.trim()), 'Comentario agregado').then((ok) => ok && setTexto(''));
      }}
    >
      <Campo etiqueta="Agregar un comentario" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nota de seguimiento…" style={{ flex: 1, minWidth: 200 }} />
      <Button type="submit" variant="outlined" disabled={enviando || texto.trim().length < 2}>
        Comentar
      </Button>
    </form>
  );
}
