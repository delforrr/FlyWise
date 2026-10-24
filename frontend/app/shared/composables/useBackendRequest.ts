import { useAuth } from '../../features/auth/composables/useAuth';
export function useBackendRequest() {
  const auth = useAuth();
  const toast = useToast();
  return async <T>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; query?: Record<string, string | number | undefined> } = {}): Promise<T> => {
    try {
      const perform = (token: string | null) => $fetch<T>(`/api${path}`, {
        ...options,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return path.startsWith('/etl/') ? await auth.authenticatedRequest(perform) : await perform(auth.token.value);
    } catch (error) {
      if (options.method && options.method !== 'GET') toast.add({ title: 'No se pudo completar la operación', description: error instanceof Error ? error.message : 'Error del servidor', color: 'error' });
      throw error;
    }
  };
}
