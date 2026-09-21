export const DEFAULT_WORLD_GRAPHICS = Object.freeze({
  antialiasing: true,
  bloom: true,
  lightShafts: true,
  wetFloorReflections: true,
  baseFog: true,
  terminalRain: true,
  huePulses: true,
  arrivalSparks: true,
});
export type WorldGraphics = {
  readonly [K in keyof typeof DEFAULT_WORLD_GRAPHICS]: boolean;
};

/** Browser storage is optional/untrusted; migrate missing flags independently. */
export function loadWorldGraphics(value: unknown): WorldGraphics {
  const stored =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_WORLD_GRAPHICS).map(([key, fallback]) => [
      key,
      typeof stored[key] === "boolean" ? stored[key] : fallback,
    ]),
  ) as WorldGraphics;
}
