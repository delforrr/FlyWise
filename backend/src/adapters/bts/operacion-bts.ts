export type FilaBts = Record<string, string>;
export type OperacionBts = {
  identidad: string;
  numeroFila: number;
  origenBts: string;
  destinoBts: string;
  operadorBts: string;
  codigoOrigen: string;
  codigoDestino: string;
  codigoOperador: string;
  fechaVuelo: string;
  numeroVuelo: string;
  estado: 'ARRIVED' | 'CANCELLED' | 'DIVERTED';
  demoraLlegadaMinutos: number | null;
};

export function normalizarBts(
  row: FilaBts,
  periodo: string,
  numeroFila: number,
): OperacionBts | string {
  const date = row.FlightDate?.slice(0, 10);
  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !date.startsWith(`${periodo}-`) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    return 'Fecha fuera del mes seleccionado';
  for (const key of [
    'DOT_ID_Reporting_Airline',
    'Flight_Number_Reporting_Airline',
    'OriginAirportID',
    'DestAirportID',
  ])
    if (!/^\d+$/.test(row[key] ?? '')) return `Identificador inválido: ${key}`;
  if (row.OriginAirportID === row.DestAirportID) return 'Extremos idénticos';
  if (!/^(?:[01]\d|2[0-3])[0-5]\d$|^2400$/.test(row.CRSDepTime ?? ''))
    return 'Hora programada inválida';
  if (
    !/^[01](?:\.0+)?$/.test(row.Cancelled ?? '') ||
    !/^[01](?:\.0+)?$/.test(row.Diverted ?? '')
  )
    return 'Resultado final desconocido';
  const estado =
    Number(row.Cancelled) === 1
      ? 'CANCELLED'
      : Number(row.Diverted) === 1
        ? 'DIVERTED'
        : 'ARRIVED';
  const demora = estado === 'ARRIVED' ? Number(row.ArrDelay) : null;
  if (
    estado === 'ARRIVED' &&
    (!row.ArrDelay?.trim() ||
      !Number.isInteger(demora) ||
      demora! < -2147483648 ||
      demora! > 2147483647)
  )
    return 'Demora de llegada desconocida o inválida';
  return {
    identidad: [
      date,
      row.DOT_ID_Reporting_Airline,
      row.Flight_Number_Reporting_Airline,
      row.OriginAirportID,
      row.DestAirportID,
      row.CRSDepTime,
    ].join(':'),
    numeroFila,
    origenBts: row.OriginAirportID,
    destinoBts: row.DestAirportID,
    operadorBts: row.DOT_ID_Reporting_Airline,
    codigoOrigen: row.Origin ?? '',
    codigoDestino: row.Dest ?? '',
    codigoOperador:
      row.IATA_CODE_Reporting_Airline ?? row.Reporting_Airline ?? '',
    fechaVuelo: date,
    numeroVuelo: row.Flight_Number_Reporting_Airline,
    estado,
    demoraLlegadaMinutos: demora,
  };
}
