import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CustomBlending,
  OneFactor,
  ZeroFactor,
  PlaneGeometry,
  Vector2,
  type Object3D,
  type ShaderMaterial,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

/** Mounted only while enabled; alpha holes for the real CSS3D screens survive. */
export function WorldBloom() {
  const { gl, scene, camera, size, invalidate } = useThree();
  const resources = useMemo(() => {
    const composer = new EffectComposer(gl);
    const render = new RenderPass(scene, camera);
    const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.18, 0.35, 0.85);
    bloom.blendMaterial.blending = CustomBlending;
    bloom.blendMaterial.blendSrc = OneFactor;
    bloom.blendMaterial.blendDst = OneFactor;
    bloom.blendMaterial.blendSrcAlpha = ZeroFactor;
    bloom.blendMaterial.blendDstAlpha = OneFactor;
    const output = new OutputPass();
    composer.addPass(render);
    composer.addPass(bloom);
    composer.addPass(output);
    return { composer, render, bloom, output };
  }, [gl, scene, camera]);
  useEffect(() => {
    resources.composer.setPixelRatio(gl.getPixelRatio());
    resources.composer.setSize(size.width, size.height);
    // Blur at a capped lower resolution; the main image retains the canvas DPR.
    const dpr = gl.getPixelRatio();
    const scale = Math.min(dpr, 640 / Math.max(size.width, size.height));
    resources.bloom.setSize(
      Math.max(1, size.width * scale),
      Math.max(1, size.height * scale),
    );
    gl.domElement.dataset.worldBloom = "on";
    invalidate();
  }, [resources, gl, size.width, size.height, invalidate]);
  useEffect(
    () => () => {
      resources.render.dispose();
      resources.bloom.dispose();
      resources.output.dispose();
      resources.composer.dispose();
      gl.domElement.dataset.worldBloom = "off";
      invalidate();
    },
    [resources, gl, invalidate],
  );
  useFrame((_, delta) => resources.composer.render(delta), 1);
  return null;
}

/** A real planar reflection, lightly blurred and blended over the original floor. */
export function WorldWetFloor({ size }: { readonly size: number }) {
  const { gl, invalidate, size: viewport } = useThree();
  const resolution = Math.min(
    512,
    Math.max(
      128,
      Math.round(
        Math.max(viewport.width, viewport.height) * gl.getPixelRatio() * 0.5,
      ),
    ),
  );
  const reflection = useMemo(() => {
    const geometry = new PlaneGeometry(size, size);
    const reflector = new Reflector(geometry, {
      textureWidth: resolution,
      textureHeight: resolution,
      multisample: 0,
      clipBias: 0.003,
      color: 0xffffff,
    });
    reflector.name = "world-wet-floor-reflection";
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = 0.012;
    reflector.raycast = () => {};
    const material = reflector.material as ShaderMaterial;
    material.transparent = true;
    material.depthWrite = false;
    material.fragmentShader = material.fragmentShader
      .replace(
        "vec4 base = texture2DProj( tDiffuse, vUv );",
        `vec2 uv = vUv.xy / vUv.w;
    vec2 d = vec2(1.5/${resolution.toFixed(1)});
    vec4 base = texture2D(tDiffuse,uv)*0.4;
    base += texture2D(tDiffuse,uv+vec2(d.x,0.0))*0.15;
    base += texture2D(tDiffuse,uv-vec2(d.x,0.0))*0.15;
    base += texture2D(tDiffuse,uv+vec2(0.0,d.y))*0.15;
    base += texture2D(tDiffuse,uv-vec2(0.0,d.y))*0.15;`,
      )
      .replace(
        "vec4( blendOverlay( base.rgb, color ), 1.0 )",
        "vec4(base.rgb, base.a * 0.28)",
      );
    const render = reflector.onBeforeRender;
    reflector.onBeforeRender = (renderer, scene, camera) => {
      const hidden: Object3D[] = [];
      scene.traverse((object) => {
        if (
          object.visible &&
          (object.name === "world-code-sky" ||
            object.name === "world-spatial-screens" ||
            object.name === "repository-local-atmosphere" ||
            object.name.startsWith("repository-terminal-rain:"))
        ) {
          hidden.push(object);
          object.visible = false;
        }
      });
      try {
        render.call(reflector, renderer, scene, camera);
      } finally {
        for (const object of hidden) object.visible = true;
      }
    };
    return reflector;
  }, [size, resolution]);
  useEffect(() => {
    gl.domElement.dataset.worldReflections = "on";
    invalidate();
    return () => {
      reflection.dispose();
      reflection.geometry.dispose();
      gl.domElement.dataset.worldReflections = "off";
      invalidate();
    };
  }, [reflection, gl, invalidate]);
  return <primitive object={reflection} dispose={null} />;
}
