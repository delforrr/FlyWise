import { type FlightRoute } from "./route"
import { type Airport } from "./airport"

export interface MapViewState {
  longitude: number
  latitude: number
  zoom: number
  pitch: number
  bearing: number
}

export type MapPickingInfo = {
  type: 'route' | 'airport'
  data: FlightRoute | Airport
  x: number
  y: number
} | null
