export type HudContainerVariant = "pill" | "box" | "container";

export type HudRounded =
  | "none"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "full";

export type HudOrientation = "horizontal" | "vertical";

export type HudActionType =
  | "zoomIn"
  | "zoomOut"
  | "toggle3D"
  | "fitRoute"
  | "resetNorth";

export interface HudHeaderNav {
  text: string;
  icon: string;
  to?: string;
}
