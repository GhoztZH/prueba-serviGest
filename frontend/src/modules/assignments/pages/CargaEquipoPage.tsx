import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRecargaEnVivo } from '../../../app/providers/TiempoRealProvider';
import { DisponibilidadBadge, PlazoBadge, Segmentos } from '../../../shared/components/atoms';
import { Aviso, Contenido, Encabezado, EstadoVacio, Kpi, Tarjeta } from '../../../shared/components/layout';
import { useConsulta } from '../../../shared/hooks/hooks';
import type { Tecnico } from '../../../shared/types/api';
import { solicitudService } from '../../requests/services/solicitud.service';
import { technicianService } from '../../technicians/services/technician.service';

/**
 * CO4 · Carga del equipo técnico (Coordinador).
 * Supervisión del estado operativo del equipo, detección de técnicos al límite
 * y acceso directo a las solicitudes aprobadas pendientes de asignación.
 */
export function CargaEquipoPage() {
  const tecnicosConsulta = useConsulta(() => technicianService.listar({ limit: 100 }), []);
  const porAsignarConsulta = useConsulta(
    () => solicitudService.listar({ estado: 'APROBADA', orden: 'vencimiento', limit: 10 }),
    [],
  );

  useRecargaEnVivo(() => {
    tecnicosConsulta.recargar();
    porAsignarConsulta.recargar();
  });

  const tecnicos = useMemo(() => tecnicosConsulta.datos?.data ?? [], [tecnicosConsulta.datos]);
  const tecnicosOrdenados = useMemo(() => {
    return [...tecnicos].sort((a, b) => {
      // Ordenar por ocupación descendente
      const ratioA = a.max_solicitudes_activas > 0 ? a.carga_actual / a.max_solicitudes_activas : 0;
      const ratioB = b.max_solicitudes_activas > 0 ? b.carga_actual / b.max_solicitudes_activas : 0;
      return ratioB - ratioA;
    });
  }, [tecnicos]);

  const alLimite = useMemo(
    () => tecnicos.filter((t) => t.activo && t.carga_actual >= t.max_solicitudes_activas),
    [tecnicos],
  );
  const disponibles = useMemo(
    () => tecnicos.filter((t) => t.activo && t.disponible && t.carga_actual < t.max_solicitudes_activas),
    [tecnicos],
  );
  const enPausa = useMemo(
    () => tecnicos.filter((t) => t.activo && !t.disponible),
    [tecnicos],
  );

  return (
    <>
      <Encabezado
        titulo="Carga del equipo"
        subtitulo="Distribución de trabajo y disponibilidad de técnicos para nuevas asignaciones"
      />

      {alLimite.length > 0 && (
        <Aviso
          tono="alerta"
          titulo={`${alLimite.length} ${alLimite.length === 1 ? 'técnico está' : 'técnicos están'} al límite de capacidad`}
        >
          {alLimite.map((t) => t.nombre).join(', ')} no pueden recibir nuevas asignaciones hasta resolver solicitudes activas.
        </Aviso>
      )}

      <div className="rejilla-kpi">
        <Kpi
          rotulo="Total técnicos"
          valor={tecnicos.length}
          nota={`${tecnicos.filter((t) => t.activo).length} activos`}
          cargando={tecnicosConsulta.cargando}
        />
        <Kpi
          rotulo="Disponibles"
          valor={disponibles.length}
          nota="Con capacidad libre"
          cargando={tecnicosConsulta.cargando}
        />
        <Kpi
          rotulo="Al límite"
          valor={alLimite.length}
          nota={alLimite.length ? 'Capacidad máxima alcanzada' : 'Ninguno saturado'}
          cargando={tecnicosConsulta.cargando}
        />
        <Kpi
          rotulo="En pausa"
          valor={enPausa.length}
          nota="No disponibles temporalmente"
          cargando={tecnicosConsulta.cargando}
        />
      </div>

      <div className="dos-columnas">
        <Tarjeta titulo="Capacidad y ocupación por técnico">
          <Contenido consulta={tecnicosConsulta}>
            {() =>
              tecnicosOrdenados.length === 0 ? (
                <EstadoVacio titulo="No hay técnicos registrados" />
              ) : (
                <div className="tabla-contenedor">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Técnico</th>
                        <th>Especialidades</th>
                        <th>Carga</th>
                        <th>Estado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tecnicosOrdenados.map((t: Tecnico) => (
                        <tr key={t.id}>
                          <td>
                            <div className="principal-celda">{t.nombre}</div>
                            <div className="nota">{t.email}</div>
                          </td>
                          <td>
                            <span className="recortar" style={{ maxWidth: 180, display: 'inline-block' }}>
                              {t.especialidades.map((e) => e.nombre).join(', ') || 'Sin especialidades'}
                            </span>
                          </td>
                          <td>
                            <div className="fila" style={{ gap: 8 }}>
                              <Segmentos
                                carga={t.carga_actual}
                                maximo={t.max_solicitudes_activas}
                                enPausa={!t.disponible}
                              />
                              <span className="nota">
                                {t.carga_actual}/{t.max_solicitudes_activas}
                              </span>
                            </div>
                          </td>
                          <td>
                            <DisponibilidadBadge
                              disponible={t.disponible}
                              carga={t.carga_actual}
                              maximo={t.max_solicitudes_activas}
                              activo={t.activo}
                            />
                          </td>
                          <td>
                            <Link className="enlace" to={`/solicitudes?tecnico=${t.id}`}>
                              Ver solicitudes
                            </Link>
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

        <div className="pila">
          <Tarjeta
            titulo="Por asignar"
            accion={
              <Link className="enlace" to="/solicitudes?vista=curso">
                Ver en curso
              </Link>
            }
          >
            <p className="nota" style={{ marginBottom: 12 }}>
              Solicitudes aprobadas en espera de un técnico calificado.
            </p>
            <Contenido consulta={porAsignarConsulta} filas={3}>
              {({ data }) =>
                data.length === 0 ? (
                  <EstadoVacio titulo="No hay solicitudes pendientes de asignación">
                    Todas las solicitudes aprobadas ya cuentan con técnico asignado.
                  </EstadoVacio>
                ) : (
                  <div className="pila md">
                    {data.map((s) => (
                      <div key={s.id} className="tarjeta seleccionable" style={{ padding: 'var(--space-md)' }}>
                        <div className="fila separada" style={{ marginBottom: 4 }}>
                          <span className="codigo">{s.codigo}</span>
                          <PlazoBadge solicitud={s} />
                        </div>
                        <div className="cuerpo-medio recortar" style={{ marginBottom: 4 }}>
                          {s.titulo}
                        </div>
                        <div className="fila separada">
                          <span className="nota">{s.categoria_nombre}</span>
                          <Link className="enlace" to={`/solicitudes/${s.id}`}>
                            Asignar
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </Contenido>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
