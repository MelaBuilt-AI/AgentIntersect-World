export type PlacementObstacle = {
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
  readonly halfDepth: number;
};
export type ScreenPlacementScene = {
  readonly floorSize: number;
  readonly obstacles: readonly PlacementObstacle[];
};

/** Nearest free half-unit grid location in the forward viewing area.
 * Search stays local (48 units); crowded rooms refuse instead of overlapping.
 */
export function nearestScreenPlacement(
  view: { x: number; z: number; yaw: number },
  width: number,
  scene: ScreenPlacementScene,
  acceptsPlacement?: (pose: { x: number; z: number; yaw: number }) => boolean,
) {
  const radius = (width * 0.006) / 2 + 0.5;
  const limit = scene.floorSize / 2 - radius;
  const candidates: {
    x: number;
    z: number;
    distance: number;
    forward: number;
  }[] = [];
  const reach = Math.min(48, scene.floorSize);
  for (let dx = -reach; dx <= reach; dx += 0.5) {
    for (let dz = -reach; dz <= reach; dz += 0.5) {
      const distance = dx * dx + dz * dz;
      if (distance < (radius + 1.25) ** 2 || distance > reach ** 2) continue;
      const x = view.x + dx,
        z = view.z + dz;
      if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
      const forward = dx * Math.sin(view.yaw) - dz * Math.cos(view.yaw);
      // A nearby rear placement can face the avatar but expose its back to the
      // third-person camera. Keep new panels in the forward 120-degree sector.
      if (forward < Math.sqrt(distance) * 0.5) continue;
      candidates.push({
        x,
        z,
        distance,
        forward,
      });
    }
  }
  candidates.sort(
    (a, b) =>
      a.distance - b.distance ||
      b.forward - a.forward ||
      a.x - b.x ||
      a.z - b.z,
  );
  const point = candidates.find(
    ({ x, z }) =>
      scene.obstacles.every((obstacle) => {
        const dx = Math.max(0, Math.abs(x - obstacle.x) - obstacle.halfWidth);
        const dz = Math.max(0, Math.abs(z - obstacle.z) - obstacle.halfDepth);
        return dx * dx + dz * dz > radius * radius;
      }) &&
      (acceptsPlacement?.({ x, z, yaw: Math.atan2(view.x - x, view.z - z) }) ??
        true),
  );
  return point
    ? {
        x: point.x,
        z: point.z,
        yaw: Math.atan2(view.x - point.x, view.z - point.z),
      }
    : null;
}
