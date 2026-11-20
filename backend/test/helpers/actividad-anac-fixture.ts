export const fixture = [
  'Fecha UTC;Hora UTC;Clase de Vuelo (todos los vuelos);Clasificación Vuelo;Tipo de Movimiento;Aeropuerto;Origen / Destino;Aerolinea Nombre;Calidad dato',
  '31/07/2026;1:20;Regular;Doméstico;Despegue;AER;CBA;Operador ANAC;DEFINITIVO',
  '01/08/2026;0:01;Regular;Doméstico;Despegue;AER;CBA;Operador ANAC;PROVISORIO',
  ...Array.from(
    { length: 29 },
    (_, i) =>
      `${String(i + 2).padStart(2, '0')}/08/2026;1:20;Regular;Doméstico;Aterrizaje;CBA;AER;Operador ANAC;PROVISORIO`,
  ),
  '31/08/2026;1:20;Regular;Doméstico;Aterrizaje;CBA;AER;Operador ANAC;PROVISORIO',
  '01/09/2026;1:20;Regular;Doméstico;Despegue;AER;CBA;Operador ANAC;DEFINITIVO',
  '',
].join('\n');
