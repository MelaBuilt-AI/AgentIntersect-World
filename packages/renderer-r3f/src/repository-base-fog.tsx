import { useContext, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BackSide,
  Matrix4,
  Vector2,
  type Camera,
  type Scene,
  type WebGLRenderer,
  type ShaderMaterial,
} from "three";
import type { CityRainClock } from "./repository-terminal-rain.js";
import { RepositoryFogDepthContext } from "./repository-fog-depth.js";

const vertex = `
varying vec3 worldPosition;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  worldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const fragment = `
uniform sampler2D sceneDepth;
uniform sampler2D sceneColor;
uniform vec2 resolution;
uniform mat4 inverseProjection;
uniform mat4 cameraWorld;
uniform vec3 center;
uniform vec3 extent;
uniform float time;
varying vec3 worldPosition;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);
}
vec3 unproject(vec2 uv, float depth) {
  vec4 view = inverseProjection * vec4(uv*2.0-1.0, depth*2.0-1.0, 1.0);
  return (cameraWorld * vec4(view.xyz/view.w,1.0)).xyz;
}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  // Do not paint over the transparent-black apertures used by CSS3D screens.
  if (texture2D(sceneColor,uv).a < 0.01) discard;
  vec3 start = unproject(uv,0.0);
  vec3 direction = normalize(worldPosition-start);
  vec3 surface = unproject(uv,texture2D(sceneDepth,uv).r);
  float surfaceDistance = max(0.0,dot(surface-start,direction));
  // Analytic ray/ellipsoid bounds and continuous density integration.
  // No horizontal surfaces, marching steps or view-dependent layer count.
  vec3 origin = (start-center)/extent;
  vec3 ray = direction/extent;
  float a=dot(ray,ray), b=dot(origin,ray), c=dot(origin,origin)-1.0;
  float discriminant=b*b-a*c;
  if(discriminant<=0.0) discard;
  float root=sqrt(discriminant);
  float entry=max(0.0,(-b-root)/a);
  float exit=min(surfaceDistance,(-b+root)/a);
  if(exit<=entry) discard;
  float halfChord=root/a;
  float peak=discriminant/a;
  vec2 u=clamp((vec2(entry,exit)+b/a)/halfChord,-1.0,1.0);
  // Integral of (1-u*u)^2: u - 2*u^3/3 + u^5/5.
  vec2 integral=u*(1.0+u*u*(-2.0/3.0+u*u/5.0));
  vec3 midpoint=start+direction*(entry+exit)*0.5;
  float wisps=0.5+0.5*noise(midpoint.xz*1.1+vec2(time*0.07,-time*0.035)+midpoint.y*0.4);
  float opticalDepth=max(0.0,integral.y-integral.x)*halfChord*peak*peak*wisps*0.35;
  float alpha=1.0-exp(-opticalDepth);
  gl_FragColor=vec4(vec3(0.20,0.36,0.43),alpha);
  #include <colorspace_fragment>
}`;

/** A low continuous volume, truncated at the nearest opaque scene surface. */
export function RepositoryBaseFog({
  x,
  z,
  radius,
  clock,
}: {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly clock: CityRainClock;
}) {
  const depth = useContext(RepositoryFogDepthContext);
  const material = useRef<ShaderMaterial>(null);
  const height = 0.95;
  const width = radius * 1.4;
  const uniforms = useMemo(
    () => ({
      sceneDepth: { value: null },
      sceneColor: { value: null },
      resolution: { value: new Vector2() },
      inverseProjection: { value: new Matrix4() },
      cameraWorld: { value: new Matrix4() },
      center: { value: [x, 0, z] },
      extent: { value: [width, height, width] },
      time: { value: 0 },
    }),
    [x, z, width],
  );
  useFrame(() => {
    if (material.current) material.current.uniforms.time!.value = clock.value;
  });
  return (
    <mesh
      name="repository-base-fog"
      position={[0, height / 2, 0]}
      raycast={() => {}}
      onBeforeRender={(gl: WebGLRenderer, scene: Scene, camera: Camera) => {
        if (!depth || !material.current) return;
        const target = depth.capture(gl, scene, camera);
        const live = material.current.uniforms;
        live.sceneDepth!.value = target.depthTexture;
        live.sceneColor!.value = target.texture;
        (live.resolution!.value as Vector2).set(target.width, target.height);
        (live.inverseProjection!.value as Matrix4).copy(
          camera.projectionMatrixInverse,
        );
        (live.cameraWorld!.value as Matrix4).copy(camera.matrixWorld);
      }}
    >
      <boxGeometry args={[width * 2, height, width * 2]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        side={BackSide}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
