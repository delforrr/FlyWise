import { timestampToDate } from './timestamp.js';

describe('timestampToDate', () => {
  it.each([
    ['2026-09-01 00:00:00', '2026-09-01T00:00:00.000Z'],
    ['2026-09-01T12:30:45.123', '2026-09-01T12:30:45.123Z'],
  ])(
    'serializes the UTC database timestamp %s as ISO JSON',
    (value, expected) => {
      expect(JSON.stringify(timestampToDate(value))).toBe(
        JSON.stringify(expected),
      );
    },
  );
});
