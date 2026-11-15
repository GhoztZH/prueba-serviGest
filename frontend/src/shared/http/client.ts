import axios, { AxiosError } from 'axios';

/**
 * Cliente HTTP único de la aplicación.
 *
 * Sesión: el token JWT se guarda en `sessionStorage` (se borra al cerrar la
 * pestaña y no viaja solo en las peticiones, así que no hay riesgo de CSRF).
 * Cada petición lo envía en `Authorization: Bearer`. Si el servidor responde
 * 401 (token vencido o revocado) se avisa a la app para volver al inicio de sesión.
 */
const CLAVE_TOKEN = 'servigest.token';

export const sesion = {
  token: (): string | null => sessionStorage.getItem(CLAVE_TOKEN),
  guardar: (token: string) => sessionStorage.setItem(CLAVE_TOKEN, token),
  borrar: () => sessionStorage.removeItem(CLAVE_TOKEN),
};

/** Error de la API con el formato del contrato: `{ error: { code, message, details } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  /** Errores de validación por campo (`details: [{ campo, mensaje }]`), para pintarlos junto a cada control. */
  get campos(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const resultado: Record<string, string> = {};
    for (const d of this.details as Array<{ campo?: string; mensaje?: string }>) {
      if (d.campo && d.mensaje && !resultado[d.campo]) resultado[d.campo] = d.mensaje;
    }
    return resultado;
  }

  /** Motivos de una regla de negocio incumplida (p. ej. por qué un técnico no es elegible). */
  get motivos(): string[] {
    const motivos = (this.details as { motivos?: unknown } | undefined)?.motivos;
    return Array.isArray(motivos) ? (motivos as string[]) : [];
  }
}

let alPerderSesion: () => void = () => undefined;
export const registrarPerdidaDeSesion = (fn: () => void) => {
  alPerderSesion = fn;
};

export const api = axios.create({ baseURL: '/api', timeout: 20_000 });

api.interceptors.request.use((config) => {
  const token = sesion.token();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error: AxiosError<{ error?: { code?: string; message?: string; details?: unknown } }>) => {
    const status = error.response?.status ?? 0;
    const cuerpo = error.response?.data?.error;
    const esLogin = error.config?.url?.includes('/auth/login');
    if (status === 401 && !esLogin) alPerderSesion();

    const mensaje =
      cuerpo?.message ??
      (status === 0 ? 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo' : 'Ocurrió un error inesperado');
    return Promise.reject(new ApiError(status, cuerpo?.code ?? 'ERROR_RED', mensaje, cuerpo?.details));
  },
);

export function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado';
}

/** Descarta los filtros vacíos antes de enviarlos como query string. */
export function limpiarParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;
}
