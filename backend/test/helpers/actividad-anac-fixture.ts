export const fixture = [
  'Fecha UTC;Hora UTC;Clase de Vuelo (todos los vuelos);Clasificación Vuelo;Tipo de Movimiento;Aeropuerto;Origen / Destino;Aerolinea Nombre;Aeronave;Matrícula;Pasajeros;PAX;Calidad dato',
  '31/07/2026;1:20;Regular;Doméstico;Despegue;AER;CBA;Operador ANAC;B738;LV-AAA;90;90;DEFINITIVO',
  '01/08/2026;0:01;Regular;Doméstico;Despegue;AER;CBA;Operador ANAC;B738;LV-AAA;120;120;PROVISORIO',
  ...Array.from(
    { length: 29 },
    (_, i) =>
      `${String(i + 2).padStart(2, '0')}/08/2026;1:20;Regular;Doméstico;Aterrizaje;CBA;AER;Operador ANAC;B738;LV-AAA;0;0;PROVISORIO`,
  ),
  '31/08/2026;1:20;Regular;Doméstico;Aterrizaje;CBA;AER;Operador ANAC;B738;LV-AAA;120;0;PROVISORIO',
  '01/09/2026;1:20;Regular;Doméstico;Despegue;AER;CBA;Operador ANAC;B738;LV-AAA;90;90;DEFINITIVO',
  '',
].join('\n');
