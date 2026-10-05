import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3 } from "three";

export type LiveWorldUserPosition = {
  readonly current: Readonly<{ x: number; z: number }>;
};

/** Keep the drawn avatar and follow-camera on the same live movement sample. */
export function useWorldUserMotion({
  userPosition,
  liveUserPosition,
  pose,
  followUser,
}: {
  readonly userPosition: Readonly<{ x: number; z: number }>;
  readonly liveUserPosition?: LiveWorldUserPosition | undefined;
  readonly pose: {
    readonly position: readonly [number, number, number];
    readonly target: readonly [number, number, number];
  };
  readonly followUser: boolean;
}) {
  const { camera, invalidate } = useThree();
  const group = useRef<Group>(null);
  const target = useMemo(() => new Vector3(), []);
  const applyPose = useCallback(() => {
    const position = liveUserPosition?.current ?? userPosition;
    const x = position.x - userPosition.x;
    const z = position.z - userPosition.z;
    // Children retain their committed world positions. Compensate only for
    // movement that has not reached the React/R3F commit yet.
    group.current?.position.set(x, 0, z);
    const cameraX = followUser ? x : 0;
    const cameraZ = followUser ? z : 0;
    camera.position.set(
      pose.position[0] + cameraX,
      pose.position[1],
      pose.position[2] + cameraZ,
    );
    target.set(
      pose.target[0] + cameraX,
      pose.target[1],
      pose.target[2] + cameraZ,
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }, [camera, followUser, liveUserPosition, pose, target, userPosition]);
  useLayoutEffect(() => {
    applyPose();
    camera.updateProjectionMatrix();
    invalidate();
  }, [applyPose, camera, invalidate]);
  // Run before the spatial-screen focus camera (-1), then environment effects.
  // A deferred React commit must not hold walking; focused screens retain
  // their camera override without taking over R3F's automatic render loop.
  useFrame(applyPose, -2);
  return group;
}
