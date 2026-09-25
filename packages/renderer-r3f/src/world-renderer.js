import {
  WebGPURenderer,
  PCFShadowMap,
  Group,
  AmbientLight,
  HemisphereLight,
  DirectionalLight,
  Fog,
} from "three/webgpu";
import { SunLight } from "three/addons/lights/SunLight.js";
import { SunLightNode } from "three/addons/lights/SunLightNode.js";

/** R3F awaits this factory before mounting any scene or starting its frame loop. */
export async function createWorldRenderer({ canvas }, antialias = false) {
  const renderer = new WebGPURenderer({ canvas, alpha: true, antialias });
  renderer.library.addLight(SunLightNode, SunLight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const deviceLost = renderer.onDeviceLost.bind(renderer);
  renderer.onDeviceLost = (info) => {
    deviceLost(info);
    if (info.reason !== "destroyed")
      canvas.dispatchEvent(
        new canvas.ownerDocument.defaultView.Event("webglcontextlost", {
          cancelable: true,
        }),
      );
  };
  await renderer.init();
  canvas.dataset.rendererBackend = renderer.backend.isWebGPUBackend
    ? "webgpu"
    : "webgl2";
  canvas.dataset.rendererRevision = "186";
  return renderer;
}

/** Keep light/fog shader bindings stable while only their values change. */
export function createWorldLighting() {
  const group = new Group();
  group.name = "world-environment-lighting";
  const ambient = new AmbientLight("#bbd3eb", 1.8);
  const hemisphere = new HemisphereLight("#ffffff", "#ffffff", 0);
  const sun = createWorldSun("#e2f5ff", 2.1, [12, 18, 8]);
  const fill = new DirectionalLight("#43bfff", 0.8);
  fill.position.set(-12, 8, -14);
  group.add(ambient, hemisphere, sun, fill);
  const fog = new Fog("#061321", 24, 130);
  return {
    group,
    fog,
    update(recipe, floor) {
      const lighting = recipe?.lighting;
      ambient.intensity = lighting ? 0 : 1.8;
      hemisphere.intensity = lighting ? lighting.ambient * 1.5 : 0;
      hemisphere.color.set(lighting?.sky ?? "#ffffff");
      hemisphere.groundColor.set(lighting?.ground ?? "#ffffff");
      sun.color.set(lighting?.sun ?? "#e2f5ff");
      sun.intensity = lighting?.intensity ?? 2.1;
      sun.position.set(...(lighting ? [24, 32, -30] : [12, 18, 8]));
      fill.color.set(floor === "repository" ? "#43bfff" : "#9284e8");
      fill.intensity = lighting ? 0 : floor === "repository" ? 0.8 : 0.55;
      fog.color.set(lighting?.fog ?? "#061321");
      fog.near = lighting ? 35 : floor === "repository" ? 24 : 1e6;
      fog.far = lighting?.fogFar ?? (floor === "repository" ? 130 : 2e6);
    },
    dispose() {
      sun.dispose();
    },
  };
}

export const createPreviewRenderer = (defaults) =>
  createWorldRenderer(defaults, true);

export function createWorldSun(color, intensity, direction) {
  const sun = new SunLight(color, intensity);
  sun.name = "world-sunlight";
  sun.position.set(...direction);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.far = 100;
  sun.shadow.normalBias = 0.015;
  sun.shadow.bias = 0;
  return sun;
}
