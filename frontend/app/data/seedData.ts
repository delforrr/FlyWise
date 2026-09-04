import type { Airport } from "~/types/airport";
import type { FlightRoute } from "~/types/route";

export const SEED_AIRPORTS: Airport[] = [
  {
    id: "EZE",
    iata: "EZE",
    icao: "SAEZ",
    name: "Ministro Pistarini Int. Airport",
    city: "Buenos Aires",
    country: "Argentina",
    coordinates: [-58.5358, -34.8222], // [Longitud, Latitud]
    type: "large_airport",
    connectionsCount: 38,
  },
  {
    id: "MAD",
    iata: "MAD",
    icao: "LEMD",
    name: "Adolfo Suárez Madrid-Barajas",
    city: "Madrid",
    country: "España",
    coordinates: [-3.5673, 40.4839],
    type: "large_airport",
    connectionsCount: 120,
  },
  // ... JFK, LHR, CDG, MIA, GRU, SCL, BCN, NRT, etc.
];

export const SEED_ROUTES: FlightRoute[] = [
  {
    id: "EZE-MAD",
    originIata: "EZE",
    originName: "Ministro Pistarini Int. Airport",
    originCity: "Buenos Aires",
    originCoordinates: [-58.5358, -34.8222],
    destinationIata: "MAD",
    destinationName: "Adolfo Suárez Madrid-Barajas",
    destinationCity: "Madrid",
    destinationCoordinates: [-3.5673, 40.4839],
    distanceKm: 10080,
    averageOtp15: 91.2, // 🟢 Renderizará arco verde
    primaryAirline: "Iberia",
    airlines: [
      {
        airlineCode: "IB",
        airlineName: "Iberia",
        otp15: 92.5,
        avgDelayMinutes: 8,
        cancellationRate: 0.4,
        sampleFlightsCount: 180,
      },
      {
        airlineCode: "AR",
        airlineName: "Aerolíneas Argentinas",
        otp15: 89.8,
        avgDelayMinutes: 12,
        cancellationRate: 1.1,
        sampleFlightsCount: 150,
      },
    ],
  },
];
