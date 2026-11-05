export interface Aeropuerto {
  id: string
  iata: string
  icao?: string
  nombre: string
  ciudad: string
  pais: string
  coordenadas: [number, number] // [longitud, latitud]
  elevation?: number
  type?: 'large_airport' | 'medium_airport' | 'small_airport'
  cantidadConexiones?: number
}
