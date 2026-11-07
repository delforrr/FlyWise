export interface Aeropuerto {
  id: string
  iata: string // Etiqueta visible con respaldo en ICAO o nombre.
  codigoIata?: string | null
  icao?: string
  nombre: string
  ciudad: string
  pais: string
  codigoIsoPais?: string | null
  coordenadas: [number, number] // [longitud, latitud]
  elevation?: number
  type?: 'large_airport' | 'medium_airport' | 'small_airport'
  cantidadConexiones?: number
}
