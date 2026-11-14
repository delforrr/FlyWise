export function timestampToDate(value: string): Date {
  // Legacy PostgreSQL timestamps are UTC, without a time-zone suffix.
  return new Date(`${value.replace(' ', 'T')}Z`);
}

export function ultimoDiaDelMes(inicioMes: string) {
  const fecha = new Date(inicioMes);
  fecha.setUTCMonth(fecha.getUTCMonth() + 1, 0);
  return fecha.toISOString().split('T')[0];
}
