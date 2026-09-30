import type { Airport } from './airport'
import type { FlightRoute } from './route'

export interface MapViewState {
  longitude: number
  latitude: number
  zoom: number
  pitch: number               // Inclinación 3D (0° a 60°)
  bearing: number             // Rotación de brújula (-180° a 180°)
}

export type MapPickingInfo = {
  type: 'route' | 'airport'
  data: FlightRoute | Airport
  x: number                   // Coordenada X del puntero en píxeles de pantalla
  y: number                   // Coordenada Y del puntero en píxeles de pantalla
} | null