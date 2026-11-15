import { api, limpiarParams } from '../../../shared/http/client';
import type { Adjunto, Estado, Historial, Pagina, Solicitud, SolicitudDetalle } from '../../../shared/types/api';
import type { FiltroSolicitudes, SolicitudNueva } from '../types/solicitud.types';

/** Comunicación con la API de solicitudes. Las pantallas no conocen URLs ni formatos de transporte. */
export const solicitudService = {
  listar: (filtro: FiltroSolicitudes) =>
    api.get<Pagina<Solicitud>>('/solicitudes', { params: limpiarParams(filtro) }).then((r) => r.data),

  /** Solo el total de un filtro (para los contadores de las pestañas). */
  contar: (filtro: FiltroSolicitudes) =>
    api.get<Pagina<Solicitud>>('/solicitudes', { params: limpiarParams({ ...filtro, limit: 1, page: 1 }) }).then((r) => r.data.meta.total),

  detalle: (id: number) => api.get<SolicitudDetalle>(`/solicitudes/${id}`).then((r) => r.data),
  historial: (id: number) => api.get<Historial[]>(`/solicitudes/${id}/historial`).then((r) => r.data),

  /** Con archivos se envía `multipart/form-data`; sin ellos, JSON. */
  crear: (datos: SolicitudNueva, archivos: File[]) => {
    if (!archivos.length) return api.post<Solicitud>('/solicitudes', datos).then((r) => r.data);
    const formulario = new FormData();
    for (const [clave, valor] of Object.entries(datos)) if (valor !== undefined) formulario.append(clave, String(valor));
    for (const archivo of archivos) formulario.append('adjuntos', archivo);
    return api.post<Solicitud>('/solicitudes', formulario).then((r) => r.data);
  },

  /** `version` activa el control de concurrencia: si otro usuario cambió la solicitud, la API responde 409. */
  cambiarEstado: (id: number, cuerpo: { estado: Estado; comentario?: string; resolucion?: string; prioridad_id?: number; version?: number }) =>
    api.patch<Solicitud>(`/solicitudes/${id}/estado`, cuerpo).then((r) => r.data),

  reabrir: (id: number, motivo: string) => api.post<Solicitud>(`/solicitudes/${id}/reapertura`, { motivo }).then((r) => r.data),
  comentar: (id: number, comentario: string) => api.post<Historial[]>(`/solicitudes/${id}/comentarios`, { comentario }).then((r) => r.data),

  subirAdjuntos: (id: number, archivos: File[]) => {
    const formulario = new FormData();
    for (const archivo of archivos) formulario.append('adjuntos', archivo);
    return api.post<Adjunto[]>(`/solicitudes/${id}/adjuntos`, formulario).then((r) => r.data);
  },

  /** La descarga pasa por la API (con el token): los adjuntos no tienen URL pública. */
  descargarAdjunto: async (id: number, adjunto: Adjunto) => {
    const { data } = await api.get<Blob>(`/solicitudes/${id}/adjuntos/${adjunto.id}`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = adjunto.nombre_original;
    enlace.click();
    URL.revokeObjectURL(url);
  },
};
