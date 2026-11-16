import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Perfil } from '../shared/types/api';
import { RutaProtegida } from './routes';

vi.mock('./providers/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from './providers/AuthProvider';

const mockUseAuth = vi.mocked(useAuth);

describe('RutaProtegida', () => {
  it('muestra estado de carga mientras se verifica la sesion', () => {
    mockUseAuth.mockReturnValue({
      usuario: null,
      cargando: true,
      iniciarSesion: vi.fn(),
      cerrarSesion: vi.fn(),
      actualizarUsuario: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/privado']}>
        <Routes>
          <Route
            path="/privado"
            element={
              <RutaProtegida>
                <div>Contenido Secreto</div>
              </RutaProtegida>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Contenido Secreto')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: /cargando/i })).toBeInTheDocument();
  });

  it('redirige a /login si no hay usuario autenticado', () => {
    mockUseAuth.mockReturnValue({
      usuario: null,
      cargando: false,
      iniciarSesion: vi.fn(),
      cerrarSesion: vi.fn(),
      actualizarUsuario: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/privado']}>
        <Routes>
          <Route
            path="/privado"
            element={
              <RutaProtegida>
                <div>Contenido Secreto</div>
              </RutaProtegida>
            }
          />
          <Route path="/login" element={<div>Pantalla Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Contenido Secreto')).not.toBeInTheDocument();
    expect(screen.getByText('Pantalla Login')).toBeInTheDocument();
  });

  it('bloquea el acceso si el rol del usuario no esta permitido', () => {
    const usuarioTecnico: Perfil = {
      id: 2,
      nombre: 'Técnico Demo',
      email: 'tecnico@servigest.ec',
      rol: 'TECNICO',
      clienteId: null,
      tecnicoId: 1,
    };

    mockUseAuth.mockReturnValue({
      usuario: usuarioTecnico,
      cargando: false,
      iniciarSesion: vi.fn(),
      cerrarSesion: vi.fn(),
      actualizarUsuario: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/solo-admin']}>
        <Routes>
          <Route
            path="/solo-admin"
            element={
              <RutaProtegida rolesPermitidos={['ADMIN']}>
                <div>Panel Administrador</div>
              </RutaProtegida>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Panel Administrador')).not.toBeInTheDocument();
    expect(screen.getByText(/no tiene permisos/i)).toBeInTheDocument();
  });

  it('permite el acceso si el rol del usuario coincide', () => {
    const usuarioAdmin: Perfil = {
      id: 1,
      nombre: 'Admin Demo',
      email: 'admin@servigest.ec',
      rol: 'ADMIN',
      clienteId: null,
      tecnicoId: null,
    };

    mockUseAuth.mockReturnValue({
      usuario: usuarioAdmin,
      cargando: false,
      iniciarSesion: vi.fn(),
      cerrarSesion: vi.fn(),
      actualizarUsuario: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/solo-admin']}>
        <Routes>
          <Route
            path="/solo-admin"
            element={
              <RutaProtegida rolesPermitidos={['ADMIN']}>
                <div>Panel Administrador</div>
              </RutaProtegida>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Panel Administrador')).toBeInTheDocument();
  });
});
