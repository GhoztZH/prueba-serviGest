import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useUsuario } from '../../../app/providers/AuthProvider';
import { useAvisos } from '../../../app/providers/AvisosProvider';
import { ActivoBadge, Par } from '../../../shared/components/atoms';
import { Campo, camposDe, Confirmacion, mensajeGeneral } from '../../../shared/components/forms';
import { Aviso, Buscador, Contenido, Encabezado, EstadoVacio, Paginacion, Tarjeta } from '../../../shared/components/layout';
import { useAccion, useConsulta, useRetardo } from '../../../shared/hooks/hooks';
import type { Cliente, ClienteDetalle, Sede } from '../../../shared/types/api';
import { clientService, type ClienteFormulario } from '../services/client.service';

const LIMITE = 10;

const FORM_CLIENTE_VACIO: ClienteFormulario = {
  identificacion: '',
  razon_social: '',
  email: '',
  telefono: '',
  direccion: '',
  sedes: [{ nombre: 'Matriz', direccion: '' }],
  cuenta: { email: '', password: '' },
  activo: true,
};

/**
 * A7/A8 y CO6 · Clientes y sedes.
 * Administrador: gestión completa (alta, edición, sedes, cuenta de acceso).
 * Coordinador: solo consulta y detalle de sedes.
 */
export function ClientesPage() {
  const usuario = useUsuario();
  const avisos = useAvisos();
  const puedeEditar = usuario.rol === 'ADMIN';

  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<string>('');
  const q = useRetardo(busqueda);

  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<number | null>(null);

  // Modales
  const [modalClienteAbierto, setModalClienteAbierto] = useState(false);
  const [editandoCliente, setEditandoCliente] = useState<ClienteDetalle | null>(null);
  const [formCliente, setFormCliente] = useState<ClienteFormulario>(FORM_CLIENTE_VACIO);

  const [modalSedeAbierto, setModalSedeAbierto] = useState(false);
  const [formSede, setFormSede] = useState({ nombre: '', direccion: '' });

  const [eliminandoSede, setEliminandoSede] = useState<Sede | null>(null);
  const [eliminandoCliente, setEliminandoCliente] = useState<Cliente | null>(null);

  const clientesConsulta = useConsulta(
    () =>
      clientService.listar({
        page: pagina,
        limit: LIMITE,
        q,
        activo: filtroActivo === '' ? '' : filtroActivo === 'true',
      }),
    [pagina, q, filtroActivo],
  );

  const primerClienteId = clientesConsulta.datos?.data?.[0]?.id ?? null;
  const clienteEfectivoId = clienteSeleccionadoId ?? primerClienteId;

  const detalleConsulta = useConsulta(
    () => (clienteEfectivoId ? clientService.detalle(clienteEfectivoId) : Promise.resolve(null)),
    [clienteEfectivoId],
  );

  // Guardar cliente
  const { ejecutar: guardarCliente, enviando: guardandoCliente, error: errorCliente } = useAccion(async () => {
    if (editandoCliente) {
      await clientService.actualizar(editandoCliente.id, formCliente);
      avisos.exito('Cliente actualizado con éxito');
    } else {
      const nuevo = await clientService.crear(formCliente);
      avisos.exito('Cliente registrado con éxito');
      setClienteSeleccionadoId(nuevo.id);
    }
    setModalClienteAbierto(false);
    clientesConsulta.recargar();
    detalleConsulta.recargar();
  });

  // Guardar sede
  const { ejecutar: guardarSede, enviando: guardandoSede, error: errorSede } = useAccion(async () => {
    if (!clienteEfectivoId) return;
    await clientService.crearSede(clienteEfectivoId, formSede);
    avisos.exito('Sede agregada con éxito');
    setModalSedeAbierto(false);
    setFormSede({ nombre: '', direccion: '' });
    detalleConsulta.recargar();
    clientesConsulta.recargar();
  });

  const abrirNuevoCliente = () => {
    setEditandoCliente(null);
    setFormCliente(FORM_CLIENTE_VACIO);
    setModalClienteAbierto(true);
  };

  const abrirEditarCliente = (c: ClienteDetalle) => {
    setEditandoCliente(c);
    setFormCliente({
      identificacion: c.identificacion,
      razon_social: c.razon_social,
      email: c.email,
      telefono: c.telefono ?? '',
      direccion: c.direccion ?? '',
      activo: c.activo,
    });
    setModalClienteAbierto(true);
  };

  const confirmarEliminarSede = async () => {
    if (!clienteEfectivoId || !eliminandoSede) return;
    try {
      await clientService.eliminarSede(clienteEfectivoId, eliminandoSede.id);
      avisos.exito('Sede eliminada');
      setEliminandoSede(null);
      detalleConsulta.recargar();
      clientesConsulta.recargar();
    } catch (e) {
      avisos.error(e);
    }
  };

  const confirmarEliminarCliente = async () => {
    if (!eliminandoCliente) return;
    try {
      await clientService.eliminar(eliminandoCliente.id);
      avisos.exito('Cliente eliminado');
      setEliminandoCliente(null);
      if (clienteSeleccionadoId === eliminandoCliente.id) {
        setClienteSeleccionadoId(null);
      }
      clientesConsulta.recargar();
    } catch (e) {
      avisos.error(e);
    }
  };

  const camposCliente = camposDe(errorCliente);
  const camposSede = camposDe(errorSede);

  return (
    <>
      <Encabezado
        titulo="Clientes y sedes"
        subtitulo={
          puedeEditar
            ? 'Gestión de clientes corporativos, sedes operativas y cuentas asociadas'
            : 'Consulta de empresas clientes y sus respectivas sedes'
        }
      >
        {puedeEditar && (
          <Button onClick={abrirNuevoCliente} startIcon={<Plus size={16} />}>
            Nuevo cliente
          </Button>
        )}
      </Encabezado>

      <div className="dos-columnas">
        <Tarjeta>
          <div className="fila separada" style={{ marginBottom: 'var(--space-lg)' }}>
            <Buscador
              valor={busqueda}
              alCambiar={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por RUC, razón social o correo…"
              ancho={280}
            />
            <div className="fila">
              <button
                type="button"
                className={`pestana ${filtroActivo === '' ? 'activo' : ''}`}
                aria-selected={filtroActivo === ''}
                onClick={() => setFiltroActivo('')}
              >
                Todos
              </button>
              <button
                type="button"
                className={`pestana ${filtroActivo === 'true' ? 'activo' : ''}`}
                aria-selected={filtroActivo === 'true'}
                onClick={() => setFiltroActivo('true')}
              >
                Activos
              </button>
            </div>
          </div>

          <Contenido consulta={clientesConsulta}>
            {({ data, meta }) =>
              data.length === 0 ? (
                <EstadoVacio titulo="No hay clientes registrados" />
              ) : (
                <>
                  <div className="tabla-contenedor">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Razón social</th>
                          <th>RUC / ID</th>
                          <th>Sedes</th>
                          <th>Estado</th>
                          {puedeEditar && <th>Acción</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((c: Cliente) => {
                          const seleccionada = c.id === clienteEfectivoId;
                          return (
                            <tr
                              key={c.id}
                              className={`clicable ${seleccionada ? 'seleccionada' : ''}`}
                              onClick={() => setClienteSeleccionadoId(c.id)}
                            >
                              <td>
                                <div className="principal-celda">{c.razon_social}</div>
                                <div className="nota">{c.email}</div>
                              </td>
                              <td className="codigo">{c.identificacion}</td>
                              <td>{c.total_sedes}</td>
                              <td>
                                <ActivoBadge activo={c.activo} />
                              </td>
                              {puedeEditar && (
                                <td onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="enlace peligro"
                                    onClick={() => setEliminandoCliente(c)}
                                  >
                                    Eliminar
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <Paginacion
                    meta={meta}
                    alCambiar={setPagina}
                    sustantivo="clientes"
                  />
                </>
              )
            }
          </Contenido>
        </Tarjeta>

        {/* Panel lateral: Detalle del cliente elegido y sus sedes */}
        <div className="pila">
          <Tarjeta
            titulo="Detalle del cliente"
            accion={
              puedeEditar &&
              detalleConsulta.datos && (
                <button
                  type="button"
                  className="enlace"
                  onClick={() => abrirEditarCliente(detalleConsulta.datos!)}
                >
                  Editar
                </button>
              )
            }
          >
            <Contenido consulta={detalleConsulta}>
              {(cliente) => {
                if (!cliente) {
                  return <EstadoVacio titulo="Selecciona un cliente para ver sus datos" />;
                }

                return (
                  <div className="pila md">
                    <div>
                      <div className="titulo-tarjeta">{cliente.razon_social}</div>
                      <div className="nota">RUC / ID: {cliente.identificacion}</div>
                    </div>

                    <Par rotulo="Correo de contacto">{cliente.email}</Par>
                    <Par rotulo="Teléfono">{cliente.telefono || '—'}</Par>
                    <Par rotulo="Dirección">{cliente.direccion || '—'}</Par>
                    <Par rotulo="Cuenta de acceso">{cliente.cuenta_email || 'Sin usuario de acceso'}</Par>
                    <Par rotulo="Estado">
                      <ActivoBadge activo={cliente.activo} />
                    </Par>

                    <div className="divisor" />

                    <div className="fila separada">
                      <div className="titulo-seccion">Sedes ({cliente.sedes.length})</div>
                      {puedeEditar && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setModalSedeAbierto(true)}
                          startIcon={<Plus size={14} />}
                        >
                          Nueva sede
                        </Button>
                      )}
                    </div>

                    {cliente.sedes.length === 0 ? (
                      <p className="tenue">No tiene sedes registradas.</p>
                    ) : (
                      <div className="pila sm">
                        {cliente.sedes.map((s) => (
                          <div
                            key={s.id}
                            className="tarjeta"
                            style={{ padding: 'var(--space-md)', background: 'var(--color-bg)' }}
                          >
                            <div className="fila separada">
                              <span className="cuerpo-medio">{s.nombre}</span>
                              {puedeEditar && (
                                <button
                                  type="button"
                                  className="boton-icono"
                                  style={{ width: 28, height: 28 }}
                                  title="Eliminar sede"
                                  onClick={() => setEliminandoSede(s)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                            <div className="nota">{s.direccion}</div>
                            <div className="nota" style={{ marginTop: 4 }}>
                              {s.total_solicitudes} {s.total_solicitudes === 1 ? 'solicitud' : 'solicitudes'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }}
            </Contenido>
          </Tarjeta>
        </div>
      </div>

      {/* Modal Crear / Editar Cliente */}
      <Dialog
        open={modalClienteAbierto}
        onClose={() => !guardandoCliente && setModalClienteAbierto(false)}
        maxWidth="sm"
        fullWidth
      >
        <form
          className="pila"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void guardarCliente();
          }}
          noValidate
        >
          <div className="titulo-seccion">
            {editandoCliente ? 'Editar cliente' : 'Nuevo cliente'}
          </div>

          {mensajeGeneral(errorCliente) && <Aviso tono="error" titulo={mensajeGeneral(errorCliente)} />}

          <div className="campos">
            <Campo
              etiqueta="RUC o Identificación"
              value={formCliente.identificacion}
              onChange={(e) => setFormCliente({ ...formCliente, identificacion: e.target.value })}
              error={camposCliente.identificacion}
              required
              disabled={Boolean(editandoCliente)}
            />
            <Campo
              etiqueta="Razón social"
              value={formCliente.razon_social}
              onChange={(e) => setFormCliente({ ...formCliente, razon_social: e.target.value })}
              error={camposCliente.razon_social}
              required
            />
          </div>

          <div className="campos">
            <Campo
              etiqueta="Correo principal"
              type="email"
              value={formCliente.email}
              onChange={(e) => setFormCliente({ ...formCliente, email: e.target.value })}
              error={camposCliente.email}
              required
            />
            <Campo
              etiqueta="Teléfono"
              value={formCliente.telefono ?? ''}
              onChange={(e) => setFormCliente({ ...formCliente, telefono: e.target.value })}
              error={camposCliente.telefono}
            />
          </div>

          <Campo
            etiqueta="Dirección fiscal"
            value={formCliente.direccion ?? ''}
            onChange={(e) => setFormCliente({ ...formCliente, direccion: e.target.value })}
            error={camposCliente.direccion}
          />

          {!editandoCliente && (
            <>
              <div className="divisor" />
              <div className="titulo-tarjeta">Sede inicial</div>
              <div className="campos">
                <Campo
                  etiqueta="Nombre de sede"
                  value={formCliente.sedes?.[0]?.nombre ?? ''}
                  onChange={(e) =>
                    setFormCliente({
                      ...formCliente,
                      sedes: [{ nombre: e.target.value, direccion: formCliente.sedes?.[0]?.direccion ?? '' }],
                    })
                  }
                  required
                />
                <Campo
                  etiqueta="Dirección de la sede"
                  value={formCliente.sedes?.[0]?.direccion ?? ''}
                  onChange={(e) =>
                    setFormCliente({
                      ...formCliente,
                      sedes: [{ nombre: formCliente.sedes?.[0]?.nombre ?? 'Matriz', direccion: e.target.value }],
                    })
                  }
                  required
                />
              </div>

              <div className="divisor" />
              <div className="titulo-tarjeta">Cuenta de acceso para el cliente (opcional)</div>
              <div className="campos">
                <Campo
                  etiqueta="Correo de usuario"
                  type="email"
                  value={formCliente.cuenta?.email ?? ''}
                  onChange={(e) =>
                    setFormCliente({
                      ...formCliente,
                      cuenta: { ...formCliente.cuenta, email: e.target.value },
                    })
                  }
                  error={camposCliente['cuenta.email']}
                />
                <Campo
                  etiqueta="Contraseña temporal"
                  type="password"
                  value={formCliente.cuenta?.password ?? ''}
                  onChange={(e) =>
                    setFormCliente({
                      ...formCliente,
                      cuenta: { ...formCliente.cuenta, email: formCliente.cuenta?.email ?? '', password: e.target.value },
                    })
                  }
                  error={camposCliente['cuenta.password']}
                />
              </div>
            </>
          )}

          {editandoCliente && (
            <div className="fila-ajuste">
              <div>
                <div className="cuerpo-medio">Cliente activo</div>
                <div className="nota">Los clientes inactivos no pueden crear solicitudes.</div>
              </div>
              <Switch
                checked={formCliente.activo ?? true}
                onChange={(e) => setFormCliente({ ...formCliente, activo: e.target.checked })}
              />
            </div>
          )}

          <div className="fila final" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
            <Button variant="text" onClick={() => setModalClienteAbierto(false)} disabled={guardandoCliente}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardandoCliente}>
              {guardandoCliente ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal Nueva Sede */}
      <Dialog
        open={modalSedeAbierto}
        onClose={() => !guardandoSede && setModalSedeAbierto(false)}
        maxWidth="xs"
        fullWidth
      >
        <form
          className="pila"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void guardarSede();
          }}
          noValidate
        >
          <div className="titulo-seccion">Nueva sede</div>
          {mensajeGeneral(errorSede) && <Aviso tono="error" titulo={mensajeGeneral(errorSede)} />}

          <Campo
            etiqueta="Nombre de la sede"
            placeholder="Ej. Sucursal Norte"
            value={formSede.nombre}
            onChange={(e) => setFormSede({ ...formSede, nombre: e.target.value })}
            error={camposSede.nombre}
            required
            autoFocus
          />

          <Campo
            etiqueta="Dirección"
            placeholder="Calle principal, número y referencia"
            value={formSede.direccion}
            onChange={(e) => setFormSede({ ...formSede, direccion: e.target.value })}
            error={camposSede.direccion}
            required
          />

          <div className="fila final" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
            <Button variant="text" onClick={() => setModalSedeAbierto(false)} disabled={guardandoSede}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardandoSede}>
              {guardandoSede ? 'Guardando…' : 'Agregar sede'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirmación eliminar sede */}
      <Confirmacion
        abierta={Boolean(eliminandoSede)}
        titulo="Eliminar sede"
        textoConfirmar="Eliminar"
        alConfirmar={() => void confirmarEliminarSede()}
        alCerrar={() => setEliminandoSede(null)}
      >
        ¿Estás seguro de que deseas eliminar la sede "{eliminandoSede?.nombre}"? Solo es posible si no tiene solicitudes asociadas.
      </Confirmacion>

      {/* Confirmación eliminar cliente */}
      <Confirmacion
        abierta={Boolean(eliminandoCliente)}
        titulo="Eliminar cliente"
        textoConfirmar="Eliminar"
        alConfirmar={() => void confirmarEliminarCliente()}
        alCerrar={() => setEliminandoCliente(null)}
      >
        ¿Estás seguro de que deseas eliminar al cliente "{eliminandoCliente?.razon_social}"? Solo es posible si no registra solicitudes activas ni dependencias.
      </Confirmacion>
    </>
  );
}
