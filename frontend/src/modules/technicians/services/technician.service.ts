import { api, limpiarParams } from '../../../shared/http/client';
import type { Pagina, Tecnico } from '../../../shared/types/api';

export interface TecnicoFormulario {
  nombre: string;
  email: string;
  password?: string;
  cedula: string;
  telefono?: string;
  max_solicitudes_activas?: number;
  especialidades: number[];
  disponible?: boolean;
  activo?: boolean;
}

const datos = <T>(r: { data: T }) => r.data;

export const technicianService = {
  listar: (params: { page?: number; limit?: number; q?: string; especialidad_id?: number | string; disponible?: boolean | '' } = {}) =>
    api.get<Pagina<Tecnico>>('/tecnicos', { params: limpiarParams(params) }).then(datos),
  detalle: (id: number) => api.get<Tecnico>(`/tecnicos/${id}`).then(datos),
  crear: (d: TecnicoFormulario) => api.post<Tecnico>('/tecnicos', d).then(datos),
  actualizar: (id: number, d: Partial<TecnicoFormulario>) => api.put<Tecnico>(`/tecnicos/${id}`, d).then(datos),
  eliminar: (id: number) => api.delete(`/tecnicos/${id}`).then(() => undefined),
  /** El técnico autenticado cambia su propia disponibilidad. */
  cambiarDisponibilidad: (disponible: boolean) => api.patch<Tecnico>('/tecnicos/me/disponibilidad', { disponible }).then(datos),
};
