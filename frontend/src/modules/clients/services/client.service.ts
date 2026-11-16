import { api, limpiarParams } from '../../../shared/http/client';
import type { Cliente, ClienteDetalle, Pagina, Sede } from '../../../shared/types/api';

export interface ClienteFormulario {
  identificacion: string;
  razon_social: string;
  email: string;
  telefono?: string;
  direccion?: string;
  sedes?: Array<{ nombre: string; direccion: string }>;
  cuenta?: { email: string; password?: string };
  activo?: boolean;
}

const datos = <T>(r: { data: T }) => r.data;

export const clientService = {
  listar: (params: { page?: number; limit?: number; q?: string; activo?: boolean | '' }) =>
    api.get<Pagina<Cliente>>('/clientes', { params: limpiarParams(params) }).then(datos),
  detalle: (id: number) => api.get<ClienteDetalle>(`/clientes/${id}`).then(datos),
  crear: (d: ClienteFormulario) => api.post<ClienteDetalle>('/clientes', d).then(datos),
  actualizar: (id: number, d: Partial<ClienteFormulario>) => api.put<ClienteDetalle>(`/clientes/${id}`, d).then(datos),
  eliminar: (id: number) => api.delete(`/clientes/${id}`).then(() => undefined),
  sedes: (id: number) => api.get<Sede[]>(`/clientes/${id}/sedes`).then(datos),
  crearSede: (id: number, d: { nombre: string; direccion: string }) => api.post<Sede>(`/clientes/${id}/sedes`, d).then(datos),
  actualizarSede: (id: number, sedeId: number, d: Partial<{ nombre: string; direccion: string; activo: boolean }>) =>
    api.put<Sede>(`/clientes/${id}/sedes/${sedeId}`, d).then(datos),
  eliminarSede: (id: number, sedeId: number) => api.delete(`/clientes/${id}/sedes/${sedeId}`).then(() => undefined),
};
