import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecargaEnVivo } from '../../../app/providers/TiempoRealProvider';
import { DisponibilidadBadge, Segmentos } from '../../../shared/components/atoms';
import { Filtro } from '../../../shared/components/forms';
import { Buscador, Contenido, Encabezado, EstadoVacio, Paginacion, Tarjeta } from '../../../shared/components/layout';
import { useConsulta, useRetardo } from '../../../shared/hooks/hooks';
import type { Tecnico } from '../../../shared/types/api';
import { catalogService } from '../../catalogs/services/catalog.service';
import { technicianService } from '../services/technician.service';

const LIMITE = 10;

/**
 * CO5 · Consulta de técnicos (Coordinador).
 * Vista de solo lectura para revisar las competencias del equipo, estado de disponibilidad
 * y carga actual, sin opciones de edición de datos maestros.
 */
export function TecnicosPage() {
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [especialidadId, setEspecialidadId] = useState('');
  const [disponible, setDisponible] = useState<string>('');
  const q = useRetardo(busqueda);

  const especialidadesConsulta = useConsulta(() => catalogService.especialidades(true), []);

  const tecnicosConsulta = useConsulta(
    () =>
      technicianService.listar({
        page: pagina,
        limit: LIMITE,
        q,
        especialidad_id: especialidadId ? Number(especialidadId) : undefined,
        disponible: disponible === '' ? '' : disponible === 'true',
      }),
    [pagina, q, especialidadId, disponible],
  );

  useRecargaEnVivo(() => {
    tecnicosConsulta.recargar();
  });

  return (
    <>
      <Encabezado
        titulo="Técnicos"
        subtitulo="Consulta de personal técnico, especialidades y carga asignada"
      />

      <Tarjeta>
        <div className="fila separada" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="fila" style={{ gap: 'var(--space-md)', flex: 1 }}>
            <Buscador
              valor={busqueda}
              alCambiar={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por nombre, correo o cédula…"
              ancho={300}
            />
            <Filtro
              etiqueta="Especialidad"
              valor={especialidadId}
              opciones={(especialidadesConsulta.datos ?? []).map((e) => ({
                valor: e.id,
                texto: e.nombre,
              }))}
              alCambiar={(v) => {
                setEspecialidadId(v);
                setPagina(1);
              }}
            />
            <Filtro
              etiqueta="Disponibilidad"
              valor={disponible}
              opciones={[
                { valor: 'true', texto: 'Disponible' },
                { valor: 'false', texto: 'En pausa' },
              ]}
              alCambiar={(v) => {
                setDisponible(v);
                setPagina(1);
              }}
            />
          </div>
        </div>

        <Contenido consulta={tecnicosConsulta}>
          {({ data, meta }) =>
            data.length === 0 ? (
              <EstadoVacio titulo="No se encontraron técnicos">
                Prueba ajustando los filtros o el texto de búsqueda.
              </EstadoVacio>
            ) : (
              <>
                <div className="tabla-contenedor">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Técnico</th>
                        <th>Cédula</th>
                        <th>Teléfono</th>
                        <th>Especialidades</th>
                        <th>Carga</th>
                        <th>Estado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((t: Tecnico) => (
                        <tr key={t.id}>
                          <td>
                            <div className="principal-celda">{t.nombre}</div>
                            <div className="nota">{t.email}</div>
                          </td>
                          <td className="codigo">{t.cedula}</td>
                          <td>{t.telefono ?? '—'}</td>
                          <td>
                            <span className="recortar" style={{ maxWidth: 200, display: 'inline-block' }}>
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

                <Paginacion
                  meta={meta}
                  alCambiar={setPagina}
                  sustantivo="técnicos"
                />
              </>
            )
          }
        </Contenido>
      </Tarjeta>
    </>
  );
}
