export interface RouteAirlinePerformance {
  airlineCode: string
  airlineName: string
  otp15: number // Porcentaje (0 - 100)
  avgDelayMinutes: number
  cancellationRate: number
  sampleFlightsCount: number
}

export interface FlightRoute {
  id: string // "EZE-MAD"
  originIata: string
  originName: string
  originCity: string
  originCoordinates: [number, number]
  
  destinationIata: string
  destinationName: string
  destinationCity: string
  destinationCoordinates: [number, number]
  
  distanceKm: number
  averageOtp15: number
  airlines: RouteAirlinePerformance[]
  primaryAirline: string
  flightType?: "direct" | "connecting"
  viaStopover?: string
}
