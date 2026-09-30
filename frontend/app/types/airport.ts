export interface Airport {
  id: string
  iata: string
  icao?: string
  name: string
  city: string
  country: string
  coordinates: [number, number] // [longitude, latitude]
  elevation?: number
  type: 'large_airport' | 'medium_airport' | 'small_airport'
  connectionsCount?: number
}
