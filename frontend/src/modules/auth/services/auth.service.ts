import { api } from '../../../shared/http/client';
import type { Perfil } from '../../../shared/types/api';

export const authService = {
  login: (email: string, password: string) =>
    api.post<{ token: string; usuario: Perfil }>('/auth/login', { email, password }).then((r) => r.data),
  logout: () => api.post('/auth/logout').then(() => undefined),
  perfil: () => api.get<Perfil>('/auth/me').then((r) => r.data),
  actualizarPerfil: (nombre: string) => api.patch<Perfil>('/auth/me', { nombre }).then((r) => r.data),
  cambiarPassword: (actual: string, nueva: string) => api.patch('/auth/me/password', { actual, nueva }).then(() => undefined),
  olvidePassword: (email: string) =>
    api.post<{ message: string; tokenDesarrollo?: string }>('/auth/olvide-password', { email }).then((r) => r.data),
  restablecerPassword: (token: string, password: string) =>
    api.post('/auth/restablecer-password', { token, password }).then(() => undefined),
};
