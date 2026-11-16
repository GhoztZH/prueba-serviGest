import { api, limpiarParams } from '../../../shared/http/client';
import type { Pagina, Rol, Usuario } from '../../../shared/types/api';

const datos = <T>(r: { data: T }) => r.data;

export const userService = {
  listar: (params: { page?: number; limit?: number; q?: string; rol?: Rol | ''; activo?: boolean | '' }) =>
    api.get<Pagina<Usuario>>('/usuarios', { params: limpiarParams(params) }).then(datos),
  crear: (d: { nombre: string; email: string; password: string; rol: 'ADMIN' | 'COORDINADOR' }) => api.post<Usuario>('/usuarios', d).then(datos),
  actualizar: (id: number, d: Partial<{ nombre: string; email: string; activo: boolean }>) => api.put<Usuario>(`/usuarios/${id}`, d).then(datos),
  restablecerPassword: (id: number, password: string) => api.post(`/usuarios/${id}/reset-password`, { password }).then(() => undefined),
};
