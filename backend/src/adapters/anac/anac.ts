export interface MovimientoAnac {
  numeroFila: number;
  fechaUtc: string;
  movimiento: 'DESPEGUE' | 'ATERRIZAJE';
  aeropuerto: string;
  origen: string;
  destino: string;
  operador: string;
  clase: string;
  clasificacion: string;
  aeronave: string;
  matricula: string;
  pasajeros: number | null;
  pax: number | null;
  calidad: string;
}

export const ANAC_HEADERS = [
  'Fecha UTC',
  'Hora UTC',
  'Clase de Vuelo (todos los vuelos)',
  'Clasificación Vuelo',
  'Tipo de Movimiento',
  'Aeropuerto',
  'Origen / Destino',
  'Aerolinea Nombre',
  'Aeronave',
  'Pasajeros',
  'PAX',
  'Calidad dato',
];

export function cabeceraAnac(input: string) {
  const header = input.replace(/^\uFEFF/, '').trim();
  return header === 'Aerolínea Nombre' ? 'Aerolinea Nombre' : header;
}

export function fechaUtcAnac(value: string) {
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!parts) return undefined;
  const date = `${parts[3]}-${parts[2]}-${parts[1]}`;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : undefined;
}

export function normalizarMovimiento(
  row: Record<string, string>,
  numeroFila: number,
  date: string,
): MovimientoAnac {
  const field = (name: string) => (row[name] ?? '').trim();
  const time = /^(\d{1,2}):(\d{2})$/.exec(field('Hora UTC'));
  if (!time || Number(time[1]) > 23 || Number(time[2]) > 59)
    throw new Error('Hora UTC inválida');
  const fechaUtc = `${date}T${time[1].padStart(2, '0')}:${time[2]}:00Z`;
  const movimiento = field('Tipo de Movimiento').toUpperCase();
  if (movimiento !== 'DESPEGUE' && movimiento !== 'ATERRIZAJE')
    throw new Error('Tipo de movimiento desconocido');
  const aeropuerto = field('Aeropuerto').toUpperCase();
  const otro = field('Origen / Destino').toUpperCase();
  if (
    !aeropuerto ||
    !otro ||
    !field('Aerolinea Nombre') ||
    !field('Clasificación Vuelo')
  )
    throw new Error(
      'Movimiento sin aeropuerto, extremo, operador o clasificación',
    );
  const integer = (name: string) => {
    const value = field(name);
    if (!value) return null;
    if (!/^\d+$/.test(value) || Number(value) > 2147483647)
      throw new Error(`${name} inválido`);
    return Number(value);
  };
  return {
    numeroFila,
    fechaUtc,
    movimiento,
    aeropuerto,
    origen: movimiento === 'DESPEGUE' ? aeropuerto : otro,
    destino: movimiento === 'DESPEGUE' ? otro : aeropuerto,
    operador: field('Aerolinea Nombre'),
    clase: field('Clase de Vuelo (todos los vuelos)'),
    clasificacion: field('Clasificación Vuelo'),
    aeronave: field('Aeronave'),
    matricula: field('Matrícula'),
    pasajeros: integer('Pasajeros'),
    pax: integer('PAX'),
    calidad: field('Calidad dato') || 'No informada',
  };
}
