import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("imported avatar deterministic intake", () => {
  const repositoryRoot = new URL("../..", import.meta.url);
  const replacementIds = [
    ...Array.from({ length: 7 }, (_, index) => `cat-agent-0${index + 1}`),
    ...Array.from({ length: 5 }, (_, index) => `dog-agent-0${index + 1}`),
    ...Array.from({ length: 5 }, (_, index) => `robot-agent-0${index + 1}`),
    ...Array.from({ length: 3 }, (_, index) => `user-male-0${index + 1}`),
    ...Array.from({ length: 3 }, (_, index) => `user-female-0${index + 1}`),
  ];

  it("checks exactly 23 repository-owned replacement assets without private source folders", () => {
    const output = execFileSync(
      "python3",
      ["tooling/avatar/inspect_imported_avatars.py", "--check"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
      },
    );
    expect(output).toContain(
      "verified 23 repository-owned replacement avatars; manifest and runtime registry are deterministic",
    );
    expect(output).not.toMatch(/\/mnt\/|Codex|3D avatars|source folder/iu);
  });

  it("keeps source inventory selection explicit and machine-independent", () => {
    const inspectorSource = readFileSync(
      new URL("inspect_imported_avatars.py", import.meta.url),
      "utf8",
    );
    expect(inspectorSource).not.toContain("DEFAULT_SOURCE_INVENTORY");
    expect(inspectorSource).not.toMatch(
      /\/home\/|\/mnt\/|[A-Z]:\\\\Users\\\\/u,
    );
  });

  it("ships only sanitized GLBs and stance thumbnails for the replacement IDs", () => {
    const assetDirectory = new URL(
      "apps/web/public/assets/imported-avatars/",
      repositoryRoot,
    );
    const files = readdirSync(assetDirectory).sort();
    expect(files).toEqual(
      [
        ...replacementIds.flatMap((id) => [
          `${id}.glb`,
          `${id}${id === "robot-agent-01" ? ".jpg" : ".png"}`,
        ]),
        "manifest.json",
      ].sort(),
    );
    expect(files).not.toEqual(
      expect.arrayContaining([
        "cat-agent.glb",
        "cat-agent.png",
        "futuristic-robot.glb",
        "futuristic-robot.png",
        "user-male.glb",
        "user-male.png",
      ]),
    );
  });

  it("records all replacement IDs, byte/hash bindings, roles, and no private paths", () => {
    const manifest = JSON.parse(
      readFileSync(
        new URL(
          "apps/web/public/assets/imported-avatars/manifest.json",
          repositoryRoot,
        ),
        "utf8",
      ),
    ) as {
      readonly assets: readonly {
        readonly id: string;
        readonly sourceSha256: string;
        readonly sha256: string;
        readonly byteSize: number;
        readonly originalRole: string;
      }[];
    };
    expect(manifest.assets.map((asset) => asset.id)).toEqual(replacementIds);
    expect(
      manifest.assets.every(
        (asset) =>
          asset.sourceSha256 === asset.sha256 &&
          /^[a-f0-9]{64}$/u.test(asset.sha256) &&
          asset.byteSize > 0 &&
          (asset.originalRole === "user" || asset.originalRole === "agent"),
      ),
    ).toBe(true);
    expect(JSON.stringify(manifest)).not.toMatch(
      /\/mnt\/|Codex|3D avatars|sourceRoots/iu,
    );
  });

  it("plans dense runtime-refused pose evidence for all 23 models and explicit variants", () => {
    const plan = JSON.parse(
      execFileSync(
        "python3",
        ["tooling/avatar/render_replacement_pose_catalog.py", "--dry-run"],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
        },
      ),
    ) as {
      readonly schema: string;
      readonly samplesPerClip: number;
      readonly modelIds: readonly string[];
      readonly variantsWith22Clips: readonly string[];
      readonly classificationStatus: string;
    };
    expect(plan).toEqual({
      schema: "aiw.replacement-avatar-pose-catalog-plan/1",
      samplesPerClip: 7,
      modelIds: replacementIds,
      variantsWith22Clips: ["cat-agent-06", "robot-agent-02", "user-male-01"],
      classificationStatus:
        "runtime-refused-until-visual-and-motion-verification",
    });
    const renderer = readFileSync(
      new URL(
        "tooling/avatar/render_replacement_pose_sheet.py",
        repositoryRoot,
      ),
      "utf8",
    );
    expect(renderer).toContain("default=7");
    expect(renderer).toContain(
      '"schema": "aiw.replacement-avatar-pose-evidence/2"',
    );
    expect(renderer).toContain('"sampleLabels"');
    expect(renderer).toContain('"evidence-index.html"');
    expect(renderer).toContain("current.to_mesh()");
    expect(renderer).toContain("union_bounds(sampled_bounds)");
    expect(renderer).toContain("maximum_centered_extent(sampled_bounds)");
    expect(renderer).toContain("frame_minimum, frame_maximum = frame_bounds");
    expect(renderer).toContain("clip_ortho_scale,");
    expect(renderer).toContain('camera.data.type = "ORTHO"');
    expect(renderer).toContain("camera.data.ortho_scale");
    expect(renderer).toContain("render_with_timeout");
    expect(renderer).toContain('"render-progress.json"');
    expect(renderer).toContain('"pose-evidence.partial.json"');

    const catalog = readFileSync(
      new URL(
        "tooling/avatar/render_replacement_pose_catalog.py",
        repositoryRoot,
      ),
      "utf8",
    );
    expect(catalog).toContain("start_new_session=True");
    expect(catalog).toContain("terminate_process_tree");
    expect(catalog).toContain("os.killpg");
    expect(catalog).toContain("subprocess.TimeoutExpired");
    expect(catalog).toContain('"catalog-progress.json"');
    expect(catalog).toContain("--frame-timeout-seconds");
    expect(catalog).toContain("--model-timeout-seconds");
    expect(catalog).toContain("--catalog-timeout-seconds");
  });
});
