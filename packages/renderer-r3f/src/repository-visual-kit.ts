import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  OctahedronGeometry,
  TorusGeometry,
  type BufferGeometry,
} from "three";

import type {
  RepositoryGeometryKind,
  RepositoryVisualFamily,
} from "./index.js";

export const REPOSITORY_VISUAL_COLORS: Readonly<
  Record<RepositoryVisualFamily, string>
> = {
  "package-workspace-hub": "#8b5cf6",
  "directory-archive-gate": "#38bdf8",
  "source-file-code-slab": "#2563eb",
  "test-file-beacon": "#22d3ee",
  "documentation-book": "#f59e0b",
  "config-control-terminal": "#a78bfa",
  "data-storage-vault": "#14b8a6",
  "binary-artifact-crate": "#64748b",
  "symbol-function-node": "#67e8f9",
};

export function createRepositoryGeometry(
  kind: RepositoryGeometryKind,
): BufferGeometry {
  switch (kind) {
    case "workspace-hub":
      return new CylinderGeometry(0.62, 0.82, 0.82, 8);
    case "archive-gate": {
      const geometry = new TorusGeometry(0.5, 0.14, 8, 16);
      geometry.rotateX(Math.PI / 2);
      return geometry;
    }
    case "code-slab":
      return new BoxGeometry(1, 0.16, 0.72);
    case "test-beacon":
      return new ConeGeometry(0.5, 1, 8);
    case "book":
      return new BoxGeometry(1, 0.3, 0.78, 2, 1, 2);
    case "control-terminal":
      return new CylinderGeometry(0.58, 0.46, 0.8, 6);
    case "storage-vault":
      return new CylinderGeometry(0.55, 0.55, 0.72, 12);
    case "artifact-crate":
      return new OctahedronGeometry(0.62, 0);
    case "function-node":
      return new IcosahedronGeometry(0.48, 0);
  }
}

export function createRepositoryMaterial(
  family: RepositoryVisualFamily,
): MeshStandardMaterial {
  const emissive =
    family === "test-file-beacon" || family === "symbol-function-node";
  return new MeshStandardMaterial({
    color: REPOSITORY_VISUAL_COLORS[family],
    roughness: family === "binary-artifact-crate" ? 0.82 : 0.58,
    metalness:
      family === "package-workspace-hub" ||
      family === "config-control-terminal" ||
      family === "data-storage-vault"
        ? 0.28
        : 0.08,
    emissive: emissive ? REPOSITORY_VISUAL_COLORS[family] : "#000000",
    emissiveIntensity: emissive ? 0.24 : 0,
  });
}
