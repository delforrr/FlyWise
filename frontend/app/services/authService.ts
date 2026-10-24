import type { ManagedUser } from '../features/users/schemas/userSchemas';

export type User = Pick<ManagedUser, 'id' | 'email' | 'role'>;
export interface AuthResponse {
  accessToken: string;
  user: User;
}
export interface LoginCredentials {
  email: string;
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
    return fetcher<AuthResponse>('/api/auth/login', { method: 'POST', body: credentials, headers: { 'X-FlyWise-Session': '1' } });
  },
  refresh(fetcher: AuthFetch = $fetch) {
    return fetcher<AuthResponse>('/api/auth/refresh', { method: 'POST', headers: { 'X-FlyWise-Session': '1' } });
  },
  getSession(fetcher: AuthFetch = $fetch) {
    return fetcher<User>('/api/auth/session', { method: 'GET', headers: { 'X-FlyWise-Session': '1' } });
  },
  logout(token: string | null, fetcher: AuthFetch = $fetch) {
    return fetcher('/api/auth/logout', {
      method: 'POST',
      headers: { 'X-FlyWise-Session': '1', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  },
  getProfile(token: string | null) {
    return $fetch<unknown>('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  },
};
