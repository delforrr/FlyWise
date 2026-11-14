import { resumirPuntualidad } from './otp.js';

describe('OTP FlyWise v1', () => {
  it('pondera los resultados elegibles y separa la evidencia insuficiente', () => {
    expect(
      resumirPuntualidad([
        { estado: 'ARRIVED', demoraLlegadaMinutos: 15 },
        { estado: 'ARRIVED', demoraLlegadaMinutos: 15 + 1 / 60 },
        { estado: 'ARRIVED', demoraLlegadaMinutos: null },
        { estado: 'DIVERTED', demoraLlegadaMinutos: null },
        { estado: 'CANCELLED', demoraLlegadaMinutos: null },
      ]),
    ).toEqual({
      total: 5,
      elegibles: 3,
      puntuales: 1,
      cancelados: 1,
      desviados: 1,
      sinEvidencia: 1,
      demoraTotal: 31n,
    });
  });
});
