import { api, limpiarParams } from '../../../shared/http/client';
import type { PaginaNotificaciones } from '../../../shared/types/api';

export const notificationService = {
  listar: (params: { page?: number; limit?: number; no_leidas?: boolean } = {}) =>
    api.get<PaginaNotificaciones>('/notificaciones', { params: limpiarParams(params) }).then((r) => r.data),
  marcarLeida: (id: number) => api.patch(`/notificaciones/${id}/leida`).then(() => undefined),
  marcarTodas: () => api.patch('/notificaciones/leer-todas').then(() => undefined),
};
