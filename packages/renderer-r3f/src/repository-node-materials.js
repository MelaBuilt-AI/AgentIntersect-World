import {
  InstancedBufferAttribute,
  MeshBasicNodeMaterial,
  SpriteNodeMaterial,
  DepthTexture,
  Texture,
  BackSide,
  DoubleSide,
  AdditiveBlending,
} from "three/webgpu";
import {
  uniform,
  uv,
  float,
  vec2,
  vec3,
  vec4,
  abs,
  max,
  pow,
  smoothstep,
  length,
  fract,
  sin,
  dot,
  instancedBufferAttribute,
  texture,
  screenUV,
  getViewPosition,
  cameraProjectionMatrixInverse,
  cameraWorldMatrix,
  positionWorld,
  modelViewMatrix,
  cameraProjectionMatrix,
  viewportSize,
  clamp,
} from "three/tsl";
import { baseFog } from "./world-tsl.js";

export function shaftMaterial() {
  const p = uv();
  const edge = pow(max(0, float(1).sub(abs(p.x.mul(2).sub(1)))), 3);
  const height = smoothstep(0, 0.12, p.y).mul(
    float(1).sub(smoothstep(0.3, 1, p.y)),
  );
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  material.fragmentNode = vec4(0.1, 0.36, 0.52, edge.mul(height).mul(0.075));
  return material;
}
export function sparkMaterial(points, age) {
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const position = instancedBufferAttribute(
    new InstancedBufferAttribute(points, 3),
  );
  const seed = fract(sin(dot(position, vec3(12.1, 8.3, 4.9))).mul(43758.5));
  const t = max(
    0,
    uniform(age.value)
      .onRenderUpdate(() => age.value)
      .sub(seed.mul(0.45)),
  );
  material.positionNode = vec3(
    position.x.mul(t.mul(0.18).add(1)),
    position.y.add(t.mul(seed.mul(2.5).add(2.2))),
    position.z.mul(t.mul(0.18).add(1)),
  );
  const distance = modelViewMatrix
    .mul(vec4(material.positionNode, 1))
    .z.negate();
  const pixels = clamp(float(65).div(max(1, distance)), 1, 9);
  material.scaleNode = vec2(
    pixels
      .mul(2)
      .mul(max(0.01, distance))
      .div(viewportSize.y.mul(cameraProjectionMatrix.element(1).y)),
  );
  const fade = float(1)
    .sub(smoothstep(1.4, 3.2, t))
    .mul(smoothstep(0, 0.2, t));
  material.colorNode = vec3(0.4, 0.8, 1);
  material.opacityNode = float(1)
    .sub(smoothstep(0, 1, length(uv().sub(0.5)).mul(2)))
    .mul(fade);
  return material;
}
export function fogMaterial(x, z, width, height, clock) {
  const depthTexture = new DepthTexture(1, 1),
    colorTexture = new Texture();
  const depth = texture(depthTexture, screenUV),
    color = texture(colorTexture, screenUV);
  const start = cameraWorldMatrix.mul(
    vec4(getViewPosition(screenUV, float(0), cameraProjectionMatrixInverse), 1),
  ).xyz;
  const surface = cameraWorldMatrix.mul(
    vec4(getViewPosition(screenUV, depth.r, cameraProjectionMatrixInverse), 1),
  ).xyz;
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: BackSide,
  });
  material.fragmentNode = baseFog(
    start,
    positionWorld,
    surface,
    vec3(x, 0, z),
    vec3(width, height, width),
    uniform(clock.value).onRenderUpdate(() => clock.value),
    color.a,
  );
  return {
    material,
    capture(target) {
      depth.value = target.depthTexture;
      color.value = target.texture;
    },
    dispose() {
      material.dispose();
      depthTexture.dispose();
      colorTexture.dispose();
    },
  };
}
