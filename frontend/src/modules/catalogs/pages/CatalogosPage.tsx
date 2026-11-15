import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useAvisos } from '../../../app/providers/AvisosProvider';
import { ActivoBadge } from '../../../shared/components/atoms';
import { Campo, camposDe, Confirmacion, mensajeGeneral, Selector } from '../../../shared/components/forms';
import { Aviso, Contenido, Encabezado, EstadoVacio, Pestanas, Tarjeta } from '../../../shared/components/layout';
import { ApiError } from '../../../shared/http/client';
import { useAccion, useConsulta } from '../../../shared/hooks/hooks';
import type { Categoria, Especialidad, Parametro, Prioridad } from '../../../shared/types/api';
import { formatoFechaHora } from '../../../shared/utils/format';
import { catalogService } from '../services/catalog.service';

type PestanaCatalogo = 'especialidades' | 'categorias' | 'prioridades' | 'parametros';

/**
 * A9 · Catálogos y parámetros del sistema (Administrador).
 * Permite configurar especialidades técnicas, categorías de servicio,
 * plazos SLA por prioridad y parámetros globales de configuración.
 */
export function CatalogosPage({ pestanaPorDefecto }: { pestanaPorDefecto?: PestanaCatalogo }) {
  const { pathname } = useLocation();
  const avisos = useAvisos();

  const inicial: PestanaCatalogo =
    pestanaPorDefecto ?? (pathname.startsWith('/parametros') ? 'parametros' : 'especialidades');
  const [pestana, setPestana] = useState<PestanaCatalogo>(inicial);

  // Consultas
  const especialidadesConsulta = useConsulta(() => catalogService.especialidades(), [pestana]);
  const categoriasConsulta = useConsulta(() => catalogService.categorias(), [pestana]);
  const prioridadesConsulta = useConsulta(() => catalogService.prioridades(), [pestana]);
  const parametrosConsulta = useConsulta(() => catalogService.parametros(), [pestana]);

  // Modal Especialidad
  const [modalEsp, setModalEsp] = useState(false);
  const [editEsp, setEditEsp] = useState<Especialidad | null>(null);
  const [formEsp, setFormEsp] = useState({ nombre: '', descripcion: '', activo: true });

  // Modal Categoría
  const [modalCat, setModalCat] = useState(false);
  const [editCat, setEditCat] = useState<Categoria | null>(null);
  const [formCat, setFormCat] = useState({ nombre: '', descripcion: '', especialidad_id: '', activo: true });

  // Modal Prioridad
  const [modalPrio, setModalPrio] = useState(false);
  const [editPrio, setEditPrio] = useState<Prioridad | null>(null);
  const [formPrio, setFormPrio] = useState({ horas_plazo: 24 });

  // Modal Parámetro
  const [modalParam, setModalParam] = useState(false);
  const [editParam, setEditParam] = useState<Parametro | null>(null);
  const [formParam, setFormParam] = useState({ valor: '' });

  // Eliminaciones
  const [eliminarEspObj, setEliminarEspObj] = useState<Especialidad | null>(null);
  const [eliminarCatObj, setEliminarCatObj] = useState<Categoria | null>(null);
  const [aviso409, setAviso409] = useState<string | null>(null);

  // Acciones Especialidad
  const { ejecutar: guardarEsp, enviando: guardandoEsp, error: errorEsp } = useAccion(async () => {
    if (editEsp) {
      await catalogService.actualizarEspecialidad(editEsp.id, formEsp);
      avisos.exito('Especialidad actualizada');
    } else {
      await catalogService.crearEspecialidad(formEsp);
      avisos.exito('Especialidad creada');
    }
    setModalEsp(false);
    especialidadesConsulta.recargar();
  });

  // Acciones Categoría
  const { ejecutar: guardarCat, enviando: guardandoCat, error: errorCat } = useAccion(async () => {
    if (editCat) {
      await catalogService.actualizarCategoria(editCat.id, {
        nombre: formCat.nombre,
        descripcion: formCat.descripcion,
        especialidad_id: Number(formCat.especialidad_id),
        activo: formCat.activo,
      });
      avisos.exito('Categoría actualizada');
    } else {
      await catalogService.crearCategoria({
        nombre: formCat.nombre,
        descripcion: formCat.descripcion,
        especialidad_id: Number(formCat.especialidad_id),
      });
      avisos.exito('Categoría creada');
    }
    setModalCat(false);
    categoriasConsulta.recargar();
  });

  // Acciones Prioridad
  const { ejecutar: guardarPrio, enviando: guardandoPrio, error: errorPrio } = useAccion(async () => {
    if (!editPrio) return;
    await catalogService.actualizarPrioridad(editPrio.id, { horas_plazo: formPrio.horas_plazo });
    avisos.exito('Plazo de prioridad actualizado');
    setModalPrio(false);
    prioridadesConsulta.recargar();
  });

  // Acciones Parámetro
  const { ejecutar: guardarParam, enviando: guardandoParam, error: errorParam } = useAccion(async () => {
    if (!editParam) return;
    await catalogService.actualizarParametro(editParam.clave, formParam.valor);
    avisos.exito('Parámetro actualizado');
    setModalParam(false);
    parametrosConsulta.recargar();
  });

  const confirmarEliminarEsp = async () => {
    if (!eliminarEspObj) return;
    try {
      setAviso409(null);
      await catalogService.eliminarEspecialidad(eliminarEspObj.id);
      avisos.exito('Especialidad eliminada');
      setEliminarEspObj(null);
      especialidadesConsulta.recargar();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAviso409('No es posible eliminar la especialidad porque tiene categorías o técnicos asociados. Puedes desactivarla en lugar de eliminarla.');
      } else {
        avisos.error(err);
      }
      setEliminarEspObj(null);
    }
  };

  const confirmarEliminarCat = async () => {
    if (!eliminarCatObj) return;
    try {
      setAviso409(null);
      await catalogService.eliminarCategoria(eliminarCatObj.id);
      avisos.exito('Categoría eliminada');
      setEliminarCatObj(null);
      categoriasConsulta.recargar();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAviso409('No es posible eliminar la categoría porque tiene solicitudes asociadas. Puedes desactivarla en lugar de eliminarla.');
      } else {
        avisos.error(err);
      }
      setEliminarCatObj(null);
    }
  };

  return (
    <>
      <Encabezado
        titulo="Catálogos y parámetros"
        subtitulo="Configuración de tablas maestras, tiempos de atención (SLA) y variables operativas"
      >
        {pestana === 'especialidades' && (
          <Button
            onClick={() => {
              setEditEsp(null);
              setFormEsp({ nombre: '', descripcion: '', activo: true });
              setModalEsp(true);
            }}
            startIcon={<Plus size={16} />}
          >
            Nueva especialidad
          </Button>
        )}
        {pestana === 'categorias' && (
          <Button
            onClick={() => {
              setEditCat(null);
              setFormCat({
                nombre: '',
                descripcion: '',
                especialidad_id: String(especialidadesConsulta.datos?.[0]?.id ?? ''),
                activo: true,
              });
              setModalCat(true);
            }}
            startIcon={<Plus size={16} />}
          >
            Nueva categoría
          </Button>
        )}
      </Encabezado>

      {aviso409 && (
        <Aviso tono="alerta" titulo="Acción no permitida">
          {aviso409}
        </Aviso>
      )}

      <Pestanas
        opciones={[
          { valor: 'especialidades', texto: 'Especialidades' },
          { valor: 'categorias', texto: 'Categorías' },
          { valor: 'prioridades', texto: 'Prioridades y plazos' },
          { valor: 'parametros', texto: 'Parámetros del sistema' },
        ]}
        valor={pestana}
        alCambiar={(p) => {
          setPestana(p);
          setAviso409(null);
        }}
        etiqueta="Catálogos del sistema"
      />

      {/* PESTAÑA: ESPECIALIDADES */}
      {pestana === 'especialidades' && (
        <Tarjeta>
          <Contenido consulta={especialidadesConsulta}>
            {(lista) =>
              lista.length === 0 ? (
                <EstadoVacio titulo="No hay especialidades registradas" />
              ) : (
                <div className="tabla-contenedor">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Descripción</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((esp) => (
                        <tr key={esp.id}>
                          <td className="principal-celda">{esp.nombre}</td>
                          <td>{esp.descripcion || '—'}</td>
                          <td>
                            <ActivoBadge activo={esp.activo} />
                          </td>
                          <td>
                            <div className="fila" style={{ gap: 'var(--space-md)' }}>
                              <button
                                type="button"
                                className="enlace"
                                onClick={() => {
                                  setEditEsp(esp);
                                  setFormEsp({
                                    nombre: esp.nombre,
                                    descripcion: esp.descripcion ?? '',
                                    activo: esp.activo,
                                  });
                                  setModalEsp(true);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="enlace peligro"
                                onClick={() => setEliminarEspObj(esp)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </Contenido>
        </Tarjeta>
      )}

      {/* PESTAÑA: CATEGORÍAS */}
      {pestana === 'categorias' && (
        <Tarjeta>
          <Contenido consulta={categoriasConsulta}>
            {(lista) =>
              lista.length === 0 ? (
                <EstadoVacio titulo="No hay categorías registradas" />
              ) : (
                <div className="tabla-contenedor">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th>Especialidad requerida</th>
                        <th>Descripción</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((cat) => (
                        <tr key={cat.id}>
                          <td className="principal-celda">{cat.nombre}</td>
                          <td>
                            <span className="badge rol">{cat.especialidad_nombre}</span>
                          </td>
                          <td>{cat.descripcion || '—'}</td>
                          <td>
                            <ActivoBadge activo={cat.activo} />
                          </td>
                          <td>
                            <div className="fila" style={{ gap: 'var(--space-md)' }}>
                              <button
                                type="button"
                                className="enlace"
                                onClick={() => {
                                  setEditCat(cat);
                                  setFormCat({
                                    nombre: cat.nombre,
                                    descripcion: cat.descripcion ?? '',
                                    especialidad_id: String(cat.especialidad_id),
                                    activo: cat.activo,
                                  });
                                  setModalCat(true);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="enlace peligro"
                                onClick={() => setEliminarCatObj(cat)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </Contenido>
        </Tarjeta>
      )}

      {/* PESTAÑA: PRIORIDADES Y PLAZOS */}
      {pestana === 'prioridades' && (
        <Tarjeta>
          <p className="nota" style={{ marginBottom: 'var(--space-lg)' }}>
            Los plazos definen las horas límite (SLA) para resolver solicitudes según su prioridad.
          </p>
          <Contenido consulta={prioridadesConsulta}>
            {(lista) => (
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Prioridad</th>
                      <th>Código</th>
                      <th>Plazo máximo de resolución</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((prio) => (
                      <tr key={prio.id}>
                        <td className="principal-celda">{prio.nombre}</td>
                        <td className="codigo">{prio.codigo}</td>
                        <td>
                          <strong>{prio.horas_plazo} horas</strong> ({Math.round(prio.horas_plazo / 24)} días)
                        </td>
                        <td>
                          <button
                            type="button"
                            className="enlace"
                            onClick={() => {
                              setEditPrio(prio);
                              setFormPrio({ horas_plazo: prio.horas_plazo });
                              setModalPrio(true);
                            }}
                          >
                            Modificar plazo
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Contenido>
        </Tarjeta>
      )}

      {/* PESTAÑA: PARÁMETROS */}
      {pestana === 'parametros' && (
        <Tarjeta>
          <p className="nota" style={{ marginBottom: 'var(--space-lg)' }}>
            Parámetros globales que gobiernan el comportamiento operativo de ServiGest.
          </p>
          <Contenido consulta={parametrosConsulta}>
            {(lista) => (
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Clave</th>
                      <th>Valor</th>
                      <th>Descripción</th>
                      <th>Última modificación</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((param) => (
                      <tr key={param.clave}>
                        <td className="codigo">{param.clave}</td>
                        <td>
                          <code>{param.valor}</code>
                        </td>
                        <td>{param.descripcion || '—'}</td>
                        <td className="nota">{formatoFechaHora(param.updated_at)}</td>
                        <td>
                          <button
                            type="button"
                            className="enlace"
                            onClick={() => {
                              setEditParam(param);
                              setFormParam({ valor: param.valor });
                              setModalParam(true);
                            }}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Contenido>
        </Tarjeta>
      )}

      {/* Modal Especialidad */}
      <Dialog open={modalEsp} onClose={() => !guardandoEsp && setModalEsp(false)} maxWidth="xs" fullWidth>
        <form
          className="pila"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void guardarEsp();
          }}
          noValidate
        >
          <div className="titulo-seccion">
            {editEsp ? 'Editar especialidad' : 'Nueva especialidad'}
          </div>

          {mensajeGeneral(errorEsp) && <Aviso tono="error" titulo={mensajeGeneral(errorEsp)} />}

          <Campo
            etiqueta="Nombre"
            value={formEsp.nombre}
            onChange={(e) => setFormEsp({ ...formEsp, nombre: e.target.value })}
            error={camposDe(errorEsp).nombre}
            required
            autoFocus
          />

          <Campo
            etiqueta="Descripción"
            value={formEsp.descripcion}
            onChange={(e) => setFormEsp({ ...formEsp, descripcion: e.target.value })}
            error={camposDe(errorEsp).descripcion}
            multiline
            minRows={2}
          />

          {editEsp && (
            <div className="fila-ajuste">
              <div>
                <div className="cuerpo-medio">Especialidad activa</div>
                <div className="nota">Si se desactiva, no se podrá asignar a nuevos técnicos.</div>
              </div>
              <Switch
                checked={formEsp.activo}
                onChange={(e) => setFormEsp({ ...formEsp, activo: e.target.checked })}
              />
            </div>
          )}

          <div className="fila final" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
            <Button variant="text" onClick={() => setModalEsp(false)} disabled={guardandoEsp}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardandoEsp}>
              {guardandoEsp ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal Categoría */}
      <Dialog open={modalCat} onClose={() => !guardandoCat && setModalCat(false)} maxWidth="xs" fullWidth>
        <form
          className="pila"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void guardarCat();
          }}
          noValidate
        >
          <div className="titulo-seccion">
            {editCat ? 'Editar categoría' : 'Nueva categoría de servicio'}
          </div>

          {mensajeGeneral(errorCat) && <Aviso tono="error" titulo={mensajeGeneral(errorCat)} />}

          <Campo
            etiqueta="Nombre"
            value={formCat.nombre}
            onChange={(e) => setFormCat({ ...formCat, nombre: e.target.value })}
            error={camposDe(errorCat).nombre}
            required
            autoFocus
          />

          <Selector
            etiqueta="Especialidad técnica requerida"
            value={formCat.especialidad_id}
            opciones={(especialidadesConsulta.datos ?? []).map((e) => ({
              valor: String(e.id),
              texto: e.nombre,
            }))}
            onChange={(e) => setFormCat({ ...formCat, especialidad_id: String(e.target.value) })}
            error={camposDe(errorCat).especialidad_id}
            required
          />

          <Campo
            etiqueta="Descripción"
            value={formCat.descripcion}
            onChange={(e) => setFormCat({ ...formCat, descripcion: e.target.value })}
            error={camposDe(errorCat).descripcion}
            multiline
            minRows={2}
          />

          {editCat && (
            <div className="fila-ajuste">
              <div>
                <div className="cuerpo-medio">Categoría activa</div>
                <div className="nota">Si se desactiva, no aparecerá en nuevas solicitudes.</div>
              </div>
              <Switch
                checked={formCat.activo}
                onChange={(e) => setFormCat({ ...formCat, activo: e.target.checked })}
              />
            </div>
          )}

          <div className="fila final" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
            <Button variant="text" onClick={() => setModalCat(false)} disabled={guardandoCat}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardandoCat}>
              {guardandoCat ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal Prioridad */}
      <Dialog open={modalPrio} onClose={() => !guardandoPrio && setModalPrio(false)} maxWidth="xs" fullWidth>
        <form
          className="pila"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void guardarPrio();
          }}
          noValidate
        >
          <div className="titulo-seccion">Plazo para prioridad {editPrio?.nombre}</div>
          {mensajeGeneral(errorPrio) && <Aviso tono="error" titulo={mensajeGeneral(errorPrio)} />}

          <Campo
            etiqueta="Horas de plazo (SLA)"
            type="number"
            value={formPrio.horas_plazo}
            onChange={(e) => setFormPrio({ horas_plazo: Math.max(1, Number(e.target.value)) })}
            error={camposDe(errorPrio).horas_plazo}
            slotProps={{ htmlInput: { min: 1, max: 720 } }}
            ayuda="Horas que tiene el técnico para resolver la solicitud a tiempo"
            required
            autoFocus
          />

          <div className="fila final" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
            <Button variant="text" onClick={() => setModalPrio(false)} disabled={guardandoPrio}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardandoPrio}>
              {guardandoPrio ? 'Guardando…' : 'Actualizar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal Parámetro */}
      <Dialog open={modalParam} onClose={() => !guardandoParam && setModalParam(false)} maxWidth="xs" fullWidth>
        <form
          className="pila"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void guardarParam();
          }}
          noValidate
        >
          <div className="titulo-seccion">Editar parámetro</div>
          <p className="nota">
            Clave: <code>{editParam?.clave}</code>
          </p>
          {editParam?.descripcion && <p className="tenue">{editParam.descripcion}</p>}

          {mensajeGeneral(errorParam) && <Aviso tono="error" titulo={mensajeGeneral(errorParam)} />}

          <Campo
            etiqueta="Valor"
            value={formParam.valor}
            onChange={(e) => setFormParam({ valor: e.target.value })}
            error={camposDe(errorParam).valor}
            required
            autoFocus
          />

          <div className="fila final" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
            <Button variant="text" onClick={() => setModalParam(false)} disabled={guardandoParam}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardandoParam}>
              {guardandoParam ? 'Guardando…' : 'Guardar valor'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirmar eliminar especialidad */}
      <Confirmacion
        abierta={Boolean(eliminarEspObj)}
        titulo="Eliminar especialidad"
        textoConfirmar="Eliminar"
        alConfirmar={() => void confirmarEliminarEsp()}
        alCerrar={() => setEliminarEspObj(null)}
      >
        ¿Estás seguro de que deseas eliminar la especialidad "{eliminarEspObj?.nombre}"? Si ya está en uso, debes desactivarla.
      </Confirmacion>

      {/* Confirmar eliminar categoría */}
      <Confirmacion
        abierta={Boolean(eliminarCatObj)}
        titulo="Eliminar categoría"
        textoConfirmar="Eliminar"
        alConfirmar={() => void confirmarEliminarCat()}
        alCerrar={() => setEliminarCatObj(null)}
      >
        ¿Estás seguro de que deseas eliminar la categoría "{eliminarCatObj?.nombre}"? Si ya registra solicitudes, debes desactivarla.
      </Confirmacion>
    </>
  );
}
