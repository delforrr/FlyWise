import { setTimeout } from 'node:timers/promises';

export class FalloOag extends Error {}
export class CredencialOagRechazada extends FalloOag {}
export class CuotaOagAgotada extends FalloOag {
  constructor(readonly reintentarDesde: number) {
    super('Cuota de OAG agotada');
  }
}

export const OAG_ENDPOINT = 'https://api.oag.com/flight-instances/';
export const OAG_CLAVE_ENTORNO = 'OAG_SUBSCRIPTION_KEY';
const MAX_REINTENTOS_PAGINA = 2;
const MAX_ESPERA_PAGINA_MS = 30_000;

export type Codigos = { iata?: string; icao?: string };
type Hora = { local?: string; utc?: string };
type Extremo = { airport?: Codigos; date?: Hora; time?: Hora };
type EstadoOag = {
  state?: string;
  updatedAt?: string;
  diversionAirport?: string;
  irregularOperationType?: string;
  arrival?: { actualTime?: { inGate?: Hora } };
};
type VueloOag = {
  scheduleInstanceKey?: string;
  originalFlight?: string;
  flightNumber?: string | number;
  serviceSuffix?: string;
  carrier?: Codigos;
  departure?: Extremo;
  arrival?: Extremo;
  codeshare?: { operatingFlight?: { code?: string } };
  statusDetails?: EstadoOag[];
};

export type ConsultaOag = {
  periodo: string;
  origenCodigo: string;
  destinoCodigo: string;
  tipoCodigo: 'IATA' | 'ICAO';
};

export async function* paginasOag(
  consulta: ConsultaOag,
  clave: string,
  cursoresPrevios: string[] = [],
) {
  const url = new URL(OAG_ENDPOINT);
  const [anio, mes] = consulta.periodo.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  url.search = new URLSearchParams({
    version: 'v2',
    DepartureAirport: consulta.origenCodigo,
    ArrivalAirport: consulta.destinoCodigo,
    DepartureDateTime: `${consulta.periodo}-01/${consulta.periodo}-${ultimoDia}`,
    CodeType: consulta.tipoCodigo,
    Content: 'Status',
    Codeshare: 'Operating',
    ServiceType: 'Passenger',
    Limit: '10',
  }).toString();
  const cursores = new Set(cursoresPrevios);
  if (cursoresPrevios.length)
    url.searchParams.set('After', cursoresPrevios[cursoresPrevios.length - 1]);
  for (;;) {
    let pagina: { data?: unknown; paging?: { next?: string | null } };
    try {
      const respuesta = await descargarPagina(url, clave);
      if (respuesta.status === 401 || respuesta.status === 403)
        throw new CredencialOagRechazada(
          `OAG respondió HTTP ${respuesta.status}`,
        );
      if (!respuesta.ok)
        throw new FalloOag(`OAG respondió HTTP ${respuesta.status}`);
      try {
        pagina = (await respuesta.json()) as typeof pagina;
      } catch {
        throw new FalloOag('OAG devolvió una página inválida');
      }
    } catch (error) {
      if (error instanceof FalloOag) throw error;
      throw new FalloOag('No fue posible obtener la página de OAG');
    }
    if (
      !Array.isArray(pagina?.data) ||
      pagina.data.length > 1000 ||
      (pagina.paging != null &&
        (typeof pagina.paging !== 'object' || Array.isArray(pagina.paging)))
    )
      throw new FalloOag('OAG devolvió una página inválida');
    const siguiente = pagina.paging?.next;
    if (siguiente == null) {
      yield { filas: pagina.data as unknown[], cursor: null };
      return;
    }
    const enlace =
      typeof siguiente === 'string' ? URL.parse(siguiente, url) : null;
    const cursor = enlace?.searchParams.get('After');
    if (
      !cursor ||
      enlace?.origin !== url.origin ||
      enlace.pathname !== url.pathname ||
      cursores.has(cursor)
    )
      throw new FalloOag('OAG devolvió un cursor de paginación inválido');
    // El proveedor sólo decide el cursor; la consulta y el destino se mantienen fijos.
    cursores.add(cursor);
    yield { filas: pagina.data as unknown[], cursor };
    url.searchParams.set('After', cursor);
  }
}

async function descargarPagina(url: URL, clave: string) {
  for (let intento = 0; ; intento++) {
    const respuesta = await fetch(url.toString(), {
      headers: { 'Subscription-Key': clave },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (respuesta.status !== 429) return respuesta;

    const cabecera = respuesta.headers.get('Retry-After')?.trim();
    const demora = !cabecera
      ? 1000 * 2 ** intento
      : /^\d+$/.test(cabecera)
        ? Number(cabecera) * 1000
        : Math.max(0, Date.parse(cabecera) - Date.now());
    await respuesta.body?.cancel();
    if (
      intento >= MAX_REINTENTOS_PAGINA ||
      !Number.isFinite(demora) ||
      demora > MAX_ESPERA_PAGINA_MS
    )
      throw new CuotaOagAgotada(
        Date.now() + (cabecera && Number.isFinite(demora) ? demora : 0),
      );
    await setTimeout(demora);
  }
}

function instanteUtc(valor: unknown): number {
  if (typeof valor !== 'string') return NaN;
  const partes =
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)(?:Z|\+00:00)?$/.exec(
      valor,
    );
  if (!partes) return NaN;
  const instante = Date.parse(`${partes[1]}T${partes[2]}Z`);
  return Number.isFinite(instante) &&
    new Date(instante).toISOString().slice(0, 10) === partes[1]
    ? instante
    : NaN;
}

export function normalizarVueloOag(fila: unknown, consulta: ConsultaOag) {
  if (!fila || typeof fila !== 'object') return null;
  const vuelo = fila as VueloOag;
  if (vuelo.codeshare?.operatingFlight?.code || vuelo.originalFlight)
    return 'fuera-de-poblacion';
  const campoCodigo = consulta.tipoCodigo === 'IATA' ? 'iata' : 'icao';
  const fechaVuelo = vuelo.departure?.date?.local;
  const numeroVuelo =
    String(vuelo.flightNumber ?? '') + (vuelo.serviceSuffix ?? '');
  if (
    vuelo.departure?.airport?.[campoCodigo] !== consulta.origenCodigo ||
    vuelo.arrival?.airport?.[campoCodigo] !== consulta.destinoCodigo ||
    typeof fechaVuelo !== 'string' ||
    fechaVuelo.slice(0, 7) !== consulta.periodo ||
    !Number.isFinite(instanteUtc(fechaVuelo + 'T00:00Z')) ||
    !/^\d{1,4}[A-Z]?$/.test(numeroVuelo) ||
    !vuelo.carrier ||
    typeof vuelo.scheduleInstanceKey !== 'string' ||
    !vuelo.scheduleInstanceKey.trim() ||
    vuelo.scheduleInstanceKey.length > 200
  )
    return null;

  const detalles = Array.isArray(vuelo.statusDetails)
    ? vuelo.statusDetails.filter(
        (detalle): detalle is EstadoOag =>
          Boolean(detalle) && typeof detalle === 'object',
      )
    : [];
  const estados = detalles.filter(
    (detalle) => detalle.irregularOperationType !== 'Recovery',
  );
  if (detalles.length && !estados.length) return 'fuera-de-poblacion';
  estados.sort((a, b) => fechaEstado(b) - fechaEstado(a));
  const estado = estados[0];
  const diversion = estados.find(
    (detalle) =>
      detalle.state === 'Diverted' ||
      detalle.irregularOperationType === 'Diversion' ||
      detalle.irregularOperationType === 'Diverted' ||
      Boolean(detalle.diversionAirport),
  );
  const salida = {
    id: vuelo.scheduleInstanceKey,
    carrier: vuelo.carrier,
    fechaVuelo,
    numeroVuelo,
    revision: estado ? fechaEstado(estado) : 0,
  };
  if (estado?.state === 'Canceled')
    return {
      ...salida,
      estado: 'CANCELLED' as const,
      demoraLlegadaMinutos: null,
    };
  if (diversion)
    return {
      ...salida,
      estado: 'DIVERTED' as const,
      demoraLlegadaMinutos: null,
    };

  const hora = vuelo.arrival?.time?.utc;
  const hhmm =
    typeof hora === 'string' ? hora.replace(/^(\d{2})(\d{2})$/, '$1:$2') : '';
  const programada = instanteUtc(`${vuelo.arrival?.date?.utc}T${hhmm}`);
  const real = instanteUtc(estado?.arrival?.actualTime?.inGate?.utc);
  if (
    estado?.state === 'InGate' &&
    Number.isFinite(programada) &&
    Number.isFinite(real)
  ) {
    // El redondeo hacia arriba conserva el umbral vigente de hasta 15 minutos exactos.
    const demoraLlegadaMinutos = Math.ceil((real - programada) / 60_000);
    return { ...salida, estado: 'ARRIVED' as const, demoraLlegadaMinutos };
  }
  if (estado?.state === 'InGate')
    return {
      ...salida,
      estado: 'ARRIVED' as const,
      demoraLlegadaMinutos: null,
    };
  return { ...salida, estado: null, demoraLlegadaMinutos: null };
}

function fechaEstado(estado: EstadoOag) {
  const fecha = instanteUtc(estado.updatedAt);
  return Number.isFinite(fecha) ? fecha : 0;
}
