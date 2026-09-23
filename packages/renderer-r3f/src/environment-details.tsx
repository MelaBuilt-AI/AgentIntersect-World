import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import type { EnvironmentResources } from "./environment-resources.js";
import { environmentScatter } from "./environment-scatter.js";

/** One instanced draw, no shadows, animation, asset downloads or collision bodies. */
export function EnvironmentDetails({
  resources,
  size,
}: {
  readonly resources: EnvironmentResources;
  readonly size: number;
}) {
  const kind =
    resources.recipe.ground.asset === "meadow-ground" ? "grass" : "rocks";
  const mesh = useRef<InstancedMesh>(null);
  const { invalidate } = useThree();
  const points = useMemo(
    () =>
      environmentScatter(
        size,
        resources.recipe.ground.tileSize,
        kind,
        resources.grassCoverage,
      ),
    [resources, size, kind],
  );
  const grass = useMemo(() => {
    const geometry = new BufferGeometry();
    const vertices: number[] = [];
    for (let blade = 0; blade < 3; blade++) {
      const angle = (blade * Math.PI) / 3;
      const x = Math.cos(angle) * 0.075,
        z = Math.sin(angle) * 0.075;
      vertices.push(-x, 0, -z, x, 0, z, x * 0.6, 0.24 + blade * 0.045, z * 0.6);
    }
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(vertices), 3),
    );
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => grass.dispose(), [grass]);
  useEffect(() => {
    if (!mesh.current) return;
    const matrix = new Matrix4();
    const axis = new Vector3(0, 1, 0);
    points.forEach((point, i) => {
      const rotation = new Quaternion().setFromAxisAngle(axis, point.yaw);
      matrix.compose(
        new Vector3(
          point.x,
          kind === "rocks" ? 0.12 * point.scale : 0.012,
          point.z,
        ),
        rotation,
        new Vector3(
          point.scale,
          point.scale * (kind === "rocks" ? 0.65 : 1),
          point.scale,
        ),
      );
      mesh.current!.setMatrixAt(i, matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [points, kind, invalidate]);
  return (
    <instancedMesh
      key={kind}
      ref={mesh}
      name={`environment-${kind}`}
      args={[undefined, undefined, points.length]}
      frustumCulled={false}
    >
      {kind === "grass" ? (
        <primitive object={grass} attach="geometry" />
      ) : (
        <icosahedronGeometry args={[0.27, 0]} />
      )}
      <meshStandardMaterial
        color={kind === "grass" ? "#71854b" : "#743f2c"}
        roughness={1}
        metalness={0}
        side={DoubleSide}
      />
    </instancedMesh>
  );
}
