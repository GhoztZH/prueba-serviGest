import Button from '@mui/material/Button';
import { useState, type FormEvent } from 'react';
import { useAuth, useUsuario } from '../../../app/providers/AuthProvider';
import { useAvisos } from '../../../app/providers/AvisosProvider';
import { Avatar, Par, Segmentos } from '../../../shared/components/atoms';
import { Campo, camposDe, mensajeGeneral } from '../../../shared/components/forms';
import { Aviso, Contenido, Encabezado, Tarjeta } from '../../../shared/components/layout';
import { useAccion, useConsulta } from '../../../shared/hooks/hooks';
import { NOMBRE_ROL } from '../../../shared/utils/format';
import { authService } from '../../auth/services/auth.service';
import { clientService } from '../../clients/services/client.service';
import { technicianService } from '../../technicians/services/technician.service';

/**
 * A3 / CO8 / T5 / C5 · Mi perfil.
 * Permite actualizar datos personales (nombre) y contraseña de acceso.
 * Muestra información de rol extendida:
 *  - Técnico: especialidades y capacidad de atención.
 *  - Cliente: razón social, identificación y sedes vinculadas.
 */
export function PerfilPage() {
  const usuario = useUsuario();
  const { actualizarUsuario } = useAuth();
  const avisos = useAvisos();

  // Estado para editar nombre
  const [nombre, setNombre] = useState(usuario.nombre);

  // Estado para cambio de contraseña
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passRepetir, setPassRepetir] = useState('');

  // Consultas específicas por rol
  const detalleTecnico = useConsulta(
    () => (usuario.rol === 'TECNICO' && usuario.tecnicoId ? technicianService.detalle(usuario.tecnicoId) : Promise.resolve(null)),
    [usuario.rol, usuario.tecnicoId],
  );

  const detalleCliente = useConsulta(
    () => (usuario.rol === 'CLIENTE' && usuario.clienteId ? clientService.detalle(usuario.clienteId) : Promise.resolve(null)),
    [usuario.rol, usuario.clienteId],
  );

  // Actualizar nombre
  const { ejecutar: guardarNombre, enviando: guardandoNombre, error: errorNombre } = useAccion(async () => {
    const actualizado = await authService.actualizarPerfil(nombre);
    actualizarUsuario(actualizado);
    avisos.exito('Nombre actualizado correctamente');
  });

  // Cambiar contraseña
  const { ejecutar: guardarPassword, enviando: guardandoPassword, error: errorPassword } = useAccion(async () => {
    if (passNueva !== passRepetir) {
      throw new Error('Las contraseñas no coinciden');
    }
    await authService.cambiarPassword(passActual, passNueva);
    avisos.exito('Contraseña cambiada con éxito');
    setPassActual('');
    setPassNueva('');
    setPassRepetir('');
  });

  const camposNombre = camposDe(errorNombre);
  const camposPass = camposDe(errorPassword);

  return (
    <>
      <Encabezado
        titulo="Mi perfil"
        subtitulo="Información de tu cuenta, datos de acceso y preferencias personales"
      />

      <div className="dos-columnas">
        <div className="pila">
          {/* Tarjeta Datos personales */}
          <Tarjeta titulo="Datos de la cuenta">
            <form
              className="pila"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void guardarNombre();
              }}
              noValidate
            >
              {mensajeGeneral(errorNombre) && <Aviso tono="error" titulo={mensajeGeneral(errorNombre)} />}

              <div className="fila" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <Avatar tamano="l" />
                <div>
                  <div className="titulo-tarjeta">{usuario.nombre}</div>
                  <div className="nota">{usuario.email}</div>
                  <span className="badge rol" style={{ marginTop: 4 }}>
                    {NOMBRE_ROL[usuario.rol]}
                  </span>
                </div>
              </div>

              <Campo
                etiqueta="Nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                error={camposNombre.nombre}
                required
              />

              <Campo
                etiqueta="Correo electrónico"
                value={usuario.email}
                disabled
                ayuda="El correo de acceso no se puede modificar directamente"
              />

              <div className="fila final">
                <Button type="submit" disabled={guardandoNombre || nombre === usuario.nombre}>
                  {guardandoNombre ? 'Guardando…' : 'Guardar nombre'}
                </Button>
              </div>
            </form>
          </Tarjeta>

          {/* Tarjeta Cambiar contraseña */}
          <Tarjeta titulo="Seguridad y contraseña">
            <form
              className="pila"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void guardarPassword();
              }}
              noValidate
            >
              {mensajeGeneral(errorPassword) && <Aviso tono="error" titulo={mensajeGeneral(errorPassword)} />}

              <Campo
                etiqueta="Contraseña actual"
                type="password"
                autoComplete="current-password"
                value={passActual}
                onChange={(e) => setPassActual(e.target.value)}
                error={camposPass.actual}
                required
              />

              <div className="campos">
                <Campo
                  etiqueta="Nueva contraseña"
                  type="password"
                  autoComplete="new-password"
                  value={passNueva}
                  onChange={(e) => setPassNueva(e.target.value)}
                  error={camposPass.nueva}
                  ayuda="Mínimo 8 caracteres, letra y número"
                  required
                />
                <Campo
                  etiqueta="Confirmar nueva contraseña"
                  type="password"
                  autoComplete="new-password"
                  value={passRepetir}
                  onChange={(e) => setPassRepetir(e.target.value)}
                  error={passRepetir && passRepetir !== passNueva ? 'Las contraseñas no coinciden' : undefined}
                  required
                />
              </div>

              <div className="fila final">
                <Button
                  type="submit"
                  disabled={guardandoPassword || !passActual || !passNueva || passNueva !== passRepetir}
                >
                  {guardandoPassword ? 'Actualizando…' : 'Cambiar contraseña'}
                </Button>
              </div>
            </form>
          </Tarjeta>
        </div>

        {/* Panel lateral: Información complementaria por rol */}
        <div className="pila">
          {usuario.rol === 'TECNICO' && (
            <Tarjeta titulo="Información técnica">
              <Contenido consulta={detalleTecnico}>
                {(tec) =>
                  !tec ? (
                    <p className="tenue">Cargando datos técnicos…</p>
                  ) : (
                    <div className="pila md">
                      <Par rotulo="Cédula">{tec.cedula}</Par>
                      <Par rotulo="Teléfono">{tec.telefono ?? 'No registrado'}</Par>
                      <Par rotulo="Capacidad máxima">{tec.max_solicitudes_activas} solicitudes</Par>
                      <Par rotulo="Carga actual">
                        <div className="fila" style={{ gap: 6 }}>
                          <Segmentos
                            carga={tec.carga_actual}
                            maximo={tec.max_solicitudes_activas}
                            enPausa={!tec.disponible}
                          />
                          <span>
                            {tec.carga_actual}/{tec.max_solicitudes_activas}
                          </span>
                        </div>
                      </Par>
                      <div className="divisor" />
                      <div className="rotulo">Especialidades:</div>
                      <div className="fila" style={{ gap: 4 }}>
                        {tec.especialidades.map((esp) => (
                          <span key={esp.id} className="badge rol">
                            {esp.nombre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                }
              </Contenido>
            </Tarjeta>
          )}

          {usuario.rol === 'CLIENTE' && (
            <Tarjeta titulo="Empresa y sedes">
              <Contenido consulta={detalleCliente}>
                {(cli) =>
                  !cli ? (
                    <p className="tenue">Cargando datos de la empresa…</p>
                  ) : (
                    <div className="pila md">
                      <Par rotulo="Razón social">{cli.razon_social}</Par>
                      <Par rotulo="RUC / ID">{cli.identificacion}</Par>
                      <Par rotulo="Correo">{cli.email}</Par>
                      <Par rotulo="Teléfono">{cli.telefono || '—'}</Par>
                      <div className="divisor" />
                      <div className="rotulo">Sedes autorizadas ({cli.sedes.length}):</div>
                      <div className="pila sm">
                        {cli.sedes.map((s) => (
                          <div
                            key={s.id}
                            className="tarjeta"
                            style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--color-bg)' }}
                          >
                            <div className="cuerpo-medio">{s.nombre}</div>
                            <div className="nota">{s.direccion}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
              </Contenido>
            </Tarjeta>
          )}

          <Tarjeta titulo="Información de la sesión">
            <Par rotulo="Identificador">#{usuario.id}</Par>
            <Par rotulo="Rol">{NOMBRE_ROL[usuario.rol]}</Par>
            <Par rotulo="Tipo de token">Bearer JWT</Par>
            <div className="nota" style={{ marginTop: 'var(--space-md)' }}>
              Por seguridad, tu sesión expira automáticamente tras un período de inactividad o revocación.
            </div>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
