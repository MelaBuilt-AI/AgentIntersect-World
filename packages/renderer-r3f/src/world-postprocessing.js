import {
  RenderPipeline,
  MeshBasicNodeMaterial,
  Mesh,
  PlaneGeometry,
} from "three/webgpu";
import { pass, vec2, vec4, reflector, viewportSize } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { createWorldPreparation } from "./world-preparation.js";

export function createWorldPipeline(
  renderer,
  scene,
  camera,
  bloomEnabled,
  antialiasing,
) {
  const scenePass = pass(scene, camera, { samples: antialiasing ? 4 : 0 });
  const color = scenePass.getTextureNode("output");

  const glow = bloomEnabled ? bloom(color, 0.18, 0.35, 0.85) : null;
  // Preserve transparent-black CSS3D apertures; bloom must never fill their alpha.
  const pipeline = new RenderPipeline(
    renderer,
    glow ? vec4(color.rgb.add(glow.rgb), color.a) : color,
  );
  const preparation = createWorldPreparation(
    renderer,
    () => pipeline.render(),
    scenePass.renderTarget,
  );
  return {
    render: preparation.render,
    pipeline,
    glow,
    scenePass,
    samples: antialiasing ? 4 : 0,
    dispose() {
      glow?.dispose();
      preparation.dispose();
      scenePass.dispose();
      pipeline.dispose();
    },
  };
}
export function createWetFloor(size, resolutionScale) {
  const reflection = reflector({
    resolutionScale,
    samples: 0,
    generateMipmaps: true,
    bounces: false,
  });
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
  });

  const offset = vec2(1.5).div(viewportSize.mul(resolutionScale));
  const reflected = reflection
    .mul(0.4)
    .add(reflection.sample(reflection.uvNode.add(vec2(offset.x, 0))).mul(0.15))
    .add(reflection.sample(reflection.uvNode.sub(vec2(offset.x, 0))).mul(0.15))
    .add(reflection.sample(reflection.uvNode.add(vec2(0, offset.y))).mul(0.15))
    .add(reflection.sample(reflection.uvNode.sub(vec2(0, offset.y))).mul(0.15));
  material.colorNode = reflected.rgb;
  material.opacityNode = reflected.a.mul(0.28);
  const mesh = new Mesh(new PlaneGeometry(size, size), material);
  mesh.name = "world-wet-floor-reflection";
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  mesh.raycast = () => {};
  mesh.add(reflection.target);
  const update = reflection.reflector.updateBefore;
  const reflectedSuns = new Map();
  reflection.reflector.updateBefore = function (frame) {
    const hidden = [];
    const activeSuns = [];
    frame.scene.traverseVisible((object) => {
      if (object.isSunLight && !object.userData.reflectionSun)
        activeSuns.push(object);
    });
    // A SunLight owns one cascade atlas. The mirror camera must not overwrite
    // the main view's atlas/matrices while that view is still being rendered.
    for (const sun of activeSuns) {
      let reflected = reflectedSuns.get(sun);
      if (!reflected) {
        reflected = sun.clone(false);
        reflected.userData.reflectionSun = true;
        reflected.name = "world-reflection-sunlight";
        reflectedSuns.set(sun, reflected);
        frame.scene.add(reflected);
      }
      reflected.color.copy(sun.color);
      reflected.intensity = sun.intensity;
      sun.getWorldPosition(reflected.position);
      reflected.visible = true;
      sun.visible = false;
      hidden.push(sun);
    }
    frame.scene.traverse((object) => {
      if (
        object.visible &&
        (object.name === "world-code-sky" ||
          object.name === "world-spatial-screens" ||
          object.name === "repository-local-atmosphere" ||
          object.name.startsWith("repository-terminal-rain:"))
      ) {
        hidden.push(object);
        object.visible = false;
      }
    });
    try {
      return update.call(this, frame);
    } finally {
      for (const sun of activeSuns) reflectedSuns.get(sun).visible = false;
      for (const object of hidden) object.visible = true;
    }
  };
  return {
    mesh,
    dispose() {
      for (const sun of reflectedSuns.values()) {
        sun.removeFromParent();
        sun.dispose();
      }
      reflectedSuns.clear();
      reflection.dispose();
      material.dispose();
      mesh.geometry.dispose();
    },
  };
}
