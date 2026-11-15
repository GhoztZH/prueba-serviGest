import { ThemeProvider } from '@mui/material/styles';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DATA_ROLE } from '../../shared/utils/format';
import { crearTema, type Modo, type RolDiseno } from '../theme';
import { useAuth } from './AuthProvider';

export type PreferenciaTema = 'light' | 'dark' | 'system';

/** Preferencias personales de interfaz. Se guardan en el navegador: no son datos del negocio. */
export interface Preferencias {
  tema: PreferenciaTema;
  /** Ruta con la que abre la aplicación (Coordinador y Técnico). */
  paginaInicio: string | null;
  /** Sede que se precarga en "Nueva solicitud" (Cliente). */
  sedePredeterminada: number | null;
}

const POR_DEFECTO: Preferencias = { tema: 'system', paginaInicio: null, sedePredeterminada: null };
const CLAVE = 'servigest.preferencias';

function leer(): Preferencias {
  try {
    return { ...POR_DEFECTO, ...(JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Partial<Preferencias>) };
  } catch {
    return POR_DEFECTO;
  }
}

interface AparienciaContexto {
  preferencias: Preferencias;
  modo: Modo;
  guardar(cambios: Partial<Preferencias>): void;
  restablecer(): void;
}

const Contexto = createContext<AparienciaContexto | null>(null);
const sistemaOscuro = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

/**
 * Tema (claro/oscuro) y color del rol.
 * Fija `data-theme` y `data-role` en <html>, que es lo que leen los tokens
 * CSS, y construye el tema de MUI con los mismos valores.
 */
export function AparienciaProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [preferencias, setPreferencias] = useState(leer);
  const [oscuroDelSistema, setOscuroDelSistema] = useState(sistemaOscuro);

  useEffect(() => {
    const consulta = window.matchMedia?.('(prefers-color-scheme: dark)');
    const alCambiar = () => setOscuroDelSistema(consulta.matches);
    consulta?.addEventListener('change', alCambiar);
    return () => consulta?.removeEventListener('change', alCambiar);
  }, []);

  const modo: Modo = preferencias.tema === 'system' ? (oscuroDelSistema ? 'dark' : 'light') : preferencias.tema;
  const rol: RolDiseno = usuario ? (DATA_ROLE[usuario.rol] as RolDiseno) : 'admin';

  useEffect(() => {
    document.documentElement.dataset.theme = modo;
    document.documentElement.dataset.role = rol;
  }, [modo, rol]);

  const guardar = useCallback((cambios: Partial<Preferencias>) => {
    setPreferencias((actual) => {
      const nuevas = { ...actual, ...cambios };
      localStorage.setItem(CLAVE, JSON.stringify(nuevas));
      return nuevas;
    });
  }, []);
  const restablecer = useCallback(() => {
    localStorage.removeItem(CLAVE);
    setPreferencias(POR_DEFECTO);
  }, []);

  const tema = useMemo(() => crearTema(modo, rol), [modo, rol]);
  const valor = useMemo(() => ({ preferencias, modo, guardar, restablecer }), [preferencias, modo, guardar, restablecer]);

  return (
    <Contexto.Provider value={valor}>
      <ThemeProvider theme={tema}>{children}</ThemeProvider>
    </Contexto.Provider>
  );
}

export function useApariencia(): AparienciaContexto {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useApariencia debe usarse dentro de AparienciaProvider');
  return contexto;
}
