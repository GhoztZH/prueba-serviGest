import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { notificationService } from '../../modules/notifications/services/notification.service';
import { sesion } from '../../shared/http/client';
import { conectarEventos } from '../../shared/http/sse';
import type { Notificacion } from '../../shared/types/api';
import { useAuth } from './AuthProvider';
import { useAvisos } from './AvisosProvider';

export interface SolicitudActualizada {
  id: number;
  codigo: string;
  estado: string;
  tipo: string;
}

type Oyente = (evento: SolicitudActualizada) => void;

interface TiempoRealContexto {
  conectado: boolean;
  noLeidas: number;
  recientes: Notificacion[];
  /** Aumenta cada vez que cambia el estado de las notificaciones (para que la pantalla completa se refresque). */
  version: number;
  marcarLeida(id: number): Promise<void>;
  marcarTodas(): Promise<void>;
  /** Se invoca cuando CUALQUIER solicitud visible para el usuario cambia en el servidor. */
  alActualizarSolicitud(oyente: Oyente): () => void;
}

const Contexto = createContext<TiempoRealContexto | null>(null);
const RECIENTES = 5;

/**
 * Actualización dinámica sin recargar la página.
 *
 * Mantiene UNA conexión SSE por sesión y reparte dos eventos del servidor:
 *  - `notificacion`: actualiza la campana (contador y lista) y muestra un aviso.
 *  - `solicitud:actualizada`: avisa a las pantallas suscritas (listados,
 *    detalle, dashboard) para que vuelvan a pedir sus datos.
 * Los datos nunca viajan "en el evento": el evento solo dice QUÉ cambió y la
 * pantalla lo vuelve a consultar por la API, donde se aplican los permisos.
 */
export function TiempoRealProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const avisos = useAvisos();
  const [conectado, setConectado] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [recientes, setRecientes] = useState<Notificacion[]>([]);
  const [version, setVersion] = useState(0);
  const oyentes = useRef(new Set<Oyente>());

  const cargar = useCallback(async () => {
    try {
      const pagina = await notificationService.listar({ limit: RECIENTES });
      setRecientes(pagina.data);
      setNoLeidas(pagina.noLeidas);
      setVersion((v) => v + 1);
    } catch {
      // La campana no debe romper la pantalla si falla una carga.
    }
  }, []);

  useEffect(() => {
    const token = sesion.token();
    if (!usuario || !token) {
      setRecientes([]);
      setNoLeidas(0);
      return;
    }
    void cargar();
    return conectarEventos(
      token,
      ({ evento, datos }) => {
        if (evento === 'notificacion') {
          const notificacion = datos as Notificacion;
          setRecientes((actual) => [notificacion, ...actual.filter((n) => n.id !== notificacion.id)].slice(0, RECIENTES));
          setNoLeidas((n) => n + 1);
          setVersion((v) => v + 1);
          avisos.info(notificacion.titulo);
        }
        if (evento === 'solicitud:actualizada') {
          for (const oyente of oyentes.current) oyente(datos as SolicitudActualizada);
        }
      },
      (estado) => {
        setConectado(estado);
        // Al reconectar se recupera lo que se haya perdido mientras no había conexión.
        if (estado) void cargar();
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  const marcarLeida = useCallback(
    async (id: number) => {
      await notificationService.marcarLeida(id);
      await cargar();
    },
    [cargar],
  );
  const marcarTodas = useCallback(async () => {
    await notificationService.marcarTodas();
    await cargar();
  }, [cargar]);
  const alActualizarSolicitud = useCallback((oyente: Oyente) => {
    oyentes.current.add(oyente);
    return () => void oyentes.current.delete(oyente);
  }, []);

  const valor = useMemo(
    () => ({ conectado, noLeidas, recientes, version, marcarLeida, marcarTodas, alActualizarSolicitud }),
    [conectado, noLeidas, recientes, version, marcarLeida, marcarTodas, alActualizarSolicitud],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTiempoReal(): TiempoRealContexto {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useTiempoReal debe usarse dentro de TiempoRealProvider');
  return contexto;
}

/**
 * Recarga los datos de una pantalla cuando el servidor avisa de un cambio.
 * `filtro` permite reaccionar solo a una solicitud concreta (pantalla de detalle).
 */
export function useRecargaEnVivo(recargar: () => void, filtro?: (evento: SolicitudActualizada) => boolean): void {
  const { alActualizarSolicitud } = useTiempoReal();
  const refs = useRef({ recargar, filtro });
  refs.current = { recargar, filtro };
  useEffect(
    () =>
      alActualizarSolicitud((evento) => {
        if (!refs.current.filtro || refs.current.filtro(evento)) refs.current.recargar();
      }),
    [alActualizarSolicitud],
  );
}
