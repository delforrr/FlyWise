import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBackendRequest } from '../../app/shared/composables/useBackendRequest';
import { useAuth } from '../../app/features/auth/composables/useAuth';

const fetcher = vi.fn();
beforeEach(() => { fetcher.mockReset(); vi.stubGlobal('$fetch', fetcher); });

describe('shared HTTP session boundary', () => {
  it('uses the current in-memory JWT and retries ETL after refreshing an expired token', async () => {
    useAuth().token.value = 'expired';
    fetcher.mockRejectedValueOnce({ statusCode: 401 })
      .mockResolvedValueOnce({ accessToken: 'renewed', user: { id: '1', email: 'admin@test.com', role: 'ADMIN' } })
      .mockResolvedValueOnce([]);
    expect(await useBackendRequest()('/etl/pipelines')).toEqual([]);
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/etl/pipelines', { headers: { Authorization: 'Bearer expired' } });
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/auth/refresh', expect.objectContaining({ method: 'POST' }));
    expect(fetcher).toHaveBeenNthCalledWith(3, '/api/etl/pipelines', { headers: { Authorization: 'Bearer renewed' } });
  });

  it('keeps public catalogue requests independent of session restoration', async () => {
    fetcher.mockResolvedValueOnce([]);
    await useBackendRequest()('/airports/catalog');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
