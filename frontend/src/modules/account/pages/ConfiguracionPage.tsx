import Button from '@mui/material/Button';
import { useState } from 'react';
import { useApariencia, type PreferenciaTema, type Preferencias } from '../../../app/providers/AparienciaProvider';
import { useUsuario } from '../../../app/providers/AuthProvider';
import { useAvisos } from '../../../app/providers/AvisosProvider';
import { Selector } from '../../../shared/components/forms';
import { Aviso, Encabezado, Tarjeta } from '../../../shared/components/layout';
import { useConsulta } from '../../../shared/hooks/hooks';
import type { Sede } from '../../../shared/types/api';
import { clientService } from '../../clients/services/client.service';

/**
 * A11 / CO9 / T6 / C7 · Configuración y preferencias de interfaz.
 * Permite cambiar el tema visual (Claro, Oscuro o Sistema) y almacenar
 * preferencias locales del dispositivo (página inicial, sede predeterminada).
 */
export function ConfiguracionPage() {
  const usuario = useUsuario();
  const avisos = useAvisos();
  const { preferencias, guardar, restablecer } = useApariencia();

  const [form, setForm] = useState<Preferencias>(preferencias);

  // Sedes si es cliente
  const sedesConsulta = useConsulta(
    () => (usuario.rol === 'CLIENTE' && usuario.clienteId ? clientService.sedes(usuario.clienteId) : Promise.resolve([])),
    [usuario.rol, usuario.clienteId],
  );

  const cambiarTema = (tema: PreferenciaTema) => {
    setForm((actual) => ({ ...actual, tema }));
  };

  const guardarCambios = () => {
    guardar(form);
    avisos.exito('Preferencias guardadas correctamente');
  };

  const restablecerValores = () => {
    restablecer();
    setForm({ tema: 'system', paginaInicio: null, sedePredeterminada: null });
    avisos.info('Valores restablecidos por defecto');
  };

  return (
    <>
      <Encabezado
        titulo="Configuración"
        subtitulo="Personaliza la apariencia de la plataforma y tus preferencias locales de navegación"
      >
        <div className="fila" style={{ gap: 'var(--space-md)' }}>
          <Button variant="text" onClick={restablecerValores}>
            Restablecer valores
          </Button>
          <Button onClick={guardarCambios}>Guardar cambios</Button>
        </div>
      </Encabezado>

      <div className="dos-columnas">
        <div className="pila">
          {/* Apariencia */}
          <Tarjeta titulo="Apariencia">
            <p className="nota" style={{ marginBottom: 'var(--space-md)' }}>
              Elige cómo deseas visualizar la interfaz. Modo sistema sigue la configuración de tu sistema operativo.
            </p>

            <div className="opciones-tema" role="radiogroup" aria-label="Tema de la aplicación">
              {/* Opción Claro */}
              <button
                type="button"
                className="opcion-tema"
                aria-checked={form.tema === 'light'}
                onClick={() => cambiarTema('light')}
              >
                <div className="muestra">
                  <span className="clara" />
                </div>
                <div className="fila separada">
                  <span className="cuerpo-medio">Claro</span>
                  <span className={`radio ${form.tema === 'light' ? 'elegido' : ''}`} />
                </div>
              </button>

              {/* Opción Oscuro */}
              <button
                type="button"
                className="opcion-tema"
                aria-checked={form.tema === 'dark'}
                onClick={() => cambiarTema('dark')}
              >
                <div className="muestra">
                  <span className="oscura" />
                </div>
                <div className="fila separada">
                  <span className="cuerpo-medio">Oscuro</span>
                  <span className={`radio ${form.tema === 'dark' ? 'elegido' : ''}`} />
                </div>
              </button>

              {/* Opción Sistema */}
              <button
                type="button"
                className="opcion-tema"
                aria-checked={form.tema === 'system'}
                onClick={() => cambiarTema('system')}
              >
                <div className="muestra sistema">
                  <span className="clara" />
                  <span className="oscura" />
                </div>
                <div className="fila separada">
                  <span className="cuerpo-medio">Sistema</span>
                  <span className={`radio ${form.tema === 'system' ? 'elegido' : ''}`} />
                </div>
              </button>
            </div>
          </Tarjeta>

          {/* Preferencias de navegación */}
          <Tarjeta titulo="Preferencias de navegación">
            {usuario.rol === 'COORDINADOR' && (
              <div className="fila-ajuste">
                <div>
                  <div className="cuerpo-medio">Página de inicio</div>
                  <div className="nota">Pantalla que se cargará al ingresar al sistema</div>
                </div>
                <Selector
                  etiqueta="Página inicial"
                  value={form.paginaInicio ?? '/dashboard'}
                  opciones={[
                    { valor: '/dashboard', texto: 'Dashboard operativo' },
                    { valor: '/solicitudes', texto: 'Bandeja de solicitudes' },
                    { valor: '/carga', texto: 'Carga del equipo' },
                  ]}
                  onChange={(e) => setForm({ ...form, paginaInicio: String(e.target.value) })}
                  style={{ width: 220 }}
                />
              </div>
            )}

            {usuario.rol === 'TECNICO' && (
              <div className="fila-ajuste">
                <div>
                  <div className="cuerpo-medio">Página de inicio</div>
                  <div className="nota">Pantalla inicial tras iniciar sesión</div>
                </div>
                <Selector
                  etiqueta="Página inicial"
                  value={form.paginaInicio ?? '/panel'}
                  opciones={[
                    { valor: '/panel', texto: 'Mi panel' },
                    { valor: '/solicitudes', texto: 'Mis solicitudes' },
                  ]}
                  onChange={(e) => setForm({ ...form, paginaInicio: String(e.target.value) })}
                  style={{ width: 200 }}
                />
              </div>
            )}

            {usuario.rol === 'CLIENTE' && (
              <div className="fila-ajuste">
                <div>
                  <div className="cuerpo-medio">Sede predeterminada</div>
                  <div className="nota">Sede que se precargará automáticamente al registrar una nueva solicitud</div>
                </div>
                <Selector
                  etiqueta="Sede preferida"
                  value={form.sedePredeterminada ? String(form.sedePredeterminada) : ''}
                  vacio="Ninguna (elegir siempre)"
                  opciones={(sedesConsulta.datos ?? []).map((s: Sede) => ({
                    valor: String(s.id),
                    texto: s.nombre,
                  }))}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sedePredeterminada: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  style={{ width: 240 }}
                />
              </div>
            )}

            {usuario.rol === 'ADMIN' && (
              <p className="tenue">
                El Administrador inicia siempre en el panel global de Reportes (/reportes).
              </p>
            )}
          </Tarjeta>
        </div>

        {/* Panel lateral: Notificaciones y avisos (documentación de limitación) */}
        <div className="pila">
          <Tarjeta titulo="Canales de notificación">
            <Aviso tono="alerta" titulo="Avisos fijados por sistema">
              El modelo actual de datos despacha todas las notificaciones operativas en tiempo real
              a la campana de la plataforma. La suscripción selectiva por canal (correo o SMS) se
              encuentra planificada para futuras versiones.
            </Aviso>

            <div className="pila sm" style={{ opacity: 0.75 }}>
              <div className="fila-ajuste">
                <div>
                  <div className="cuerpo-medio">Alertas en plataforma</div>
                  <div className="nota">Avisos emergentes y contador en la campana</div>
                </div>
                <span className="badge ok">Siempre activo</span>
              </div>

              <div className="fila-ajuste">
                <div>
                  <div className="cuerpo-medio">Notificaciones por correo</div>
                  <div className="nota">Envío a tu dirección de contacto</div>
                </div>
                <span className="badge neutro">Próximamente</span>
              </div>
            </div>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
