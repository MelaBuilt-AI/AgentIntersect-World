import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  Vector3,
} from "three";

// Execute the private component unchanged with dependency-aware hook slots.
// Actual Three resources are used; this is a CPU component lifecycle test,
// not a React reconciler, browser, GPU reclamation, or visual acceptance test.
function mountMarker() {
  const path = new URL(
    "../src/world-room-imported-canvas.tsx",
    import.meta.url,
  );
  const text = readFileSync(path, "utf8");
  const file = ts.createSourceFile(
    path.pathname,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declaration = file.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "ImportedAvatarGroundingMarker",
  );
  if (!declaration) throw new Error("Grounding component missing");
  const code = ts.transpileModule(declaration.getText(file), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      jsxFactory: "jsx",
    },
  }).outputText;
  type Slot = { deps: unknown[]; value?: unknown; cleanup?: () => void };
  const slots: Slot[] = [];
  let cursor = 0;
  let pending: (() => void)[] = [];
  const unchanged = (slot: Slot | undefined, deps: unknown[]) =>
    slot &&
    slot.deps.length === deps.length &&
    deps.every((v, i) => Object.is(v, slot.deps[i]));
  const effect = (setup: () => (() => void) | void, deps: unknown[]) => {
    const index = cursor++;
    if (unchanged(slots[index], deps)) return;
    pending.push(() => {
      slots[index]?.cleanup?.();
      const cleanup = setup();
      slots[index] = { deps, ...(cleanup ? { cleanup } : {}) };
    });
  };
  const component = runInNewContext(`${code}\nImportedAvatarGroundingMarker`, {
    BufferGeometry,
    LineBasicMaterial,
    LineSegments,
    Vector3,
    jsx: (_type: unknown, props: { object: LineSegments }) => props,
    useMemo: (factory: () => unknown, deps: unknown[]) => {
      const index = cursor++;
      if (!unchanged(slots[index], deps))
        slots[index] = { deps, value: factory() };
      return slots[index]!.value;
    },
    useEffect: effect,
    useLayoutEffect: effect,
  }) as (props: { role: "user" | "agent"; position: number[] }) => {
    object: LineSegments<BufferGeometry, LineBasicMaterial>;
  };
  return {
    render(position: number[], role: "user" | "agent" = "user") {
      cursor = 0;
      pending = [];
      const { object } = component({ position, role });
      for (const commit of pending) commit();
      return object;
    },
    unmount() {
      for (const slot of slots) slot.cleanup?.();
    },
  };
}

describe("imported-avatar grounding resource lifecycle", () => {
  it("reuses ring resources across fresh position arrays and movement", () => {
    const marker = mountMarker();
    const first = marker.render([1, 0, 2]);
    try {
      for (let i = 0; i < 100; i++)
        expect(marker.render([1, 0, 2])).toBe(first);
      const moved = marker.render([3, 0, 4]);
      expect(moved).toBe(first);
      expect(moved.position.toArray()).toEqual([3, 0.0125, 4]);
      expect(moved.geometry.getAttribute("position").count).toBe(128);
      expect(moved.material.color.getHexString()).toBe("38bdf8");
    } finally {
      marker.unmount();
    }
  });

  it("disposes owned geometry and material on replacement and unmount", () => {
    const marker = mountMarker();
    const first = marker.render([0, 0, 0]);
    let geometryDisposed = 0,
      materialDisposed = 0;
    first.geometry.addEventListener("dispose", () => geometryDisposed++);
    first.material.addEventListener("dispose", () => materialDisposed++);
    const next = marker.render([0, 0, 0], "agent");
    let nextGeometryDisposed = 0,
      nextMaterialDisposed = 0;
    next.geometry.addEventListener("dispose", () => nextGeometryDisposed++);
    next.material.addEventListener("dispose", () => nextMaterialDisposed++);
    marker.unmount();
    expect([geometryDisposed, materialDisposed]).toEqual([1, 1]);
    expect([nextGeometryDisposed, nextMaterialDisposed]).toEqual([1, 1]);
    expect(next.material.color.getHexString()).toBe("f59e0b");
  });
});
