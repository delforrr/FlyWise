export function timestampToDate(value: string): Date {
  // Legacy PostgreSQL timestamps are UTC, without a time-zone suffix.
  return new Date(`${value.replace(' ', 'T')}Z`);
}
