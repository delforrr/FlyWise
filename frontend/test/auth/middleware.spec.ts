import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../app/features/auth/composables/useAuth';

type Middleware = (to: { path: string }) => Promise<unknown>;
let middleware: Middleware;
const fetcher = vi.fn();
const user = { id: 'user-1', correo: 'admin@flywise.com', rol: 'ADMIN' };
const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }))}.signature`;

beforeAll(async () => {
  vi.stubGlobal('defineNuxtRouteMiddleware', (handler: Middleware) => handler);
  middleware = (await import('../../app/middleware/auth.global')).default;
});
beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal('$fetch', fetcher);
  vi.mocked(navigateTo).mockClear();
});

describe('protección de administración', () => {
  it.each(['/admin', '/admin/usuarios', '/admin/servicios', '/admin/otra'])('redirige %s sin sesión', async path => {
    fetcher.mockRejectedValueOnce({ statusCode: 401 });
    await middleware({ path });
    expect(navigateTo).toHaveBeenCalledWith('/login');
    expect(useAuth().token.value).toBeNull();
  });

  it('restaura la sesión recordada antes de autorizar una ruta', async () => {
    fetcher.mockResolvedValueOnce({ accessToken: token, user });
    await middleware({ path: '/admin' });
    expect(navigateTo).not.toHaveBeenCalled();
    expect(useAuth().isAuthenticated()).toBe(true);
  });

  it('renueva JWT vencidos y no consulta la API para JWT vigentes', async () => {
    useAuth().token.value = `header.${btoa(JSON.stringify({ exp: 1 }))}.signature`;
    fetcher.mockResolvedValueOnce({ accessToken: token, user });
    await middleware({ path: '/admin/usuarios' });
    await middleware({ path: '/admin/servicios' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('permite el login sin sesión, redirige si ya hay sesión y deja libres las páginas públicas', async () => {
    await middleware({ path: '/explorar' });
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockRejectedValueOnce({ statusCode: 401 });
    await middleware({ path: '/login' });
    expect(navigateTo).not.toHaveBeenCalled();
    useAuth().token.value = token;
    await middleware({ path: '/login' });
    expect(navigateTo).toHaveBeenCalledWith('/admin');
  });

  it('no autoriza administración cuando el servidor de sesiones falla', async () => {
    fetcher.mockRejectedValueOnce({ statusCode: 503 });
    await expect(middleware({ path: '/admin' })).rejects.toEqual({ statusCode: 503 });
    expect(useAuth().isAuthenticated()).toBe(false);
  });
});
