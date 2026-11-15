import { RouterProvider } from 'react-router-dom';
import { AparienciaProvider } from './providers/AparienciaProvider';
import { AuthProvider } from './providers/AuthProvider';
import { AvisosProvider } from './providers/AvisosProvider';
import { TiempoRealProvider } from './providers/TiempoRealProvider';
import { router } from './routes';

/**
 * Componente raíz de la aplicación.
 * Encapsula los proveedores globales en el orden estricto de precedencia:
 * AuthProvider → AparienciaProvider → AvisosProvider → TiempoRealProvider → RouterProvider.
 */
export function App() {
  return (
    <AuthProvider>
      <AparienciaProvider>
        <AvisosProvider>
          <TiempoRealProvider>
            <RouterProvider router={router} />
          </TiempoRealProvider>
        </AvisosProvider>
      </AparienciaProvider>
    </AuthProvider>
  );
}
