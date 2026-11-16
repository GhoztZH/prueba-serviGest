import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { useState } from 'react';
import { Selector } from '../../../shared/components/forms';
import { Contenido, Encabezado, EstadoVacio, Paginacion, Tarjeta } from '../../../shared/components/layout';
import { useConsulta } from '../../../shared/hooks/hooks';
import type { RegistroAuditoria } from '../../../shared/types/api';
import { formatoFechaHora } from '../../../shared/utils/format';
import { auditService } from '../services/audit.service';

const LIMITE = 12;

const ENTIDADES = [
  { valor: '', texto: 'Todas las entidades' },
  { valor: 'usuarios', texto: 'Usuarios' },
  { valor: 'clientes', texto: 'Clientes' },
  { valor: 'sedes', texto: 'Sedes' },
  { valor: 'tecnicos', texto: 'Técnicos' },
  { valor: 'solicitudes', texto: 'Solicitudes' },
  { valor: 'asignaciones', texto: 'Asignaciones' },
  { valor: 'categorias', texto: 'Categorías' },
  { valor: 'especialidades', texto: 'Especialidades' },
  { valor: 'prioridades', texto: 'Prioridades' },
  { valor: 'parametros', texto: 'Parámetros' },
];

/**
 * Auditoría del sistema (Administrador).
 * Registro inmutable de eventos, modificaciones de datos maestros, cambios de estado
 * y acciones operativas con trazabilidad de usuario, fecha y valores previos/posteriores.
 */
export function AuditoriaPage() {
  const [pagina, setPagina] = useState(1);
  const [entidad, setEntidad] = useState('');
  const [registroDetalle, setRegistroDetalle] = useState<RegistroAuditoria | null>(null);

  const auditoriaConsulta = useConsulta(
    () =>
      auditService.listar({
        page: pagina,
        limit: LIMITE,
        entidad: entidad || undefined,
      }),
    [pagina, entidad],
  );

  return (
    <>
      <Encabezado
        titulo="Auditoría"
        subtitulo="Trazabilidad histórica de operaciones, cambios de datos y accesos al sistema"
      />

      <Tarjeta>
        <div className="fila separada" style={{ marginBottom: 'var(--space-lg)' }}>
          <Selector
            etiqueta="Filtrar por entidad"
            value={entidad}
            opciones={ENTIDADES}
            onChange={(e) => {
              setEntidad(String(e.target.value));
              setPagina(1);
            }}
            style={{ width: 240 }}
          />
        </div>

        <Contenido consulta={auditoriaConsulta}>
          {({ data, meta }) =>
            data.length === 0 ? (
              <EstadoVacio titulo="No se encontraron registros de auditoría" />
            ) : (
              <>
                <div className="tabla-contenedor">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Fecha y hora</th>
                        <th>Usuario</th>
                        <th>Entidad</th>
                        <th>ID</th>
                        <th>Acción</th>
                        <th>IP</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((r: RegistroAuditoria) => (
                        <tr key={r.id}>
                          <td className="nota" style={{ whiteSpace: 'nowrap' }}>
                            {formatoFechaHora(r.fecha)}
                          </td>
                          <td>
                            <div className="principal-celda">{r.usuario_nombre ?? 'Sistema'}</div>
                          </td>
                          <td>
                            <span className="badge rol">{r.entidad}</span>
                          </td>
                          <td className="codigo">{r.entidad_id ?? '—'}</td>
                          <td>
                            <span className="badge neutro">{r.accion}</span>
                          </td>
                          <td className="codigo">{r.ip ?? '—'}</td>
                          <td>
                            <button
                              type="button"
                              className="enlace"
                              onClick={() => setRegistroDetalle(r)}
                            >
                              Ver cambios
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Paginacion
                  meta={meta}
                  alCambiar={setPagina}
                  sustantivo="registros"
                />
              </>
            )
          }
        </Contenido>
      </Tarjeta>

      {/* Modal Detalle Antes / Después */}
      <Dialog
        open={Boolean(registroDetalle)}
        onClose={() => setRegistroDetalle(null)}
        maxWidth="md"
        fullWidth
      >
        {registroDetalle && (
          <div className="pila">
            <div className="tarjeta-cabecera">
              <div>
                <h2 className="titulo-seccion">Detalle del registro #{registroDetalle.id}</h2>
                <div className="nota">
                  {formatoFechaHora(registroDetalle.fecha)} · Por{' '}
                  <strong>{registroDetalle.usuario_nombre ?? 'Sistema'}</strong> ({registroDetalle.ip ?? 'IP no registrada'})
                </div>
              </div>
            </div>

            <div className="fila" style={{ gap: 'var(--space-md)' }}>
              <span className="badge rol">Entidad: {registroDetalle.entidad}</span>
              <span className="badge neutro">Acción: {registroDetalle.accion}</span>
              {registroDetalle.entidad_id && (
                <span className="codigo">ID afectado: {registroDetalle.entidad_id}</span>
              )}
            </div>

            <div className="dos-columnas" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="tarjeta" style={{ background: 'var(--color-bg)' }}>
                <div className="etiqueta" style={{ marginBottom: 8 }}>
                  Datos anteriores (Antes)
                </div>
                <pre
                  style={{
                    fontSize: 12,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: 280,
                    overflowY: 'auto',
                  }}
                >
                  {registroDetalle.datos_antes
                    ? JSON.stringify(registroDetalle.datos_antes, null, 2)
                    : '(Sin datos previos / Creación)'}
                </pre>
              </div>

              <div className="tarjeta" style={{ background: 'var(--color-bg)' }}>
                <div className="etiqueta" style={{ marginBottom: 8 }}>
                  Datos nuevos (Después)
                </div>
                <pre
                  style={{
                    fontSize: 12,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: 280,
                    overflowY: 'auto',
                  }}
                >
                  {registroDetalle.datos_despues
                    ? JSON.stringify(registroDetalle.datos_despues, null, 2)
                    : '(Sin datos posteriores / Eliminación)'}
                </pre>
              </div>
            </div>

            <div className="fila final">
              <Button onClick={() => setRegistroDetalle(null)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
