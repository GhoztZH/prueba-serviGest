import Switch from '@mui/material/Switch';
import { useUsuario } from '../../../app/providers/AuthProvider';
import { useAvisos } from '../../../app/providers/AvisosProvider';
import { useRecargaEnVivo } from '../../../app/providers/TiempoRealProvider';
import { DisponibilidadBadge, Par, Progreso } from '../../../shared/components/atoms';
import { Aviso, Contenido, Encabezado, Tarjeta } from '../../../shared/components/layout';
import { useConsulta } from '../../../shared/hooks/hooks';
import { technicianService } from '../services/technician.service';

/**
 * Disponibilidad del Técnico.
 * Permite al técnico pausar o reanudar su disponibilidad para recibir nuevas asignaciones.
 */
export function DisponibilidadPage() {
  const usuario = useUsuario();
  const avisos = useAvisos();

  const tecnicoConsulta = useConsulta(
    () => (usuario.tecnicoId ? technicianService.detalle(usuario.tecnicoId) : Promise.resolve(null)),
    [usuario.tecnicoId],
  );

  useRecargaEnVivo(() => {
    tecnicoConsulta.recargar();
  });

  const cambiar = async (disponible: boolean) => {
    try {
      await technicianService.cambiarDisponibilidad(disponible);
      avisos.exito(disponible ? 'Disponibilidad activada' : 'Disponibilidad en pausa');
      tecnicoConsulta.recargar();
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <>
      <Encabezado
        titulo="Disponibilidad"
        subtitulo="Gestiona tu disponibilidad para recibir nuevas solicitudes de servicio técnico"
      />

      <Contenido consulta={tecnicoConsulta}>
        {(tecnico) => {
          if (!tecnico) return <Aviso tono="alerta" titulo="No se encontró el perfil de técnico" />;

          const alLimite = tecnico.carga_actual >= tecnico.max_solicitudes_activas;

          return (
            <div className="dos-columnas">
              <div className="pila">
                <Tarjeta titulo="Estado de asignaciones">
                  <div className="fila-ajuste">
                    <div>
                      <div className="cuerpo-medio">Recibir nuevas solicitudes</div>
                      <div className="nota">
                        Si desactivas esta opción, el Coordinador verá tu perfil en pausa y no te sugerirá para asignaciones.
                      </div>
                    </div>
                    <Switch
                      checked={tecnico.disponible}
                      onChange={(e) => void cambiar(e.target.checked)}
                      disabled={!tecnico.activo}
                    />
                  </div>

                  <div style={{ marginTop: 'var(--space-lg)' }}>
                    <div className="fila separada" style={{ marginBottom: 8 }}>
                      <span className="cuerpo-medio">Ocupación actual</span>
                      <DisponibilidadBadge
                        disponible={tecnico.disponible}
                        carga={tecnico.carga_actual}
                        maximo={tecnico.max_solicitudes_activas}
                        activo={tecnico.activo}
                      />
                    </div>
                    <Progreso
                      valor={tecnico.carga_actual}
                      maximo={tecnico.max_solicitudes_activas}
                      tono={alLimite ? 'alerta' : undefined}
                      etiqueta="Carga de trabajo actual"
                    />
                    <div className="nota" style={{ marginTop: 8 }}>
                      {tecnico.carga_actual} de {tecnico.max_solicitudes_activas} solicitudes activas
                      {alLimite && ' · Capacidad máxima alcanzada'}
                    </div>
                  </div>
                </Tarjeta>
              </div>

              <div className="pila">
                <Tarjeta titulo="Detalles de mi perfil">
                  <Par rotulo="Cédula">{tecnico.cedula}</Par>
                  <Par rotulo="Teléfono">{tecnico.telefono ?? 'No registrado'}</Par>
                  <Par rotulo="Capacidad máxima">{tecnico.max_solicitudes_activas} solicitudes</Par>
                  <div className="divisor" />
                  <div className="rotulo" style={{ marginBottom: 'var(--space-sm)' }}>
                    Especialidades asignadas:
                  </div>
                  <div className="fila" style={{ gap: 'var(--space-xs)' }}>
                    {tecnico.especialidades.length === 0 ? (
                      <span className="nota">Ninguna especialidad</span>
                    ) : (
                      tecnico.especialidades.map((esp) => (
                        <span key={esp.id} className="badge rol">
                          {esp.nombre}
                        </span>
                      ))
                    )}
                  </div>
                </Tarjeta>
              </div>
            </div>
          );
        }}
      </Contenido>
    </>
  );
}
