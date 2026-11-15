import Button from '@mui/material/Button';
import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApariencia } from '../../../app/providers/AparienciaProvider';
import { useUsuario } from '../../../app/providers/AuthProvider';
import { useAvisos } from '../../../app/providers/AvisosProvider';
import { Prioridad } from '../../../shared/components/atoms';
import { Campo, camposDe, mensajeGeneral, Selector } from '../../../shared/components/forms';
import { Aviso, Encabezado, Tarjeta } from '../../../shared/components/layout';
import { ApiError } from '../../../shared/http/client';
import { useAccion, useConsulta } from '../../../shared/hooks/hooks';
import { tamanoArchivo } from '../../../shared/utils/format';
import { catalogService } from '../../catalogs/services/catalog.service';
import { clientService } from '../../clients/services/client.service';
import { MAXIMO_ARCHIVOS, motivoRechazo, ZonaArchivos } from '../components/Adjuntos';
import { solicitudService } from '../services/solicitud.service';

const VACIO = { cliente_id: '', sede_id: '', categoria_id: '', prioridad_id: '', titulo: '', descripcion: '', equipo_afectado: '' };

/**
 * Registro de una solicitud (C2).
 * El cliente registra para su propia empresa; el Coordinador puede registrar
 * a nombre de un cliente y por eso ve además el selector de cliente.
 * Sede, categoría y prioridad se ELIGEN de lo registrado (nunca texto libre).
 * La fecha límite no se pide: la calcula el backend según la prioridad.
 */
export function NuevaSolicitudPage() {
  const usuario = useUsuario();
  const avisos = useAvisos();
  const navegar = useNavigate();
  const { preferencias } = useApariencia();
  const esCliente = usuario.rol === 'CLIENTE';
  const [f, setF] = useState(VACIO);
  const [archivos, setArchivos] = useState<File[]>([]);
  const clienteId = esCliente ? usuario.clienteId : f.cliente_id ? Number(f.cliente_id) : null;

  const clientes = useConsulta(() => (esCliente ? Promise.resolve(null) : clientService.listar({ activo: true, limit: 100 })), [esCliente]);
  const sedes = useConsulta(() => (clienteId ? clientService.sedes(clienteId) : Promise.resolve([])), [clienteId]);
  const categorias = useConsulta(() => catalogService.categorias(true), []);
  const prioridades = useConsulta(() => catalogService.prioridades(), []);
  const { ejecutar, enviando, error } = useAccion(solicitudService.crear);
  const campos = camposDe(error);
  const duplicada = error instanceof ApiError && error.status === 409 ? (error.details as { solicitud_id?: number } | undefined) : undefined;

  const cambiar = (clave: keyof typeof VACIO) => (e: { target: { value: unknown } }) => setF((actual) => ({ ...actual, [clave]: String(e.target.value) }));
  const sedesActivas = (sedes.datos ?? []).filter((s) => s.activo);

  // Dato ya conocido: se precarga la sede (la predeterminada del usuario o la única que tenga).
  useEffect(() => {
    if (f.sede_id || !sedesActivas.length) return;
    const preferida = sedesActivas.find((s) => s.id === preferencias.sedePredeterminada) ?? (sedesActivas.length === 1 ? sedesActivas[0] : undefined);
    if (preferida) setF((actual) => ({ ...actual, sede_id: String(preferida.id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedes.datos]);

  const agregar = (nuevos: File[]) => {
    const rechazo = nuevos.map(motivoRechazo).find(Boolean);
    if (rechazo) return avisos.error(rechazo);
    if (archivos.length + nuevos.length > MAXIMO_ARCHIVOS) return avisos.error(`Puedes adjuntar hasta ${MAXIMO_ARCHIVOS} archivos`);
    setArchivos((actual) => [...actual, ...nuevos]);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const resultado = await ejecutar(
      {
        cliente_id: esCliente ? undefined : Number(f.cliente_id) || undefined,
        sede_id: Number(f.sede_id),
        categoria_id: Number(f.categoria_id),
        prioridad_id: Number(f.prioridad_id),
        titulo: f.titulo,
        descripcion: f.descripcion,
        equipo_afectado: f.equipo_afectado,
      },
      archivos,
    );
    if (resultado.ok) {
      avisos.exito(`Solicitud ${resultado.valor.codigo} registrada`);
      navegar(`/solicitudes/${resultado.valor.id}`);
    }
  };

  return (
    <>
      <Encabezado titulo="Nueva solicitud" subtitulo={esCliente ? 'Cuéntanos qué necesitas y te avisaremos de cada avance' : 'Registro de una solicitud a nombre de un cliente'} />
      <div className="dos-columnas">
        <form className="tarjeta pila" onSubmit={enviar} noValidate>
          {duplicada?.solicitud_id ? (
            <Aviso
              titulo="Ya existe una solicitud abierta para ese equipo"
              accion={
                <Button variant="outlined" component={Link} to={`/solicitudes/${duplicada.solicitud_id}`}>
                  Ver solicitud
                </Button>
              }
            >
              {(error as Error).message}. Puedes agregar un comentario en ella en lugar de registrar otra.
            </Aviso>
          ) : (
            mensajeGeneral(error) && <Aviso tono="error" titulo={mensajeGeneral(error)} />
          )}

          <div className="campos">
            {!esCliente && (
              <Selector
                className="ancho"
                etiqueta="Cliente"
                value={f.cliente_id}
                onChange={(e) => setF((actual) => ({ ...actual, cliente_id: String(e.target.value), sede_id: '' }))}
                opciones={(clientes.datos?.data ?? []).map((c) => ({ valor: c.id, texto: c.razon_social }))}
                vacio="Elige el cliente"
                error={campos.cliente_id}
                required
              />
            )}
            <Selector
              etiqueta="Sede"
              value={f.sede_id}
              onChange={cambiar('sede_id')}
              opciones={sedesActivas.map((s) => ({ valor: s.id, texto: s.nombre }))}
              vacio={clienteId ? 'Elige la sede' : 'Elige primero el cliente'}
              disabled={!clienteId}
              error={campos.sede_id}
              required
            />
            <Selector etiqueta="Categoría" value={f.categoria_id} onChange={cambiar('categoria_id')} opciones={(categorias.datos ?? []).map((c) => ({ valor: c.id, texto: c.nombre }))} vacio="Elige la categoría" error={campos.categoria_id} required />
            <Selector
              etiqueta="Prioridad"
              value={f.prioridad_id}
              onChange={cambiar('prioridad_id')}
              opciones={(prioridades.datos ?? []).map((p) => ({ valor: p.id, texto: `${p.nombre} · ${p.horas_plazo} horas` }))}
              vacio="Elige la prioridad"
              error={campos.prioridad_id}
              required
            />
            <Campo etiqueta="Equipo o recurso afectado" value={f.equipo_afectado} onChange={cambiar('equipo_afectado')} placeholder="Ej.: Impresora HP de contabilidad" error={campos.equipo_afectado} required />
            <Campo className="ancho" etiqueta="Título" value={f.titulo} onChange={cambiar('titulo')} placeholder="Resume el problema en una frase" error={campos.titulo} required />
            <Campo
              className="ancho"
              etiqueta="Descripción"
              value={f.descripcion}
              onChange={cambiar('descripcion')}
              multiline
              minRows={3}
              placeholder="Cuéntanos qué pasa, desde cuándo y qué esperas que se resuelva…"
              error={campos.descripcion}
              required
            />
          </div>

          <ZonaArchivos alElegir={agregar} deshabilitada={enviando} />
          {archivos.length > 0 && (
            <div className="fila">
              {archivos.map((a, i) => (
                <span key={`${a.name}-${i}`} className="archivo" style={{ cursor: 'default' }}>
                  <span className="recortar">{a.name}</span>
                  <span className="nota">{tamanoArchivo(a.size)}</span>
                  <button type="button" className="enlace-boton" aria-label={`Quitar ${a.name}`} onClick={() => setArchivos((actual) => actual.filter((_, j) => j !== i))}>
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="fila final">
            <Button variant="text" component={Link} to="/solicitudes">
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar solicitud'}
            </Button>
          </div>
        </form>

        <div className="pila">
          <Tarjeta titulo="Plazos según prioridad">
            {[...(prioridades.datos ?? [])].reverse().map((p) => (
              <div key={p.id} className="par">
                <Prioridad nivel={p.codigo} />
                <span>{p.horas_plazo} horas</span>
              </div>
            ))}
            <p className="nota" style={{ marginTop: 8 }}>
              Elige “Crítica” solo si el problema detiene tu trabajo. Al aprobar, la prioridad puede ajustarse.
            </p>
          </Tarjeta>
          <Tarjeta titulo="¿Qué pasa después?">
            <ol className="pila md" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {['Revisamos y aprobamos tu solicitud', 'Asignamos a un técnico', 'Recibes avisos en cada cambio'].map((paso, i) => (
                <li key={paso} className="fila" style={{ gap: 12 }}>
                  <span className="badge rol" style={{ width: 24, height: 24, justifyContent: 'center', padding: 0, fontWeight: 700 }}>
                    {i + 1}
                  </span>
                  {paso}
                </li>
              ))}
            </ol>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
