import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import {
  REPOSITORY_VISUAL_FAMILIES,
  RENDER_OBJECT_KINDS,
  boundedSemanticObjects,
  preparePhase10AggregateView,
  preparePhase10VisibleDetail,
  prepareRepositoryInstances,
  repositoryVisualFamily,
  resolveWebGLCapability,
} from "../src/index.js";
import {
  applyAvatarRuntimePose,
  avatarLodForDistance,
  avatarSelectionKey,
  avatarSecondaryVisibility,
  collectAvatarRuntimeTargets,
  configureAvatarScene,
  prepareAvatarLayerApplication,
  resolveAvatarMixerPlan,
  resolveAvatarLayerRotation,
} from "../src/avatar-kit-canvas.js";
import {
  repositoryIslandQuality,
  repositoryPointerMissSelection,
} from "../src/repository-island-canvas.js";
import {
  createImportedAvatarImpostorSnapshot,
  importedAvatarImpostorPoseTime,
  selectImportedAvatarWorldRepresentation,
} from "../src/imported-avatar-canvas.js";
import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";

describe("repository renderer preparation", () => {
  it("clears semantic selection on a repository canvas background miss", () => {
    expect(repositoryPointerMissSelection()).toBeNull();
    const source = readFileSync(
      new URL("../src/repository-island-canvas.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(
      /onPointerMissed=\{\(\) =>\s*onSelect\(repositoryPointerMissSelection\(\)\)\}/u,
    );
  });

  it("uses a bounded aggregate rendering tier without changing small-world quality", () => {
    expect(repositoryIslandQuality(999, false)).toEqual({
      tier: "semantic-detail",
      dpr: [1, 1.5],
      antialias: true,
      pbrMaterials: true,
    });
    expect(repositoryIslandQuality(1_000, false)).toEqual({
      tier: "aggregate",
      dpr: 1,
      antialias: false,
      pbrMaterials: false,
    });
    expect(repositoryIslandQuality(10_001, true)).toEqual({
      tier: "aggregate",
      dpr: 1,
      antialias: false,
      pbrMaterials: false,
    });
  });

  it("keeps full avatar detail at every distance while runtime LOD is disabled", () => {
    expect(
      [
        0,
        6,
        6.01,
        9,
        9.001,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NaN,
      ].map((distance) => avatarLodForDistance(distance, "world")),
    ).toEqual(["LOD0", "LOD0", "LOD0", "LOD0", "LOD0", "LOD0", "LOD0", "LOD0"]);
    expect(avatarLodForDistance(100, "builder")).toBe("LOD0");
    expect(avatarLodForDistance(0, "roster")).toBe("LOD0");
    expect(avatarSecondaryVisibility("LOD2")).toEqual({
      fur: false,
      markings: false,
      shirtLabel: false,
      circuitSeam: false,
      armCircuitSeams: false,
      articulationPanels: false,
    });
  });

  it("uses a runtime impostor only for constrained imported avatars", () => {
    expect(selectImportedAvatarWorldRepresentation("full")).toBe("live-model");
    expect(selectImportedAvatarWorldRepresentation("constrained")).toBe(
      "runtime-impostor",
    );
  });

  it("captures imported impostors from the middle of the approved clip", () => {
    expect(importedAvatarImpostorPoseTime(1.8)).toBeCloseTo(0.9);
    expect(importedAvatarImpostorPoseTime(0)).toBe(0);
    expect(importedAvatarImpostorPoseTime(Number.NaN)).toBe(0);
  });

  it("captures an imported avatar impostor and restores renderer state", () => {
    const parent = new Group();
    const scene = new Group();
    scene.add(
      new Mesh(
        new BoxGeometry(1, 2, 1),
        new MeshStandardMaterial({ color: "#d9a07b" }),
      ),
    );
    parent.add(scene);
    const setRenderTarget = vi.fn();
    const setClearColor = vi.fn();
    const render = vi.fn();
    const renderer = {
      getRenderTarget: () => null,
      setRenderTarget,
      getClearColor: (target: Color) => target,
      getClearAlpha: () => 1,
      setClearColor,
      clear: vi.fn(),
      render,
    } as unknown as WebGLRenderer;

    const snapshot = createImportedAvatarImpostorSnapshot(scene, renderer);

    expect(render).toHaveBeenCalledOnce();
    expect(setRenderTarget.mock.calls[0]?.[0]).toBe(snapshot.target);
    expect(setRenderTarget.mock.calls.at(-1)?.[0]).toBeNull();
    expect(setClearColor).toHaveBeenCalledWith("#000000", 0);
    expect(scene.parent).toBe(parent);
    expect(snapshot.sprite.userData).toMatchObject({
      avatarSource: "imported",
      avatarRepresentation: "runtime-impostor",
    });
    expect(snapshot.sprite.material.map).toBe(snapshot.target.texture);
    snapshot.material.dispose();
    snapshot.target.dispose();
  });

  it("disposes a failed imported-avatar impostor capture", () => {
    const parent = new Group();
    const scene = new Group();
    scene.add(new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial()));
    parent.add(scene);
    const setRenderTarget = vi.fn();
    const setClearColor = vi.fn();
    const dispose = vi.spyOn(WebGLRenderTarget.prototype, "dispose");
    const renderer = {
      getRenderTarget: () => null,
      setRenderTarget,
      getClearColor: (target: Color) => target,
      getClearAlpha: () => 1,
      setClearColor,
      clear: vi.fn(),
      render: () => {
        throw new Error("imported impostor render failed");
      },
    } as unknown as WebGLRenderer;

    expect(() => createImportedAvatarImpostorSnapshot(scene, renderer)).toThrow(
      "imported impostor render failed",
    );
    expect(setRenderTarget.mock.calls.at(-1)?.[0]).toBeNull();
    expect(setClearColor).toHaveBeenCalledTimes(2);
    expect(scene.parent).toBe(parent);
    expect(dispose).toHaveBeenCalledOnce();
    dispose.mockRestore();
  });

  it("clones selected runtime materials without mutating the shared GLTF source", () => {
    const source = new Group();
    const sharedCore = new MeshStandardMaterial({ color: "#ffffff" });
    const selectedBody = new MeshStandardMaterial({ color: "#d9a07b" });
    const core = new Mesh(undefined, sharedCore);
    core.name = "CORE_CHEST";
    const swatch = new Mesh(undefined, selectedBody);
    swatch.name = "COLOR_SWATCH_warm-light";
    const selectedHead = new Mesh(
      undefined,
      new MeshStandardMaterial({ color: "#ffffff" }),
    );
    selectedHead.name = "HEAD_human_round";
    const unusedHead = new Mesh(
      undefined,
      new MeshStandardMaterial({ color: "#ffffff" }),
    );
    unusedHead.name = "HEAD_cat_shorthair";
    source.add(core, swatch, selectedHead, unusedHead);
    const configured = configureAvatarScene(
      source,
      {
        species: "human",
        head: "round",
        hands: "hands",
        feet: "feet",
        fur: "none",
        tail: "none",
        markings: "solid",
        bodyColor: "warm-light",
        shirt: "Codex",
      },
      "LOD0",
    );
    const configuredCore = configured.getObjectByName("CORE_CHEST") as Mesh;
    expect(configuredCore.material).not.toBe(sharedCore);
    expect(
      (configuredCore.material as MeshStandardMaterial).color.getHexString(),
    ).toBe("d9a07b");
    expect(sharedCore.color.getHexString()).toBe("ffffff");
    expect(configured.getObjectByName("HEAD_human_round")).toBeDefined();
    expect(configured.getObjectByName("HEAD_cat_shorthair")).toBeUndefined();
    expect(
      configured.getObjectByName("COLOR_SWATCH_warm-light"),
    ).toBeUndefined();
  });

  it("physically prunes LOD2 to the selected species shell while retaining the rig root", () => {
    const source = new Group();
    const rig = new Object3D();
    rig.name = "Armature";
    const swatch = new Mesh(
      undefined,
      new MeshStandardMaterial({ color: "#334155" }),
    );
    swatch.name = "COLOR_SWATCH_fur-charcoal";
    const core = new Mesh(
      undefined,
      new MeshStandardMaterial({ color: "#ffffff" }),
    );
    core.name = "CORE_CHEST";
    const selectedBody = new Mesh(
      undefined,
      new MeshStandardMaterial({ color: "#ffffff" }),
    );
    selectedBody.name = "LOD2_BODY_cat";
    const unusedBody = new Mesh(
      undefined,
      new MeshStandardMaterial({ color: "#ffffff" }),
    );
    unusedBody.name = "LOD2_BODY_human";
    const selectedShirt = new Mesh(
      undefined,
      new MeshStandardMaterial({ color: "#ffe066" }),
    );
    selectedShirt.name = "LOD2_SHIRT_Hermes";
    source.add(rig, swatch, core, selectedBody, unusedBody, selectedShirt);
    const configured = configureAvatarScene(
      source,
      {
        species: "cat",
        head: "shorthair",
        hands: "paws",
        feet: "paws",
        fur: "short",
        tail: "cat-straight",
        markings: "socks",
        bodyColor: "fur-charcoal",
        shirt: "Hermes",
      },
      "LOD2",
    );
    expect(configured.getObjectByName("Armature")).toBeDefined();
    expect(configured.getObjectByName("LOD2_BODY_cat")).toBeDefined();
    expect(configured.getObjectByName("LOD2_SHIRT_Hermes")).toBeDefined();
    expect(configured.getObjectByName("LOD2_BODY_human")).toBeUndefined();
    expect(configured.getObjectByName("CORE_CHEST")).toBeUndefined();
    expect(
      configured.getObjectByName("COLOR_SWATCH_fur-charcoal"),
    ).toBeUndefined();
  });

  it("keys configured scene work by selection values and LOD rather than object identity", () => {
    const first = {
      species: "cat",
      head: "shorthair",
      hands: "paws",
      feet: "paws",
      fur: "short",
      tail: "cat-straight",
      markings: "socks",
      bodyColor: "fur-charcoal",
      shirt: "Hermes",
    };
    expect(avatarSelectionKey(first)).toBe(avatarSelectionKey({ ...first }));
    const source = readFileSync(
      new URL("../src/avatar-kit-canvas.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/\[gltf\.scene, lod, selectionKey\]/u);
    expect(source).not.toMatch(/\[gltf, lod, selection\]/u);
  });

  it("applies face, gaze, and anatomical layers while reduced motion freezes only secondary motion", () => {
    expect(
      prepareAvatarLayerApplication({
        base: "Idle",
        upperBody: "Work",
        face: "EyeSquint",
        gaze: "work",
        secondary: "Talk",
        crossfadeSeconds: 0.22,
        secondaryMotion: false,
      }),
    ).toEqual({
      yaw: 0.1,
      pitch: -0.12,
      earPitch: -0.08,
      tailYaw: 0.1,
      face: "EyeSquint",
    });
  });

  it("applies untracked gaze and anatomy offsets without accumulating every frame", () => {
    expect(resolveAvatarLayerRotation(0.25, 0.35, 0.1, false)).toBe(0.35);
    expect(resolveAvatarLayerRotation(0.25, 0.35, 0.1, true)).toBeCloseTo(0.45);
  });

  it("caches layer targets once and applies bounded pose offsets without repeated scene lookup", () => {
    const scene = new Group();
    for (const name of [
      "head",
      "eye.L",
      "eye.R",
      "ear.L.01",
      "ear.R.01",
      "tail.01",
      "tail.02",
      "tail.03",
    ]) {
      const target = new Object3D();
      target.name = name;
      scene.add(target);
    }
    let lookups = 0;
    const originalLookup = scene.getObjectByName.bind(scene);
    scene.getObjectByName = (name: string) => {
      lookups += 1;
      return originalLookup(name);
    };
    const targets = collectAvatarRuntimeTargets(scene);
    const lookupCount = lookups;
    const pose = {
      yaw: 0.1,
      pitch: -0.12,
      earPitch: -0.08,
      tailYaw: 0.1,
      face: null,
    };
    applyAvatarRuntimePose(targets, pose, new Set(), 0.08);
    applyAvatarRuntimePose(targets, pose, new Set(), -0.08);
    expect(lookups).toBe(lookupCount);
    expect(targets.named.head?.rotation.y).toBeCloseTo(0.1);
    expect(targets.named["tail.01"]?.rotation.y).toBeCloseTo(0.02);
  });

  it("uses one mixer and a single full semantic clip for the World LOD2 tier", () => {
    const layer = {
      base: "Idle",
      upperBody: "Work",
      face: "EyeSquint",
      gaze: "work",
      secondary: "Talk",
      crossfadeSeconds: 0.22,
      secondaryMotion: true,
    } as const;
    expect(resolveAvatarMixerPlan(layer, "LOD2")).toEqual({
      base: "Work",
      upperBody: null,
    });
    expect(resolveAvatarMixerPlan(layer, "LOD1")).toEqual({
      base: "Idle",
      upperBody: "Work",
    });
    const source = readFileSync(
      new URL("../src/avatar-kit-canvas.tsx", import.meta.url),
      "utf8",
    );
    expect(source.match(/new AnimationMixer\(scene\)/gu)).toHaveLength(1);
    expect(source).toContain("mixer.update(Math.min(delta, 0.05))");
  });

  it("mounts every prepared instance kind, including focused symbols, in the shared R3F lane", () => {
    expect(RENDER_OBJECT_KINDS).toEqual([
      "package",
      "directory",
      "file",
      "symbol",
    ]);
    expect(REPOSITORY_VISUAL_FAMILIES).toEqual([
      "package-workspace-hub",
      "directory-archive-gate",
      "source-file-code-slab",
      "test-file-beacon",
      "documentation-book",
      "config-control-terminal",
      "data-storage-vault",
      "binary-artifact-crate",
      "symbol-function-node",
    ]);
  });

  it("projects truthful names and kinds into the deterministic semantic visual grammar", () => {
    const base = {
      ref: "aiw://object/00000000000000000000000000000001",
      position: { x: 0, y: 0, z: 0 },
      bounds: { x: 0, z: 0, width: 1, depth: 1 },
    };
    expect(
      [
        ["package-workspace-hub", { ...base, kind: "package", name: "web" }],
        ["directory-archive-gate", { ...base, kind: "directory", name: "src" }],
        ["source-file-code-slab", { ...base, kind: "file", name: "index.ts" }],
        ["test-file-beacon", { ...base, kind: "file", name: "index.test.ts" }],
        ["documentation-book", { ...base, kind: "file", name: "README.md" }],
        [
          "config-control-terminal",
          { ...base, kind: "file", name: "tsconfig.json" },
        ],
        [
          "data-storage-vault",
          { ...base, kind: "file", name: "records.sqlite" },
        ],
        [
          "binary-artifact-crate",
          { ...base, kind: "file", name: "avatar.glb" },
        ],
        [
          "symbol-function-node",
          { ...base, kind: "symbol", name: "prepareWorld" },
        ],
      ].map(
        ([expected, object]) =>
          repositoryVisualFamily(
            object as Parameters<typeof repositoryVisualFamily>[0],
          ) === expected,
      ),
    ).toEqual(Array.from({ length: 9 }, () => true));
    expect(
      repositoryVisualFamily({
        ...base,
        kind: "file",
        name: "opaque.custom",
        fileKind: "test",
        language: "typescript",
        size: 42,
      }),
    ).toBe("test-file-beacon");
  });

  it("groups semantic families with stable shared geometry descriptors and draw-call proxy", () => {
    const objects = [
      "index.ts",
      "index.test.ts",
      "README.md",
      "tsconfig.json",
      "records.sqlite",
      "avatar.glb",
    ].map((name, index) => ({
      ref: `aiw://object/${index.toString(16).padStart(32, "0")}`,
      kind: "file" as const,
      name,
      position: { x: index, y: 0, z: 0 },
      bounds: { x: index, z: 0, width: 1, depth: 1 },
    }));
    const prepared = prepareRepositoryInstances(objects);
    expect(
      Object.values(prepared.groups)
        .filter((group) => group.count > 0)
        .map((group) => group.geometry)
        .sort(),
    ).toEqual(
      [
        "book",
        "code-slab",
        "control-terminal",
        "storage-vault",
        "test-beacon",
        "artifact-crate",
      ].sort(),
    );
    expect(prepared.drawCallProxy).toBe(6);
  });

  it("prepares 10,000 deterministic transforms without DOM materialization", () => {
    const objects = Array.from({ length: 10_000 }, (_, index) => ({
      ref: `aiw://object/${index.toString(16).padStart(32, "0")}`,
      kind: "file" as const,
      name: `file-${index}.unknown`,
      position: { x: index % 100, y: 0, z: Math.floor(index / 100) },
      bounds: {
        x: index % 100,
        z: Math.floor(index / 100),
        width: 1,
        depth: 1,
      },
    }));
    const started = performance.now();
    const prepared = prepareRepositoryInstances(objects);
    const durationMs = performance.now() - started;
    expect(prepared.groups["source-file-code-slab"].count).toBe(10_000);
    expect(prepared.groups["source-file-code-slab"].matrices).toHaveLength(
      160_000,
    );
    expect(durationMs).toBeLessThan(250);
    expect(boundedSemanticObjects(objects, 120)).toHaveLength(120);
  });

  it("reports disabled and creation-failure fallbacks truthfully", () => {
    expect(resolveWebGLCapability({ forceDisabled: true })).toEqual({
      available: false,
      reason: "disabled",
    });
    expect(resolveWebGLCapability({ createContext: () => null })).toEqual({
      available: false,
      reason: "creation-failed",
    });
  });

  it("retains bounded persistent evidence markers independently of motion", () => {
    const prepared = prepareRepositoryInstances([
      {
        ref: "aiw://object/00000000000000000000000000000001",
        kind: "file",
        name: "changed.ts",
        position: { x: 4, y: 0, z: 6 },
        bounds: { x: 3, z: 5, width: 2, depth: 2 },
        evidenceOutcome: "modified",
      },
      {
        ref: "aiw://object/00000000000000000000000000000002",
        kind: "file",
        name: "unchanged.ts",
        position: { x: 8, y: 0, z: 6 },
        bounds: { x: 7, z: 5, width: 2, depth: 2 },
      },
    ]);
    expect(prepared.evidenceMarkers).toEqual([
      {
        ref: "aiw://object/00000000000000000000000000000001",
        outcome: "modified",
        position: [4, 1.96, 6],
      },
    ]);
  });

  it("caps focus-only Phase 10 symbols, edges, total instances, and semantic rows", () => {
    const base = Array.from({ length: 2_000 }, (_, index) => ({
      ref: `aiw://object/${index.toString(16).padStart(32, "0")}`,
      kind: "file" as const,
      name: `file-${index}.ts`,
      position: { x: index % 100, y: 0, z: Math.floor(index / 100) },
      bounds: {
        x: index % 100,
        z: Math.floor(index / 100),
        width: 1,
        depth: 1,
      },
    }));
    const symbols = Array.from({ length: 2_000 }, (_, index) => ({
      ref: `aiw://symbol/${index.toString(16).padStart(32, "0")}`,
      name: `symbol-${index}`,
    }));
    const detail = preparePhase10VisibleDetail({
      baseObjects: base,
      focusedFile: base[0]!,
      symbols,
      dependencies: Array.from({ length: 2_000 }, (_, index) => ({
        ref: `edge-${index}`,
        sourceFileRef: base[0]!.ref,
        candidateRefs: [],
        confidence: ["external"],
      })),
      selectedRef: symbols[700]!.ref,
    });
    expect(detail.prepared.total).toBeLessThanOrEqual(2_000);
    expect(detail.prepared.groups["symbol-function-node"].count).toBe(512);
    expect(detail.visibleDependencyRefs).toHaveLength(1_024);
    expect(detail.semanticSymbols).toHaveLength(200);
    expect(detail.symbolsTruncated).toBe(true);
    expect(detail.dependenciesTruncated).toBe(true);
    expect(detail.selectedRef).toBe(symbols[700]!.ref);
    expect(detail.wholeRepositoryDetailMaterialized).toBe(false);
  });

  it("projects only bounded drawable exact dependency bridges", () => {
    const source = {
      ref: "aiw://object/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      kind: "file" as const,
      name: "source.ts",
      position: { x: 1, y: 0, z: 2 },
      bounds: { x: 1, z: 2, width: 1, depth: 1 },
    };
    const target = {
      ref: "aiw://object/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      kind: "file" as const,
      name: "target.ts",
      position: { x: 8, y: 0, z: 9 },
      bounds: { x: 8, z: 9, width: 1, depth: 1 },
    };
    const detail = preparePhase10VisibleDetail({
      baseObjects: [source, target],
      focusedFile: source,
      symbols: [],
      dependencies: [
        {
          ref: "aiw://dependency/11111111111111111111111111111111",
          sourceFileRef: source.ref,
          candidateRefs: [target.ref],
          confidence: ["exact_file"],
        },
        {
          ref: "aiw://dependency/22222222222222222222222222222222",
          sourceFileRef: source.ref,
          candidateRefs: [],
          confidence: ["external"],
        },
      ],
      selectedRef: source.ref,
    });
    expect(detail.dependencyBridges).toEqual([
      expect.objectContaining({
        ref: "aiw://dependency/11111111111111111111111111111111",
        sourceRef: source.ref,
        targetRef: target.ref,
      }),
    ]);
    expect(detail.visibleDependencyRefs).toHaveLength(2);
  });

  it("caps aggregate repository objects and dependency bridges", () => {
    const objects = Array.from({ length: 2_500 }, (_, index) => ({
      ref: `aiw://object/${index.toString(16).padStart(32, "0")}`,
      kind: "file" as const,
      name: `file-${index}.ts`,
      position: { x: index, y: 0, z: 0 },
      bounds: { x: index, z: 0, width: 1, depth: 1 },
    }));
    const prepared = preparePhase10AggregateView(
      objects,
      Array.from({ length: 1_100 }, (_, index) => ({
        key: `edge-${index}`,
        sourceRef: objects[index]!.ref,
        targetRef: objects[index + 1]!.ref,
        confidence: ["exact_file"],
      })),
    );
    expect(prepared.total).toBe(2_000);
    expect(prepared.dependencyBridges).toHaveLength(1_024);
  });

  it("reuses the decimated 100k aggregate instead of repeating full frame work", () => {
    const objects = Array.from({ length: 100_000 }, (_, index) => ({
      ref: `aiw://object/${index.toString(16).padStart(32, "0")}`,
      kind: "file" as const,
      name: `file-${index}.ts`,
      position: { x: index % 500, y: 0, z: Math.floor(index / 500) },
      bounds: {
        x: index % 500,
        z: Math.floor(index / 500),
        width: 1,
        depth: 1,
      },
    }));
    const dependencies: never[] = [];
    const first = preparePhase10AggregateView(objects, dependencies);
    const samples: number[] = [];
    let latest = first;
    for (let frame = 0; frame < 120; frame += 1) {
      const started = performance.now();
      latest = preparePhase10AggregateView(objects, dependencies);
      samples.push(performance.now() - started);
    }
    const p95 = [...samples].sort((left, right) => left - right)[113]!;

    expect(latest).toBe(first);
    expect(latest.total).toBe(2_000);
    expect(p95).toBeLessThanOrEqual(33.3);
  });
});
