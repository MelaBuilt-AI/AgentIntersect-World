import { Vector3, type Matrix4 } from "three";
import {
  WORLD_SCREEN_CENTER_Y,
  WORLD_SCREEN_SCALE,
  WORLD_SCREEN_SHELL_PADDING,
  WORLD_SCREEN_SHELL_DEPTH,
  WORLD_SCREEN_SHELL_Z,
  type WorldScreenBinding,
} from "./world-screen-types.js";

// Clip in camera space before perspective division (also handles edge-on
// screens crossing the camera near plane without inverted/huge polygons).
function clipDepth(
  points: Vector3[],
  depth: number,
  nearer: boolean,
): Vector3[] {
  const result: Vector3[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const insideA = nearer ? a.z >= depth : a.z <= depth;
    const insideB = nearer ? b.z >= depth : b.z <= depth;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      result.push(a.clone().lerp(b, (depth - a.z) / (b.z - a.z)));
    }
  }
  return result;
}

/** Cut only nearer spatial-screen pixels out of the crisp DOM overlay.
 * One small luminance mask unions every screen; overlapping holes never XOR.
 * Uses existing poses/camera, no raycasts, DOM layout reads or React updates.
 */
export function activityScreenMask({
  camera,
  screens,
  position,
  size,
  box,
}: {
  readonly camera: {
    position: Vector3;
    matrixWorldInverse: Matrix4;
    projectionMatrix: Matrix4;
  };
  readonly screens: readonly WorldScreenBinding[];
  readonly position: readonly [number, number, number];
  readonly size: { width: number; height: number };
  readonly box: { x: number; y: number; width: number; height: number };
}): string {
  const agentDepth = new Vector3(...position).applyMatrix4(
    camera.matrixWorldInverse,
  ).z;
  const polygons: string[] = [];
  for (const screen of screens) {
    if (!screen.spatial) continue;
    const { x, z, yaw } = screen.pose;
    const sin = Math.sin(yaw),
      cos = Math.cos(yaw);
    // Both the DOM front and the opaque scene-rendered back occlude clouds.
    const reveal =
      screen.revealProgress ?? (screen.revealStartedAt === undefined ? 1 : 0);
    if (!reveal) continue;
    const w = (screen.width * WORLD_SCREEN_SCALE) / 2;
    const h = (screen.height * WORLD_SCREEN_SCALE) / 2;
    const y = screen.pose.y ?? WORLD_SCREEN_CENTER_Y;
    const toCamera = (horizontal: number, vertical: number, depth: number) =>
      new Vector3(
        x + horizontal * cos + depth * sin,
        y - h + (vertical + h) * reveal,
        z - horizontal * sin + depth * cos,
      ).applyMatrix4(camera.matrixWorldInverse);
    const content = [
      toCamera(-w, -h, 0),
      toCamera(w, -h, 0),
      toCamera(w, h, 0),
      toCamera(-w, h, 0),
    ];
    // The opaque shell extends beyond the content and behind its plane.
    // Project its actual six faces so the side still occludes edge-on.
    const shellW = w + WORLD_SCREEN_SHELL_PADDING;
    const shellH = h + WORLD_SCREEN_SHELL_PADDING;
    const corners = [-1, 1].flatMap((side) => {
      const depth =
        WORLD_SCREEN_SHELL_Z + (side * WORLD_SCREEN_SHELL_DEPTH) / 2;
      return [
        toCamera(-shellW, -shellH, depth),
        toCamera(shellW, -shellH, depth),
        toCamera(shellW, shellH, depth),
        toCamera(-shellW, shellH, depth),
      ];
    });
    const faces = [
      content,
      ...[
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
      ].map((face) => face.map((index) => corners[index]!)),
    ];
    for (const face of faces) {
      const points = clipDepth(clipDepth(face, agentDepth, true), -0.1, false);
      if (points.length < 3) continue;
      const projected = points.map((point) => {
        const p = point.clone().applyMatrix4(camera.projectionMatrix);
        return {
          x: ((p.x + 1) * size.width) / 2 - box.x,
          y: ((1 - p.y) * size.height) / 2 - box.y,
        };
      });
      // Eight pixels preserve the existing cloud float/shadow outside its box.
      if (
        projected.every((p) => p.x < -8) ||
        projected.every((p) => p.x > box.width + 8) ||
        projected.every((p) => p.y < -8) ||
        projected.every((p) => p.y > box.height + 8)
      )
        continue;
      polygons.push(
        `<polygon fill="black" points="${projected.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")}"/>`,
      );
    }
  }
  if (!polygons.length) return "none";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 ${box.width + 16} ${box.height + 16}"><rect x="-8" y="-8" width="100%" height="100%" fill="white"/>${polygons.join("")}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
