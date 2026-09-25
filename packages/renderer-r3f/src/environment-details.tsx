import { DetailMaterial } from "./environment-node-materials.js";
import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import type { EnvironmentResources } from "./environment-resources.js";
import { environmentScatter } from "./environment-scatter.js";
import {
  createGrassGeometry,
  createRockGeometry,
  environmentDetailKind,
} from "./environment-detail-geometry.js";

/** One instanced draw, no shadows, animation, asset downloads or collision bodies. */
export function EnvironmentDetails({
  resources,
  size,
}: {
  readonly resources: EnvironmentResources;
  readonly size: number;
}) {
  const kind = environmentDetailKind(resources.recipe.ground.asset);
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
  const geometry = useMemo(
    () => (kind === "grass" ? createGrassGeometry() : createRockGeometry()),
    [kind],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    if (!mesh.current) return;
    const matrix = new Matrix4();
    const axis = new Vector3(0, 1, 0);
    points.forEach((point, i) => {
      const rotation = new Quaternion().setFromAxisAngle(axis, point.yaw);
      matrix.compose(
        new Vector3(
          point.x,
          kind === "rocks" ? 0.09 * point.scale : -0.008,
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
      <primitive object={geometry} attach="geometry" />
      <DetailMaterial resources={resources} size={size} />
    </instancedMesh>
  );
}
