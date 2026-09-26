import {
  skyFlashMaterial,
  weatherAtlasMaterial,
  weatherMaterial,
} from "./world-node-materials.js";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  NormalBlending,
  PlaneGeometry,
  Group,
  Mesh,
} from "three";
import {
  ENVIRONMENT_FX,
  type EnvironmentWeather,
} from "@agentintersect-world/world-schema/environment";
import type { EnvironmentResources } from "./environment-resources.js";
import { HorizonLightning } from "./horizon-lightning.js";
import {
  atlasFrame,
  lightningStrike,
  skyLightningLayout,
  weatherPositions,
  type WeatherStrike,
  type WeatherStrikeHandler,
} from "./environment-weather-model.js";

const kinds = {
  none: 0,
  "light-rain": 0,
  "heavy-rain": 1,
  snow: 2,
  ash: 3,
  sparkles: 4,
  wind: 5,
  leaves: 6,
  sand: 7,
  embers: 8,
};
const ids = Object.keys(ENVIRONMENT_FX) as (keyof typeof ENVIRONMENT_FX)[];

/** This layer has no raycasts, actor transforms, collision or repository authority. */
export function EnvironmentWeatherEffects({
  resources,
  size,
  userPosition,
  reducedMotion,
  onStrike,
}: {
  readonly resources: EnvironmentResources;
  readonly size: number;
  readonly userPosition: { x: number; z: number };
  readonly reducedMotion: boolean;
  readonly onStrike?: WeatherStrikeHandler | undefined;
}) {
  // No hidden animated shader or thunder schedule in Reduced Motion / clear weather.
  const weather = resources.recipe.weather;
  if (!weather || reducedMotion) return null;
  return (
    <Weather
      resources={resources}
      weather={weather}
      size={size}
      userPosition={userPosition}
      onStrike={onStrike}
    />
  );
}
function Weather({
  resources,
  weather,
  size,
  userPosition,
  onStrike,
}: {
  resources: EnvironmentResources;
  weather: EnvironmentWeather;
  size: number;
  userPosition: { x: number; z: number };
  onStrike?: WeatherStrikeHandler | undefined;
}) {
  const particles = useRef<Group>(null);

  const bolts = useRef<Group>(null);
  const sky = useRef<Group>(null);
  const meshes = useRef(new Map<string, Mesh>());
  const light = useRef<{ intensity: number; position: Group["position"] }>(
    null,
  );
  const runtime = useRef({
    time: 0,
    next: 3,
    began: -100,
    sequence: 0,
    strike: null as WeatherStrike | null,
    sky: [] as ReturnType<typeof skyLightningLayout>,
  });
  const flash = useMemo(() => ({ value: 0 }), []);
  const flashMaterial = useMemo(() => skyFlashMaterial(flash), [flash]);
  useEffect(() => () => flashMaterial.dispose(), [flashMaterial]);
  const atlasMaterials = useMemo(
    () =>
      new Map(
        ids.flatMap((id) => {
          const map = resources.textures[id];
          return map
            ? [
                [
                  id,
                  weatherAtlasMaterial(
                    map,
                    ENVIRONMENT_FX[id].blend === "additive"
                      ? AdditiveBlending
                      : NormalBlending,
                    id.startsWith("fx_lightning") ? 0.8 : 0.65,
                  ),
                ],
              ]
            : [];
        }),
      ),
    [resources],
  );
  useEffect(
    () => () => {
      for (const material of atlasMaterials.values()) material.dispose();
    },
    [atlasMaterials],
  );
  const positions = useMemo(() => weatherPositions(weather), [weather]);
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      wind: { value: weather.wind },
      kind: { value: kinds[weather.particles] },
      viewport: { value: 800 },
    }),
    [weather],
  );
  const material = useMemo(
    () => weatherMaterial(positions, uniforms),
    [positions, uniforms],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera, size: viewport, gl }, delta) => {
    const state = runtime.current;
    state.time += Math.min(delta, 0.1);
    particles.current?.position.set(userPosition.x, 0, userPosition.z);
    uniforms.time.value = state.time;
    uniforms.viewport.value = viewport.height * Math.min(gl.getPixelRatio(), 2);
    if (weather.lightning !== "off" && state.time >= state.next) {
      state.strike = lightningStrike(
        state.sequence++,
        weather,
        size,
        userPosition,
      );
      state.began = state.time;
      state.sky = skyLightningLayout(state.strike, weather.intensity);
      state.next = state.time + weather.lightningInterval;
      onStrike?.(state.strike);
    }
    const strike = state.strike;
    if (!strike || !bolts.current) return;
    const age = state.time - state.began;
    bolts.current.visible = strike.local;
    bolts.current.position.set(strike.x, 0, strike.z);
    bolts.current.rotation.y = Math.atan2(
      camera.position.x - bolts.current.position.x,
      camera.position.z - bolts.current.position.z,
    );
    for (const id of ids) {
      const mesh = meshes.current.get(id);
      if (!mesh) continue;
      const frame = atlasFrame(id, age);
      mesh.visible = frame !== null;
      if (frame !== null) {
        const tex = resources.textures[id];
        const uv = ENVIRONMENT_FX[id].frames[frame]!;
        tex?.offset.set(uv.offset[0], uv.offset[1]);
        tex?.repeat.set(uv.repeat[0], uv.repeat[1]);
        // The sky shares these maps with hidden local meshes. Own the atlas
        // matrix here instead of relying on an individual material's draw.
        tex?.updateMatrix();
      }
    }
    flash.value =
      weather.flashes && !strike.local && age >= 0 && age < 1.4
        ? Math.sin((Math.PI * age) / 1.4) * 0.32
        : 0;
    if (sky.current) {
      sky.current.position.copy(camera.position);
      sky.current.visible =
        !strike.local && atlasFrame("fx_lightning_strike", age) !== null;
      sky.current.children.forEach((group, index) => {
        const placement = state.sky[index];
        group.visible = !!placement;
        if (!placement) return;
        group.position.set(placement.x, placement.y, placement.z);
        group.scale.set(placement.scale, placement.scale, placement.scale);
        group.rotation.y = Math.atan2(-placement.x, -placement.z);
      });
    }
    // Local strike illumination stays unchanged; sky bursts use distant glows.
    if (light.current) {
      light.current.position.set(strike.x, 2, strike.z);
      light.current.intensity =
        weather.flashes && age < 0.9
          ? Math.sin((Math.PI * age) / 0.9) * (strike.local ? 12 : 0)
          : 0;
    }
  });
  return (
    <group name="environment-weather">
      {weather.horizonLightning && weather.horizonLightning.density > 0 ? (
        <HorizonLightning
          resources={resources}
          settings={weather.horizonLightning}
          flashes={weather.flashes}
        />
      ) : null}
      {positions.length > 0 ? (
        <group ref={particles}>
          <instancedMesh
            name={`weather-${weather.particles}`}
            args={[geometry, material, positions.length / 3]}
            frustumCulled={false}
            raycast={() => {}}
            dispose={null}
          />
        </group>
      ) : null}
      {/* Keep light membership stable: hiding its bolt group rebuilds even
          unrelated scene shaders in Three. Only intensity/position vary. */}
      {weather.lightning !== "off" ? (
        <pointLight
          ref={light}
          color="#bddbff"
          intensity={0}
          position={[0, 2, 0]}
          distance={24}
          decay={2}
        />
      ) : null}
      {weather.lightning !== "off" ? (
        <group ref={bolts} name="weather-strike">
          {ids
            .filter((id) => resources.textures[id])
            .map((id, index) => {
              const atlas = ENVIRONMENT_FX[id];
              const upright =
                id === "fx_lightning_strike" ||
                id === "fx_lightning_arc" ||
                id === "fx_impact_dust" ||
                id === "fx_impact_sparks";
              const height =
                id === "fx_lightning_strike"
                  ? 24
                  : id === "fx_lightning_arc"
                    ? 5
                    : id === "fx_impact_scorch"
                      ? 3.5
                      : 6;
              const width = (height * atlas.width) / atlas.height;
              return (
                <mesh
                  key={id}
                  ref={(mesh: Mesh | null) => {
                    if (mesh) meshes.current.set(id, mesh);
                    else meshes.current.delete(id);
                  }}
                  name={id}
                  visible={false}
                  position={[
                    0,
                    upright
                      ? height * (atlas.pivot[1] - 0.5) +
                        (id === "fx_lightning_arc" ? 18 : 0.08)
                      : 0.015 + index * 0.003,
                    0,
                  ]}
                  rotation={upright ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}
                  raycast={() => {}}
                >
                  <planeGeometry args={[width, height]} />
                  <primitive
                    object={atlasMaterials.get(id)}
                    attach="material"
                    dispose={null}
                  />
                </mesh>
              );
            })}
        </group>
      ) : null}
      {weather.lightning === "distant" || weather.lightning === "both" ? (
        <group ref={sky} name="weather-sky-lightning" visible={false}>
          {Array.from({ length: 8 }, (_, index) => (
            <group key={index} name={`weather-sky-burst-${index}`}>
              <mesh
                name="weather-sky-flash"
                position={[0, 16, -0.2]}
                renderOrder={-16}
                raycast={() => {}}
              >
                <planeGeometry args={[55, 40]} />
                <primitive
                  object={flashMaterial}
                  attach="material"
                  dispose={null}
                />
              </mesh>
              {(["fx_lightning_strike", "fx_lightning_arc"] as const).map(
                (id) => {
                  const atlas = ENVIRONMENT_FX[id];
                  const height = id === "fx_lightning_strike" ? 24 : 9;
                  return (
                    <mesh
                      key={id}
                      name={`sky-${id}`}
                      position={[
                        0,
                        height * (atlas.pivot[1] - 0.5) +
                          (id === "fx_lightning_arc" ? 18 : 0),
                        0,
                      ]}
                      renderOrder={-15}
                      raycast={() => {}}
                    >
                      <planeGeometry
                        args={[(height * atlas.width) / atlas.height, height]}
                      />
                      <primitive
                        object={atlasMaterials.get(id)}
                        attach="material"
                        dispose={null}
                      />
                    </mesh>
                  );
                },
              )}
            </group>
          ))}
        </group>
      ) : null}
    </group>
  );
}
