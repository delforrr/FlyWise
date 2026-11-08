import { Map, setWorkerUrl, type MapOptions } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { DEFAULT_MAP_CAMERA, getBaseMapStyle } from "./mapUtils";

export interface MapRenderProfile {
  allow3D: boolean;
  dpr: number;
}

export function createBaseMap(
  container: HTMLElement | string,
  colorMode: string,
  profile: MapRenderProfile,
  camera: Partial<Pick<MapOptions, "center" | "zoom" | "pitch" | "bearing">> = {},
): Map {
  setWorkerUrl(workerUrl);
  const map = new Map({
    container,
    style: getBaseMapStyle(colorMode),
    ...DEFAULT_MAP_CAMERA,
    ...camera,
    pitch: profile.allow3D ? (camera.pitch ?? DEFAULT_MAP_CAMERA.pitch) : 0,
    maxPitch: profile.allow3D ? 60 : 0,
    dragRotate: profile.allow3D,
    touchPitch: profile.allow3D,
    pixelRatio: profile.dpr,
    attributionControl: { compact: true },
    renderWorldCopies: false,
  });
  if (!profile.allow3D) {
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
  }
  return map;
}

export function applyMapRenderProfile(map: Map, profile: MapRenderProfile): void {
  map.setPixelRatio(profile.dpr);
  map.setMaxPitch(profile.allow3D ? 60 : 0);
  if (profile.allow3D) {
    map.dragRotate.enable();
    map.touchPitch.enable();
    map.touchZoomRotate.enableRotation();
    map.keyboard.enableRotation();
  } else {
    map.setPitch(0);
    map.dragRotate.disable();
    map.touchPitch.disable();
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
  }
}
