import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Popover from '@mui/material/Popover';
import { Bell, Menu, Search } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { itemActivo, MENU } from '../../app/navigation';
import { useAuth, useUsuario } from '../../app/providers/AuthProvider';
import { useTiempoReal } from '../../app/providers/TiempoRealProvider';
import { Avatar, Badge } from '../components/atoms';
import { EstadoVacio } from '../components/layout';
import type { Notificacion } from '../types/api';
import { fechaRelativa, NOMBRE_ROL } from '../utils/format';

/** Último tramo de la miga de pan, que cada pantalla de detalle puede fijar (p. ej. el código de la solicitud). */
const MigaContexto = createContext<(texto: string | null) => void>(() => undefined);

export function useMiga(texto: string | null | undefined): void {
  const fijar = useContext(MigaContexto);
  useEffect(() => {
    fijar(texto ?? null);
    return () => fijar(null);
  }, [fijar, texto]);
}

function BarraLateral({ alNavegar }: { alNavegar?: () => void }) {
  const usuario = useUsuario();
  const { cerrarSesion } = useAuth();
  const { pathname } = useLocation();
  const activo = itemActivo(usuario.rol, pathname);

  return (
    <aside className="barra-lateral">
      <div className="marca">
        <span className="marca-logo" aria-hidden="true" />
        ServiGest
      </div>
      <span className="insignia-rol">
        <Badge tono="rol">{NOMBRE_ROL[usuario.rol]}</Badge>
      </span>
      <nav aria-label="Menú principal">
        {MENU[usuario.rol].map((seccion) => (
          <div key={seccion.titulo}>
            <div className="sobretitulo nav-seccion">{seccion.titulo}</div>
            {seccion.items.map((item) => (
              <NavLink
                key={item.ruta}
                to={item.ruta}
                onClick={alNavegar}
                className={`nav-item ${activo?.ruta === item.ruta ? 'activo' : ''}`}
                aria-current={activo?.ruta === item.ruta ? 'page' : undefined}
              >
                <item.icono aria-hidden="true" />
                {item.texto}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="tarjeta-usuario">
        <Avatar />
        <div style={{ minWidth: 0 }}>
          <div className="nombre recortar">{usuario.nombre}</div>
          <button type="button" className="enlace-boton" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
}

/** Panel rápido de la campana: últimas notificaciones, marcar como leídas e ir a la pantalla completa. */
function PanelCampana({ alCerrar }: { alCerrar: () => void }) {
  const { recientes, noLeidas, marcarLeida, marcarTodas } = useTiempoReal();
  const navegar = useNavigate();

  const abrir = (n: Notificacion) => {
    if (!n.leida) void marcarLeida(n.id);
    alCerrar();
    navegar(n.solicitud_id ? `/solicitudes/${n.solicitud_id}` : '/notificaciones');
  };

  return (
    <div className="panel-campana">
      <div className="tarjeta-cabecera">
        <h2 className="titulo-tarjeta">Notificaciones</h2>
        {noLeidas > 0 && (
          <button type="button" className="enlace" onClick={() => void marcarTodas()}>
            Marcar todas como leídas
          </button>
        )}
      </div>
      {recientes.length === 0 ? (
        <EstadoVacio titulo="Sin notificaciones">Aquí verá los avisos sobre sus solicitudes.</EstadoVacio>
      ) : (
        recientes.map((n) => (
          <button key={n.id} type="button" className={`fila-notificacion ${n.leida ? '' : 'nueva'}`} onClick={() => abrir(n)}>
            <span className="punto" aria-hidden="true" />
            <span style={{ minWidth: 0 }}>
              <span className="titulo-n">
                {n.titulo}
                {n.solicitud_codigo ? `: ${n.solicitud_codigo}` : ''}
              </span>
              <span className="nota" style={{ display: 'block' }}>
                {fechaRelativa(n.created_at)}
                {!n.leida && <span className="solo-lectores"> · sin leer</span>}
              </span>
            </span>
          </button>
        ))
      )}
      <hr className="divisor" />
      <Button
        variant="text"
        fullWidth
        onClick={() => {
          alCerrar();
          navegar('/notificaciones');
        }}
      >
        Ver todas las notificaciones
      </Button>
    </div>
  );
}

function BarraSuperior({ detalle, alAbrirMenu }: { detalle: string | null; alAbrirMenu: () => void }) {
  const usuario = useUsuario();
  const { noLeidas } = useTiempoReal();
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const [texto, setTexto] = useState('');
  const seccion = itemActivo(usuario.rol, pathname) ?? (pathname.startsWith('/notificaciones') ? { ruta: '/notificaciones', texto: 'Notificaciones' } : undefined);

  // Búsqueda global: lleva al listado de solicitudes filtrado por código o título.
  const buscar = (e: FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    navegar(`/solicitudes?q=${encodeURIComponent(texto.trim())}`);
    setTexto('');
  };

  return (
    <header className="barra-superior">
      <button type="button" className="boton-icono solo-movil" onClick={alAbrirMenu} aria-label="Abrir menú">
        <Menu />
      </button>
      <nav className="miga recortar" aria-label="Ubicación">
        <Link to="/">Inicio</Link>
        {seccion && (
          <>
            {' / '}
            {detalle ? <Link to={seccion.ruta}>{seccion.texto}</Link> : seccion.texto}
          </>
        )}
        {detalle && ` / ${detalle}`}
      </nav>
      <form className="busqueda" role="search" onSubmit={buscar}>
        <Search aria-hidden="true" />
        <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar…" aria-label="Buscar solicitudes por código o título" />
      </form>
      <button
        type="button"
        className={`boton-icono ${ancla ? 'activo' : ''}`}
        onClick={(e) => setAncla(e.currentTarget)}
        aria-label={noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : 'Notificaciones'}
        aria-haspopup="dialog"
      >
        <Bell />
        {noLeidas > 0 && <span className="contador">{noLeidas > 99 ? '99+' : noLeidas}</span>}
      </button>
      <Link to="/perfil" aria-label="Mi perfil">
        <Avatar />
      </Link>
      <Popover open={Boolean(ancla)} anchorEl={ancla} onClose={() => setAncla(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <PanelCampana alCerrar={() => setAncla(null)} />
      </Popover>
    </header>
  );
}

/**
 * Plantilla de la aplicación: barra lateral (240 px) + barra superior (64 px) + contenido.
 * En pantallas menores a 1024 px la barra lateral pasa a un panel deslizable.
 */
export function AppLayout({ children }: { children?: ReactNode }) {
  const [detalle, setDetalle] = useState<string | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <MigaContexto.Provider value={setDetalle}>
      <div className="app">
        <BarraLateral />
        <Drawer open={menuAbierto} onClose={() => setMenuAbierto(false)}>
          <BarraLateral alNavegar={() => setMenuAbierto(false)} />
        </Drawer>
        <div className="principal">
          <BarraSuperior detalle={detalle} alAbrirMenu={() => setMenuAbierto(true)} />
          <main className="contenido">{children ?? <Outlet />}</main>
        </div>
      </div>
    </MigaContexto.Provider>
  );
}
