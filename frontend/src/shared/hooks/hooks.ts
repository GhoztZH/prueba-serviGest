import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { mensajeDe } from '../http/client';

export interface EstadoConsulta<T> {
  datos: T | undefined;
  cargando: boolean;
  /** Mensaje de error de la última carga, si falló. */
  error: string | null;
  /** Vuelve a pedir los datos sin vaciar los actuales (no parpadea la pantalla). */
  recargar: () => void;
}

/**
 * Carga de datos del servidor con sus tres estados (cargando, error, datos).
 * Se vuelve a ejecutar cuando cambian las dependencias y descarta las
 * respuestas que llegan tarde (si el filtro cambió mientras tanto).
 */
export function useConsulta<T>(consulta: () => Promise<T>, deps: DependencyList): EstadoConsulta<T> {
  const [datos, setDatos] = useState<T>();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const turno = useRef(0);

  useEffect(() => {
    const actual = ++turno.current;
    setCargando(true);
    consulta()
      .then((resultado) => {
        if (actual !== turno.current) return;
        setDatos(resultado);
        setError(null);
      })
      .catch((e: unknown) => {
        if (actual === turno.current) setError(mensajeDe(e));
      })
      .finally(() => {
        if (actual === turno.current) setCargando(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { datos, cargando, error, recargar };
}

/** Retrasa un valor que cambia rápido (texto de búsqueda) para no pedir en cada tecla. */
export function useRetardo<T>(valor: T, ms = 350): T {
  const [retardado, setRetardado] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setRetardado(valor), ms);
    return () => clearTimeout(temporizador);
  }, [valor, ms]);
  return retardado;
}

export type Resultado<R> = { ok: true; valor: R } | { ok: false };

/**
 * Envío de un formulario o acción: evita el doble clic y expone el error.
 * `ejecutar` nunca lanza: devuelve `{ ok }` para que la pantalla decida qué hacer después.
 */
export function useAccion<A extends unknown[], R>(accion: (...args: A) => Promise<R>) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const ejecutar = useCallback(
    async (...args: A): Promise<Resultado<R>> => {
      if (enviando) return { ok: false };
      setEnviando(true);
      setError(null);
      try {
        return { ok: true, valor: await accion(...args) };
      } catch (e) {
        setError(e);
        return { ok: false };
      } finally {
        setEnviando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accion, enviando],
  );

  return { ejecutar, enviando, error, limpiarError: () => setError(null) };
}
