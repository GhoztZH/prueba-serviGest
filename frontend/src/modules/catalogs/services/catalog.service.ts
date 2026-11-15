import { api } from '../../../shared/http/client';
import type { Categoria, Especialidad, Parametro, Prioridad } from '../../../shared/types/api';

const datos = <T>(r: { data: T }) => r.data;

export const catalogService = {
  especialidades: (activo?: boolean) => api.get<Especialidad[]>('/especialidades', { params: activo === undefined ? {} : { activo } }).then(datos),
  crearEspecialidad: (d: { nombre: string; descripcion?: string }) => api.post<Especialidad>('/especialidades', d).then(datos),
  actualizarEspecialidad: (id: number, d: Partial<{ nombre: string; descripcion: string; activo: boolean }>) => api.put<Especialidad>(`/especialidades/${id}`, d).then(datos),
  eliminarEspecialidad: (id: number) => api.delete(`/especialidades/${id}`).then(() => undefined),

  categorias: (activo?: boolean) => api.get<Categoria[]>('/categorias', { params: activo === undefined ? {} : { activo } }).then(datos),
  crearCategoria: (d: { nombre: string; descripcion?: string; especialidad_id: number }) => api.post<Categoria>('/categorias', d).then(datos),
  actualizarCategoria: (id: number, d: Partial<{ nombre: string; descripcion: string; especialidad_id: number; activo: boolean }>) => api.put<Categoria>(`/categorias/${id}`, d).then(datos),
  eliminarCategoria: (id: number) => api.delete(`/categorias/${id}`).then(() => undefined),

  prioridades: () => api.get<Prioridad[]>('/prioridades').then(datos),
  actualizarPrioridad: (id: number, d: { nombre?: string; horas_plazo?: number }) => api.put<Prioridad>(`/prioridades/${id}`, d).then(datos),

  parametros: () => api.get<Parametro[]>('/parametros').then(datos),
  actualizarParametro: (clave: string, valor: string) => api.put<Parametro>(`/parametros/${clave}`, { valor }).then(datos),
};
