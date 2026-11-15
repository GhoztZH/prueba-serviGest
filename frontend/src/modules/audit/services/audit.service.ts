import { api, limpiarParams } from '../../../shared/http/client';
import type { Pagina, RegistroAuditoria } from '../../../shared/types/api';

export const auditService = {
  listar: (params: { page?: number; limit?: number; entidad?: string }) =>
    api.get<Pagina<RegistroAuditoria>>('/auditoria', { params: limpiarParams(params) }).then((r) => r.data),
};
