import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

describe('Startup validation (real backend process)', () => {
  it('rejects an invalid port before opening the HTTP server', async () => {
    const result: unknown = await promisify(execFile)(
      process.execPath,
      ['dist/src/main.js'],
      {
        env: { ...process.env, PORT: '0' },
        timeout: 10000,
      },
    ).catch((error: unknown) => error);
    expect(result).toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Environment validation error: PORT'),
    });
  }, 15000);
});
