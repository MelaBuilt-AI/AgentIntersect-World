import { useContext, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, Fog, Group, Object3D } from "three";
import type { EnvironmentResources } from "./environment-resources.js";
import { WorldGraphicsContext } from "./world-graphics-context.js";
import { WorldBloom } from "./world-atmosphere-effects.js";
import { EnvironmentDetails } from "./environment-details.js";

/** Cosmetic only: the original floor size and all navigation authority stay intact. */
export function ScenicEnvironment({
  resources,
  size,
  reducedMotion,
  userPosition,
}: {
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
  const target = useMemo(() => new Object3D(), []);
  const ground = textures[recipe.ground.asset]!;
  const background = textures[recipe.sky.background.asset]!;
  const middle = textures[recipe.sky.middle.asset]!;
  const foreground = textures[recipe.sky.foreground.asset]!;
  useEffect(() => {
    const previous = scene.fog;
    scene.fog = new Fog(recipe.lighting.fog, 35, recipe.lighting.fogFar);
    ground.repeat.set(
      size / recipe.ground.tileSize,
      size / recipe.ground.tileSize,
    );
    foreground.repeat.set(
      recipe.sky.foreground.asset === "day-clouds" ? 3 : 2,
      2,
    );
    gl.domElement.dataset.environment = recipe.name;
    invalidate();
    return () => {
      scene.fog = previous;
      delete gl.domElement.dataset.environment;
    };
  }, [scene, recipe, ground, foreground, size, gl, invalidate]);
  useEffect(() => {
    target.position.set(userPosition.x, 0, userPosition.z);
    target.updateMatrixWorld();
  }, [target, userPosition.x, userPosition.z]);
  const animateGround = useMemo(
    () =>
      (shader: {
        uniforms: Record<string, unknown>;
        fragmentShader: string;
      }) => {
        shader.uniforms.environmentTime = time;
        shader.fragmentShader =
          "uniform float environmentTime;\n" +
          shader.fragmentShader.replace(
            "#include <map_fragment>",
            `#include <map_fragment>
#ifdef USE_MAP
  // A shallow drifting light/dust pattern; ground features never slide under feet.
  float drift = sin(vMapUv.x * 8.0 + environmentTime * 0.22) * sin(vMapUv.y * 7.0 - environmentTime * 0.16);
  diffuseColor.rgb *= 0.985 + 0.015 * drift;
#endif`,
          );
      },
    [time],
  );
  useFrame(({ camera }, delta) => {
    sky.current?.position.copy(camera.position);
    if (!reducedMotion) {
      const step = Math.min(delta, 0.15);
      time.value += step;
      background.offset.x += recipe.sky.background.speed * step;
      middle.offset.x += recipe.sky.middle.speed * step;
      foreground.offset.x += recipe.sky.foreground.speed * step;
      if (recipe.sky.foreground.asset === "space-gas")
        foreground.offset.y += step * 0.0007;
    }
  });
  const skyMaterial = (layer: keyof typeof recipe.sky) => ({
    map: textures[recipe.sky[layer].asset] ?? null,
    color: recipe.sky[layer].tint,
    transparent: layer !== "background",
    opacity: recipe.sky[layer].opacity,
    side: BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  return (
    <group name="world-scenic-environment">
      {graphics.bloom || graphics.antialiasing ? (
        <WorldBloom
          bloom={graphics.bloom}
          antialiasing={graphics.antialiasing}
        />
      ) : null}
      <hemisphereLight
        args={[
          recipe.lighting.sky,
          recipe.lighting.ground,
          recipe.lighting.ambient,
        ]}
      />
      <directionalLight
        color={recipe.lighting.sun}
        intensity={recipe.lighting.intensity}
        position={[userPosition.x + 24, 32, userPosition.z - 30]}
        target={target}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={100}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
      />
      <primitive object={target} />
      <mesh
        name="environment-ground"
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[size, size, 1]}
        receiveShadow
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          map={ground}
          color={recipe.ground.tint}
          roughness={recipe.ground.roughness}
          metalness={0}
          onBeforeCompile={animateGround}
          customProgramCacheKey={() => "environment-ground-drift-1"}
        />
      </mesh>
      <EnvironmentDetails resources={resources} size={size} />
      <group ref={sky} name="environment-sky">
        <mesh name="environment-background" renderOrder={-20}>
          <sphereGeometry args={[450, 48, 24]} />
          <meshBasicMaterial {...skyMaterial("background")} />
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
            recipe.sky.middle.asset === "mountain-horizon" ? -25 : 0,
            0,
          ]}
          renderOrder={-18}
        >
          {recipe.sky.middle.asset === "mountain-horizon" ? (
            <cylinderGeometry args={[440, 440, 145, 96, 1, true]} />
          ) : (
            <sphereGeometry args={[440, 48, 24]} />
          )}
          <meshBasicMaterial {...skyMaterial("middle")} />
        </mesh>
        <mesh name="environment-foreground" renderOrder={-17}>
          <sphereGeometry
            args={[435, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshBasicMaterial {...skyMaterial("foreground")} />
        </mesh>
      </group>
    </group>
  );
}
