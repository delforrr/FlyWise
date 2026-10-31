import type { ManagedUser } from '../features/users/schemas/userSchemas';

export type Usuario = Pick<ManagedUser, 'id' | 'correo' | 'rol'>;
export interface AuthResponse {
  accessToken: string;
  user: Usuario;
}
export interface LoginCredentials {
  correo: string;
  password: string;
  remember?: boolean;
}
export type AuthFetch = <T>(url: string, options?: {
  method?: 'GET' | 'POST';
  body?: LoginCredentials;
  headers?: Record<string, string>;
}) => Promise<T>;

export const authService = {
  login(credentials: LoginCredentials, fetcher: AuthFetch = $fetch) {
    return fetcher<AuthResponse>('/api/autenticacion/iniciar-sesion', { method: 'POST', body: credentials, headers: { 'X-FlyWise-Session': '1' } });
  },
  refresh(fetcher: AuthFetch = $fetch) {
    return fetcher<AuthResponse>('/api/autenticacion/renovar', { method: 'POST', headers: { 'X-FlyWise-Session': '1' } });
  },
  getSession(fetcher: AuthFetch = $fetch) {
    return fetcher<Usuario>('/api/autenticacion/sesion', { method: 'GET', headers: { 'X-FlyWise-Session': '1' } });
  },
  logout(token: string | null, fetcher: AuthFetch = $fetch) {
    return fetcher('/api/autenticacion/cerrar-sesion', {
      method: 'POST',
      headers: { 'X-FlyWise-Session': '1', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  },
  getProfile(token: string | null) {
    return $fetch<unknown>('/api/autenticacion/perfil', { headers: { Authorization: `Bearer ${token}` } });
  },
};
