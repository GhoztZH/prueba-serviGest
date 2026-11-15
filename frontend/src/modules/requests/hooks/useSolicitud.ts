import { useCallback, useState } from 'react';
import { useAvisos } from '../../../app/providers/AvisosProvider';
import { useRecargaEnVivo } from '../../../app/providers/TiempoRealProvider';
import { useConsulta } from '../../../shared/hooks/hooks';
import type { Estado, SolicitudDetalle } from '../../../shared/types/api';
import { solicitudService } from '../services/solicitud.service';

/**
 * Detalle e historial de una solicitud, siempre al día: si otro usuario la
 * modifica, el servidor avisa por SSE y la pantalla vuelve a consultarla.
 */
export function useSolicitud(id: number) {
  const detalle = useConsulta(() => solicitudService.detalle(id), [id]);
  const historial = useConsulta(() => solicitudService.historial(id), [id]);
  const recargar = useCallback(() => {
    detalle.recargar();
    historial.recargar();
  }, [detalle, historial]);
  useRecargaEnVivo(recargar, (evento) => evento.id === id);
  return { detalle, historial, recargar };
}

export interface CambioEstado {
  estado: Estado;
  comentario?: string;
  resolucion?: string;
  prioridad_id?: number;
}

/**
 * Ejecuta una operación sobre la solicitud con el mismo patrón en todas las
 * pantallas: un envío a la vez, aviso de éxito o de error, y recarga al terminar
 * (también si falla: el estado pudo cambiar en el servidor mientras tanto).
 */
export function useOperacion(alTerminar: () => void) {
  const avisos = useAvisos();
  const [enviando, setEnviando] = useState(false);

  const operar = useCallback(
    async (operacion: () => Promise<unknown>, exito: string): Promise<boolean> => {
      if (enviando) return false;
      setEnviando(true);
      try {
        await operacion();
        avisos.exito(exito);
        return true;
      } catch (e) {
        avisos.error(e);
        return false;
      } finally {
        setEnviando(false);
        alTerminar();
      }
    },
    [avisos, enviando, alTerminar],
  );

  return { operar, enviando };
}

/** Cambio de estado enviando la versión que el usuario está viendo (el backend responde 409 si ya cambió). */
export function cambiarEstado(solicitud: SolicitudDetalle, cambio: CambioEstado) {
  return solicitudService.cambiarEstado(solicitud.id, { ...cambio, version: solicitud.version });
}
