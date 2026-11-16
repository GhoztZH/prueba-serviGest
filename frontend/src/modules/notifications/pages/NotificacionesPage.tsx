import Button from '@mui/material/Button';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAvisos } from '../../../app/providers/AvisosProvider';
import { useTiempoReal } from '../../../app/providers/TiempoRealProvider';
import { Contenido, Encabezado, EstadoVacio, Paginacion, Tarjeta } from '../../../shared/components/layout';
import { useConsulta } from '../../../shared/hooks/hooks';
import type { Notificacion } from '../../../shared/types/api';
import { fechaRelativa, formatoFechaHora } from '../../../shared/utils/format';
import { notificationService } from '../services/notification.service';

const LIMITE = 12;

/**
 * A10 / CO7 / T4 / C4 · Notificaciones del usuario.
 * Centro de notificaciones completo: filtrado por leídas/no leídas,
 * marcado individual o masivo y actualización reactiva en vivo vía SSE.
 */
export function NotificacionesPage() {
  const avisos = useAvisos();
  const { version, marcarLeida: marcarLeidaContexto, marcarTodas: marcarTodasContexto } = useTiempoReal();

  const [pagina, setPagina] = useState(1);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);

  const notificacionesConsulta = useConsulta(
    () =>
      notificationService.listar({
        page: pagina,
        limit: LIMITE,
        no_leidas: soloNoLeidas ? true : undefined,
      }),
    [pagina, soloNoLeidas, version],
  );

  const marcarUna = async (n: Notificacion) => {
    if (n.leida) return;
    try {
      await marcarLeidaContexto(n.id);
      notificacionesConsulta.recargar();
    } catch (e) {
      avisos.error(e);
    }
  };

  const marcarTodas = async () => {
    try {
      await marcarTodasContexto();
      avisos.exito('Todas las notificaciones marcadas como leídas');
      notificacionesConsulta.recargar();
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <>
      <Encabezado
        titulo="Notificaciones"
        subtitulo="Avisos sobre cambios de estado, asignaciones, vencimientos y comentarios en tus solicitudes"
      >
        <div className="fila" style={{ gap: 'var(--space-md)' }}>
          <Button
            variant="text"
            onClick={() => void marcarTodas()}
            disabled={notificacionesConsulta.datos?.noLeidas === 0}
          >
            Marcar todas como leídas
          </Button>
        </div>
      </Encabezado>

      <Tarjeta>
        <div className="fila separada" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="pestanas" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className="pestana"
              aria-selected={!soloNoLeidas}
              onClick={() => {
                setSoloNoLeidas(false);
                setPagina(1);
              }}
            >
              Todas
            </button>
            <button
              type="button"
              className="pestana"
              aria-selected={soloNoLeidas}
              onClick={() => {
                setSoloNoLeidas(true);
                setPagina(1);
              }}
            >
              Sin leer
              {(notificacionesConsulta.datos?.noLeidas ?? 0) > 0
                ? ` (${notificacionesConsulta.datos?.noLeidas})`
                : ''}
            </button>
          </div>
        </div>

        <Contenido consulta={notificacionesConsulta}>
          {({ data, meta }) =>
            data.length === 0 ? (
              <EstadoVacio titulo="No tienes notificaciones">
                {soloNoLeidas
                  ? 'No tienes notificaciones pendientes por leer.'
                  : 'Aquí aparecerán los avisos sobre tus solicitudes.'}
              </EstadoVacio>
            ) : (
              <>
                <div className="lista-notificaciones">
                  {data.map((n: Notificacion) => (
                    <div
                      key={n.id}
                      className={`fila-notificacion ${n.leida ? '' : 'nueva'}`}
                      style={{ padding: 'var(--space-md) var(--space-lg)' }}
                    >
                      <span className="punto" aria-hidden="true" style={{ marginTop: 6 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="fila separada">
                          <span className="titulo-n">
                            {n.titulo}
                            {n.solicitud_codigo && (
                              <span className="codigo" style={{ marginLeft: 6 }}>
                                · {n.solicitud_codigo}
                              </span>
                            )}
                          </span>
                          <span className="nota" title={formatoFechaHora(n.created_at)}>
                            {fechaRelativa(n.created_at)}
                          </span>
                        </div>
                        <p style={{ marginTop: 4, color: 'var(--color-text)' }}>{n.mensaje}</p>
                        <div className="fila" style={{ gap: 'var(--space-lg)', marginTop: 8 }}>
                          {n.solicitud_id && (
                            <Link
                              className="enlace"
                              to={`/solicitudes/${n.solicitud_id}`}
                              onClick={() => void marcarUna(n)}
                            >
                              Ver solicitud
                            </Link>
                          )}
                          {!n.leida && (
                            <button
                              type="button"
                              className="enlace"
                              onClick={() => void marcarUna(n)}
                            >
                              Marcar como leída
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Paginacion
                  meta={meta}
                  alCambiar={setPagina}
                  sustantivo="notificaciones"
                />
              </>
            )
          }
        </Contenido>
      </Tarjeta>
    </>
  );
}
