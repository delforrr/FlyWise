import type { HorariosOperacion } from '../../entities/vuelos/domain/operacion.js';

import {
  FalloOag,
  type Codigos,
  type ConsultaOag,
  type OperacionOag,
} from '../../ingestion/application/oag/alcance-oag.js';

export class FalloTransitorioOag extends FalloOag {
  constructor(
    mensaje: string,
    readonly reintentarDesde?: number,
  ) {
    super(mensaje);
  }
}
export class CredencialOagRechazada extends FalloOag {}
export const OAG_ENDPOINT = 'https://api.oag.com/flight-instances/';
export const OAG_CLAVE_ENTORNO = 'OAG_SUBSCRIPTION_KEY';
type Hora = { local?: string; utc?: string };
type Extremo = { airport?: Codigos; date?: Hora; time?: Hora };
type EstadoOag = {
  state?: string;
  updatedAt?: string;
  diversionAirport?: string;
  irregularOperationType?: string;
  departure?: { actualTime?: { outGate?: Hora } };
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

export async function* paginasOag(
  consulta: ConsultaOag,
  clave: string,
  cursoresPrevios: string[] = [],
  filasPrevias = 0,
  totalEsperado?: number,
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
  let total = filasPrevias;
  for (;;) {
    let pagina: {
      data?: unknown;
      paging?: { next?: string | null; totalCount?: number };
    };
    const respuesta = await descargarPagina(url, clave);
    try {
      pagina = (await respuesta.json()) as typeof pagina;
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new FalloOag('OAG devolvió una página inválida');
      throw new FalloTransitorioOag('No fue posible leer la página de OAG');
    }
    if (
      !Array.isArray(pagina?.data) ||
      pagina.data.length > 1000 ||
      (pagina.paging != null &&
        (typeof pagina.paging !== 'object' || Array.isArray(pagina.paging)))
    )
      throw new FalloOag('OAG devolvió una página inválida');
    total += pagina.data.length;
    const informado = pagina.paging?.totalCount;
    if (informado !== undefined) {
      if (
        !Number.isSafeInteger(informado) ||
        informado < 0 ||
        (totalEsperado !== undefined && informado !== totalEsperado)
      )
        throw new FalloOag('OAG devolvió un total de paginación inválido');
      totalEsperado = informado;
    }
    const siguiente = pagina.paging?.next;
    if (
      totalEsperado !== undefined &&
      (total > totalEsperado || (siguiente == null && total !== totalEsperado))
    )
      throw new FalloOag(
        'La paginación de OAG no coincide con el total informado',
      );
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
    yield { filas: pagina.data as unknown[], cursor, totalEsperado };
    url.searchParams.set('After', cursor);
  }
}

async function descargarPagina(url: URL, clave: string) {
  let respuesta: Response;
  try {
    respuesta = await fetch(url.toString(), {
      headers: { 'Subscription-Key': clave },
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new FalloTransitorioOag('No fue posible obtener la página de OAG');
  }
  if (respuesta.ok) return respuesta;

  const { status } = respuesta;
  const cabecera = respuesta.headers.get('Retry-After')?.trim();
  await respuesta.body?.cancel().catch(() => undefined);
  if (status === 401 || status === 403)
    throw new CredencialOagRechazada(`OAG respondió HTTP ${status}`);
  if (status === 429 || status >= 500) {
    const ahora = Date.now();
    const fecha = !cabecera
      ? NaN
      : /^\d+$/.test(cabecera)
        ? ahora + Number(cabecera) * 1000
        : Date.parse(cabecera);
    throw new FalloTransitorioOag(
      status === 429 ? 'Cuota de OAG agotada' : `OAG respondió HTTP ${status}`,
      Number.isFinite(fecha) ? Math.max(ahora, fecha) : undefined,
    );
  }
  throw new FalloOag(`OAG respondió HTTP ${status}`);
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

function instanteProgramado(
  extremo: Extremo | undefined,
  referencia: keyof Hora,
) {
  const hora = extremo?.time?.[referencia];
  const hhmm =
    typeof hora === 'string' ? hora.replace(/^(\d{2})(\d{2})$/, '$1:$2') : '';
  return instanteUtc(`${extremo?.date?.[referencia]}T${hhmm}`);
}

function iso(instante: number) {
  return Number.isFinite(instante) ? new Date(instante).toISOString() : null;
}

function primerInstante(
  estados: EstadoOag[],
  hora: (estado: EstadoOag) => string | undefined,
) {
  for (const estado of estados) {
    const instante = instanteUtc(hora(estado));
    if (Number.isFinite(instante)) return instante;
  }
  return NaN;
}

function salidaProgramada(vuelo: VueloOag) {
  const utc = instanteProgramado(vuelo.departure, 'utc');
  const local = instanteProgramado(vuelo.departure, 'local');
  const minutos = (local - utc) / 60_000;
  const desfase =
    Number.isInteger(minutos) && Math.abs(minutos) <= 14 * 60 ? minutos : null;
  return {
    utc,
    desfase,
    fecha:
      desfase === null
        ? vuelo.departure?.date?.local
        : new Date(utc + desfase * 60_000).toISOString().slice(0, 10),
  };
}

export function normalizarVueloOag(
  fila: unknown,
  consulta: ConsultaOag,
): OperacionOag | 'fuera-de-poblacion' | null {
  if (!fila || typeof fila !== 'object') return null;
  const vuelo = fila as VueloOag;
  if (vuelo.codeshare?.operatingFlight?.code || vuelo.originalFlight)
    return 'fuera-de-poblacion';
  const campoCodigo = consulta.tipoCodigo === 'IATA' ? 'iata' : 'icao';
  const programacion = salidaProgramada(vuelo);
  const fechaVuelo = programacion.fecha;
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
  const llegadaProgramada = instanteProgramado(vuelo.arrival, 'utc');
  const llegadaReal = primerInstante(
    estados,
    (detalle) => detalle.arrival?.actualTime?.inGate?.utc,
  );
  const horarios: HorariosOperacion = {
    salidaProgramadaUtc: iso(programacion.utc),
    salidaRealUtc: iso(
      primerInstante(
        estados,
        (detalle) => detalle.departure?.actualTime?.outGate?.utc,
      ),
    ),
    llegadaProgramadaUtc: iso(llegadaProgramada),
    llegadaRealUtc: iso(llegadaReal),
    desfaseOrigenMinutos: programacion.desfase,
    evidenciaFecha:
      programacion.desfase === null ? 'fecha-informada' : 'desfase-origen',
  };
  const salida = {
    id: vuelo.scheduleInstanceKey,
    carrier: vuelo.carrier,
    fechaVuelo,
    numeroVuelo,
    revision: estado ? fechaEstado(estado) : 0,
    horarios,
  };
  if (estado?.state === 'Canceled')
    return {
      ...salida,
      estado: 'CANCELLED' as const,
      demoraLlegadaMinutos: null,
    };
  if (diversion && estado?.state === 'InGate')
    return {
      ...salida,
      estado: 'DIVERTED' as const,
      demoraLlegadaMinutos: null,
    };

  if (
    estado?.state === 'InGate' &&
    Number.isFinite(llegadaProgramada) &&
    Number.isFinite(llegadaReal)
  ) {
    // El redondeo hacia arriba conserva el umbral vigente de hasta 15 minutos exactos.
    const demoraLlegadaMinutos = Math.ceil(
      (llegadaReal - llegadaProgramada) / 60_000,
    );
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
