import { Link } from 'react-router-dom';
import { Encabezado, Tarjeta } from '../../../shared/components/layout';

/**
 * C6 · Centro de Ayuda para Clientes.
 * Preguntas frecuentes, guía del ciclo de vida de una solicitud,
 * explicación de prioridades y canales de contacto técnico.
 */
export function AyudaPage() {
  return (
    <>
      <Encabezado
        titulo="Centro de ayuda"
        subtitulo="Guías y preguntas frecuentes sobre el registro, seguimiento y resolución de solicitudes técnicas"
      />

      <div className="dos-columnas">
        <div className="pila">
          {/* Guía rápida */}
          <Tarjeta titulo="¿Cómo solicitar servicio técnico?">
            <div className="pila md">
              <p>
                Para reportar una incidencia o requerimiento en tus instalaciones, dirígete a{' '}
                <Link className="enlace" to="/solicitudes/nueva">
                  Nueva solicitud
                </Link>
                . Completa los siguientes pasos:
              </p>
              <ol className="pila sm" style={{ paddingLeft: 'var(--space-lg)', margin: 0 }}>
                <li>
                  <strong>Selecciona la sede afectada:</strong> Elige la oficina o sucursal donde se encuentra el equipo.
                </li>
                <li>
                  <strong>Identifica la categoría y el equipo:</strong> Selecciona el tipo de servicio técnico e indica el equipo (código, marca o modelo).
                </li>
                <li>
                  <strong>Describe el problema con claridad:</strong> Explica qué ocurre, desde cuándo y su impacto operativo.
                </li>
                <li>
                  <strong>Adjunta archivos o fotos:</strong> Si dispones de capturas del error o fotografías del equipo, agrégalas (hasta 5 archivos de 10 MB cada uno).
                </li>
              </ol>
            </div>
          </Tarjeta>

          {/* Preguntas frecuentes */}
          <Tarjeta titulo="Preguntas frecuentes">
            <div className="pila md">
              <div>
                <div className="cuerpo-medio">¿Qué significa el estado "Pendiente de información"?</div>
                <p className="nota" style={{ marginTop: 4 }}>
                  El técnico asignado ha revisado tu solicitud y requiere datos complementarios para continuar (por ejemplo, número de serie, pruebas realizadas o disponibilidad de acceso al lugar). Puedes responder escribiendo un comentario directamente en el detalle de la solicitud.
                </p>
              </div>

              <div className="divisor" />

              <div>
                <div className="cuerpo-medio">¿Cuándo se considera cerrada una solicitud?</div>
                <p className="nota" style={{ marginTop: 4 }}>
                  Cuando el técnico concluye los trabajos, marca la solicitud como <strong>Resuelta</strong> e ingresa el informe de solución. Como cliente, podrás revisar la resolución y proceder con el cierre definitivo o solicitar una reapertura si la falla persiste.
                </p>
              </div>

              <div className="divisor" />

              <div>
                <div className="cuerpo-medio">¿Cómo se calculan los plazos de atención?</div>
                <p className="nota" style={{ marginTop: 4 }}>
                  Cada solicitud tiene una fecha límite de cumplimiento calculada automáticamente según la prioridad asignada por el Coordinador. La plataforma te mostrará en todo momento el tiempo restante o si la solicitud se encuentra por vencer.
                </p>
              </div>

              <div className="divisor" />

              <div>
                <div className="cuerpo-medio">¿Por qué el sistema rechaza una solicitud por duplicidad?</div>
                <p className="nota" style={{ marginTop: 4 }}>
                  Para evitar solicitudes repetidas sobre la misma falla, el sistema impide registrar una nueva solicitud si ya existe una solicitud abierta para la misma sede, categoría y equipo afectado.
                </p>
              </div>
            </div>
          </Tarjeta>
        </div>

        {/* Panel lateral: Tiempos y Contacto */}
        <div className="pila">
          <Tarjeta titulo="Niveles de prioridad y SLA">
            <div className="pila sm">
              <div className="fila separada">
                <span className="badge error">Crítica</span>
                <span className="cuerpo-medio">Hasta 4 horas</span>
              </div>
              <p className="nota">Paralización total del servicio o afectación general grave.</p>

              <div className="divisor" />

              <div className="fila separada">
                <span className="badge alerta">Alta</span>
                <span className="cuerpo-medio">Hasta 8 horas</span>
              </div>
              <p className="nota">Afectación importante en procesos clave sin alternativa viable.</p>

              <div className="divisor" />

              <div className="fila separada">
                <span className="badge rol">Media</span>
                <span className="cuerpo-medio">Hasta 24 horas</span>
              </div>
              <p className="nota">Incidencia parcial que permite continuar operando.</p>

              <div className="divisor" />

              <div className="fila separada">
                <span className="badge neutro">Baja</span>
                <span className="cuerpo-medio">Hasta 48 horas</span>
              </div>
              <p className="nota">Consultas técnicas o mantenimientos preventivos.</p>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Mesa de ayuda ServiGest">
            <p className="nota" style={{ marginBottom: 'var(--space-md)' }}>
              Si requieres asistencia urgente o tienes problemas para ingresar al sistema, comunícate con nuestro centro de operaciones:
            </p>
            <div className="pila sm">
              <div>
                <div className="etiqueta">Teléfono directo:</div>
                <div className="cuerpo-medio">+593 4 299 0000</div>
              </div>
              <div>
                <div className="etiqueta">Correo de soporte:</div>
                <div className="cuerpo-medio">soporte@servigest.ec</div>
              </div>
              <div>
                <div className="etiqueta">Horario de atención:</div>
                <div className="nota">Lunes a Viernes · 08:00 a 18:00</div>
              </div>
            </div>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
