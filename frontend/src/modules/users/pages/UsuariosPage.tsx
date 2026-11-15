import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAvisos } from '../../../app/providers/AvisosProvider';
import { ActivoBadge, DisponibilidadBadge, Segmentos } from '../../../shared/components/atoms';
import { Campo, camposDe, mensajeGeneral, Selector } from '../../../shared/components/forms';
import { Aviso, Buscador, Contenido, Encabezado, EstadoVacio, Paginacion, Pestanas, Tarjeta } from '../../../shared/components/layout';
import { useAccion, useConsulta, useRetardo } from '../../../shared/hooks/hooks';
import type { Especialidad, Rol, Tecnico, Usuario } from '../../../shared/types/api';
import { formatoFecha, NOMBRE_ROL } from '../../../shared/utils/format';
import { catalogService } from '../../catalogs/services/catalog.service';
import { technicianService, type TecnicoFormulario } from '../../technicians/services/technician.service';
import { userService } from '../services/user.service';

const LIMITE = 10;

interface UsuarioFormulario {
  nombre: string;
  email: string;
  password?: string;
  rol: 'ADMIN' | 'COORDINADOR';
  activo: boolean;
}

const FORM_USUARIO_VACIO: UsuarioFormulario = {
  nombre: '',
  email: '',
  password: '',
  rol: 'COORDINADOR',
  activo: true,
};

const FORM_TECNICO_VACIO: TecnicoFormulario = {
  nombre: '',
  email: '',
  password: '',
  cedula: '',
  telefono: '',
  max_solicitudes_activas: 5,
  especialidades: [],
  disponible: true,
  activo: true,
};

/**
 * A4/A5/A6 · Gestión de Usuarios y Técnicos (Administrador).
 * Pestañas para administrar cuentas del sistema (Admin y Coordinador)
 * y el plantel de técnicos (con especialidades y carga máxima).
 */
export function UsuariosPage() {
  const avisos = useAvisos();
  const [pestana, setPestana] = useState<'usuarios' | 'tecnicos'>('usuarios');
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<string>('');
  const [filtroActivo, setFiltroActivo] = useState<string>('');
  const q = useRetardo(busqueda);

  // Modales
  const [modalUsuarioAbierto, setModalUsuarioAbierto] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState<Usuario | null>(null);
  const [formUsuario, setFormUsuario] = useState<UsuarioFormulario>(FORM_USUARIO_VACIO);

  const [modalTecnicoAbierto, setModalTecnicoAbierto] = useState(false);
  const [editandoTecnico, setEditandoTecnico] = useState<Tecnico | null>(null);
  const [formTecnico, setFormTecnico] = useState<TecnicoFormulario>(FORM_TECNICO_VACIO);

  const [usuarioReset, setUsuarioReset] = useState<Usuario | null>(null);
  const [nuevaPassword, setNuevaPassword] = useState('');

  // Consultas
  const usuariosConsulta = useConsulta(
    () =>
      userService.listar({
        page: pagina,
        limit: LIMITE,
        q,
        rol: (filtroRol || '') as Rol | '',
        activo: filtroActivo === '' ? '' : filtroActivo === 'true',
      }),
    [pagina, q, filtroRol, filtroActivo, pestana],
  );

  const tecnicosConsulta = useConsulta(
    () =>
      technicianService.listar({
        page: pagina,
        limit: LIMITE,
        q,
      }),
    [pagina, q, pestana],
  );

  const especialidadesConsulta = useConsulta(() => catalogService.especialidades(true), []);

  // Guardar usuario
  const { ejecutar: guardarUsuario, enviando: guardandoUsuario, error: errorUsuario } = useAccion(async () => {
    if (editandoUsuario) {
      await userService.actualizar(editandoUsuario.id, {
        nombre: formUsuario.nombre,
        email: formUsuario.email,
        activo: formUsuario.activo,
      });
      avisos.exito('Usuario actualizado con éxito');
    } else {
      await userService.crear({
        nombre: formUsuario.nombre,
        email: formUsuario.email,
        password: formUsuario.password || '',
        rol: formUsuario.rol,
      });
      avisos.exito('Usuario creado con éxito');
    }
    setModalUsuarioAbierto(false);
    usuariosConsulta.recargar();
  });

  // Guardar técnico
  const { ejecutar: guardarTecnico, enviando: guardandoTecnico, error: errorTecnico } = useAccion(async () => {
    if (editandoTecnico) {
      await technicianService.actualizar(editandoTecnico.id, formTecnico);
      avisos.exito('Técnico actualizado con éxito');
    } else {
      await technicianService.crear(formTecnico);
      avisos.exito('Técnico registrado con éxito');
    }
    setModalTecnicoAbierto(false);
    tecnicosConsulta.recargar();
  });

  // Restablecer contraseña
  const { ejecutar: ejecutarReset, enviando: reseteando, error: errorReset } = useAccion(async () => {
    if (!usuarioReset) return;
    await userService.restablecerPassword(usuarioReset.id, nuevaPassword);
    avisos.exito(`Contraseña actualizada para ${usuarioReset.nombre}`);
    setUsuarioReset(null);
    setNuevaPassword('');
  });

  const abrirNuevo = () => {
    if (pestana === 'usuarios') {
      setEditandoUsuario(null);
      setFormUsuario(FORM_USUARIO_VACIO);
      setModalUsuarioAbierto(true);
    } else {
      setEditandoTecnico(null);
      setFormTecnico(FORM_TECNICO_VACIO);
      setModalTecnicoAbierto(true);
    }
  };

  const abrirEditarUsuario = (u: Usuario) => {
    setEditandoUsuario(u);
    setFormUsuario({
      nombre: u.nombre,
      email: u.email,
      rol: u.rol === 'ADMIN' ? 'ADMIN' : 'COORDINADOR',
      activo: u.activo,
    });
    setModalUsuarioAbierto(true);
  };

  const abrirEditarTecnico = (t: Tecnico) => {
    setEditandoTecnico(t);
    setFormTecnico({
      nombre: t.nombre,
      email: t.email,
      cedula: t.cedula,
      telefono: t.telefono ?? '',
      max_solicitudes_activas: t.max_solicitudes_activas,
      especialidades: t.especialidades.map((e) => e.id),
      disponible: t.disponible,
      activo: t.activo,
    });
    setModalTecnicoAbierto(true);
  };

  const camposUsuario = camposDe(errorUsuario);
  const camposTecnico = camposDe(errorTecnico);

  return (
    <>
      <Encabezado
        titulo="Usuarios y técnicos"
        subtitulo="Gestión de cuentas de acceso, roles administrativos y plantilla técnica"
      >
        <Button onClick={abrirNuevo} startIcon={<Plus size={16} />}>
          {pestana === 'usuarios' ? 'Nuevo usuario' : 'Nuevo técnico'}
        </Button>
      </Encabezado>

      <Pestanas
        opciones={[
          { valor: 'usuarios', texto: 'Usuarios del sistema' },
          { valor: 'tecnicos', texto: 'Técnicos' },
        ]}
        valor={pestana}
        alCambiar={(p) => {
          setPestana(p);
          setPagina(1);
          setBusqueda('');
        }}
        etiqueta="Tipo de usuarios"
      />

      <Tarjeta>
        <div className="fila separada" style={{ marginBottom: 'var(--space-lg)' }}>
          <Buscador
            valor={busqueda}
            alCambiar={(v) => {
              setBusqueda(v);
              setPagina(1);
            }}
            placeholder={
              pestana === 'usuarios'
                ? 'Buscar por nombre o correo…'
                : 'Buscar por nombre, correo o cédula…'
            }
            ancho={320}
          />

          {pestana === 'usuarios' && (
            <div className="fila" style={{ gap: 'var(--space-md)' }}>
              <Selector
                etiqueta="Rol"
                value={filtroRol}
                opciones={[
                  { valor: '', texto: 'Todos los roles' },
                  { valor: 'ADMIN', texto: 'Administrador' },
                  { valor: 'COORDINADOR', texto: 'Coordinador' },
                  { valor: 'TECNICO', texto: 'Técnico' },
                  { valor: 'CLIENTE', texto: 'Cliente' },
                ]}
                onChange={(e) => {
                  setFiltroRol(String(e.target.value));
                  setPagina(1);
                }}
                style={{ width: 160 }}
              />
              <Selector
                etiqueta="Estado"
                value={filtroActivo}
                opciones={[
                  { valor: '', texto: 'Todos' },
                  { valor: 'true', texto: 'Activos' },
                  { valor: 'false', texto: 'Inactivos' },
                ]}
                onChange={(e) => {
                  setFiltroActivo(String(e.target.value));
                  setPagina(1);
                }}
                style={{ width: 140 }}
              />
            </div>
          )}
        </div>

        {pestana === 'usuarios' ? (
          <Contenido consulta={usuariosConsulta}>
            {({ data, meta }) =>
              data.length === 0 ? (
                <EstadoVacio titulo="No se encontraron usuarios" />
              ) : (
                <>
                  <div className="tabla-contenedor">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Rol</th>
                          <th>Estado</th>
                          <th>Último acceso</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((u: Usuario) => (
                          <tr key={u.id}>
                            <td>
                              <div className="principal-celda">{u.nombre}</div>
                              <div className="nota">{u.email}</div>
                            </td>
                            <td>
                              <span className="badge rol">{NOMBRE_ROL[u.rol]}</span>
                            </td>
                            <td>
                              <ActivoBadge activo={u.activo} />
                            </td>
                            <td className="nota">
                              {u.ultimo_acceso ? formatoFecha(u.ultimo_acceso) : 'Nunca'}
                            </td>
                            <td>
                              <div className="fila" style={{ gap: 'var(--space-md)' }}>
                                <button
                                  type="button"
                                  className="enlace"
                                  onClick={() => abrirEditarUsuario(u)}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="enlace"
                                  onClick={() => setUsuarioReset(u)}
                                  title="Restablecer contraseña"
                                >
                                  Contraseña
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Paginacion
                    meta={meta}
                    alCambiar={setPagina}
                    sustantivo="usuarios"
                  />
                </>
              )
            }
          </Contenido>
        ) : (
          <Contenido consulta={tecnicosConsulta}>
            {({ data, meta }) =>
              data.length === 0 ? (
                <EstadoVacio titulo="No se encontraron técnicos" />
              ) : (
                <>
                  <div className="tabla-contenedor">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Técnico</th>
                          <th>Cédula</th>
                          <th>Especialidades</th>
                          <th>Carga actual</th>
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
                            <td>
                              <span className="recortar" style={{ maxWidth: 220, display: 'inline-block' }}>
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
                              <button
                                type="button"
                                className="enlace"
                                onClick={() => abrirEditarTecnico(t)}
                              >
                                Editar
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
                    sustantivo="técnicos"
                  />
                </>
              )
            }
          </Contenido>
        )}
      </Tarjeta>

      {/* Modal Usuario */}
      <Dialog
        open={modalUsuarioAbierto}
        onClose={() => !guardandoUsuario && setModalUsuarioAbierto(false)}
        maxWidth="sm"
        fullWidth
      >
        <form
          className="pila"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void guardarUsuario();
          }}
          noValidate
        >
          <div className="titulo-seccion">
            {editandoUsuario ? 'Editar usuario' : 'Nuevo usuario administrativo'}
          </div>

          {mensajeGeneral(errorUsuario) && <Aviso tono="error" titulo={mensajeGeneral(errorUsuario)} />}

          <Campo
            etiqueta="Nombre completo"
            value={formUsuario.nombre}
            onChange={(e) => setFormUsuario({ ...formUsuario, nombre: e.target.value })}
            error={camposUsuario.nombre}
            required
            autoFocus
          />

          <Campo
            etiqueta="Correo electrónico"
            type="email"
            value={formUsuario.email}
            onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })}
            error={camposUsuario.email}
            required
          />

          {!editandoUsuario && (
            <>
              <Selector
                etiqueta="Rol asignado"
                value={formUsuario.rol}
                opciones={[
                  { valor: 'COORDINADOR', texto: 'Coordinador' },
                  { valor: 'ADMIN', texto: 'Administrador' },
                ]}
                onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value as 'ADMIN' | 'COORDINADOR' })}
                required
              />
              <Campo
                etiqueta="Contraseña inicial"
                type="password"
                value={formUsuario.password}
                onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })}
                error={camposUsuario.password}
                ayuda="Mínimo 8 caracteres, al menos una letra y un número"
                required
              />
            </>
          )}

          {editandoUsuario && (
            <div className="fila-ajuste">
              <div>
                <div className="cuerpo-medio">Usuario activo</div>
                <div className="nota">Los usuarios inactivos no pueden ingresar al sistema.</div>
              </div>
              <Switch
                checked={formUsuario.activo}
                onChange={(e) => setFormUsuario({ ...formUsuario, activo: e.target.checked })}
              />
            </div>
          )}

          <div className="fila final" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
            <Button variant="text" onClick={() => setModalUsuarioAbierto(false)} disabled={guardandoUsuario}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardandoUsuario}>
              {guardandoUsuario ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal Técnico */}
      <Dialog
        open={modalTecnicoAbierto}
        onClose={() => !guardandoTecnico && setModalTecnicoAbierto(false)}
        maxWidth="sm"
        fullWidth
      >
        <form
          className="pila"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void guardarTecnico();
          }}
          noValidate
        >
          <div className="titulo-seccion">
            {editandoTecnico ? 'Editar técnico' : 'Nuevo técnico'}
          </div>

          {mensajeGeneral(errorTecnico) && <Aviso tono="error" titulo={mensajeGeneral(errorTecnico)} />}

          <div className="campos">
            <Campo
              etiqueta="Nombre completo"
              value={formTecnico.nombre}
              onChange={(e) => setFormTecnico({ ...formTecnico, nombre: e.target.value })}
              error={camposTecnico.nombre}
              required
              autoFocus
            />
            <Campo
              etiqueta="Cédula"
              value={formTecnico.cedula}
              onChange={(e) => setFormTecnico({ ...formTecnico, cedula: e.target.value })}
              error={camposTecnico.cedula}
              required
            />
          </div>

          <div className="campos">
            <Campo
              etiqueta="Correo electrónico"
              type="email"
              value={formTecnico.email}
              onChange={(e) => setFormTecnico({ ...formTecnico, email: e.target.value })}
              error={camposTecnico.email}
              required
            />
            <Campo
              etiqueta="Teléfono"
              value={formTecnico.telefono ?? ''}
              onChange={(e) => setFormTecnico({ ...formTecnico, telefono: e.target.value })}
              error={camposTecnico.telefono}
            />
          </div>

          {!editandoTecnico && (
            <Campo
              etiqueta="Contraseña inicial"
              type="password"
              value={formTecnico.password ?? ''}
              onChange={(e) => setFormTecnico({ ...formTecnico, password: e.target.value })}
              error={camposTecnico.password}
              ayuda="Mínimo 8 caracteres"
              required
            />
          )}

          <Campo
            etiqueta="Carga máxima de solicitudes simultáneas"
            type="number"
            value={formTecnico.max_solicitudes_activas ?? 5}
            onChange={(e) =>
              setFormTecnico({ ...formTecnico, max_solicitudes_activas: Math.max(1, Number(e.target.value)) })
            }
            error={camposTecnico.max_solicitudes_activas}
            slotProps={{ htmlInput: { min: 1, max: 20 } }}
            required
          />

          <div className="campo">
            <label className="rotulo">Especialidades técnicas</label>
            <div className="campos" style={{ maxHeight: 160, overflowY: 'auto' }}>
              {(especialidadesConsulta.datos ?? []).map((esp: Especialidad) => {
                const marcada = formTecnico.especialidades.includes(esp.id);
                return (
                  <FormControlLabel
                    key={esp.id}
                    control={
                      <Checkbox
                        checked={marcada}
                        onChange={(e) => {
                          const nuevas = e.target.checked
                            ? [...formTecnico.especialidades, esp.id]
                            : formTecnico.especialidades.filter((id) => id !== esp.id);
                          setFormTecnico({ ...formTecnico, especialidades: nuevas });
                        }}
                      />
                    }
                    label={esp.nombre}
                  />
                );
              })}
            </div>
            {camposTecnico.especialidades && (
              <span className="nota texto-error">{camposTecnico.especialidades}</span>
            )}
          </div>

          {editandoTecnico && (
            <div className="fila-ajuste">
              <div>
                <div className="cuerpo-medio">Técnico activo</div>
                <div className="nota">Un técnico inactivo no puede recibir nuevas solicitudes ni ingresar.</div>
              </div>
              <Switch
                checked={formTecnico.activo ?? true}
                onChange={(e) => setFormTecnico({ ...formTecnico, activo: e.target.checked })}
              />
            </div>
          )}

          <div className="fila final" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
            <Button variant="text" onClick={() => setModalTecnicoAbierto(false)} disabled={guardandoTecnico}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardandoTecnico}>
              {guardandoTecnico ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal Restablecer Contraseña */}
      <Dialog
        open={Boolean(usuarioReset)}
        onClose={() => !reseteando && setUsuarioReset(null)}
        maxWidth="xs"
        fullWidth
      >
        <form
          className="pila"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void ejecutarReset();
          }}
          noValidate
        >
          <div className="titulo-seccion">Restablecer contraseña</div>
          <p className="nota">
            Asigna una nueva clave para <strong>{usuarioReset?.nombre}</strong> ({usuarioReset?.email}).
          </p>

          {mensajeGeneral(errorReset) && <Aviso tono="error" titulo={mensajeGeneral(errorReset)} />}

          <Campo
            etiqueta="Nueva contraseña"
            type="password"
            value={nuevaPassword}
            onChange={(e) => setNuevaPassword(e.target.value)}
            error={camposDe(errorReset).password}
            ayuda="Mínimo 8 caracteres, al menos una letra y un número"
            required
            autoFocus
          />

          <div className="fila final" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
            <Button variant="text" onClick={() => setUsuarioReset(null)} disabled={reseteando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={reseteando || !nuevaPassword}>
              {reseteando ? 'Actualizando…' : 'Actualizar contraseña'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
