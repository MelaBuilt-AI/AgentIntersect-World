import { useContext, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  DoubleSide,
  type Points,
  type ShaderMaterial,
} from "three";
import { WorldGraphicsContext } from "./world-graphics-context.js";
import { RepositoryBaseFog } from "./repository-base-fog.js";
import type { CityRainClock } from "./repository-terminal-rain.js";

const noRaycast = () => {};
const vertex = `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const shaftFragment = `varying vec2 vUv; void main(){
 float edge=pow(max(0.0,1.0-abs(vUv.x*2.0-1.0)),3.0);
 float height=smoothstep(0.0,0.12,vUv.y)*(1.0-smoothstep(0.3,1.0,vUv.y));
 gl_FragColor=vec4(0.10,0.36,0.52,edge*height*0.075);
 #include <colorspace_fragment>
}`;

/** Low volume mist and the accepted crossed shafts / arrival sparks. */
export function RepositoryLocalAtmosphere({
  x,
  z,
  radius,
  roof,
  clock,
  settledAt,
  reducedMotion,
}: {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly roof: number;
  readonly clock: CityRainClock;
  readonly settledAt: number;
  readonly reducedMotion: boolean;
}) {
  const graphics = useContext(WorldGraphicsContext);
  const sparks = useRef<ShaderMaterial>(null);
  const sparkMesh = useRef<Points>(null);
  const skipSparks = useRef(reducedMotion);
  const sparkUniforms = useMemo(() => ({ age: { value: 0 } }), []);
  const shapes = useMemo(() => {
    const shaftPos: number[] = [],
      shaftUv: number[] = [];
    const quad = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    for (let side = 0; side < 2; side++)
      for (const [u, v] of quad) {
        const width = radius * (1.0 - v! * 0.8);
        shaftPos.push(
          side === 0 ? (u! - 0.5) * width : 0,
          v! * (roof + 10),
          side === 1 ? (u! - 0.5) * width : 0,
        );
        shaftUv.push(u!, v!);
      }
    const points = Array.from({ length: 36 }, (_, i) => [
      Math.sin(i * 13.3) * radius * 0.55,
      0.2 + (i % 7) * 0.12,
      Math.cos(i * 17.1) * radius * 0.55,
    ]).flat();
    return {
      shaftPos: new Float32Array(shaftPos),
      shaftUv: new Float32Array(shaftUv),
      points: new Float32Array(points),
    };
  }, [radius, roof]);
  useFrame(() => {
    if (reducedMotion) skipSparks.current = true;
    const age = Math.max(0, clock.value - settledAt);
    if (sparks.current) sparks.current.uniforms.age!.value = age;
    if (sparkMesh.current)
      sparkMesh.current.visible = !skipSparks.current && age < 3.5;
  });
  return (
    <group name="repository-local-atmosphere" position={[x, 0, z]}>
      {graphics.baseFog ? (
        <RepositoryBaseFog x={x} z={z} radius={radius} clock={clock} />
      ) : null}
      {graphics.lightShafts ? (
        <mesh name="repository-local-shafts" raycast={noRaycast}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[shapes.shaftPos, 3]}
            />
            <bufferAttribute
              attach="attributes-uv"
              args={[shapes.shaftUv, 2]}
            />
          </bufferGeometry>
          <shaderMaterial
            vertexShader={vertex}
            fragmentShader={shaftFragment}
            side={DoubleSide}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ) : null}
      {graphics.arrivalSparks && !reducedMotion ? (
        <points
          ref={sparkMesh}
          name="repository-arrival-sparks"
          raycast={noRaycast}
          frustumCulled={false}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[shapes.points, 3]}
            />
          </bufferGeometry>
          <shaderMaterial
            ref={sparks}
            uniforms={sparkUniforms}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
            vertexShader={`uniform float age; varying float fade; void main(){float seed=fract(sin(dot(position,vec3(12.1,8.3,4.9)))*43758.5);float t=max(0.0,age-seed*0.45);vec3 p=position;p.xz*=1.0+t*0.18;p.y+=t*(2.2+seed*2.5);vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(65.0/max(1.0,-mv.z),1.0,9.0);fade=(1.0-smoothstep(1.4,3.2,t))*smoothstep(0.0,0.2,t);}`}
            fragmentShader={`varying float fade; void main(){float d=length(gl_PointCoord-0.5)*2.0;gl_FragColor=vec4(0.4,0.8,1.0,(1.0-smoothstep(0.0,1.0,d))*fade); #include <colorspace_fragment>\n}`.replace(
              "; #include",
              ";\n#include",
            )}
          />
        </points>
      ) : null}
    </group>
  );
}
