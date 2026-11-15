import Button from '@mui/material/Button';
import { useEffect, useState } from 'react';
import { Avatar, Progreso } from '../../../shared/components/atoms';
import { Campo, Confirmacion, Selector } from '../../../shared/components/forms';
import { Contenido, EstadoVacio, Tarjeta } from '../../../shared/components/layout';
import { ApiError } from '../../../shared/http/client';
import { useConsulta } from '../../../shared/hooks/hooks';
import type { CandidatoSugerido, SolicitudDetalle } from '../../../shared/types/api';
import { catalogService } from '../../catalogs/services/catalog.service';
import { cambiarEstado, useOperacion } from '../../requests/hooks/useSolicitud';
import { solicitudService } from '../../requests/services/solicitud.service';
import { asignacionService } from '../services/asignacion.service';

/**
 * Lista de técnicos sugeridos. La elegibilidad (especialidad, disponibilidad,
 * carga) la calcula el backend: aquí solo se muestra y se impide elegir a quien
 * no puede recibir la solicitud, explicando el motivo.
 */
function TecnicosSugeridos({ candidatos, elegido, alElegir }: { candidatos: CandidatoSugerido[]; elegido: number | null; alElegir: (id: number) => void }) {
  if (!candidatos.length) return <EstadoVacio titulo="No hay técnicos con la especialidad requerida">El administrador puede asignar la especialidad a un técnico.</EstadoVacio>;
  return (
    <div className="pila md" role="radiogroup" aria-label="Técnicos sugeridos">
      {candidatos.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={elegido === c.id}
          aria-disabled={!c.elegible}
          className={`tarjeta seleccionable ${elegido === c.id ? 'elegida' : ''} ${c.elegible ? '' : 'deshabilitada'}`}
          style={{ padding: 12 }}
          onClick={() => c.elegible && alElegir(c.id)}
        >
          <span className="fila" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 12 }}>
            <span className={`radio ${elegido === c.id ? 'elegido' : ''}`} style={{ marginTop: 8 }} aria-hidden="true" />
            <Avatar />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="titulo-tarjeta" style={{ display: 'block' }}>
                {c.nombre}
              </span>
              <span className="nota" style={{ display: 'block', marginBottom: 6 }}>
                {c.elegible ? `${c.carga_actual} de ${c.max_solicitudes_activas} activas` : c.motivos.join(' · ')}
              </span>
              {c.elegible && (
                <Progreso valor={c.carga_actual} maximo={c.max_solicitudes_activas} tono={c.carga_actual / c.max_solicitudes_activas >= 0.8 ? 'alerta' : undefined} etiqueta={`Carga de ${c.nombre}`} />
              )}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Panel del Coordinador (CO3 · Revisar y asignar).
 *
 * Flujo: REGISTRADA → decide (aprueba, con ajuste opcional de prioridad, o
 * rechaza con motivo) → elige un técnico sugerido → la solicitud queda ASIGNADA.
 * "Aprobar y asignar" son dos operaciones de la API encadenadas; si la
 * asignación falla, la aprobación ya quedó hecha y se informa el motivo.
 */
export function PanelDecision({ solicitud, alCambiar }: { solicitud: SolicitudDetalle; alCambiar: () => void }) {
  const { operar, enviando } = useOperacion(alCambiar);
  const { estado, acciones } = solicitud;
  const esReasignacion = acciones.puedeAsignar && estado !== 'APROBADA';
  const muestraSugeridos = estado === 'REGISTRADA' || acciones.puedeAsignar;

  const sugeridos = useConsulta(() => (muestraSugeridos ? asignacionService.sugeridos(solicitud.id) : Promise.resolve([])), [solicitud.id, solicitud.version]);
  const prioridades = useConsulta(() => catalogService.prioridades(), []);
  const [tecnico, setTecnico] = useState<number | null>(null);
  const [prioridad, setPrioridad] = useState(solicitud.prioridad_id);
  const [motivo, setMotivo] = useState('');
  const [dialogo, setDialogo] = useState<'cancelar' | 'rechazar-resolucion' | 'reabrir' | null>(null);

  // Si el técnico elegido deja de ser elegible (cambió su carga en vivo), se quita la selección.
  useEffect(() => {
    if (tecnico && !sugeridos.datos?.some((c) => c.id === tecnico && c.elegible)) setTecnico(null);
  }, [sugeridos.datos, tecnico]);
  useEffect(() => setPrioridad(solicitud.prioridad_id), [solicitud.prioridad_id]);

  const aprobar = () =>
    operar(async () => {
      await cambiarEstado(solicitud, { estado: 'APROBADA', prioridad_id: prioridad });
      if (!tecnico) return;
      try {
        await asignacionService.asignar(solicitud.id, tecnico);
      } catch (e) {
        const detalle = e instanceof ApiError && e.motivos.length ? e.motivos.join('; ') : (e as Error).message;
        throw new Error(`La solicitud se aprobó, pero no se pudo asignar: ${detalle}`);
      }
    }, tecnico ? 'Solicitud aprobada y asignada' : 'Solicitud aprobada');

  const asignar = () =>
    operar(async () => {
      try {
        await asignacionService.asignar(solicitud.id, tecnico!, esReasignacion ? motivo.trim() : undefined);
      } catch (e) {
        // El backend explica por qué el técnico no cumple (especialidad, disponibilidad, carga).
        if (e instanceof ApiError && e.motivos.length) throw new Error(e.motivos.join('; '));
        throw e;
      }
    }, esReasignacion ? 'Solicitud reasignada' : 'Técnico asignado').then((ok) => ok && setMotivo(''));

  const cerrarDialogo = (ok: boolean) => ok && setDialogo(null);
  const puede = (e: (typeof acciones.transiciones)[number]) => acciones.transiciones.includes(e);

  return (
    <>
      {estado === 'REGISTRADA' && (
        <Tarjeta titulo="Decisión">
          <div className="pila md">
            <Selector
              etiqueta="Prioridad"
              value={prioridad}
              onChange={(e) => setPrioridad(Number(e.target.value))}
              opciones={(prioridades.datos ?? []).map((p) => ({ valor: p.id, texto: `${p.nombre} · plazo de ${p.horas_plazo} horas` }))}
              ayuda={prioridad !== solicitud.prioridad_id ? 'Al cambiar la prioridad se recalcula la fecha límite.' : undefined}
            />
            <Campo etiqueta="Motivo del rechazo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Obligatorio solo si rechazas" />
            <div className="fila" style={{ flexWrap: 'nowrap' }}>
              <Button
                variant="outlined"
                fullWidth
                disabled={enviando || motivo.trim().length < 5}
                onClick={() => void operar(() => cambiarEstado(solicitud, { estado: 'CANCELADA', comentario: motivo.trim() }), 'Solicitud rechazada')}
              >
                Rechazar
              </Button>
              <Button fullWidth disabled={enviando} onClick={() => void aprobar()}>
                {tecnico ? 'Aprobar y asignar' : 'Aprobar'}
              </Button>
            </div>
            {!tecnico && <p className="nota">Elige un técnico sugerido para aprobar y asignar en un solo paso.</p>}
          </div>
        </Tarjeta>
      )}

      {muestraSugeridos && (
        <Tarjeta titulo={esReasignacion ? 'Reasignar técnico' : 'Técnicos sugeridos'} accion={<span className="nota">Por especialidad y carga</span>}>
          <div className="pila md">
            <Contenido consulta={sugeridos} filas={3}>
              {(candidatos) => <TecnicosSugeridos candidatos={candidatos} elegido={tecnico} alElegir={setTecnico} />}
            </Contenido>
            {acciones.puedeAsignar && (
              <>
                {esReasignacion && (
                  <Campo etiqueta="Motivo de la reasignación" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: vacaciones del técnico actual" ayuda="Obligatorio, mínimo 10 caracteres" />
                )}
                <Button fullWidth variant={esReasignacion ? 'outlined' : 'contained'} disabled={enviando || !tecnico || (esReasignacion && motivo.trim().length < 10)} onClick={() => void asignar()}>
                  {esReasignacion ? 'Reasignar' : 'Asignar técnico'}
                </Button>
              </>
            )}
          </div>
        </Tarjeta>
      )}

      {(puede('CERRADA') || acciones.puedeReabrir || (estado !== 'REGISTRADA' && puede('CANCELADA'))) && (
        <Tarjeta titulo="Seguimiento">
          <div className="pila md">
            {puede('CERRADA') && (
              <>
                <Button fullWidth disabled={enviando} onClick={() => void operar(() => cambiarEstado(solicitud, { estado: 'CERRADA' }), 'Solicitud cerrada')}>
                  Cerrar solicitud
                </Button>
                <Button fullWidth variant="outlined" disabled={enviando} onClick={() => setDialogo('rechazar-resolucion')}>
                  Rechazar la resolución
                </Button>
              </>
            )}
            {acciones.puedeReabrir && (
              <Button fullWidth variant="outlined" disabled={enviando} onClick={() => setDialogo('reabrir')}>
                Reabrir solicitud
              </Button>
            )}
            {estado !== 'REGISTRADA' && puede('CANCELADA') && (
              <Button fullWidth variant="text" disabled={enviando} onClick={() => setDialogo('cancelar')}>
                Cancelar solicitud
              </Button>
            )}
          </div>
        </Tarjeta>
      )}

      <Confirmacion
        abierta={dialogo === 'cancelar'}
        titulo={`Cancelar ${solicitud.codigo}`}
        textoConfirmar="Cancelar solicitud"
        motivo={{ etiqueta: 'Motivo de la cancelación', minimo: 5 }}
        enviando={enviando}
        alCerrar={() => setDialogo(null)}
        alConfirmar={(comentario) => void operar(() => cambiarEstado(solicitud, { estado: 'CANCELADA', comentario }), 'Solicitud cancelada').then(cerrarDialogo)}
      >
        Una solicitud cancelada ya no admite cambios.
      </Confirmacion>
      <Confirmacion
        abierta={dialogo === 'rechazar-resolucion'}
        titulo="Rechazar la resolución"
        textoConfirmar="Devolver al técnico"
        motivo={{ etiqueta: '¿Por qué no se acepta?', minimo: 5 }}
        enviando={enviando}
        alCerrar={() => setDialogo(null)}
        alConfirmar={(comentario) => void operar(() => cambiarEstado(solicitud, { estado: 'EN_PROCESO', comentario }), 'La solicitud volvió a atención').then(cerrarDialogo)}
      >
        La solicitud vuelve a “En proceso” y el técnico recibe un aviso.
      </Confirmacion>
      <Confirmacion
        abierta={dialogo === 'reabrir'}
        titulo={`Reabrir ${solicitud.codigo}`}
        textoConfirmar="Reabrir"
        motivo={{ etiqueta: 'Motivo de la reapertura', minimo: 10 }}
        enviando={enviando}
        alCerrar={() => setDialogo(null)}
        alConfirmar={(m) => void operar(() => solicitudService.reabrir(solicitud.id, m), 'Solicitud reabierta').then(cerrarDialogo)}
      >
        La reapertura queda registrada en el historial con tu usuario y el motivo. El plazo de atención se reinicia.
      </Confirmacion>
    </>
  );
}
