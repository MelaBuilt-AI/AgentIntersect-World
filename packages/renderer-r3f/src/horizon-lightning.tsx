import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector2 } from "three";
import {
  ENVIRONMENT_FX,
  type EnvironmentWeather,
} from "@agentintersect-world/world-schema/environment";
import type { EnvironmentResources } from "./environment-resources.js";
import {
  horizonLightningCount,
  horizonLightningSample,
} from "./environment-weather-model.js";
import {
  horizonBoltMaterial,
  skyFlashMaterial,
} from "./world-node-materials.js";

/** Independent low storm band: no local impacts, new lights, or thunder spam. */
export function HorizonLightning({
  resources,
  settings,
  flashes,
}: {
  readonly resources: EnvironmentResources;
  readonly settings: NonNullable<EnvironmentWeather["horizonLightning"]>;
  readonly flashes: boolean;
}) {
  const root = useRef<Group>(null);
  const groups = useRef(new Map<number, Group>());
  const clock = useRef(0);
  const slots = useMemo(
    () =>
      Array.from({ length: horizonLightningCount(settings) }, () => {
        const coordinates = {
          offset: { value: new Vector2() },
          repeat: { value: new Vector2() },
        };
        const strength = { value: 0 },
          glow = { value: 0 };
        return {
          coordinates,
          strength,
          glow,
          bolt: horizonBoltMaterial(
            resources.textures.fx_lightning_strike!,
            coordinates,
            strength,
          ),
          light: skyFlashMaterial(glow),
        };
      }),
    [resources, settings],
  );
  useEffect(
    () => () => {
      for (const slot of slots) {
        slot.bolt.dispose();
        slot.light.dispose();
      }
    },
    [slots],
  );
  useFrame(({ camera }, delta) => {
    clock.current += Math.min(delta, 0.1);
    root.current?.position.copy(camera.position);
    slots.forEach((slot, index) => {
      const sample = horizonLightningSample(index, clock.current, settings);
      const uv = ENVIRONMENT_FX.fx_lightning_strike.frames[sample.frame]!;
      slot.coordinates.offset.value.set(uv.offset[0], uv.offset[1]);
      slot.coordinates.repeat.value.set(uv.repeat[0], uv.repeat[1]);
      slot.strength.value = sample.opacity;
      slot.glow.value = flashes ? sample.opacity * 0.3 : 0;
      const group = groups.current.get(index);
      if (!group) return;
      group.visible = sample.opacity > 0;
      group.position.set(sample.x, sample.y, sample.z);
      group.scale.set(sample.height, sample.height, sample.height);
      group.rotation.y = Math.atan2(-sample.x, -sample.z);
      group.rotation.z = sample.roll;
    });
  });
  return (
    <group ref={root} name="weather-horizon-lightning">
      {slots.map((slot, index) => (
        <group
          key={index}
          name={`weather-horizon-bolt-${index}`}
          visible={false}
          ref={(group: Group | null) => {
            if (group) groups.current.set(index, group);
            else groups.current.delete(index);
          }}
        >
          <mesh
            name="weather-horizon-glow"
            position={[0, 0, -0.02]}
            renderOrder={-16}
            raycast={() => {}}
          >
            <planeGeometry args={[1.8, 1.4]} />
            <primitive object={slot.light} attach="material" dispose={null} />
          </mesh>
          <mesh
            name="weather-horizon-strike"
            renderOrder={-15}
            raycast={() => {}}
          >
            <planeGeometry args={[1 / 3, 1]} />
            <primitive object={slot.bolt} attach="material" dispose={null} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
