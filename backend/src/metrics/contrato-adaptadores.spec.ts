import { normalizarBts } from '../adapters/bts/operacion-bts.js';
import { normalizarVueloOag } from '../adapters/oag/flight-info.js';
import { porcentajeOtp, resumirPuntualidad } from './domain/otp.js';

const casos = [
  { estado: 'InGate', utc: '2026-10-01T12:15:00Z', demora: '15' },
  { estado: 'InGate', utc: '2026-10-01T12:15:01Z', demora: '16' },
  { estado: 'InGate', demora: '' },
  { estado: 'Canceled', demora: '' },
  { estado: 'Diverted', demora: '' },
];

describe('Contrato OTP de OAG y BTS', () => {
  it.each(['OAG', 'BTS'])('%s produce los mismos conteos y OTP', (fuente) => {
    const operaciones = casos.map(({ estado, utc, demora }, i) => {
      if (fuente === 'BTS') {
        const fila = normalizarBts(
          {
            FlightDate: '2026-10-01',
            DOT_ID_Reporting_Airline: '1',
            Flight_Number_Reporting_Airline: String(i + 1),
            OriginAirportID: '2',
            DestAirportID: '3',
            CRSDepTime: '1000',
            Cancelled: estado === 'Canceled' ? '1' : '0',
            Diverted: estado === 'Diverted' ? '1' : '0',
            ArrDelay: demora,
          },
          '2026-10',
          i + 1,
        );
        if ('causa' in fila) throw new Error(fila.motivo);
        return fila;
      }
      const fila = normalizarVueloOag(
        {
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
        },
        {
          periodo: '2026-10',
          origenCodigo: 'AEP',
          destinoCodigo: 'COR',
          tipoCodigo: 'IATA',
        },
      );
      if (!fila || typeof fila === 'string' || !fila.estado)
        throw new Error('Operación OAG descartada');
      return {
        estado: fila.estado,
        demoraLlegadaMinutos: fila.demoraLlegadaMinutos,
      };
    });
    expect(resumirPuntualidad(operaciones)).toEqual({
      total: 5,
      elegibles: 3,
      puntuales: 1,
      cancelados: 1,
      desviados: 1,
      sinEvidencia: 1,
      demoraTotal: 31n,
    });
    const resumen = resumirPuntualidad(operaciones.slice(2, 4));
    expect(porcentajeOtp(resumen.puntuales, resumen.elegibles)).toBeNull();
  });
});
