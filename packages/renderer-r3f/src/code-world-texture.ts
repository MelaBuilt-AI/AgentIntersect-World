import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import {
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three";

/** Non-suspending textures: loading artwork never hides the working World. */
export function useCodeTexture(name: string) {
  const { gl, invalidate } = useThree();
  const [texture, setTexture] = useState<Texture | null>(null);
  useEffect(() => {
    let active = true;
    const loaded = new TextureLoader().load(
      `/assets/code-world/${name}.webp`,
      (map) => {
        if (!active) return;
        map.colorSpace = SRGBColorSpace;
        map.wrapS = map.wrapT = RepeatWrapping;
        map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
        map.needsUpdate = true;
        setTexture(map);
        invalidate();
      },
    );
    return () => {
      active = false;
      loaded.dispose();
    };
  }, [gl, invalidate, name]);
  return texture;
}
