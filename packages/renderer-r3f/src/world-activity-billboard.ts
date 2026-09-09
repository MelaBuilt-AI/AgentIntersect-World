import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { activityScreenMask } from "./world-activity-occlusion.js";
import type { WorldScreenBinding } from "./world-screen-types.js";
const EMPTY_SCREENS: readonly WorldScreenBinding[] = [];
import type { WorldRoomActivity } from "./world-room-canvas.js";

/** DOM lettering stays sharp even when World renders at constrained GPU DPR. */
export function useActivityBillboard({
  activity,
  descriptor,
  position,
  screens = EMPTY_SCREENS,
}: {
  readonly screens?: readonly WorldScreenBinding[] | undefined;
  readonly activity: WorldRoomActivity;
  readonly descriptor: {
    readonly anchor: readonly [number, number, number];
    readonly visualLabel: string;
    readonly visible: boolean;
    readonly animated: boolean;
  };
  readonly position: readonly [number, number, number];
}): void {
  const { gl, invalidate } = useThree();
  const { element, heading, text } = useMemo(() => {
    const element = document.createElement("div");
    const cloud = document.createElement("div");
    const bezel = document.createElement("div");
    const rain = document.createElement("div");
    const face = document.createElement("div");
    const content = document.createElement("div");
    const heading = document.createElement("div");
    const text = document.createElement("div");
    element.className = "world-activity-bubble";
    cloud.className = "world-activity-cloud";
    bezel.className = "world-activity-cloud__bezel";
    rain.className = "world-activity-cloud__rain";
    face.className = "world-activity-cloud__face";
    content.className = "world-activity-cloud__content";
    heading.className = "world-activity-cloud__heading";
    text.className = "world-activity-cloud__text";
    bezel.append(rain);
    content.append(heading, text);
    cloud.append(bezel, face, content);
    element.append(cloud);
    return { element, heading, text };
  }, []);
  const point = useMemo(() => new Vector3(), []);
  const bounds = useMemo(() => ({ width: 200, height: 104, viewport: 0 }), []);
  useEffect(() => {
    element.setAttribute("aria-hidden", "true");
    Object.assign(element.style, {
      position: "absolute",
      left: "0",
      top: "0",
      zIndex: "3",
      pointerEvents: "none",
      visibility: "hidden",
    });
    // Content determines size. Cache resize notifications, never force layout
    // or enqueue React state in the render loop.
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      bounds.width = entry.contentRect.width;
      bounds.height = entry.contentRect.height;
      invalidate();
    });
    gl.domElement.parentElement?.append(element);
    observer.observe(element);
    return () => {
      observer.disconnect();
      element.remove();
    };
  }, [bounds, element, gl, invalidate]);
  useEffect(() => {
    heading.textContent = `${activity.icon || "○"} ${descriptor.visualLabel}`;
    text.textContent = activity.progressText || activity.detail;
    element.dataset.state = activity.state;
    element.dataset.animated = String(descriptor.animated);
    invalidate();
  }, [
    activity,
    descriptor.visualLabel,
    descriptor.animated,
    element,
    heading,
    text,
    invalidate,
  ]);
  useFrame(({ camera, size }) => {
    point
      .set(position[0], descriptor.anchor[1], position[2])
      .applyMatrix4(camera.matrixWorldInverse)
      .applyMatrix4(camera.projectionMatrix);
    const visible =
      descriptor.visible &&
      point.z > -1 &&
      point.z < 1 &&
      Math.abs(point.x) < 1.1 &&
      Math.abs(point.y) < 1.4;
    element.style.visibility = visible ? "visible" : "hidden";
    element.dataset.visible = String(visible);
    if (!visible) return;
    if (bounds.viewport !== size.width) {
      bounds.viewport = size.width;
      element.style.maxWidth = `${Math.min(260, size.width - 24)}px`;
    }
    const x = Math.max(
      12,
      Math.min(
        size.width - bounds.width - 12,
        ((point.x + 1) * size.width) / 2 - bounds.width / 2,
      ),
    );
    const y = Math.max(
      12,
      Math.min(
        size.height - bounds.height - 12,
        ((1 - point.y) * size.height) / 2 - bounds.height,
      ),
    );
    element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    const mask = activityScreenMask({
      camera,
      screens,
      position,
      size,
      box: { x, y, width: bounds.width, height: bounds.height },
    });
    if (element.style.maskImage !== mask) element.style.maskImage = mask;
  });
}
