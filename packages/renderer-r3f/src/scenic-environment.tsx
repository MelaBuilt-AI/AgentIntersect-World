import { WorldSun } from "./world-sun.js";
import {
  ScenicGroundMaterial,
  ScenicSkyMaterial,
} from "./environment-node-materials.js";
import { useContext, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Fog, Group } from "three";
import type { EnvironmentResources } from "./environment-resources.js";
import { WorldGraphicsContext } from "./world-graphics-context.js";
import { WorldBloom } from "./world-atmosphere-effects.js";
import { EnvironmentDetails } from "./environment-details.js";
import { EnvironmentWeatherEffects } from "./environment-weather.js";
import { EnvironmentCutouts } from "./environment-cutouts.js";
import type { WeatherStrikeHandler } from "./environment-weather-model.js";
import { skyMapping } from "./environment-presentation.js";

/** Cosmetic only: the original floor size and all navigation authority stay intact. */
export function ScenicEnvironment({
  resources,
  size,
  reducedMotion,
  userPosition,
  postprocessing = true,
  lighting = true,
  onStrike,
}: {
  readonly onStrike?: WeatherStrikeHandler | undefined;
  readonly postprocessing?: boolean;
  readonly lighting?: boolean;
  readonly resources: EnvironmentResources;
  readonly size: number;
  readonly reducedMotion: boolean;
  readonly userPosition: { readonly x: number; readonly z: number };
}) {
  const { recipe, textures } = resources;
  const graphics = useContext(WorldGraphicsContext);
  const { scene, gl, invalidate } = useThree();
  const sky = useRef<Group>(null);
  const time = useMemo(() => ({ value: 0 }), []);

  const ground = textures[recipe.ground.asset]!;
  const background = textures[recipe.sky.background.asset]!;
  const middle = textures[recipe.sky.middle.asset]!;
  const foreground = textures[recipe.sky.foreground.asset]!;
  useEffect(() => {
    const previous = scene.fog;
    if (lighting)
      scene.fog = new Fog(recipe.lighting.fog, 35, recipe.lighting.fogFar);
    ground.repeat.set(
      size / recipe.ground.tileSize,
      size / recipe.ground.tileSize,
    );
    for (const layer of ["background", "middle", "foreground"] as const) {
      const mapping = skyMapping(layer, recipe.sky[layer].asset);
      textures[recipe.sky[layer].asset]!.repeat.set(
        mapping.repeatX,
        mapping.repeatY,
      );
    }
    gl.domElement.dataset.environment = recipe.name;
    invalidate();
    return () => {
      if (lighting) scene.fog = previous;
      delete gl.domElement.dataset.environment;
    };
  }, [
    scene,
    recipe,
    textures,
    ground,
    foreground,
    size,
    gl,
    invalidate,
    lighting,
  ]);

  useFrame(({ camera }, delta) => {
    sky.current?.position.copy(camera.position);
    if (!reducedMotion) {
      const step = Math.min(delta, 0.15);
      time.value += step;
      background.offset.x += recipe.sky.background.speed * step;
      middle.offset.x += recipe.sky.middle.speed * step;
      if (recipe.sky.foreground.asset !== "aurora_ribbons")
        foreground.offset.x += recipe.sky.foreground.speed * step;
      // Keep the feathered image border fixed vertically; only drift in longitude.
    }
  });

  return (
    <group name="world-scenic-environment">
      {postprocessing && (graphics.bloom || graphics.antialiasing) ? (
        <WorldBloom
          bloom={graphics.bloom}
          antialiasing={graphics.antialiasing}
        />
      ) : null}
      {lighting ? (
        <hemisphereLight
          args={[
            recipe.lighting.sky,
            recipe.lighting.ground,
            recipe.lighting.ambient * 1.5,
          ]}
        />
      ) : null}
      {lighting ? (
        <WorldSun
          scenic
          color={recipe.lighting.sun}
          intensity={recipe.lighting.intensity}
        />
      ) : null}
      <mesh
        name="environment-ground"
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[size, size, 1]}
        receiveShadow
      >
        <planeGeometry args={[1, 1]} />
        <ScenicGroundMaterial resources={resources} clock={time} />
      </mesh>
      <EnvironmentDetails resources={resources} size={size} />
      <EnvironmentCutouts resources={resources} size={size} />
      <EnvironmentWeatherEffects
        resources={resources}
        size={size}
        userPosition={userPosition}
        reducedMotion={reducedMotion}
        onStrike={onStrike}
      />
      <group ref={sky} name="environment-sky">
        <mesh name="environment-background" renderOrder={-20}>
          <sphereGeometry args={[450, 48, 24]} />
          <ScenicSkyMaterial
            map={background}
            tint={recipe.sky.background.tint}
            opacity={recipe.sky.background.opacity}
            feather={false}
            density={
              skyMapping("background", recipe.sky.background.asset).stars
                ? recipe.sky.background.asset === "dense_starfield"
                  ? 0.12
                  : 0.055
                : 0
            }
          />
        </mesh>
        {recipe.lighting.sunVisible ? (
          <mesh
            name="environment-sun"
            position={[160, 215, -200]}
            renderOrder={-19}
          >
            <sphereGeometry args={[12, 24, 16]} />
            <meshBasicMaterial
              color={recipe.lighting.sun}
              depthWrite={false}
              fog={false}
              toneMapped={false}
            />
          </mesh>
        ) : null}
        <mesh
          name="environment-middle"
          position={[
            0,
            recipe.sky.middle.asset !== "space-planets" ? 35 : 0,
            0,
          ]}
          renderOrder={-18}
        >
          {recipe.sky.middle.asset !== "space-planets" ? (
            <cylinderGeometry args={[440, 440, 145, 96, 1, true]} />
          ) : (
            <sphereGeometry args={[440, 48, 24]} />
          )}
          <ScenicSkyMaterial
            map={textures[recipe.sky.middle.asset] ?? null}
            tint={recipe.sky.middle.tint}
            opacity={recipe.sky.middle.opacity}
            feather
          />
        </mesh>
        {(recipe.celestial ?? []).map((sprite, index) => {
          const azimuth = (sprite.azimuth * Math.PI) / 180;
          const elevation = (sprite.elevation * Math.PI) / 180;
          return (
            <sprite
              key={`${sprite.asset}-${index}`}
              name={`environment-celestial-${sprite.asset}`}
              position={[
                Math.sin(azimuth) * Math.cos(elevation) * 425,
                Math.sin(elevation) * 425,
                -Math.cos(azimuth) * Math.cos(elevation) * 425,
              ]}
              scale={[sprite.size, sprite.size, 1]}
              renderOrder={-18}
            >
              <spriteMaterial
                map={textures[sprite.asset] ?? null}
                color={sprite.tint}
                opacity={sprite.opacity}
                transparent
                depthWrite={false}
                fog={false}
                toneMapped={false}
              />
            </sprite>
          );
        })}
        <mesh name="environment-foreground" renderOrder={-17}>
          <sphereGeometry args={[435, 64, 32]} />
          <ScenicSkyMaterial
            map={textures[recipe.sky.foreground.asset] ?? null}
            tint={recipe.sky.foreground.tint}
            opacity={recipe.sky.foreground.opacity}
            feather
          />
        </mesh>
      </group>
    </group>
  );
}
