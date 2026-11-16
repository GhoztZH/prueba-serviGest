import Switch from '@mui/material/Switch';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUsuario } from '../../../app/providers/AuthProvider';
import { useAvisos } from '../../../app/providers/AvisosProvider';
import { useRecargaEnVivo, useTiempoReal } from '../../../app/providers/TiempoRealProvider';
import { Par, PlazoBadge, Prioridad, Progreso } from '../../../shared/components/atoms';
import { Contenido, Encabezado, EstadoError, EstadoVacio, Kpi, Tarjeta } from '../../../shared/components/layout';
import { useConsulta } from '../../../shared/hooks/hooks';
import type { Indicadores } from '../../../shared/types/api';
import { fechaISO, fechaRelativa, formatoFecha, horasPromedio, NOMBRE_ESTADO, porcentaje, primerNombre } from '../../../shared/utils/format';
import { catalogService } from '../../catalogs/services/catalog.service';
import { clientService } from '../../clients/services/client.service';
import { solicitudService } from '../../requests/services/solicitud.service';
import { technicianService } from '../../technicians/services/technician.service';
import { BarrasEvolucion, BarrasPorEstado, FiltrosPeriodo } from '../components/Graficos';
import { dashboardService, type FiltroIndicadores } from '../services/dashboard.service';

/** Período por defecto: los últimos 30 días (el mismo que aplica el backend). */
function periodoInicial(): FiltroIndicadores {
  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setDate(hoy.getDate() - 29);
  return { desde: fechaISO(desde), hasta: fechaISO(hoy) };
}

/** Indicadores del período elegido; se recalculan en el backend y se refrescan en vivo. */
function useIndicadores() {
  const [filtro, setFiltro] = useState<FiltroIndicadores>(periodoInicial);
  const indicadores = useConsulta(() => dashboardService.indicadores(filtro), [filtro]);
  const categorias = useConsulta(() => catalogService.categorias(), []);
  useRecargaEnVivo(indicadores.recargar);
  return { filtro, cambiar: (cambios: FiltroIndicadores) => setFiltro((f) => ({ ...f, ...cambios })), indicadores, categorias: categorias.datos ?? [] };
}

const subtituloPeriodo = (f: FiltroIndicadores) => (f.desde && f.hasta ? `Del ${formatoFecha(`${f.desde}T12:00:00`)} al ${formatoFecha(`${f.hasta}T12:00:00`)}` : '');

function CargaPorTecnico({ datos }: { datos: Indicadores['cargaPorTecnico'] }) {
  if (!datos.length) return <EstadoVacio titulo="No hay técnicos activos" />;
  return (
    <div className="pila md">
      {datos.map((t) => {
        const alLimite = t.activas >= t.maximo;
        return (
          <div key={t.tecnico_id}>
            <div className="fila separada" style={{ marginBottom: 4 }}>
              <span className="cuerpo-medio">{t.nombre}</span>
              <span className={`nota ${alLimite ? 'texto-alerta' : ''}`}>
                {t.activas} de {t.maximo} activas{t.disponible ? '' : ' · en pausa'}
              </span>
            </div>
            <Progreso valor={t.activas} maximo={t.maximo} tono={alLimite ? 'alerta' : undefined} etiqueta={`Carga de ${t.nombre}`} />
          </div>
        );
      })}
    </div>
  );
}

/** CO1 · Dashboard operativo del Coordinador: la cola de trabajo de hoy y el estado del equipo. */
export function DashboardOperativoPage() {
  const { filtro, cambiar, indicadores, categorias } = useIndicadores();
  // La cola de trabajo es el estado ACTUAL (no depende del período): totales directos del listado.
  const cola = useConsulta(
    () =>
      Promise.all([
        solicitudService.contar({ estado: 'REGISTRADA' }),
        solicitudService.contar({ estado: 'REGISTRADA', prioridad: 'CRITICA' }),
        solicitudService.contar({ estado: 'APROBADA' }),
        solicitudService.contar({ vencimiento: 'vencida' }),
        solicitudService.contar({ estado: 'PENDIENTE_INFO' }),
      ]),
    [],
  );
  const proximas = useConsulta(() => solicitudService.listar({ vencimiento: 'por_vencer', orden: 'vencimiento', limit: 5 }), []);
  useRecargaEnVivo(() => {
    cola.recargar();
    proximas.recargar();
  });
  const [porAprobar, criticas, aprobadas, vencidas, pendientes] = cola.datos ?? [];

  return (
    <>
      <Encabezado titulo="Dashboard operativo" subtitulo="Hoy · cola de trabajo y equipo técnico">
        <FiltrosPeriodo filtro={filtro} alCambiar={cambiar} categorias={categorias} />
      </Encabezado>
      {cola.error && <EstadoError mensaje={cola.error} alReintentar={cola.recargar} />}
      <div className="rejilla-kpi">
        <Kpi rotulo="Por aprobar" valor={porAprobar} nota={criticas ? `${criticas} ${criticas === 1 ? 'crítica' : 'críticas'}` : 'Ninguna crítica'} cargando={!cola.datos} />
        <Kpi rotulo="Aprobadas sin técnico" valor={aprobadas} nota="Listas para asignar" cargando={!cola.datos} />
        <Kpi rotulo="Vencidas" valor={vencidas} nota={vencidas ? 'Requieren seguimiento' : 'Todo dentro de plazo'} cargando={!cola.datos} />
        <Kpi rotulo="Pendientes de información" valor={pendientes} nota="Esperan al cliente" cargando={!cola.datos} />
      </div>
      <Contenido consulta={indicadores} filas={8}>
        {(i) => (
          <div className="dos-columnas">
            <div className="pila">
              <Tarjeta titulo="Solicitudes por estado" accion={<Link className="enlace" to="/solicitudes?vista=todas">Ver listado</Link>}>
                <BarrasPorEstado datos={i.porEstado} />
                <p className="nota">{subtituloPeriodo(filtro)} · {i.resumen.total} solicitudes registradas</p>
              </Tarjeta>
              <Tarjeta titulo="Entradas y resueltas" accion={<span className="nota">Por fecha</span>}>
                <BarrasEvolucion datos={i.evolucion} />
              </Tarjeta>
            </div>
            <div className="pila">
              <Tarjeta titulo="Carga por técnico" accion={<Link className="enlace" to="/carga">Ver equipo</Link>}>
                <CargaPorTecnico datos={i.cargaPorTecnico} />
              </Tarjeta>
              <Tarjeta titulo="Próximas a vencer" accion={<Link className="enlace" to="/solicitudes?vista=todas&vencimiento=por_vencer">Ver todas</Link>}>
                <Contenido consulta={proximas} filas={3}>
                  {({ data }) =>
                    data.length === 0 ? (
                      <EstadoVacio titulo="Nada por vencer">Ninguna solicitud abierta está cerca de su fecha límite.</EstadoVacio>
                    ) : (
                      <div className="pila md">
                        {data.map((s) => (
                          <Link key={s.id} to={`/solicitudes/${s.id}`} className="fila separada" style={{ textDecoration: 'none', flexWrap: 'nowrap' }}>
                            <span className="recortar">
                              {s.codigo} · {s.titulo}
                            </span>
                            <PlazoBadge solicitud={s} />
                          </Link>
                        ))}
                      </div>
                    )
                  }
                </Contenido>
              </Tarjeta>
            </div>
          </div>
        )}
      </Contenido>
    </>
  );
}

/** Descarga los indicadores del período como CSV (los mismos valores que muestra la pantalla). */
function exportarIndicadores(i: Indicadores) {
  const filas: Array<[string, string | number]> = [
    ['Período', `${i.filtros.desde} a ${i.filtros.hasta}`],
    ['Solicitudes', i.resumen.total],
    ['Abiertas', i.resumen.abiertas],
    ['A tiempo', i.cumplimiento.aTiempo],
    ['Fuera de plazo', i.cumplimiento.fueraDePlazo],
    ['Cumplimiento de plazos (%)', i.cumplimiento.porcentaje ?? ''],
    ['Tiempo medio de resolución (h)', i.tiempoResolucion.global ?? ''],
    ...i.porEstado.map((e): [string, number] => [`Estado: ${NOMBRE_ESTADO[e.codigo]}`, e.total]),
    ...i.porPrioridad.map((p): [string, number] => [`Prioridad: ${p.nombre}`, p.total]),
  ];
  const blob = new Blob([`﻿${filas.map((f) => f.join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `indicadores_${i.filtros.desde}_${i.filtros.hasta}.csv`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

/** A1 · Reportes globales del Administrador: gestión del período (cumplimiento, tiempos, datos maestros). */
export function ReportesPage() {
  const { filtro, cambiar, indicadores, categorias } = useIndicadores();
  const maestros = useConsulta(
    () =>
      Promise.all([clientService.listar({ activo: true, limit: 100 }), technicianService.listar({ limit: 100 })]).then(([clientes, tecnicos]) => ({
        clientes: clientes.meta.total,
        sedes: clientes.data.reduce((n, c) => n + c.total_sedes, 0),
        tecnicos: tecnicos.data.filter((t) => t.activo).length,
      })),
    [],
  );
  const i = indicadores.datos;
  const evaluadas = i ? i.cumplimiento.aTiempo + i.cumplimiento.fueraDePlazo : 0;

  return (
    <>
      <Encabezado titulo="Reportes globales" subtitulo={`${subtituloPeriodo(filtro)} · todas las sedes`}>
        <FiltrosPeriodo filtro={filtro} alCambiar={cambiar} categorias={categorias} />
      </Encabezado>
      <div className="rejilla-kpi">
        <Kpi rotulo="Solicitudes" valor={i?.resumen.total} nota={i ? `${i.resumen.abiertas} abiertas` : undefined} cargando={!i} />
        <Kpi rotulo="Fuera de plazo" valor={i?.cumplimiento.fueraDePlazo} nota={i ? `${i.vencimientos.vencidas} abiertas vencidas` : undefined} cargando={!i} />
        <Kpi rotulo="Cumplimiento de plazos" valor={porcentaje(i?.cumplimiento.porcentaje ?? null)} nota={i ? `${i.cumplimiento.aTiempo} de ${evaluadas} a tiempo` : undefined} cargando={!i} />
        <Kpi rotulo="Tiempo medio de resolución" valor={horasPromedio(i?.tiempoResolucion.global ?? null)} nota="Del registro a la resolución" cargando={!i} />
      </div>
      <Contenido consulta={indicadores} filas={8}>
        {(datos) => (
          <div className="dos-columnas">
            <div className="pila">
              <Tarjeta titulo="Solicitudes por estado" accion={<button type="button" className="enlace" onClick={() => exportarIndicadores(datos)}>Exportar</button>}>
                <BarrasPorEstado datos={datos.porEstado} />
              </Tarjeta>
              <Tarjeta titulo="Evolución en el tiempo" accion={<span className="nota">Creadas y resueltas</span>}>
                <BarrasEvolucion datos={datos.evolucion} />
              </Tarjeta>
            </div>
            <div className="pila">
              <Tarjeta titulo="Cumplimiento por prioridad">
                <div className="pila md">
                  {[...datos.porPrioridad].reverse().map((p) => (
                    <div key={p.codigo}>
                      <div className="fila separada" style={{ marginBottom: 4 }}>
                        <Prioridad nivel={p.codigo} />
                        <span className="nota">{p.cumplimiento === null ? 'Sin datos' : `${porcentaje(p.cumplimiento)} a tiempo`}</span>
                      </div>
                      <Progreso valor={p.cumplimiento ?? 0} maximo={100} etiqueta={`Cumplimiento de la prioridad ${p.nombre}`} />
                    </div>
                  ))}
                </div>
              </Tarjeta>
              <Tarjeta titulo="Tiempo medio por prioridad">
                {datos.tiempoResolucion.porPrioridad.map((p) => (
                  <Par key={p.codigo} rotulo={`${p.nombre} · ${p.resueltas} resueltas`}>
                    {horasPromedio(p.horas)}
                  </Par>
                ))}
              </Tarjeta>
              <Tarjeta titulo="Datos maestros" accion={<Link className="enlace" to="/clientes">Administrar</Link>}>
                <Contenido consulta={maestros} filas={3}>
                  {(m) => (
                    <>
                      <Par rotulo="Clientes activos">{m.clientes}</Par>
                      <Par rotulo="Sedes registradas">{m.sedes}</Par>
                      <Par rotulo="Técnicos activos">{m.tecnicos}</Par>
                    </>
                  )}
                </Contenido>
              </Tarjeta>
            </div>
          </div>
        )}
      </Contenido>
    </>
  );
}

/** T1 · Mi panel del Técnico: lo que debe atender hoy, su carga y su disponibilidad. */
export function PanelTecnicoPage() {
  const usuario = useUsuario();
  const avisos = useAvisos();
  const { recientes } = useTiempoReal();
  const ficha = useConsulta(() => technicianService.detalle(usuario.tecnicoId!), [usuario.tecnicoId]);
  const indicadores = useConsulta(() => dashboardService.indicadores(), []);
  const activas = useConsulta(() => solicitudService.listar({ estado: 'ASIGNADA,EN_PROCESO,PENDIENTE_INFO', orden: 'vencimiento', limit: 5 }), []);
  const urgentes = useConsulta(() => Promise.all([solicitudService.contar({ vencimiento: 'por_vencer' }), solicitudService.contar({ vencimiento: 'vencida' })]), []);
  useRecargaEnVivo(() => {
    ficha.recargar();
    indicadores.recargar();
    activas.recargar();
    urgentes.recargar();
  });

  const t = ficha.datos;
  const i = indicadores.datos;
  const cambiarDisponibilidad = async (disponible: boolean) => {
    try {
      await technicianService.cambiarDisponibilidad(disponible);
      avisos.exito(disponible ? 'Ahora estás disponible para asignaciones' : 'Quedaste en pausa: no recibirás nuevas asignaciones');
      ficha.recargar();
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <>
      <Encabezado titulo={`Hola, ${primerNombre(usuario.nombre)}`} subtitulo={t ? `Tienes ${t.carga_actual} ${t.carga_actual === 1 ? 'solicitud activa' : 'solicitudes activas'} · tu límite es de ${t.max_solicitudes_activas}` : undefined}>
        <label className="fila cuerpo-medio" style={{ gap: 12 }}>
          Disponible para asignaciones
          <Switch checked={t?.disponible ?? false} disabled={!t} onChange={(e) => void cambiarDisponibilidad(e.target.checked)} />
        </label>
      </Encabezado>
      <div className="rejilla-kpi">
        <Kpi rotulo="Activas" valor={t?.carga_actual} nota={t ? `Límite: ${t.max_solicitudes_activas} simultáneas` : undefined} cargando={!t} />
        <Kpi rotulo="Por vencer" valor={urgentes.datos?.[0]} nota={urgentes.datos?.[1] ? `${urgentes.datos[1]} ya vencidas` : 'Ninguna vencida'} cargando={!urgentes.datos} />
        <Kpi rotulo="Resueltas" valor={i ? i.resumen.resueltas + i.resumen.cerradas : undefined} nota="Últimos 30 días" cargando={!i} />
        <Kpi rotulo="Cumplimiento de plazos" valor={porcentaje(i?.cumplimiento.porcentaje ?? null)} nota={i ? `${i.cumplimiento.aTiempo} a tiempo · ${i.cumplimiento.fueraDePlazo} fuera de plazo` : undefined} cargando={!i} />
      </div>
      <div className="dos-columnas">
        <Tarjeta titulo="Para atender primero" accion={<Link className="enlace" to="/solicitudes">Ver todas</Link>}>
          <Contenido consulta={activas}>
            {({ data }) =>
              data.length === 0 ? (
                <EstadoVacio titulo="No tienes solicitudes activas">Cuando te asignen una, aparecerá aquí.</EstadoVacio>
              ) : (
                <>
                  <div className="tabla-contenedor">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Solicitud</th>
                          <th>Prioridad</th>
                          <th>Plazo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((s) => (
                          <tr key={s.id}>
                            <td className="codigo">{s.codigo}</td>
                            <td>
                              <Link className="enlace" to={`/solicitudes/${s.id}`}>
                                {s.titulo}
                              </Link>
                            </td>
                            <td>
                              <Prioridad nivel={s.prioridad} />
                            </td>
                            <td>
                              <PlazoBadge solicitud={s} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="nota" style={{ marginTop: 12 }}>
                    Ordenadas por fecha límite: lo más urgente aparece arriba.
                  </p>
                </>
              )
            }
          </Contenido>
        </Tarjeta>
        <div className="pila">
          <Tarjeta titulo="Mi carga de trabajo">
            {t ? (
              <>
                <div className="fila separada" style={{ marginBottom: 8 }}>
                  <span className="cuerpo-medio">
                    {t.carga_actual} de {t.max_solicitudes_activas} activas
                  </span>
                  <span className="nota">{Math.max(0, t.max_solicitudes_activas - t.carga_actual)} cupos libres</span>
                </div>
                <Progreso valor={t.carga_actual} maximo={t.max_solicitudes_activas} tono={t.carga_actual >= t.max_solicitudes_activas ? 'alerta' : undefined} etiqueta="Mi carga de trabajo" />
              </>
            ) : (
              <div className="esqueleto" style={{ height: 32 }} />
            )}
          </Tarjeta>
          <Tarjeta titulo="Notificaciones recientes" accion={<Link className="enlace" to="/notificaciones">Ver todas</Link>}>
            {recientes.length === 0 ? (
              <EstadoVacio titulo="Sin notificaciones" />
            ) : (
              recientes.slice(0, 3).map((n) => (
                <Link key={n.id} to={n.solicitud_id ? `/solicitudes/${n.solicitud_id}` : '/notificaciones'} className={`fila-notificacion ${n.leida ? '' : 'nueva'}`} style={{ textDecoration: 'none' }}>
                  <span className="punto" aria-hidden="true" />
                  <span>
                    <span className="titulo-n">
                      {n.titulo}
                      {n.solicitud_codigo ? `: ${n.solicitud_codigo}` : ''}
                    </span>
                    <span className="nota" style={{ display: 'block' }}>
                      {fechaRelativa(n.created_at)}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
