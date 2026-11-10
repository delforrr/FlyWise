export interface RouteAirlinePerformance {
  codigoAerolinea: string
  nombreAerolinea: string
  otp15: number | null // Porcentaje (0 - 100)
  avgDelayMinutes: number | null
  cancellationRate: number | null
  sampleFlightsCount: number
}

export interface RouteMetric {
  origenId: string
  destinoId: string
  periodo: string
  aerolineaId: string | null
  otp15: number | null
  vuelosTotales: number
  vuelosOperados: number
  fuentes: string[]
  actualizadoEn: string | null
  pendiente: boolean
  errorActualizacion: string | null
}

export interface FlightRoute {
  id: string // "EZE-MAD"
  origenId: string
  originIata: string
  originName: string
  originCity: string
  originCoordinates: [number, number]
  
  destinoId: string
  destinationIata: string
  destinationName: string
  destinationCity: string
  destinationCoordinates: [number, number]
  
  distanciaKm: number
  averageOtp15: number | null
  metricas?: RouteMetric
  aerolineas: RouteAirlinePerformance[]
  primaryAirline: string
  flightType?: "direct" | "connecting"
  viaStopover?: string
}
