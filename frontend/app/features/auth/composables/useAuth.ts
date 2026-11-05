import { ref, toRef } from 'vue';
import { authService, type AuthFetch, type LoginCredentials, type Usuario } from '../../../services/authService';
export type { Usuario, AuthResponse } from '../../../services/authService';

export interface UseAuthOptions {
  mockFetch?: AuthFetch;
  mockNavigateTo?: (url: string) => Promise<unknown>;
  cookieStorage?: { token: string | null };
}

const refreshes = new WeakMap<object, Promise<boolean>>();

export function useAuth(options?: UseAuthOptions) {
  const storage = options?.cookieStorage;
  const token = storage
    ? toRef(storage, 'token')
    : useState<string | null>('auth_token', () => null);
  const user = options ? ref<Usuario | null>(null) : useState<Usuario | null>('auth_user', () => null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const navigate = options?.mockNavigateTo ?? navigateTo;
  const scope = options ?? useNuxtApp();
  const fetcher = options?.mockFetch ?? (import.meta.server ? useRequestFetch() : $fetch);

  function isAuthenticated() {
    try {
      const payload = JSON.parse(atob(token.value!.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
      return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
    } catch { return false; }
  }

  function clearSession() {
    token.value = null;
    user.value = null;
  }

  async function login(credentials: LoginCredentials): Promise<boolean> {
    if (isLoading.value) return false;
    isLoading.value = true;
    error.value = null;
    try {
      const response = await authService.login(credentials, fetcher);
      token.value = response.accessToken;
      user.value = response.user;
      await navigate('/admin');
      return true;
    } catch (cause: unknown) {
      const failure = cause as { data?: { message?: string | string[] }; message?: string };
      const message = failure?.data?.message;
      error.value = Array.isArray(message) ? message.join(' ') : message ||
        (failure?.message && !['Internal Server Error', 'Error'].includes(failure.message)
          ? failure.message : 'Error de autenticación');
      clearSession();
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  function restoreSession(): Promise<boolean> {
    if (import.meta.server && !useCookie('refresh_token').value) {
      clearSession();
      return Promise.resolve(false);
    }
    const pending = refreshes.get(scope);
    if (pending) return pending;
    async function restore() {
      try {
        if (import.meta.server) {
          user.value = await authService.getSession(fetcher);
        } else {
          const response = await authService.refresh(fetcher);
          token.value = response.accessToken;
          user.value = response.user;
        }
        return true;
      } catch (cause: unknown) {
        if ((cause as { statusCode?: number }).statusCode !== 401) throw cause;
        clearSession();
        return false;
      }
    }
    // Serializa la rotación entre pestañas; la cookie se actualiza antes de liberar el lock.
    const pendingRestore = import.meta.client && globalThis.navigator?.locks
      ? globalThis.navigator.locks.request('flywise-session', restore)
      : restore();
    const promise = pendingRestore.finally(() => { refreshes.delete(scope); });
    refreshes.set(scope, promise);
    return promise;
  }

  async function sessionExpired(): Promise<never> {
    clearSession();
    await navigate('/login');
    throw new Error('Tu sesión venció. Volvé a iniciar sesión.');
  }

  async function authenticatedRequest<T>(action: (accessToken: string | null) => Promise<T>): Promise<T> {
    const originalToken = token.value;
    try { return await action(originalToken); } catch (cause: unknown) {
      if ((cause as { statusCode?: number }).statusCode !== 401) throw cause;
    }
    // Otra petición puede haber renovado el JWT mientras esta esperaba su respuesta.
    if (token.value === originalToken && !(await restoreSession())) return sessionExpired();
    try { return await action(token.value); } catch (cause: unknown) {
      if ((cause as { statusCode?: number }).statusCode === 401) return sessionExpired();
      throw cause;
    }
  }

  async function logout(): Promise<void> {
    await refreshes.get(scope);
    await authService.logout(token.value, fetcher);
    clearSession();
    await navigate('/login');
  }

  return { user, token, isLoading, error, isAuthenticated, login, logout, clearSession, restoreSession, authenticatedRequest };
}
