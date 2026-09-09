import { expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { activityScreenMask } from "../src/world-activity-occlusion.js";
import type { WorldScreenBinding } from "../src/world-screen-types.js";

const camera = new PerspectiveCamera(60, 1, 0.1, 100);
camera.position.set(0, 2.6, 10);
camera.updateMatrixWorld();
const screen = (z: number, yaw = 0): WorldScreenBinding =>
  ({
    id: "workbench",
    spatial: true,
    pose: { x: 0, z, yaw },
    width: 500,
    height: 400,
    viewport: { style: {}, dataset: {}, inert: false },
    cameraElement: { style: {}, dataset: {}, inert: false },
    element: { style: {}, dataset: {}, inert: false },
  }) as WorldScreenBinding;
const mask = (screens: WorldScreenBinding[], agentZ = 0) =>
  activityScreenMask({
    camera,
    screens,
    position: [0, 0, agentZ],
    size: { width: 800, height: 800 },
    box: { x: 300, y: 260, width: 200, height: 140 },
  });
it("cuts out a nearer screen but keeps a cloud ahead of the screen", () => {
  expect(mask([screen(4)])).toContain("polygon");
  expect(mask([screen(4)], 6)).toBe("none");
  expect(mask([screen(-4)])).toBe("none");
});
it("ignores docked and non-overlapping screens", () => {
  expect(mask([{ ...screen(4), spatial: false }])).toBe("none");
  expect(mask([screen(4, Math.PI)])).toContain("polygon");
  expect(mask([screen(4, Math.PI)], 6)).toBe("none");
  expect(mask([{ ...screen(4), pose: { x: 30, z: 4, yaw: 0 } }])).toBe("none");
});
it("unions multiple occluders and projects rotated screens, not bounding boxes", () => {
  const a = screen(4, 0.5);
  const b = screen(5, -0.2);
  const svg = decodeURIComponent(mask([a, b]));
  const polygonCount = (value: string) =>
    (value.match(/<polygon/g) ?? []).length;
  expect(polygonCount(svg)).toBe(
    polygonCount(decodeURIComponent(mask([a]))) +
      polygonCount(decodeURIComponent(mask([b]))),
  );
  expect(svg).toContain('fill="black"');
});
function containsPixel(value: string, x: number, y: number): boolean {
  return [...decodeURIComponent(value).matchAll(/points="([^"]+)"/g)].some(
    ([, points]) => {
      const polygon = points!.split(" ").map((p) => p.split(",").map(Number));
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [ax, ay] = polygon[i]! as [number, number];
        const [bx, by] = polygon[j]! as [number, number];
        if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
          inside = !inside;
      }
      return inside;
    },
  );
}

it.each([0, Math.PI / 3, Math.PI / 2, (2 * Math.PI) / 3, Math.PI])(
  "masks the physical bezel and side thickness at yaw %s",
  (yaw) => {
    const binding = screen(4, yaw);
    const value = activityScreenMask({
      camera,
      screens: [binding],
      position: [0, 2.6, 0],
      size: { width: 800, height: 800 },
      box: { x: 0, y: 0, width: 800, height: 800 },
    });
    // Actual shell: content 3 x 2.4, outer 3.1 x 2.5, depth .14 at z -.075.
    // Sample the visible side and upper/lower bezel, not the content rectangle.
    const samples = [
      [-1.549, 0, -0.075],
      [-0.7, 1.24, -0.075],
      [-0.7, -1.24, -0.075],
    ];
    for (const [x, y, z] of samples) {
      const point = new Vector3(
        x! * Math.cos(yaw) + z! * Math.sin(yaw),
        2.6 + y!,
        4 - x! * Math.sin(yaw) + z! * Math.cos(yaw),
      )
        .applyMatrix4(camera.matrixWorldInverse)
        .applyMatrix4(camera.projectionMatrix);
      expect(
        containsPixel(
          value,
          ((point.x + 1) * 800) / 2,
          ((1 - point.y) * 800) / 2,
        ),
        `shell sample ${x},${y},${z} at yaw ${yaw}`,
      ).toBe(true);
    }
  },
);

it("respects the screen reveal and clips a screen crossing the near plane", () => {
  expect(
    mask([{ ...screen(4), revealStartedAt: performance.now() + 1000 }]),
  ).toBe("none");
  const value = mask([{ ...screen(9, 1.2), width: 1500 }]);
  expect(value).not.toMatch(/NaN|Infinity/);
});
