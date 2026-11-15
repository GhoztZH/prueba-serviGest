import { api, limpiarParams } from '../../../shared/http/client';
import type { Indicadores } from '../../../shared/types/api';

export interface FiltroIndicadores {
  desde?: string;
  hasta?: string;
  categoria_id?: number | string;
  prioridad_id?: number | string;
  cliente_id?: number | string;
  tecnico_id?: number | string;
}

export const dashboardService = {
  /** Todos los indicadores llegan calculados del backend a partir de los datos persistidos. */
  indicadores: (filtro: FiltroIndicadores = {}) => api.get<Indicadores>('/dashboard/indicadores', { params: limpiarParams(filtro) }).then((r) => r.data),
};
