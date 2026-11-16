import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '../../modules/auth/services/auth.service';
import { registrarPerdidaDeSesion, sesion } from '../../shared/http/client';
import type { Perfil } from '../../shared/types/api';

interface AuthContexto {
  usuario: Perfil | null;
  /** true mientras se comprueba si hay una sesión guardada (al abrir o recargar la página). */
  cargando: boolean;
  iniciarSesion(email: string, password: string): Promise<Perfil>;
  cerrarSesion(): Promise<void>;
  actualizarUsuario(perfil: Perfil): void;
}

const Contexto = createContext<AuthContexto | null>(null);

/**
 * Sesión del usuario.
 *
 * Flujo: al iniciar sesión se guarda el token y el perfil que devuelve la API.
 * Al recargar la página, si hay token, se pide `GET /auth/me`: el servidor
 * confirma que sigue vigente (no revocado, cuenta activa) y devuelve el perfil.
 * El rol que se usa para decidir menús y rutas SIEMPRE viene del servidor.
 * Esto es solo comodidad de interfaz: los permisos reales los verifica el backend.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(() => sesion.token() !== null);

  useEffect(() => {
    // Cualquier 401 de la API (token vencido o revocado) cierra la sesión local.
    registrarPerdidaDeSesion(() => {
      sesion.borrar();
      setUsuario(null);
    });
    if (!sesion.token()) return;
    authService
      .perfil()
      .then(setUsuario)
      .catch(() => sesion.borrar())
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const { token, usuario: perfil } = await authService.login(email, password);
    sesion.guardar(token);
    setUsuario(perfil);
    return perfil;
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await authService.logout(); // revoca el token en el servidor
    } catch {
      // Aunque falle la red, la sesión local se cierra igual.
    }
    sesion.borrar();
    setUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion, actualizarUsuario: setUsuario }),
    [usuario, cargando, iniciarSesion, cerrarSesion],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): AuthContexto {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return contexto;
}

/** Usuario autenticado (para páginas que ya están detrás de una ruta protegida). */
export function useUsuario(): Perfil {
  const { usuario } = useAuth();
  if (!usuario) throw new Error('Esta pantalla requiere una sesión iniciada');
  return usuario;
}
