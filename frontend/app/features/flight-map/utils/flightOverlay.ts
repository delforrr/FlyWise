import { MapboxOverlay } from "@deck.gl/mapbox";
import type { Layer, PickingInfo } from "@deck.gl/core";
import type { FlightRoute } from "~/types/route";
import type { Airport } from "~/types/airport";
import type { useFlightSelection } from "~/features/route-audit/composables/useFlightSelection";
import type { useMapPerformance } from "../composables/useMapPerformance";

type PerformanceProfile = ReturnType<typeof useMapPerformance>;

export function getOverlayRenderProps(profile: PerformanceProfile) {
  return {
    useDevicePixels: profile.dpr.value,
    // Disable automatic GPU picking; touch/click explicitly queries once below.
    _pickable: profile.enableHoverPicking.value,
    pickingRadius: profile.isMobileOrTouch.value ? 12 : 6,
  };
}

export function createFlightOverlay(
  layers: Layer[],
  selection: ReturnType<typeof useFlightSelection>,
  profile: PerformanceProfile,
): MapboxOverlay {
  const overlay = new MapboxOverlay({
    interleaved: false,
    ...getOverlayRenderProps(profile),
    layers,
    getCursor: ({ isHovering }) => (isHovering ? "pointer" : "default"),
    onHover: (info: PickingInfo<Airport | FlightRoute>) => {
      if (!profile.enableHoverPicking.value) return;
      if (info.object) {
        selection.setHoveredEntity({
          type: "originIata" in info.object ? "route" : "airport",
          data: info.object,
          x: Math.round(info.x),
          y: Math.round(info.y),
        });
      } else {
        selection.clearHoveredEntity();
      }
    },
    onClick: (info: PickingInfo<Airport | FlightRoute>) => {
      let object = info.object;
      if (!profile.enableHoverPicking.value) {
        overlay.setProps({ _pickable: true });
        try {
          object = overlay.pickObject({ x: info.x, y: info.y, radius: 12 })?.object;
        } finally {
          overlay.setProps({ _pickable: false });
        }
      }
      if (!object) return;
      if ("originIata" in object) {
        selection.setRoute(object.originIata, object.destinationIata);
      } else if (!selection.selectedOrigin.value) {
        selection.setOrigin(object.iata);
      } else if (selection.selectedOrigin.value === object.iata) {
        selection.setOrigin();
      } else if (!selection.selectedDestination.value) {
        selection.setDestination(object.iata);
      } else {
        selection.setOrigin(object.iata);
      }
    },
  });
  return overlay;
}
