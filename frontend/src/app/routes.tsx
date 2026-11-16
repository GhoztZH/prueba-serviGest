import Button from '@mui/material/Button';
import { type ReactNode } from 'react';
import { createBrowserRouter, Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { CargaEquipoPage } from '../modules/assignments/pages/CargaEquipoPage';
import { AuditoriaPage } from '../modules/audit/pages/AuditoriaPage';
import { LoginPage, RecuperarPage, RestablecerPage } from '../modules/auth/pages/AccesoPages';
import { CatalogosPage } from '../modules/catalogs/pages/CatalogosPage';
import { ClientesPage } from '../modules/clients/pages/ClientesPage';
import { DashboardOperativoPage, PanelTecnicoPage, ReportesPage } from '../modules/dashboard/pages/DashboardPages';
import { NotificacionesPage } from '../modules/notifications/pages/NotificacionesPage';
import { NuevaSolicitudPage } from '../modules/requests/pages/NuevaSolicitudPage';
import { SolicitudDetallePage } from '../modules/requests/pages/SolicitudDetallePage';
import { SolicitudesPage } from '../modules/requests/pages/SolicitudesPage';
import { DisponibilidadPage } from '../modules/technicians/pages/DisponibilidadPage';
import { TecnicosPage } from '../modules/technicians/pages/TecnicosPage';
import { UsuariosPage } from '../modules/users/pages/UsuariosPage';
import { AyudaPage } from '../modules/account/pages/AyudaPage';
import { ConfiguracionPage } from '../modules/account/pages/ConfiguracionPage';
import { PerfilPage } from '../modules/account/pages/PerfilPage';
import { Cargando, EstadoError, EstadoVacio } from '../shared/components/layout';
import { AppLayout } from '../shared/layouts/AppLayout';
import type { Rol } from '../shared/types/api';
import { INICIO, itemsDe } from './navigation';
import { useApariencia } from './providers/AparienciaProvider';
import { useAuth } from './providers/AuthProvider';

interface RutaProtegidaProps {
  rolesPermitidos?: Rol[];
  children?: ReactNode;
}

/**
 * Control de acceso a nivel de interfaz.
 * - Sin sesión: redirige a /login conservando la URL de origen en el estado.
 * - Con sesión pero rol no autorizado: muestra pantalla informativa de "Sin acceso".
 */
export function RutaProtegida({ rolesPermitidos, children }: RutaProtegidaProps) {
  const { usuario, cargando } = useAuth();
  const ubicacion = useLocation();

  if (cargando) {
    return <Cargando filas={6} />;
  }

  if (!usuario) {
    return <Navigate to="/login" state={{ desde: ubicacion.pathname }} replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return (
      <div className="contenido">
        <EstadoError
          mensaje={`Tu rol (${usuario.rol}) no tiene permisos para acceder a esta pantalla.`}
        />
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Button variant="outlined">Ir a mi inicio</Button>
          </Link>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
}

/**
 * Redirección de la raíz (/) a la página de inicio correspondiente
 * según el rol del usuario o su preferencia guardada.
 */
function RedireccionRaiz() {
  const { usuario, cargando } = useAuth();
  const { preferencias } = useApariencia();

  if (cargando) return <Cargando filas={4} />;
  if (!usuario) return <Navigate to="/login" replace />;

  const inicioDefecto = INICIO[usuario.rol];
  let destino = inicioDefecto;

  if (preferencias.paginaInicio) {
    const items = itemsDe(usuario.rol);
    if (items.some((i) => i.ruta === preferencias.paginaInicio)) {
      destino = preferencias.paginaInicio;
    }
  }

  return <Navigate to={destino} replace />;
}

export const rutas = [
  // Rutas públicas
  { path: '/login', element: <LoginPage /> },
  { path: '/recuperar', element: <RecuperarPage /> },
  { path: '/restablecer', element: <RestablecerPage /> },

  // Rutas protegidas dentro del cascarón de la aplicación
  {
    element: (
      <RutaProtegida>
        <AppLayout />
      </RutaProtegida>
    ),
    children: [
      { path: '/', element: <RedireccionRaiz /> },

      // Solicitudes
      {
        path: '/solicitudes',
        element: (
          <RutaProtegida rolesPermitidos={['ADMIN', 'COORDINADOR', 'TECNICO', 'CLIENTE']}>
            <SolicitudesPage />
          </RutaProtegida>
        ),
      },
      {
        path: '/solicitudes/nueva',
        element: (
          <RutaProtegida rolesPermitidos={['CLIENTE', 'COORDINADOR', 'ADMIN']}>
            <NuevaSolicitudPage />
          </RutaProtegida>
        ),
      },
      {
        path: '/solicitudes/:id',
        element: (
          <RutaProtegida rolesPermitidos={['ADMIN', 'COORDINADOR', 'TECNICO', 'CLIENTE']}>
            <SolicitudDetallePage />
          </RutaProtegida>
        ),
      },

      // Administrador
      {
        path: '/reportes',
        element: (
          <RutaProtegida rolesPermitidos={['ADMIN']}>
            <ReportesPage />
          </RutaProtegida>
        ),
      },
      {
        path: '/usuarios',
        element: (
          <RutaProtegida rolesPermitidos={['ADMIN']}>
            <UsuariosPage />
          </RutaProtegida>
        ),
      },
      {
        path: '/catalogos',
        element: (
          <RutaProtegida rolesPermitidos={['ADMIN']}>
            <CatalogosPage pestanaPorDefecto="especialidades" />
          </RutaProtegida>
        ),
      },
      {
        path: '/parametros',
        element: (
          <RutaProtegida rolesPermitidos={['ADMIN']}>
            <CatalogosPage pestanaPorDefecto="parametros" />
          </RutaProtegida>
        ),
      },
      {
        path: '/auditoria',
        element: (
          <RutaProtegida rolesPermitidos={['ADMIN']}>
            <AuditoriaPage />
          </RutaProtegida>
        ),
      },

      // Coordinador
      {
        path: '/dashboard',
        element: (
          <RutaProtegida rolesPermitidos={['COORDINADOR']}>
            <DashboardOperativoPage />
          </RutaProtegida>
        ),
      },
      {
        path: '/carga',
        element: (
          <RutaProtegida rolesPermitidos={['COORDINADOR']}>
            <CargaEquipoPage />
          </RutaProtegida>
        ),
      },
      {
        path: '/tecnicos',
        element: (
          <RutaProtegida rolesPermitidos={['COORDINADOR']}>
            <TecnicosPage />
          </RutaProtegida>
        ),
      },

      // Clientes y sedes (Admin edita, Coordinador consulta)
      {
        path: '/clientes',
        element: (
          <RutaProtegida rolesPermitidos={['ADMIN', 'COORDINADOR']}>
            <ClientesPage />
          </RutaProtegida>
        ),
      },

      // Técnico
      {
        path: '/panel',
        element: (
          <RutaProtegida rolesPermitidos={['TECNICO']}>
            <PanelTecnicoPage />
          </RutaProtegida>
        ),
      },
      {
        path: '/disponibilidad',
        element: (
          <RutaProtegida rolesPermitidos={['TECNICO']}>
            <DisponibilidadPage />
          </RutaProtegida>
        ),
      },

      // Cliente
      {
        path: '/ayuda',
        element: (
          <RutaProtegida rolesPermitidos={['CLIENTE']}>
            <AyudaPage />
          </RutaProtegida>
        ),
      },

      // Comunes a todos los roles
      {
        path: '/notificaciones',
        element: <NotificacionesPage />,
      },
      {
        path: '/perfil',
        element: <PerfilPage />,
      },
      {
        path: '/configuracion',
        element: <ConfiguracionPage />,
      },

      // 404 No encontrado
      {
        path: '*',
        element: (
          <div className="contenido">
            <EstadoVacio titulo="Página no encontrada">
              La dirección que buscas no existe o ha sido movida.
            </EstadoVacio>
          </div>
        ),
      },
    ],
  },
];

export const router = createBrowserRouter(rutas);
