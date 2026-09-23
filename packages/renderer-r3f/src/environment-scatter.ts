export type EnvironmentDetail = {
  readonly x: number;
  readonly z: number;
  readonly scale: number;
  readonly yaw: number;
};
/** Fixed draw/instance budget, deterministic placement, no physics or expanding density. */
export function environmentScatter(
  size: number,
  tileSize: number,
  kind: "grass" | "rocks",
  coverage?: Uint8Array,
): EnvironmentDetail[] {
  const points: EnvironmentDetail[] = [];
  const limit = kind === "grass" ? 24 : 18;
  const extent = Math.min(32, Math.max(0, size / 2 - 2));
  let seed = 71237;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const fract = (value: number) => value - Math.floor(value);
  for (let attempt = 0; attempt < 512 && points.length < limit; attempt++) {
    const x = (random() * 2 - 1) * extent;
    const z = (random() * 2 - 1) * extent;
    if (Math.hypot(x, z) < 3.5) continue;
    if (kind === "grass") {
      // Same plane UV and image orientation as the ground material.
      const u = Math.floor(fract((x + size / 2) / tileSize) * 32);
      const v = Math.min(
        31,
        Math.floor((1 - fract((size / 2 - z) / tileSize)) * 32),
      );
      if (!coverage?.[v * 32 + u]) continue;
    }
    points.push({
      x,
      z,
      scale: 0.65 + random() * 0.7,
      yaw: random() * Math.PI * 2,
    });
  }
  return points;
}
