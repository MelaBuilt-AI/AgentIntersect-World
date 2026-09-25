import {
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  SpriteNodeMaterial,
} from "three/webgpu";
import { AdditiveBlending, Color, InstancedBufferAttribute } from "three";
import {
  uniform,
  texture,
  uv,
  vec2,
  vec3,
  positionWorld,
  positionLocal,
  output,
  mix,
  sin,
  float,
  smoothstep,
  fract,
  dot,
  instancedBufferAttribute,
  modelViewMatrix,
  cameraProjectionMatrix,
  clamp,
  max,
  vec4,
  floor,
} from "three/tsl";
import {
  codeSky,
  starfield,
  rewriteSurface,
  arrival,
  weatherPosition,
  weatherColor,
  terminalRain,
} from "./world-tsl.js";

// Bind descriptors to live TSL uniforms without R3F copying their value objects.
const rawTexture = (map, coordinates = null) =>
  texture(map, coordinates).setUpdateMatrix(false);
const live = (descriptor, type) =>
  uniform(descriptor.value, type).onRenderUpdate(() => descriptor.value);
export function codeSkyMaterial(map, clock, layer, props) {
  const material = new MeshBasicNodeMaterial(props);
  if (map) {
    // Original-only density: slightly finer than the old 6×3 code sky.
    const coordinates = uv().mul(vec2(8, 4));
    // r186 sample() clones the node and derives updateMatrix from its UV input.
    // Explicit UVs keep the texture repeat from being applied a second time.
    const sample = rawTexture(map, coordinates);
    const art = codeSky(
      sample,
      coordinates,
      live(clock, "float"),
      float(layer),
    );
    material.colorNode = art.rgb;
    material.opacityNode = art.a.mul(props.opacity);
  }
  return material;
}
export function cutoutContactMaterial() {
  const material = new MeshBasicNodeMaterial({
    color: "#000000",
    transparent: true,
    depthWrite: false,
  });
  material.opacityNode = float(1)
    .sub(smoothstep(0, 0.5, uv().sub(0.5).length()))
    .pow(2)
    .mul(0.45);
  return material;
}
export function weatherAtlasMaterial(map, blending, opacity) {
  const material = new MeshBasicNodeMaterial({
    map,
    transparent: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    blending,
  });
  // r186's ordinary-material observer tracks texture version, not UV changes.
  // A live node graph updates atlas uniforms even with camera/object stationary.
  const sample = texture(map);
  material.colorNode = sample.rgb;
  material.opacityNode = sample.a.mul(opacity);
  return material;
}
export function horizonBoltMaterial(map, coordinates, strength) {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    blending: AdditiveBlending,
  });
  // Explicit UVs share the uploaded atlas without touching the upper/local
  // timeline's texture matrix or allocating a texture copy per horizon bolt.
  const sample = rawTexture(
    map,
    uv()
      .mul(live(coordinates.repeat, "vec2"))
      .add(live(coordinates.offset, "vec2")),
  );
  material.colorNode = sample.rgb;
  material.opacityNode = sample.a.mul(live(strength, "float"));
  return material;
}
export function skyFlashMaterial(strength) {
  const material = new MeshBasicNodeMaterial({
    color: "#94bfff",
    transparent: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    blending: AdditiveBlending,
  });
  // Localized cloud glow, not a fullscreen strobe or an attenuated point light
  // that cannot reach the unlit skybox.
  material.opacityNode = float(1)
    .sub(smoothstep(0, 0.5, uv().sub(0.5).length()))
    .pow(2)
    .mul(live(strength, "float"));
  return material;
}
export function scenicSkyMaterial(map, props, feather, density) {
  const material = new MeshBasicNodeMaterial(props);
  if (density)
    material.colorNode = starfield(positionLocal, float(density)).rgb;
  else if (map && feather) {
    const sample = texture(map);
    material.opacityNode = sample.a
      .mul(props.opacity)
      .mul(smoothstep(0, 0.12, uv().y))
      .mul(float(1).sub(smoothstep(0.88, 1, uv().y)));
  }
  return material;
}
export function scenicGroundMaterial(resources, clock) {
  const { ground } = resources.recipe;
  const material = new MeshStandardNodeMaterial({
    color: ground.tint,
    map: resources.textures[ground.asset],
    roughness: ground.roughness,
    metalness: 0,
  });
  const baseUv = uv().mul(resources.textures[ground.asset].repeat);
  let base = rawTexture(resources.textures[ground.asset], baseUv).rgb.mul(
    new Color(ground.tint),
  );
  if (ground.blend) {
    const b = ground.blend;
    const mask = rawTexture(
      resources.textures[b.mask],
      baseUv.mul(ground.tileSize / b.maskSize),
    ).r.mul(b.amount);
    base = mix(
      base,
      rawTexture(
        resources.textures[b.asset],
        baseUv.mul(ground.tileSize / b.tileSize),
      ).rgb.mul(new Color(b.tint)),
      mask,
    );
  }
  const time = live(clock, "float");
  material.colorNode = base.mul(
    sin(baseUv.x.mul(8).add(time.mul(0.22)))
      .mul(sin(baseUv.y.mul(7).sub(time.mul(0.16))))
      .mul(0.015)
      .add(0.985),
  );
  return material;
}
export function detailMaterial(resources, size, side) {
  const { ground } = resources.recipe;
  const p = vec2(
    positionWorld.x.add(size / 2),
    float(size / 2).sub(positionWorld.z),
  );
  const surface = p.add(positionWorld.y.mul(0.6));
  const map = resources.textures[ground.asset];
  let base = rawTexture(map, surface.div(ground.tileSize)).rgb.mul(
    new Color(ground.tint),
  );
  if (ground.blend) {
    const b = ground.blend;
    base = mix(
      base,
      rawTexture(resources.textures[b.asset], surface.div(b.tileSize)).rgb.mul(
        new Color(b.tint),
      ),
      rawTexture(resources.textures[b.mask], p.div(b.maskSize)).r.mul(b.amount),
    );
  }
  const grain = rawTexture(
    map,
    positionWorld.xz.mul(2).add(positionWorld.y.mul(1.7)),
  ).rgb;
  const material = new MeshStandardNodeMaterial({
    roughness: 1,
    metalness: 0,
    side,
  });
  material.colorNode = base.mul(
    dot(grain, vec3(0.2126, 0.7152, 0.0722))
      .mul(0.5)
      .add(0.85),
  );
  return material;
}
export function rewriteMaterial(material, uniforms) {
  const original = material.outputNode;
  material.outputNode = rewriteSurface(
    original ?? output,
    positionWorld,
    uv(),
    rawTexture(uniforms.code.value),
    live(uniforms.time, "float"),
    live(uniforms.strength, "float"),
  );
  if (uniforms.progress) {
    // The avatar's actual streaming-cell reveal, mapped across floor/sky UVs
    // rather than actor height. A finished value clears the final glow band.
    const position = vec3(uv().x.mul(12), uv().y.mul(6), 0);
    const cells = floor(uv().mul(vec2(216, 108)));
    const height = fract(
      sin(dot(cells, vec2(39.346, 11.135))).mul(47453.5453),
    ).mul(6);
    material.outputNode = arrival(
      material.outputNode,
      position,
      live(uniforms.progress, "float"),
      live(uniforms.time, "float"),
      position.y.sub(height),
      float(6),
      rawTexture(uniforms.code.value, uv()),
    );
  }
  material.needsUpdate = true;
  return () => {
    material.outputNode = original;
    material.needsUpdate = true;
  };
}
export function arrivalMaterial(original, uniforms, renderer) {
  // Convert built-in glTF/kit materials through the same registered library used
  // by the renderer. Clone ownership stays with this arrival generation.
  const converted = original.isNodeMaterial
    ? original
    : renderer.library.fromMaterial(original);
  const material = converted.clone();
  material.outputNode = arrival(
    material.outputNode ?? output,
    positionWorld,
    live(uniforms.aiwArrivalProgress, "float"),
    live(uniforms.aiwArrivalTime, "float"),
    live(uniforms.aiwArrivalFloor, "float"),
    live(uniforms.aiwArrivalHeight, "float"),
    rawTexture(uniforms.aiwArrivalRain.value),
  );
  return material;
}
export function weatherMaterial(positions, uniforms) {
  // WebGPU point primitives cannot have programmable size. One instanced quad
  // draw retains the exact seeded particles without a React object per particle.
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const position = instancedBufferAttribute(
    new InstancedBufferAttribute(positions, 3),
  );
  const time = live(uniforms.time, "float"),
    wind = live(uniforms.wind, "float"),
    kind = live(uniforms.kind, "float");
  material.positionNode = weatherPosition(position, time, wind, kind);
  const sizes = [0.32, 0.32, 0.16, 0.22, 0.3, 1.2, 0.24, 0.2, 0.28];
  const height = live(uniforms.viewport, "float");
  const distance = modelViewMatrix
    .mul(vec4(material.positionNode, 1))
    .z.negate();
  const pixels = clamp(
    float(sizes[uniforms.kind.value]).mul(height).div(max(1, distance)),
    1.5,
    uniforms.kind.value < 1.5 ? 36 : 24,
  );
  material.scaleNode = vec2(
    pixels
      .mul(2)
      .mul(max(0.01, distance))
      .div(height.mul(cameraProjectionMatrix.element(1).y)),
  );
  const seed = fract(sin(dot(position.xz, vec2(127.1, 311.7))).mul(43758.5453));
  const color = weatherColor(uv(), kind, time, wind, seed);
  material.colorNode = color.rgb;
  material.opacityNode = color.a;
  return material;
}
export function terminalRainMaterial(uniforms, props) {
  const material = new MeshBasicNodeMaterial(props);
  const n = {};
  for (const key of Object.keys(uniforms))
    n[key] =
      key === "rainMap"
        ? rawTexture(uniforms[key].value)
        : live(uniforms[key], key === "rainColor" ? "color" : "float");
  material.positionNode = vec3(
    positionLocal.x,
    positionLocal.y.mul(n.rainHeight),
    positionLocal.z,
  );
  material.fragmentNode = terminalRain(
    n.rainMap,
    uv(),
    n.rainTime,
    n.rainHeight,
    n.rainReach,
    n.rainSpark,
    n.rainVisible,
    n.rainPulse,
    n.rainStrength,
    n.rainColor,
  );
  return material;
}
