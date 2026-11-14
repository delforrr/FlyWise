const mesBuenosAires = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
});

export function periodosCerradosMapa() {
  const partes = mesBuenosAires.formatToParts(Date.now());
  const anio = Number(partes.find(({ type }) => type === 'year')?.value);
  const mes = Number(partes.find(({ type }) => type === 'month')?.value);
  return Array.from({ length: 12 }, (_, indice) =>
    new Date(Date.UTC(anio, mes - 2 - indice, 1)).toISOString().slice(0, 7),
  );
}
