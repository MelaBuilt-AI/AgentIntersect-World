export const REPOSITORY_ASSET_CATEGORIES = [
  "structure",
  "code",
  "version-control",
  "quality",
  "collaboration",
  "knowledge-data",
  "delivery",
] as const;

export type RepositoryAssetCategory =
  (typeof REPOSITORY_ASSET_CATEGORIES)[number];
export type RepositoryCityStatus =
  "idle" | "active" | "pending" | "failure" | "special";

export const REPOSITORY_STATUS_PRESENTATION = Object.freeze({
  idle: { color: "#8aa0ad", label: "Idle / source material", marker: "○" },
  active: { color: "#41e9ff", label: "Active / success", marker: "✓" },
  pending: { color: "#ffbf47", label: "Pending", marker: "…" },
  failure: { color: "#ff4d63", label: "Failure", marker: "!" },
  special: { color: "#b76cff", label: "Merge / deploy", marker: "◆" },
} satisfies Record<
  RepositoryCityStatus,
  { readonly color: string; readonly label: string; readonly marker: string }
>);

const REPOSITORY_ASSET_EFFECTS = Object.freeze({
  materialize: "rise-scan-particles" as const,
  idle: "hover-emissive-pulse" as const,
  reducedMotion: "instant-semantic-marker" as const,
});

type RepositoryAssetSeed = readonly [
  id: string,
  label: string,
  category: RepositoryAssetCategory,
  meaning: string,
  eventTypes: readonly string[],
  glbHash: string,
  pngHash: string,
];

const ASSET_SEEDS = [
  [
    "01-code-slab",
    "Code Slab",
    "code",
    "Current file or code snippet being edited.",
    ["file.created", "file.updated"],
    "fa79db4d984ce667c6cc86a754f41dd5fc14930c8ab5788993407e64b3f553fb",
    "5965754bdd474af0d945f6a3ff24b5ef8808cef22699c1a2ff0e5074131413a7",
  ],
  [
    "02-pull-request-merge-gateway",
    "Pull Request Merge Gateway",
    "version-control",
    "Pull request opened, updated, or merged.",
    ["pull-request.opened", "pull-request.updated", "pull-request.merged"],
    "8cd982ef272f170ac8a04cf575bcaf23553cf5c73c5c9895096eeb3f965d14bd",
    "432e8eb3838d6903e29843641e16c931013dfb5d48d4a3f5c3b759a11d146fa7",
  ],
  [
    "03-branch-splitter",
    "Branch Splitter",
    "version-control",
    "Branch creation, switch, or divergence.",
    ["branch.created", "branch.switched", "branch.diverged"],
    "8294312a48e1630cf1daf5ece2407def909529c6432c6a894878c65f1f946acc",
    "dc35b13360fd693a4800c985cb17a98f080d2fd5da8a295d3b73e5f6c6703165",
  ],
  [
    "04-repository-root-hub",
    "Repository Root Hub",
    "structure",
    "Repository identity, overall activity, and health.",
    ["repository.loaded"],
    "b8196f94ee4619e7de83b55931701b0c9e5ad56a181007e1f8d375c162a00f41",
    "934adf685f7ba77d0ecc835148c305e244412f3696dd464f36b3a184f03e37e4",
  ],
  [
    "05-directory-archive-gate",
    "Directory Archive Gate",
    "structure",
    "Folder and directory structure in the repository.",
    ["directory.discovered"],
    "f1452199c852ddf5712d82f2bfaabb9ff147aa06b95e2e96dac4a24ab178b74d",
    "2734254d37a1f1cd19091a0ef6e20d9e43c2f25bedc8403bf68e58e50c8d7963",
  ],
  [
    "06-test-beacon",
    "Test Beacon",
    "quality",
    "Tests currently running or passing.",
    ["test.running", "test.passed"],
    "54c58416758fbe742ca746bce2c13db4ae2f30b4a44decdfa49e340c895ac99f",
    "329a26710baeeb6e4abaed90ae0689bc790069100c7e97ad34d5ab0cc36b6032",
  ],
  [
    "07-failing-build-alarm",
    "Failing Build Alarm",
    "quality",
    "Failed test, build, or reported error.",
    ["test.failed", "build.failed", "error.detected"],
    "7b10a52c483e4fe65527e65ebd9841d7306c404875a2c3f7d239237570212a15",
    "c6b004d08fa6391dbbae85678fc4f2478c150f7f20161bb048fcf899f149f7ac",
  ],
  [
    "08-documentation-codex",
    "Documentation Codex",
    "knowledge-data",
    "Documentation and written repository knowledge.",
    ["documentation.updated"],
    "1f5aa19ce1a120400f7210c91fdc76999feb852d4107f4876a9cc53c51eb134f",
    "4f18ebe9b0670dcdb6bb3bf6bae306fb9402bca0a880091ecb4bd508b3791d21",
  ],
  [
    "09-configuration-console",
    "Configuration Console",
    "knowledge-data",
    "Configuration, manifests, and settings.",
    ["configuration.updated"],
    "39e97116176dac113d1fc29839116e2e49372cca87830bd8afb3d673c24fc222",
    "d5253d33845af9544b50bdbedfc19eb763deecb958eb5566986dd7fb2745a13f",
  ],
  [
    "10-data-storage-vault",
    "Data Storage Vault",
    "knowledge-data",
    "Data, storage, or database content.",
    ["data.updated"],
    "190b0f337ca07f1ca5d5b3cb4b0ed1b8f5e74fb0232eb6b61ff8aeab0ad99967",
    "880de128b219831aa56da6478df9baa68488796d6b3a8fe0363b9ce1f171307f",
  ],
  [
    "11-binary-artifact-crate",
    "Binary Artifact Crate",
    "delivery",
    "Binary or generated build output artifact.",
    ["artifact.created"],
    "064bbf567f4398fdbe34e969083b807602079627ee711bd64382b678476afcad",
    "3e4ab875fb102d707e18dabb3313ac7c3abf37185a9926b8f8be023d9a155790",
  ],
  [
    "12-function-node",
    "Function Node",
    "code",
    "Focused function, component, or code symbol.",
    ["symbol.focused"],
    "e2dcea6cc2a720bb4692dd5b9050839683ae06e9edd8dd8a6bdc93209da8e03f",
    "f7b9d36570a5c500929cee80c131c8883fe35901a0d63aff8bd9382777f0eced",
  ],
  [
    "13-dependency-bridge",
    "Dependency Bridge",
    "code",
    "Import, package, or dependency relationship.",
    ["dependency.discovered"],
    "0c393281721230aad77ec514b74803d95615257256b23eed42d065d48df14cb0",
    "d1e2efae87c66e9bb77d82486f7f621a1ddc97b1b5cdb029e78593a99aa2496e",
  ],
  [
    "14-commit-marker",
    "Commit Marker",
    "version-control",
    "Commit that leaves a visible project-history trail.",
    ["commit.created"],
    "768a519eb0aab9674a57175c9329bd87fe8a73b2810f9e371b8e2be4023b299e",
    "7b4a05876285ac4267bb255e733a593b6cd8e284e45c365419835a6a30bf2eb2",
  ],
  [
    "15-code-review-station",
    "Code Review Station",
    "collaboration",
    "Active code-review workspace or session.",
    ["review.started", "review.updated"],
    "15a8d9d5489ea32db2831151f3060deef8bf7562b1034c0c8730a300f0c63973",
    "56c94d3f16872fa6606be59b8f0ba762e08b3212c3c8794bc94c39a3bf1d5c26",
  ],
  [
    "16-merge-conflict-cluster",
    "Merge Conflict Cluster",
    "version-control",
    "Merge conflicts requiring resolution.",
    ["merge-conflict.detected"],
    "5d3ed7b5564b1043fdd2ad71f9981bb765cae6c021058637e177ec43b40254c3",
    "1ff0adb1d6f625b529726816be74dc46890f54def0030c2f8e908b9c523bbdc7",
  ],
  [
    "17-issue-tracker-beacon",
    "Issue Tracker Beacon",
    "collaboration",
    "Unresolved issue or reported bug.",
    ["issue.opened", "issue.updated"],
    "b0973f2c2aa5400c928ef289225dc3fc4010d32942521e988637985a9139f65c",
    "ff83d7f38f86dd54f6248565b24815caf9ebcf8c1673400382f302b22a98ba7b",
  ],
  [
    "18-release-launch-capsule",
    "Release Launch Capsule",
    "delivery",
    "Release prepared or published by the repository workflow.",
    ["release.created"],
    "b351119cf2242023c060565262a53394addf0df80df9f80d49739d0e207733f5",
    "82f1901858757d5532d4de2d30703e450ff6ab9ac6c49ee216660f1172f30173",
  ],
  [
    "19-security-access-sentinel",
    "Security Access Sentinel",
    "quality",
    "Security scan or permission and access issue.",
    ["security.scan", "access.issue"],
    "221334cd4a8f7532d01df8cb86c2a0f6726b4d4d5b7eb1bffa3828fdeb1ae833",
    "296c3b73ac890988a3aeb247c935b6cd44675a9e1e4e5aefad95a7fb322342bf",
  ],
  [
    "20-live-collaboration-relay",
    "Live Collaboration Relay",
    "collaboration",
    "User and agent conversation or collaboration activity.",
    ["conversation.activity"],
    "7b0d4da593c944ddfcdf0ad1b28636b2245c194b84db497e790f310611156d44",
    "b1ff12154469f4f42c320e8e45f424846b80c918085c9ae705daf066067ad976",
  ],
  [
    "21-task-intake-kiosk",
    "Task Intake Kiosk",
    "collaboration",
    "Task currently selected for agent work.",
    ["task.selected"],
    "916bac749f224109d3ed5abb682499e87a0ebf1e68ac395d81376e03ca9b1b46",
    "a5e3b020542249ed9345705955f10b2e5a07fcef7f6435fb035bc0a546a47359",
  ],
  [
    "22-search-index-tower",
    "Search Index Tower",
    "knowledge-data",
    "Search or repository indexing activity.",
    ["search.performed", "index.updated"],
    "84ba42eda2bbedb98893df17c35baade72014075194169a0745caf0cc455816f",
    "fa67e2059b871d3e27b46796ac6e318c5dab9c191612405647398b8c17bebc30",
  ],
  [
    "23-diff-projector",
    "Diff Projector",
    "code",
    "Code diff or review projection.",
    ["diff.created"],
    "282c655950796717545f94c1026ed03f6598e6bdf312d343ea31ba1bf2446d03",
    "e2f23d49599f03ae4b0a7df324e366d7cec9609826e301df205a9192fc5bd9d4",
  ],
  [
    "24-ci-pipeline-rail",
    "CI Pipeline Rail",
    "quality",
    "Continuous-integration build stages and progress.",
    ["ci.started", "ci.stage.completed"],
    "6e79e5c338e63197b9fd03a15c4b9ac07f2a35856600222e0542ec2fb1db5da8",
    "68ebe5b8d53cec4023d60067986eb7807c7db4bf3a056929848251d196165993",
  ],
  [
    "25-remote-sync-uplink",
    "Remote Sync Uplink",
    "version-control",
    "Remote fetch, pull, push, or sync state.",
    ["remote.sync"],
    "4e5a0e9aca8c379232aed862d32cd6ccec4f67153e675eab1061991e456d26b6",
    "b7514b6b29e0d4dc431548bf13c85c61059f6a069bceac1423e77c10ca28160f",
  ],
  [
    "26-deployment-portal",
    "Deployment Portal",
    "delivery",
    "Deployment starting or completing.",
    ["deployment.started", "deployment.completed"],
    "53b00b8426984dad27946a82c1fdf77b6ad54541ccd171e60f32d6422d522040",
    "6f434f5580023718c89cd0afcebab4052508ff25d5fb97ed8d8dc4e8ba0da165",
  ],
] as const satisfies readonly RepositoryAssetSeed[];

// Mesh accessor X/Z bounds multiplied by the existing 2.2 runtime scale.
const REPOSITORY_ASSET_FOOTPRINTS = {
  "01-code-slab": [1.41, 0.45],
  "02-pull-request-merge-gateway": [2.2, 1.63],
  "03-branch-splitter": [2.2, 0.79],
  "04-repository-root-hub": [2.18, 2.2],
  "05-directory-archive-gate": [2.2, 0.68],
  "06-test-beacon": [0.91, 0.92],
  "07-failing-build-alarm": [2.2, 2.2],
  "08-documentation-codex": [1.76, 1.14],
  "09-configuration-console": [2.2, 1.86],
  "10-data-storage-vault": [2.03, 1.44],
  "11-binary-artifact-crate": [2.2, 1.71],
  "12-function-node": [2.2, 1.92],
  "13-dependency-bridge": [2.2, 0.96],
  "14-commit-marker": [1.09, 0.98],
  "15-code-review-station": [2.2, 2.2],
  "16-merge-conflict-cluster": [2.2, 1.1],
  "17-issue-tracker-beacon": [2.2, 1.98],
  "18-release-launch-capsule": [1.91, 1.9],
  "19-security-access-sentinel": [1.65, 1.59],
  "20-live-collaboration-relay": [2.2, 0.53],
  "21-task-intake-kiosk": [1.41, 1.14],
  "22-search-index-tower": [1.33, 1.37],
  "23-diff-projector": [1.83, 1.5],
  "24-ci-pipeline-rail": [2.2, 1.2],
  "25-remote-sync-uplink": [1.87, 1.87],
  "26-deployment-portal": [2.2, 2.14],
} as const satisfies Record<
  (typeof ASSET_SEEDS)[number][0],
  readonly [number, number]
>;

export type RepositoryAssetDefinition = {
  readonly id: (typeof ASSET_SEEDS)[number][0];
  readonly label: string;
  readonly category: RepositoryAssetCategory;
  readonly meaning: string;
  readonly inspectorCopy: string;
  readonly glbUrl: string;
  readonly thumbnailUrl: string;
  readonly sourceHashes: { readonly glb: string; readonly png: string };
  readonly eventTypes: readonly string[];
  readonly effects: typeof REPOSITORY_ASSET_EFFECTS;
  readonly statusPresentation: typeof REPOSITORY_STATUS_PRESENTATION;
  readonly defaultScale: number;
  readonly footprint: readonly [number, number];
};

export const REPOSITORY_ASSET_MANIFEST: readonly RepositoryAssetDefinition[] =
  Object.freeze(
    ASSET_SEEDS.map(([id, label, category, meaning, eventTypes, glb, png]) =>
      Object.freeze({
        id,
        label,
        category,
        meaning,
        inspectorCopy: `${meaning} It appears when matching repository activity is observed.`,
        glbUrl: `/assets/repository-city/${id}.glb`,
        thumbnailUrl: `/assets/repository-city/${id}.png`,
        sourceHashes: Object.freeze({ glb, png }),
        eventTypes,
        effects: REPOSITORY_ASSET_EFFECTS,
        statusPresentation: REPOSITORY_STATUS_PRESENTATION,
        defaultScale: 2.2,
        footprint: REPOSITORY_ASSET_FOOTPRINTS[id],
      }),
    ),
  );

export type RepositoryAssetId = RepositoryAssetDefinition["id"];

export const REPOSITORY_ASSET_BY_ID = new Map(
  REPOSITORY_ASSET_MANIFEST.map((asset) => [asset.id, asset]),
);

export const REPOSITORY_ASSET_BY_EVENT = new Map(
  REPOSITORY_ASSET_MANIFEST.flatMap((asset) =>
    asset.eventTypes.map((eventType) => [eventType, asset] as const),
  ),
);
