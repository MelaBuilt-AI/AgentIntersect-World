import { useEffect, useMemo, useRef } from "react";
import { cutoutContactMaterial } from "./world-node-materials.js";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Group } from "three";
import { ENVIRONMENT_ASSETS } from "@agentintersect-world/world-schema/environment";
import type { EnvironmentResources } from "./environment-resources.js";

/** Supplied concept artwork as explicit decorative cutouts, not fabricated GLB meshes. */
export function EnvironmentCutouts({
  resources,
  size,
}: {
  readonly resources: EnvironmentResources;
  readonly size: number;
}) {
  const group = useRef<Group>(null);
  const contact = useMemo(() => cutoutContactMaterial(), []);
  useEffect(() => () => contact.dispose(), [contact]);
  const props = useMemo(
    () =>
      (resources.recipe.props ?? []).flatMap((item, kind) =>
        Array.from({ length: item.count }, (_, index) => {
          const angle = index * 2.399963 + kind * 1.7;
          const radius = size * (0.23 + ((index * 7 + kind * 3) % 11) * 0.016);
          const asset = ENVIRONMENT_ASSETS[item.asset];
          return {
            ...item,
            // Seat the lowest opaque rim slightly into the surface so filtered
            // alpha edges / shadow-map bias do not leave a hovering light gap.
            y: item.size * (("groundV" in asset ? asset.groundV : 1) - 0.52),
            x: Math.sin(angle) * radius,
            z: Math.cos(angle) * radius,
          };
        }),
      ),
    [resources.recipe.props, size],
  );
  useFrame(({ camera }) => {
    group.current?.traverse((child) => {
      if (child.name.startsWith("environment-cutout-"))
        child.rotation.y = Math.atan2(
          camera.position.x - child.position.x,
          camera.position.z - child.position.z,
        );
    });
  });
  return (
    <group ref={group} name="environment-prop-cutouts">
      {props.map((prop, index) => (
        <mesh
          key={index}
          name={`environment-cutout-${prop.asset}-${index}`}
          position={[prop.x, prop.y, prop.z]}
          castShadow
          raycast={() => {}}
        >
          <planeGeometry args={[prop.size, prop.size]} />
          <meshBasicMaterial
            map={resources.textures[prop.asset] ?? null}
            transparent
            alphaTest={0.1}
            shadowSide={DoubleSide}
            depthWrite
            toneMapped={false}
          />
        </mesh>
      ))}
      {props.map((prop, index) => (
        <mesh
          key={index}
          name={`environment-prop-contact-${index}`}
          position={[prop.x, 0.018, prop.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => {}}
        >
          <planeGeometry args={[prop.size * 0.75, prop.size * 0.45]} />
          <primitive object={contact} attach="material" dispose={null} />
        </mesh>
      ))}
    </group>
  );
}
