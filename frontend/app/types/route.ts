export interface RouteAirlinePerformance {
  airlineCode: string
  airlineName: string
  otp15: number | null // Porcentaje (0 - 100)
  avgDelayMinutes: number | null
  cancellationRate: number | null
  sampleFlightsCount: number
}

export interface FlightRoute {
  id: string // "EZE-MAD"
  originId: string
  originIata: string
  originName: string
  originCity: string
  originCoordinates: [number, number]
  
  destinationId: string
  destinationIata: string
  destinationName: string
  destinationCity: string
  destinationCoordinates: [number, number]
  
  distanceKm: number
  averageOtp15: number | null
  airlines: RouteAirlinePerformance[]
  primaryAirline: string
  flightType?: "direct" | "connecting"
  viaStopover?: string
}
