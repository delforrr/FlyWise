import { Readable } from 'node:stream';
import { AdaptadorBts } from '../adapters/bts/adaptador-bts.js';
import { AdaptadorOag } from '../adapters/oag/adaptador-oag.js';
import type { EvidenciaOperacion } from '../ingestion/application/adaptador-operaciones.js';
import { ingerirOperaciones } from '../ingestion/application/ingesta-operaciones.js';
import { porcentajeOtp, resumirPuntualidad } from './domain/otp.js';

const casos = [
  { estado: 'InGate', utc: '2026-10-01T12:15:00Z', demora: '15' },
  { estado: 'InGate', utc: '2026-10-01T12:15:01Z', demora: '16' },
  { estado: 'InGate', demora: '' },
  { estado: 'Canceled', demora: '' },
  { estado: 'Diverted', demora: '' },
];

describe('Contrato OTP de OAG y BTS', () => {
  it.each(['OAG', 'BTS'])(
    '%s entrega los mismos conteos y OTP por el puerto de ingesta',
    async (fuente) => {
      const operaciones: EvidenciaOperacion[] = [];
      const consumidor = {
        procesarFila(fila: { tipo: string; operacion?: EvidenciaOperacion }) {
          if (fila.tipo !== 'operacion' || !fila.operacion?.estado)
            throw new Error('Se esperaba una operación final');
          operaciones.push(fila.operacion);
        },
        terminarLote() {},
      };
      if (fuente === 'BTS') {
        const cabecera =
          'FlightDate,DOT_ID_Reporting_Airline,Flight_Number_Reporting_Airline,OriginAirportID,DestAirportID,CRSDepTime,Cancelled,Diverted,ArrDelay';
        const filas = casos.map(
          ({ estado, demora }, i) =>
            `2026-10-01,1,${i + 1},2,3,1000,${Number(estado === 'Canceled')},${Number(estado === 'Diverted')},${demora}`,
        );
        await ingerirOperaciones(
          new AdaptadorBts(),
          {
            periodo: '2026-10',
            source: Readable.from([[cabecera, ...filas].join('\n')]),
            registrarBytes() {},
          },
          consumidor,
        );
      } else {
        const { jest } = await import('@jest/globals');
        const fetchOag = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
          Response.json({
            data: casos.map(({ estado, utc }, i) => ({
              scheduleInstanceKey: String(i + 1),
              flightNumber: i + 1,
              carrier: { iata: 'AR' },
              departure: {
                airport: { iata: 'AEP' },
                date: { local: '2026-10-01' },
              },
              arrival: {
                airport: { iata: 'COR' },
                date: { utc: '2026-10-01' },
                time: { utc: '1200' },
              },
              statusDetails: [
                { state: estado, arrival: { actualTime: { inGate: { utc } } } },
              ],
            })),
          }),
        );
        try {
          await ingerirOperaciones(
            new AdaptadorOag(),
            {
              consulta: {
                periodo: '2026-10',
                origenCodigo: 'AEP',
                destinoCodigo: 'COR',
                tipoCodigo: 'IATA',
              },
              clave: 'sintetica',
              cursores: [],
            },
            consumidor,
          );
        } finally {
          fetchOag.mockRestore();
        }
      }
      expect(
        resumirPuntualidad(
          operaciones.map(({ estado, demoraLlegadaMinutos }) => {
            if (!estado) throw new Error('Se esperaba una operación final');
            return { estado, demoraLlegadaMinutos };
          }),
        ),
      ).toMatchObject({
        total: 5,
        elegibles: 3,
        puntuales: 1,
        cancelados: 1,
        desviados: 1,
        sinEvidencia: 1,
        demoraTotal: 31n,
      });
      expect(porcentajeOtp(0, 0)).toBeNull();
    },
  );
});

it('propaga un fallo del CSV BTS después de entregar un lote completo', async () => {
  const error = new Error('Descarga interrumpida');
  async function* csvConFallo() {
    yield 'FlightDate,DOT_ID_Reporting_Airline,Flight_Number_Reporting_Airline,OriginAirportID,DestAirportID,CRSDepTime,Cancelled,Diverted,ArrDelay\n';
    for (let i = 0; i < 1000; i++) yield `2026-10-01,1,${i},2,3,1000,0,0,15\n`;
    await loteEntregado;
    throw error;
  }
  let terminarLote!: () => void;
  const loteEntregado = new Promise<void>((resolve) => {
    terminarLote = resolve;
  });
  const lectura = new AdaptadorBts().leerLotes({
    periodo: '2026-10',
    source: Readable.from(csvConFallo()),
    registrarBytes() {},
  });
  try {
    expect((await lectura.next()).value?.filas).toHaveLength(1000);
    terminarLote();
    await expect(lectura.next()).rejects.toThrow(error);
  } finally {
    await lectura.return(undefined);
  }
});
