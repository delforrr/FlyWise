import 'reflect-metadata';
import { validate } from './env.validation.js';

describe('Startup configuration boundary', () => {
  const valid = {
    DATABASE_URL: 'postgresql://fixture:fixture@localhost:5432/flywise_db',
    JWT_SECRET: 'fixture-secret-with-at-least-32-characters',
  };
  it.each([
    { PORT: '0' },
    { PORT: '65536' },
    { PORT: '1.5' },
    { REDIS_PORT: '-1' },
    { REDIS_PORT: '1.5' },
    { DATABASE_URL: '' },
    { DATABASE_URL: '   ' },
    { REDIS_HOST: '' },
    { JWT_SECRET: 'weak' },
    { JWT_SECRET: ' '.repeat(40) },
  ])(
    'rejects invalid startup settings without disclosing values: %p',
    (patch) => {
      expect(() => validate({ ...valid, ...patch })).toThrow(
        /Environment validation error/,
      );
    },
  );
  it('accepts defaults and converts valid port strings', () => {
    expect(
      validate({ ...valid, PORT: '3001', REDIS_PORT: '6379' }),
    ).toMatchObject({ PORT: 3001, REDIS_PORT: 6379, REDIS_HOST: 'localhost' });
  });
});
