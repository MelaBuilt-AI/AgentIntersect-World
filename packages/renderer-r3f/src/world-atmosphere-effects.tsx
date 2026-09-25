import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { createWorldPipeline, createWetFloor } from "./world-postprocessing.js";

/** One modern render owner for bloom/MSAA, retaining spatial-screen alpha. */
export function WorldBloom({
  bloom: bloomEnabled = true,
  antialiasing = true,
}: {
  readonly bloom?: boolean;
  readonly antialiasing?: boolean;
}) {
  const { gl, scene, camera, size, invalidate } = useThree();
  const resources = useMemo(
    () => createWorldPipeline(gl, scene, camera, bloomEnabled, antialiasing),
    [gl, scene, camera, bloomEnabled, antialiasing],
  );
  useEffect(() => {
    resources.glow?.setResolutionScale(
      Math.min(
        1,
        640 / (Math.max(size.width, size.height) * gl.getPixelRatio()),
      ),
    );
    gl.domElement.dataset.worldBloom = resources.glow ? "on" : "off";
    gl.domElement.dataset.worldAntialiasing = resources.samples ? "on" : "off";
    gl.domElement.dataset.worldAntialiasingSamples = String(resources.samples);
    invalidate();
  }, [resources, gl, size.width, size.height, invalidate]);
  useEffect(
    () => () => {
      resources.dispose();
      gl.domElement.dataset.worldBloom = "off";
      gl.domElement.dataset.worldAntialiasing = "off";
      gl.domElement.dataset.worldAntialiasingSamples = "0";
      invalidate();
    },
    [resources, gl, invalidate],
  );
  useFrame(() => resources.render(), 1);
  return null;
}

/** Actual mirrored scene geometry through the WebGPU reflector node. */
export function WorldWetFloor({ size }: { readonly size: number }) {
  const { gl, size: viewport, invalidate } = useThree();
  const resolution = Math.min(
    512,
    Math.max(
      128,
      Math.round(
        Math.max(viewport.width, viewport.height) * gl.getPixelRatio() * 0.5,
      ),
    ),
  );
  const reflection = useMemo(
    () =>
      createWetFloor(
        size,
        resolution /
          (Math.max(viewport.width, viewport.height) * gl.getPixelRatio()),
      ),
    [size, resolution, viewport.width, viewport.height, gl],
  );
  useEffect(() => {
    gl.domElement.dataset.worldReflections = "on";
    invalidate();
    return () => {
      reflection.dispose();
      gl.domElement.dataset.worldReflections = "off";
      invalidate();
    };
  }, [reflection, gl, invalidate]);
  return <primitive object={reflection.mesh} dispose={null} />;
}
