import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBackendRequest } from '../../app/shared/composables/useBackendRequest';
import { useAuth } from '../../app/features/auth/composables/useAuth';

const fetcher = vi.fn();
beforeEach(() => { fetcher.mockReset(); vi.stubGlobal('$fetch', fetcher); });

describe('shared HTTP session boundary', () => {
  it('uses the current in-memory JWT and retries ETL after refreshing an expired token', async () => {
    useAuth().token.value = 'expired';
    fetcher.mockRejectedValueOnce({ statusCode: 401 })
      .mockResolvedValueOnce({ accessToken: 'renewed', user: { id: '1', correo: 'admin@test.com', rol: 'ADMIN' } })
      .mockResolvedValueOnce([]);
    expect(await useBackendRequest()('/etl/procesos')).toEqual([]);
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/etl/procesos', { headers: { Authorization: 'Bearer expired' } });
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/autenticacion/renovar', expect.objectContaining({ method: 'POST' }));
    expect(fetcher).toHaveBeenNthCalledWith(3, '/api/etl/procesos', { headers: { Authorization: 'Bearer renewed' } });
  });

  it('keeps public catalogue requests independent of session restoration', async () => {
    fetcher.mockResolvedValueOnce([]);
    await useBackendRequest()('/aeropuertos/catalogo');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
