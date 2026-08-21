import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Page,
  type Request,
  type Response,
  type Route,
} from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { REPOSITORY_ASSET_BY_ID } from "../../../packages/renderer-r3f/src/repository-asset-manifest.js";
import { projectRepositoryObjects } from "../../../packages/renderer-r3f/src/repository-city-state.js";
import type { RepositoryRenderObject } from "../../../packages/renderer-r3f/src/index.js";
import { seedConfiguredAvatar } from "./helpers.js";

const configuredEvidenceDirectory = process.env.AIW_PHASE19_TASK12_EVIDENCE_DIR;
if (!configuredEvidenceDirectory)
  throw new Error("AIW_PHASE19_TASK12_EVIDENCE_DIR is required.");
const evidenceDirectory: string = configuredEvidenceDirectory;

const ref = (value: string) => `aiw://object/${value.padStart(32, "0")}`;
const generationFingerprint = "f".repeat(64);
const layoutGeneration = `layout-${generationFingerprint}`;
const objectA = ref("a");
const objectB = ref("b");
const objectC = ref("c");

const snapshot = {
  schema: "aiw.world/0.4",
  identityVersion: "aiw.identity/1",
  layoutVersion: "aiw.layout/grid/1",
  snapshotId: "1".repeat(32),
  generationFingerprint,
  workspaceRef: ref("1"),
  repositoryRef: ref("2"),
  objects: [
    {
      kind: "workspace",
      id: "1".repeat(32),
      ref: ref("1"),
      name: "Task 12 workspace",
      parentRef: null,
      childRefs: [ref("2")],
      position: { x: 0, y: 0, z: 0 },
      bounds: { x: 0, z: 0, width: 24, depth: 24 },
    },
    {
      kind: "repository",
      id: "2".repeat(32),
      ref: ref("2"),
      name: "AgentIntersect World",
      parentRef: ref("1"),
      childRefs: [ref("3")],
      position: { x: 0, y: 0, z: 0 },
      bounds: { x: 0, z: 0, width: 20, depth: 20 },
    },
    {
      kind: "package",
      id: "3".repeat(32),
      ref: ref("3"),
      name: "@agentintersect-world/web",
      parentRef: ref("2"),
      childRefs: [ref("4")],
      path: "apps/web",
      packageKind: "npm",
      packageName: "@agentintersect-world/web",
      position: { x: 2, y: 0, z: 2 },
      bounds: { x: 1, z: 1, width: 2, depth: 2 },
    },
    {
      kind: "directory",
      id: "4".repeat(32),
      ref: ref("4"),
      name: "world-entry",
      parentRef: ref("3"),
      childRefs: [objectA, objectB, objectC],
      path: "apps/web/src/world-entry",
      fileCount: 3,
      position: { x: 6, y: 0, z: 2 },
      bounds: { x: 5, z: 1, width: 2, depth: 2 },
    },
    {
      kind: "file",
      id: "a".repeat(32),
      ref: objectA,
      name: "WorldEntryExperience.tsx",
      parentRef: ref("4"),
      childRefs: [],
      path: "apps/web/src/world-entry/WorldEntryExperience.tsx",
      size: 52_000,
      fileKind: "source",
      language: "typescript",
      contentHash: "a".repeat(64),
      pathHistory: [],
      position: { x: 2, y: 0, z: 8 },
      bounds: { x: 1, z: 7, width: 2, depth: 2 },
    },
    {
      kind: "file",
      id: "b".repeat(32),
      ref: objectB,
      name: "WorldRoom.tsx",
      parentRef: ref("4"),
      childRefs: [],
      path: "apps/web/src/world-entry/WorldRoom.tsx",
      size: 58_000,
      fileKind: "source",
      language: "typescript",
      contentHash: "b".repeat(64),
      pathHistory: [],
      position: { x: 6, y: 0, z: 8 },
      bounds: { x: 5, z: 7, width: 2, depth: 2 },
    },
    {
      kind: "file",
      id: "c".repeat(32),
      ref: objectC,
      name: "agent-work-focus-model.ts",
      parentRef: ref("4"),
      childRefs: [],
      path: "apps/web/src/world-entry/agent-work-focus-model.ts",
      size: 4_200,
      fileKind: "source",
      language: "typescript",
      contentHash: "c".repeat(64),
      pathHistory: [],
      position: { x: 10, y: 0, z: 8 },
      bounds: { x: 9, z: 7, width: 2, depth: 2 },
    },
  ],
  tiles: [],
  limits: {
    fullDetailFiles: 10_000,
    maxTileRecords: 128,
    maxPathHistory: 8,
    maxTombstones: 256,
  },
} as const;

const renderedRepositoryObjects = snapshot.objects.flatMap((object) =>
  object.kind === "package" ||
  object.kind === "directory" ||
  object.kind === "file"
    ? [object as RepositoryRenderObject]
    : [],
);
const cityInstances = projectRepositoryObjects(renderedRepositoryObjects);

type AdapterId = "hermes" | "codex" | "claude-code";
type AgentFixture = {
  readonly adapterId: AdapterId;
  readonly displayName: string;
  readonly sessionId: string;
  readonly adapterSessionRef: string;
};
type FixtureFocus = {
  readonly activityId: string;
  readonly objectRef: string;
  readonly repositoryPath: string;
  readonly requestId: string;
  readonly state:
    | "targeted"
    | "navigating"
    | "coding"
    | "completed"
    | "failed"
    | "cancelled"
    | "stale";
};
type FixtureMovement = {
  readonly requestId: string;
  readonly objectRef: string;
  readonly layoutGeneration: string;
  readonly speed: number;
  readonly sequence: number;
};
type RosterAgent = {
  readonly rosterId: string;
  readonly adapterId: AdapterId;
  readonly sessionOwnership: "operator-persistent" | "world-owned";
  readonly worldSessionId: string;
  readonly worldInstanceId: string;
  readonly nativeRootSessionRef: string;
  readonly displayName: string;
  readonly continuity:
    "current" | "previous-recovered" | "stale" | "unavailable";
  readonly connection: "connecting" | "connected" | "stale" | "unavailable";
  readonly avatar: {
    readonly status: "missing" | "editing" | "accepted";
    readonly profileId: string | null;
    readonly sessionId: string | null;
  };
  readonly addedOrder: number;
};
type BrowserIssues = {
  responses: string[];
  requestFailures: string[];
  consoleErrors: string[];
  pageErrors: string[];
  unexpectedFixtureRoutes: string[];
};
type SceneObservation = {
  readonly capturedAt: string;
  readonly renderer: "procedural" | "imported" | "semantic";
  readonly workStates: Readonly<
    Record<string, { readonly state: string; readonly objectRef: string }>
  >;
  readonly positions: Readonly<
    Record<string, { readonly x: number; readonly z: number }>
  >;
  readonly agentRows: readonly string[];
  readonly roomWorkState: string | null;
  readonly roomObjectRef: string | null;
  readonly renderLoopMode: string | null;
  readonly mixerTime: string | null;
};
type Receipt = {
  schema: "aiw.phase19-task12-headed-observation/1";
  caseId: string;
  startedAt: string;
  expectedRenderer: "procedural" | "imported" | "semantic";
  viewport: { width: number; height: number };
  reducedMotion: boolean;
  agents: readonly AgentFixture[];
  layoutGeneration: string;
  objects: readonly string[];
  observations: Array<{ label: string; scene: SceneObservation }>;
  checks: Array<{ label: string; passed: boolean; detail?: unknown }>;
  screenshots: string[];
  axe: Array<{ id: string; impact: string | null }>;
  transitions: Array<{
    actorId: string;
    requestId: string;
    operation: string;
    body: unknown;
  }>;
  reconnectObserved: boolean;
  reorderedServerProjectionObserved: boolean;
  issues: BrowserIssues;
  finishedAt?: string;
};

const desktopAgents: readonly [AgentFixture, AgentFixture] = [
  {
    adapterId: "codex",
    displayName: "Codex",
    sessionId: "11000000-0000-4000-8000-000000000001",
    adapterSessionRef: "codex-task12-a",
  },
  {
    adapterId: "claude-code",
    displayName: "Claude",
    sessionId: "22000000-0000-4000-8000-000000000002",
    adapterSessionRef: "claude-task12-b",
  },
] as const;
const importedAgents: readonly [AgentFixture, AgentFixture] = [
  {
    adapterId: "hermes",
    displayName: "Mr Fluff",
    sessionId: "33000000-0000-4000-8000-000000000003",
    adapterSessionRef: "native-mr-fluff-task12",
  },
  {
    adapterId: "codex",
    displayName: "Codex",
    sessionId: "44000000-0000-4000-8000-000000000004",
    adapterSessionRef: "codex-task12-imported",
  },
] as const;

const envelope = (data: unknown) => ({
  ok: true,
  data,
  meta: {
    correlationId: "99000000-0000-4000-8000-000000000009",
    schema: "aiw.api/0.3",
  },
});

const sessionFor = (agent: AgentFixture) => ({
  schema: "aiw.agent-session/0.12",
  sessionId: agent.sessionId,
  adapterId: agent.adapterId,
  adapterSessionRef: agent.adapterSessionRef,
  adapterRootSessionRef: agent.adapterSessionRef,
  profile: "default",
  workspaceId: "world-entry",
  repositoryRef: "current",
  mode: "explore",
  permissionRevision: 0,
  capabilitySnapshotHash: "d".repeat(64),
  continuity: "current",
  status: "ready",
});

const hermesProposal = (agent: AgentFixture) => ({
  schema: "aiw.avatar-proposal/0.12",
  proposalId: "55000000-0000-4000-8000-000000000005",
  sessionId: agent.sessionId,
  displayName: agent.displayName,
  species: "cat",
  head: "cat",
  hands: "paws",
  feet: "paws",
  fur: "short",
  tail: "cat",
  markings: "tuxedo",
  bodyColor: "charcoal",
  shirt: "Hermes",
  movementStyle: "shared-biped-core",
  sourceDisclosure: "Bounded local Task 12 fixture proposal.",
  rationale: "Explicit imported-avatar headed acceptance path.",
  createdAt: "2026-08-19T12:00:00.000Z",
  avatarSource: {
    kind: "imported",
    version: 2,
    mode: "original",
    modelId: "cat-agent-01",
  },
});

function monitorBrowser(
  page: Page,
  expectedNotFoundPaths: readonly string[] = [],
): BrowserIssues {
  const issues: BrowserIssues = {
    responses: [],
    requestFailures: [],
    consoleErrors: [],
    pageErrors: [],
    unexpectedFixtureRoutes: [],
  };
  page.on("response", (response: Response) => {
    const expectedNotFound =
      response.status() === 404 &&
      expectedNotFoundPaths.includes(new URL(response.url()).pathname);
    if (response.status() >= 400 && !expectedNotFound)
      issues.responses.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request: Request) => {
    issues.requestFailures.push(
      `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`,
    );
  });
  page.on("console", (message) => {
    const expectedNotFound = expectedNotFoundPaths.includes(
      new URL(message.location().url || "http://fixture.invalid").pathname,
    );
    if (message.type() === "error" && !expectedNotFound)
      issues.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => issues.pageErrors.push(error.message));
  return issues;
}

function fixtureFocus(
  agent: AgentFixture,
  focus: FixtureFocus,
): Record<string, unknown> {
  return {
    schema: "aiw.agent-work-focus/0.19",
    activityId: focus.activityId,
    rosterId: agent.sessionId,
    worldSessionId: agent.sessionId,
    repositoryRef: snapshot.repositoryRef,
    objectRef: focus.objectRef,
    objectKind: "file",
    repositoryPath: focus.repositoryPath,
    layoutGeneration,
    movementRequestId: focus.requestId,
    source: "structured-tool-event",
    state: focus.state,
  };
}

function movementAuthority(
  agent: AgentFixture,
  movement: FixtureMovement | null,
) {
  if (!movement)
    return { capability: { enabled: true }, actions: [], executions: [] };
  const now = Date.now();
  return {
    capability: { enabled: true },
    actions: [
      {
        actionId: movement.requestId,
        kind: "move-agent",
        state: "path-planned",
        reason: "structured repository work focus",
      },
    ],
    executions: [
      {
        accepted: true,
        envelope: {
          schema: "aiw.world-action/0.13",
          requestId: "66000000-0000-4000-8000-000000000006",
          batchId: "77000000-0000-4000-8000-000000000007",
          sessionId: agent.sessionId,
          adapterSessionRef: agent.adapterSessionRef,
          repositoryRef: snapshot.repositoryRef,
          worldGeneration: "world-task12-headed",
          layoutGeneration: movement.layoutGeneration,
          graphGeneration: null,
          capabilitySnapshotHash: "d".repeat(64),
          sequence: movement.sequence,
          createdAt: new Date(now - 1_000).toISOString(),
          expiresAt: new Date(now + 60_000).toISOString(),
          actions: [
            {
              kind: "move-agent",
              schema: "aiw.agent-movement/1",
              actionId: movement.requestId,
              actorId: agent.sessionId,
              source: "agent-autonomous",
              speed: movement.speed,
              target: {
                kind: "repository-object",
                objectId: movement.objectRef,
                layoutGeneration: movement.layoutGeneration,
              },
            },
          ],
        },
      },
    ],
  };
}

async function installTwoAgentFixture(
  page: Page,
  agents: readonly AgentFixture[],
  issues: BrowserIssues,
  requireReconnect: boolean,
) {
  const worldInstanceId = "88000000-0000-4000-8000-000000000008";
  let roster: RosterAgent[] = [];
  let revision = 0;
  let reconnectObserved = false;
  let reorderedServerProjectionObserved = false;
  const focuses = new Map<string, FixtureFocus | null>();
  const movements = new Map<string, FixtureMovement | null>();
  const transitions: Receipt["transitions"] = [];
  const projection = () => ({
    projection: {
      schema: "aiw.constellation/0.19",
      mode: "multi-agent",
      worldInstanceId,
      lifecycle: "assembling",
      revision,
      agents: roster,
      entryReady:
        roster.length === 2 &&
        roster.every(
          (agent) =>
            agent.connection === "connected" &&
            agent.avatar.status === "accepted",
        ),
      truth: "current",
    },
    terminalOutcomes: [],
    unavailableReason: null,
  });
  const fulfillJson = (route: Route, data: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    if (pathname.endsWith("/agent-sessions/capabilities")) {
      await fulfillJson(
        route,
        envelope(
          agents.map((agent) => ({
            adapterId: agent.adapterId,
            capabilities: {
              attach: true,
              create: true,
              sendText: true,
              streamDeltas: true,
            },
            unavailable: {},
          })),
        ),
      );
      return;
    }
    if (pathname.endsWith("/agent-sessions/native")) {
      const hermes = agents.find((agent) => agent.adapterId === "hermes");
      await fulfillJson(
        route,
        envelope(
          hermes
            ? [
                {
                  id: hermes.adapterSessionRef,
                  source: "cli",
                  title: hermes.displayName,
                  displayName: hermes.displayName,
                  messageCount: 12,
                },
              ]
            : [],
        ),
      );
      return;
    }
    if (pathname.endsWith("/agent-sessions/attach") && method === "POST") {
      const agent = agents.find(
        (candidate) => candidate.adapterId === "hermes",
      );
      await fulfillJson(route, envelope(sessionFor(agent!)));
      return;
    }
    if (pathname.endsWith("/agent-sessions/world") && method === "POST") {
      const body = request.postDataJSON() as { readonly adapterId?: string };
      const agent = agents.find(
        (candidate) => candidate.adapterId === body.adapterId,
      );
      await fulfillJson(route, envelope(sessionFor(agent!)));
      return;
    }
    const statusMatch = pathname.match(/\/agent-sessions\/([^/]+)\/status$/u);
    if (statusMatch && method === "GET") {
      const sessionId = decodeURIComponent(statusMatch[1]!);
      const rosterAgent = roster.find(
        (candidate) => candidate.worldSessionId === sessionId,
      );
      if (requireReconnect && rosterAgent?.connection === "stale") {
        await fulfillJson(route, { error: "stale session unavailable" }, 404);
        return;
      }
      const agent = agents.find(
        (candidate) => candidate.sessionId === sessionId,
      );
      await fulfillJson(route, envelope(sessionFor(agent!)));
      return;
    }
    const sessionMatch = pathname.match(
      /\/agent-sessions\/([^/]+)\/(history|avatar-proposal|avatar-consent|work-focus)$/u,
    );
    if (sessionMatch) {
      const sessionId = decodeURIComponent(sessionMatch[1]!);
      const operation = sessionMatch[2]!;
      const agent = agents.find(
        (candidate) => candidate.sessionId === sessionId,
      )!;
      if (operation === "history") {
        await fulfillJson(
          route,
          envelope({
            sessionId,
            continuity: "current",
            messages: [],
            transcriptAuthority: agent.adapterId,
            avatarConsent: null,
          }),
        );
      } else if (operation === "avatar-proposal") {
        await fulfillJson(
          route,
          envelope(agent.adapterId === "hermes" ? hermesProposal(agent) : null),
        );
      } else if (operation === "avatar-consent") {
        await fulfillJson(route, envelope({ state: "accepted" }));
      } else {
        const focus = focuses.get(sessionId) ?? null;
        await fulfillJson(
          route,
          envelope({ focus: focus ? fixtureFocus(agent, focus) : null }),
        );
      }
      return;
    }
    if (pathname.endsWith("/constellation/current") && method === "GET") {
      await fulfillJson(route, envelope(projection()));
      return;
    }
    if (pathname.endsWith("/constellation/agents") && method === "POST") {
      const body = request.postDataJSON() as {
        readonly agent: Omit<
          RosterAgent,
          | "worldInstanceId"
          | "continuity"
          | "connection"
          | "avatar"
          | "addedOrder"
        >;
      };
      roster = [
        ...roster,
        {
          ...body.agent,
          worldInstanceId,
          continuity: "current",
          connection: "connected",
          avatar: { status: "missing", profileId: null, sessionId: null },
          addedOrder: roster.length,
        },
      ];
      revision += 1;
      await fulfillJson(route, envelope(projection()), 201);
      return;
    }
    const constellationMatch = pathname.match(
      /\/constellation\/agents\/([^/]+)\/(avatar|reconnect)$/u,
    );
    if (constellationMatch) {
      const rosterId = decodeURIComponent(constellationMatch[1]!);
      const operation = constellationMatch[2]!;
      if (operation === "avatar") {
        const body = request.postDataJSON() as {
          readonly avatar: RosterAgent["avatar"];
        };
        roster = roster.map((agent) =>
          agent.rosterId === rosterId
            ? { ...agent, avatar: body.avatar }
            : agent,
        );
        if (
          requireReconnect &&
          roster.length === 2 &&
          roster.every((agent) => agent.avatar.status === "accepted")
        )
          roster = roster.map((agent): RosterAgent =>
            agent.rosterId === rosterId
              ? {
                  ...agent,
                  continuity: "stale",
                  connection: "stale",
                }
              : agent,
          );
      } else {
        reconnectObserved = true;
        roster = roster
          .map((agent): RosterAgent =>
            agent.rosterId === rosterId
              ? {
                  ...agent,
                  continuity: "current",
                  connection: "connected",
                }
              : agent,
          )
          .reverse();
        reorderedServerProjectionObserved = roster[0]?.addedOrder === 1;
      }
      revision += 1;
      await fulfillJson(route, envelope(projection()));
      return;
    }
    if (pathname.endsWith("/repository-indexes") && method === "POST") {
      await fulfillJson(
        route,
        envelope({
          id: "aa000000-0000-4000-8000-00000000000a",
          rootPath: ".",
          status: "succeeded",
          generation: {
            id: "bb000000-0000-4000-8000-00000000000b",
            fingerprint: generationFingerprint,
            rootPath: ".",
            repositoryName: "task12-fixture",
            startedAt: "2026-08-19T12:00:00.000Z",
            completedAt: "2026-08-19T12:00:01.000Z",
            durationMs: 1_000,
            git: { present: false, branch: null, head: null, dirty: false },
            directories: [],
            files: [],
            packages: [],
            coverage: {
              discoveredFiles: 3,
              indexedFiles: 3,
              prunedEntries: 0,
              skippedSymlinks: 0,
              directories: 1,
              packages: 1,
              binaryFiles: 0,
              oversizedFiles: 0,
              bytesHashed: 114_200,
            },
          },
          createdAt: "2026-08-19T12:00:00.000Z",
          updatedAt: "2026-08-19T12:00:01.000Z",
          progress: {
            phase: "complete",
            discoveredFiles: 3,
            indexedFiles: 3,
            bytesHashed: 114_200,
          },
        }),
        201,
      );
      return;
    }
    if (pathname.endsWith("/world/current") && method === "GET") {
      await fulfillJson(route, envelope({ snapshot }));
      return;
    }
    const worldActionTransition = pathname.match(
      /\/world-actions\/([^/]+)\/actions\/([^/]+)\/(transition|cancel)$/u,
    );
    if (worldActionTransition && method === "POST") {
      transitions.push({
        actorId: decodeURIComponent(worldActionTransition[1]!),
        requestId: decodeURIComponent(worldActionTransition[2]!),
        operation: worldActionTransition[3]!,
        body: request.postDataJSON(),
      });
      await fulfillJson(route, {});
      return;
    }
    const worldActionMatch = pathname.match(/\/world-actions\/([^/]+)$/u);
    if (worldActionMatch && method === "GET") {
      const sessionId = decodeURIComponent(worldActionMatch[1]!);
      const agent = agents.find(
        (candidate) => candidate.sessionId === sessionId,
      )!;
      await fulfillJson(
        route,
        movementAuthority(agent, movements.get(sessionId) ?? null),
      );
      return;
    }
    issues.unexpectedFixtureRoutes.push(`${method} ${pathname}`);
    await fulfillJson(
      route,
      { error: "unexpected Task 12 fixture route" },
      404,
    );
  });

  return {
    agents,
    focuses,
    movements,
    transitions,
    get roster() {
      return roster;
    },
    get reconnectObserved() {
      return reconnectObserved;
    },
    get reorderedServerProjectionObserved() {
      return reorderedServerProjectionObserved;
    },
  };
}

async function connectTwoAgents(
  page: Page,
  agents: readonly AgentFixture[],
  requireReconnect: boolean,
) {
  await seedConfiguredAvatar(page, "Aaron");
  await page.goto("/");
  await page.getByRole("button", { name: /Multi Agent/u }).click();
  for (const [index, agent] of agents.entries()) {
    const harnessLabel =
      agent.adapterId === "claude-code"
        ? "Connect claude"
        : `Connect ${agent.adapterId}`;
    await page.getByRole("button", { name: harnessLabel }).click();
    const agentName = page.getByLabel("Agent name");
    await expect(agentName).toBeVisible();
    await agentName.fill(agent.displayName);
    await agentName.press("Enter");
    await expect(
      page.getByRole("heading", {
        name: `Create ${agent.displayName}’s avatar`,
      }),
    ).toBeVisible();
    await page.getByLabel("Required agent name").fill(agent.displayName);
    await page.getByRole("button", { name: "Use Complete Avatar" }).click();
    const accept = page.getByRole("button", { name: "Accept and save avatar" });
    await expect(accept).toBeEnabled();
    await accept.click();
    const expectedConnection =
      requireReconnect && index === agents.length - 1 ? "stale" : "connected";
    const expectedTruth = expectedConnection === "stale" ? "Stale" : "Current";
    const expectedLabel = `${agent.displayName} · ${agent.adapterId} · ${expectedTruth}`;
    const rosterEntry = page
      .getByRole("region", { name: "Connected agent constellation" })
      .locator(`li[data-connection="${expectedConnection}"]`)
      .filter({ hasText: expectedLabel });
    await expect(rosterEntry).toHaveCount(1);
    await expect(rosterEntry).toContainText(expectedLabel);
    if (index < agents.length - 1) {
      await expect(
        page.getByRole("button", { name: /Multi Agent/u }),
      ).toBeVisible();
    }
  }
  if (requireReconnect) {
    const reconnect = page.getByRole("button", { name: "Reconnect" });
    await expect(reconnect).toBeVisible();
    await reconnect.click();
  }
  const enter = page.locator('button:has-text("Enter World"):not([disabled])');
  await expect(enter).toHaveCount(1);
  await enter.click();
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "blank",
  );
}

async function loadRepository(page: Page) {
  const chat = page.locator("form.world-chat");
  const composer = chat.getByRole("textbox");
  await composer.fill("/repo load .");
  await chat.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "repository",
    { timeout: 30_000 },
  );
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-repository-readiness",
    "ready",
    { timeout: 30_000 },
  );
}

async function readScene(page: Page): Promise<SceneObservation> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>(
      '[data-testid="world-room-canvas"]',
    );
    const room = document.querySelector<HTMLElement>("main.world-room");
    const agentElements = [
      ...document.querySelectorAll<HTMLElement>(".world-room__avatars li"),
    ].slice(1);
    const agentRows = agentElements.map((element) =>
      element.innerText.replace(/\s+/gu, " ").trim(),
    );
    const positions: Record<string, { x: number; z: number }> = {};
    for (const row of agentRows) {
      const match = row.match(
        /^(.+?)(?: · coding at \S+)? · connected agent avatar · position (-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/u,
      );
      if (match)
        positions[match[1]!] = { x: Number(match[2]), z: Number(match[3]) };
    }
    const workStates: Record<string, { state: string; objectRef: string }> = {};
    for (const value of (canvas?.dataset.agentWorkStates ?? "").split("|")) {
      if (!value) continue;
      const [rosterId, state, ...objectParts] = value.split(":");
      if (rosterId && state)
        workStates[rosterId] = {
          state,
          objectRef: objectParts.join(":"),
        };
    }
    if (!canvas)
      for (const element of agentElements) {
        const rosterId = element.dataset.rosterId;
        const state = element.dataset.workState;
        if (rosterId && state)
          workStates[rosterId] = {
            state,
            objectRef: element.dataset.objectRef ?? "",
          };
      }
    return {
      capturedAt: new Date().toISOString(),
      renderer: canvas
        ? canvas.hasAttribute("data-agent-avatar-source")
          ? "imported"
          : "procedural"
        : "semantic",
      workStates,
      positions,
      agentRows,
      roomWorkState: room?.dataset.agentWorkState ?? null,
      roomObjectRef: room?.dataset.agentObjectRef ?? null,
      renderLoopMode: canvas?.dataset.renderLoopMode ?? null,
      mixerTime: canvas?.dataset.agentAvatarMixerTime ?? null,
    };
  });
}

async function observeUntil(
  page: Page,
  receipt: Receipt,
  label: string,
  predicate: (scene: SceneObservation) => boolean,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  let scene = await readScene(page);
  while (Date.now() < deadline && !predicate(scene)) {
    receipt.observations.push({ label: `${label}:sample`, scene });
    await page.waitForTimeout(100);
    scene = await readScene(page);
  }
  receipt.observations.push({ label, scene });
  return scene;
}

function addCheck(
  receipt: Receipt,
  label: string,
  passed: boolean,
  detail?: unknown,
) {
  receipt.checks.push({
    label,
    passed,
    ...(detail === undefined ? {} : { detail }),
  });
}

async function captureScreenshots(page: Page, receipt: Receipt, label: string) {
  const normal = resolve(
    evidenceDirectory,
    `${receipt.caseId}-${label}-normal-ui.png`,
  );
  await page.screenshot({ path: normal });
  receipt.screenshots.push(normal);
  const style = await page.addStyleTag({
    content:
      ".world-hud, .repository-assets { visibility: hidden !important; }",
  });
  const bodies = resolve(
    evidenceDirectory,
    `${receipt.caseId}-${label}-body-only-overlays-hidden.png`,
  );
  await page.screenshot({ path: bodies });
  await style.evaluate((element) => element.parentNode?.removeChild(element));
  receipt.screenshots.push(bodies);
}

async function viewportGeometry(page: Page) {
  return page.evaluate(() => {
    const selectors = [
      ".world-room__agent-target",
      ".world-hud",
      ".world-hud button",
      ".world-hud input",
      ".world-hud textarea",
      '[data-testid="world-room-canvas"]',
    ];
    const viewport = {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };
    const bounds = selectors.flatMap((selector) =>
      [...document.querySelectorAll<HTMLElement>(selector)].map((element) => {
        const rectangle = element.getBoundingClientRect();
        return {
          selector,
          left: rectangle.left,
          top: rectangle.top,
          right: rectangle.right,
          bottom: rectangle.bottom,
          visible: rectangle.width > 0 && rectangle.height > 0,
        };
      }),
    );
    return {
      viewport,
      bounds,
      overflowX: document.documentElement.scrollWidth - viewport.width,
      overflowY: document.documentElement.scrollHeight - viewport.height,
    };
  });
}

function positionsDoNotOverlap(
  positions: Readonly<
    Record<string, { readonly x: number; readonly z: number }>
  >,
) {
  const values = Object.values(positions);
  const agentsSeparated =
    values.length === 2 &&
    Math.hypot(values[0]!.x - values[1]!.x, values[0]!.z - values[1]!.z) >= 0.8;
  const objectsSeparated = values.every((position) =>
    cityInstances.every((instance) => {
      const footprint = REPOSITORY_ASSET_BY_ID.get(instance.assetId)!.footprint;
      return (
        Math.abs(position.x - instance.position.x) >= footprint[0] / 2 + 0.25 ||
        Math.abs(position.z - instance.position.z) >= footprint[1] / 2 + 0.25
      );
    }),
  );
  return { agentsSeparated, objectsSeparated };
}

async function runAxe(page: Page, receipt: Receipt) {
  const result = await new AxeBuilder({ page })
    .include("main.world-room")
    .analyze();
  receipt.axe = result.violations
    .filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    )
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? null,
    }));
  addCheck(
    receipt,
    "axe has no serious or critical violations",
    receipt.axe.length === 0,
    receipt.axe,
  );
}

function newReceipt(
  caseId: string,
  expectedRenderer: Receipt["expectedRenderer"],
  viewport: Receipt["viewport"],
  reducedMotion: boolean,
  agents: readonly AgentFixture[],
  issues: BrowserIssues,
): Receipt {
  return {
    schema: "aiw.phase19-task12-headed-observation/1",
    caseId,
    startedAt: new Date().toISOString(),
    expectedRenderer,
    viewport,
    reducedMotion,
    agents,
    layoutGeneration,
    objects: [objectA, objectB, objectC],
    observations: [],
    checks: [],
    screenshots: [],
    axe: [],
    transitions: [],
    reconnectObserved: false,
    reorderedServerProjectionObserved: false,
    issues,
  };
}

async function finishReceipt(receipt: Receipt) {
  receipt.finishedAt = new Date().toISOString();
  await writeFile(
    resolve(evidenceDirectory, `${receipt.caseId}-observation-receipt.json`),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );
  for (const check of receipt.checks)
    expect.soft(check.passed, `${receipt.caseId}: ${check.label}`).toBe(true);
}

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test("desktop connection and reconnect path keeps two exact coding agents independent through retarget and terminal completion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const expectedReconnectMiss = `/api/agent-sessions/${desktopAgents[1]!.sessionId}/status`;
  const issues = monitorBrowser(page, [expectedReconnectMiss]);
  const receipt = newReceipt(
    "desktop-reconnect-terminal",
    "imported",
    { width: 1440, height: 900 },
    false,
    desktopAgents,
    issues,
  );
  try {
    const fixture = await installTwoAgentFixture(
      page,
      desktopAgents,
      issues,
      true,
    );
    await connectTwoAgents(page, desktopAgents, true);
    receipt.reconnectObserved = fixture.reconnectObserved;
    receipt.reorderedServerProjectionObserved =
      fixture.reorderedServerProjectionObserved;
    addCheck(
      receipt,
      "stale roster entry was explicitly reconnected",
      fixture.reconnectObserved,
    );
    addCheck(
      receipt,
      "reversed server projection recovered stable addedOrder",
      fixture.reorderedServerProjectionObserved,
      fixture.roster.map((agent) => ({
        rosterId: agent.rosterId,
        addedOrder: agent.addedOrder,
      })),
    );
    await loadRepository(page);
    const [agentA, agentB] = desktopAgents;
    const a1 = "a1000000-0000-4000-8000-000000000001";
    const b1 = "b1000000-0000-4000-8000-000000000002";
    fixture.focuses.set(agentA.sessionId, {
      activityId: "activity-a-object-a",
      objectRef: objectA,
      repositoryPath: "apps/web/src/world-entry/WorldEntryExperience.tsx",
      requestId: a1,
      state: "navigating",
    });
    fixture.focuses.set(agentB.sessionId, {
      activityId: "activity-b-object-b",
      objectRef: objectB,
      repositoryPath: "apps/web/src/world-entry/WorldRoom.tsx",
      requestId: b1,
      state: "navigating",
    });
    fixture.movements.set(agentA.sessionId, {
      requestId: a1,
      objectRef: objectA,
      layoutGeneration,
      speed: 12,
      sequence: 1,
    });
    fixture.movements.set(agentB.sessionId, {
      requestId: b1,
      objectRef: objectB,
      layoutGeneration,
      speed: 4,
      sequence: 1,
    });

    const aFirst = await observeUntil(
      page,
      receipt,
      "A coding while B navigates",
      (scene) =>
        scene.workStates[agentA.sessionId]?.state === "coding" &&
        scene.workStates[agentA.sessionId]?.objectRef === objectA &&
        scene.workStates[agentB.sessionId]?.state === "navigating" &&
        scene.workStates[agentB.sessionId]?.objectRef === objectB,
      8_000,
    );
    addCheck(
      receipt,
      "A reaches object A before B reaches object B",
      aFirst.workStates[agentA.sessionId]?.state === "coding" &&
        aFirst.workStates[agentA.sessionId]?.objectRef === objectA &&
        aFirst.workStates[agentB.sessionId]?.state === "navigating" &&
        aFirst.workStates[agentB.sessionId]?.objectRef === objectB,
      aFirst.workStates,
    );

    const bothCoding = await observeUntil(
      page,
      receipt,
      "B independently coding",
      (scene) =>
        scene.workStates[agentA.sessionId]?.state === "coding" &&
        scene.workStates[agentA.sessionId]?.objectRef === objectA &&
        scene.workStates[agentB.sessionId]?.state === "coding" &&
        scene.workStates[agentB.sessionId]?.objectRef === objectB,
      18_000,
    );
    addCheck(
      receipt,
      "both agents preserve exact independent object identity",
      bothCoding.workStates[agentA.sessionId]?.objectRef === objectA &&
        bothCoding.workStates[agentB.sessionId]?.objectRef === objectB,
      bothCoding.workStates,
    );
    addCheck(
      receipt,
      "normal complete-avatar multi-agent renderer is imported",
      bothCoding.renderer === "imported",
      bothCoding.renderer,
    );
    await captureScreenshots(page, receipt, "both-coding");

    const a2 = "a2000000-0000-4000-8000-000000000003";
    fixture.focuses.set(agentA.sessionId, {
      activityId: "activity-a-object-c",
      objectRef: objectC,
      repositoryPath: "apps/web/src/world-entry/agent-work-focus-model.ts",
      requestId: a2,
      state: "navigating",
    });
    const lateOldArrival = await observeUntil(
      page,
      receipt,
      "late stale A arrival rejected",
      (scene) =>
        scene.workStates[agentA.sessionId]?.state === "navigating" &&
        scene.workStates[agentA.sessionId]?.objectRef === objectC &&
        scene.workStates[agentB.sessionId]?.state === "coding",
      4_000,
    );
    addCheck(
      receipt,
      "late stale A arrival stops coding before retarget movement",
      lateOldArrival.workStates[agentA.sessionId]?.state === "navigating" &&
        lateOldArrival.workStates[agentA.sessionId]?.objectRef === objectC &&
        lateOldArrival.workStates[agentB.sessionId]?.state === "coding",
      lateOldArrival.workStates,
    );

    fixture.movements.set(agentA.sessionId, {
      requestId: a2,
      objectRef: objectC,
      layoutGeneration: `layout-${"0".repeat(64)}`,
      speed: 12,
      sequence: 2,
    });
    const wrongGeneration = await observeUntil(
      page,
      receipt,
      "wrong generation A arrival rejected",
      (scene) =>
        scene.workStates[agentA.sessionId]?.state !== "coding" &&
        scene.workStates[agentA.sessionId]?.objectRef === objectC &&
        scene.workStates[agentB.sessionId]?.state === "coding",
      4_000,
    );
    addCheck(
      receipt,
      "wrong-generation A request cannot unlock coding",
      wrongGeneration.workStates[agentA.sessionId]?.state !== "coding" &&
        wrongGeneration.workStates[agentB.sessionId]?.state === "coding",
      wrongGeneration.workStates,
    );

    const a3 = "a3000000-0000-4000-8000-000000000004";
    fixture.focuses.set(agentA.sessionId, {
      activityId: "activity-a-object-c",
      objectRef: objectC,
      repositoryPath: "apps/web/src/world-entry/agent-work-focus-model.ts",
      requestId: a3,
      state: "navigating",
    });
    fixture.movements.set(agentA.sessionId, {
      requestId: a3,
      objectRef: objectC,
      layoutGeneration,
      speed: 12,
      sequence: 3,
    });
    const aRetargeted = await observeUntil(
      page,
      receipt,
      "A coding after exact object C arrival",
      (scene) =>
        scene.workStates[agentA.sessionId]?.state === "coding" &&
        scene.workStates[agentA.sessionId]?.objectRef === objectC,
      16_000,
    );
    addCheck(
      receipt,
      "A resumes only at exact current object C arrival",
      aRetargeted.workStates[agentA.sessionId]?.state === "coding" &&
        aRetargeted.workStates[agentA.sessionId]?.objectRef === objectC,
      aRetargeted.workStates,
    );

    fixture.focuses.set(agentB.sessionId, {
      activityId: "activity-b-object-b",
      objectRef: objectB,
      repositoryPath: "apps/web/src/world-entry/WorldRoom.tsx",
      requestId: b1,
      state: "completed",
    });
    const bTerminal = await observeUntil(
      page,
      receipt,
      "B terminal while A remains active",
      (scene) =>
        scene.workStates[agentB.sessionId]?.state === "idle" &&
        scene.workStates[agentA.sessionId]?.state === "coding" &&
        scene.workStates[agentA.sessionId]?.objectRef === objectC,
      4_000,
    );
    addCheck(
      receipt,
      "B completion stops only B while A stays coding",
      bTerminal.workStates[agentB.sessionId]?.state === "idle" &&
        bTerminal.workStates[agentA.sessionId]?.state === "coding" &&
        bTerminal.workStates[agentA.sessionId]?.objectRef === objectC,
      bTerminal.workStates,
    );
    fixture.focuses.set(agentB.sessionId, null);
    fixture.movements.set(agentB.sessionId, null);
    const bCleared = await observeUntil(
      page,
      receipt,
      "B cleared without A leakage",
      (scene) =>
        scene.workStates[agentB.sessionId]?.state === "idle" &&
        scene.workStates[agentA.sessionId]?.state === "coding",
      4_000,
    );
    addCheck(
      receipt,
      "clearing B does not clear A",
      bCleared.workStates[agentB.sessionId]?.state === "idle" &&
        bCleared.workStates[agentA.sessionId]?.state === "coding",
      bCleared.workStates,
    );

    const transitions = fixture.transitions;
    receipt.transitions = transitions;
    addCheck(
      receipt,
      "arrival transitions retain exact A and B actor/request identity",
      transitions.some(
        (transition) =>
          transition.actorId === agentA.sessionId &&
          transition.requestId === a1,
      ) &&
        transitions.some(
          (transition) =>
            transition.actorId === agentB.sessionId &&
            transition.requestId === b1,
        ),
      transitions,
    );
    const finalScene = await readScene(page);
    const overlap = positionsDoNotOverlap(finalScene.positions);
    addCheck(
      receipt,
      "agent bodies do not overlap",
      overlap.agentsSeparated,
      finalScene.positions,
    );
    addCheck(
      receipt,
      "agent bodies do not overlap repository objects",
      overlap.objectsSeparated,
      finalScene.positions,
    );
    addCheck(
      receipt,
      "no Dig semantic is claimed",
      !/\bDig\b/u.test(documentText(await page.locator("body").innerText())) &&
        !/\bDig\b/u.test(JSON.stringify(receipt.observations)),
    );
    const geometry = await viewportGeometry(page);
    addCheck(
      receipt,
      "desktop HUD, controls, badges, and canvas remain in bounds",
      geometry.overflowX <= 0 &&
        geometry.bounds
          .filter((bound) => bound.visible)
          .every(
            (bound) =>
              bound.left >= -0.5 &&
              bound.top >= -0.5 &&
              bound.right <= geometry.viewport.width + 0.5 &&
              bound.bottom <= geometry.viewport.height + 0.5,
          ),
      geometry,
    );
    await captureScreenshots(page, receipt, "retarget-terminal");
    await runAxe(page, receipt);
    addCheck(
      receipt,
      "browser issue monitor stayed empty",
      Object.values(issues).every((values) => values.length === 0),
      issues,
    );
  } catch (error) {
    receipt.checks.push({
      label: "headed journey completed without harness exception",
      passed: false,
      detail:
        error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
    throw error;
  } finally {
    await finishReceipt(receipt);
  }
});

test("390x844 imported path and reduced motion preserve static independent coding semantics", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const issues = monitorBrowser(page);
  const receipt = newReceipt(
    "portrait-imported-reduced",
    "imported",
    { width: 390, height: 844 },
    true,
    importedAgents,
    issues,
  );
  try {
    const fixture = await installTwoAgentFixture(
      page,
      importedAgents,
      issues,
      false,
    );
    await connectTwoAgents(page, importedAgents, false);
    await loadRepository(page);
    const before = await readScene(page);
    receipt.observations.push({
      label: "reduced motion before focus",
      scene: before,
    });
    const [agentA, agentB] = importedAgents;
    const a1 = "c1000000-0000-4000-8000-000000000001";
    const b1 = "d1000000-0000-4000-8000-000000000002";
    fixture.focuses.set(agentA.sessionId, {
      activityId: "reduced-a",
      objectRef: objectA,
      repositoryPath: "apps/web/src/world-entry/WorldEntryExperience.tsx",
      requestId: a1,
      state: "navigating",
    });
    fixture.focuses.set(agentB.sessionId, {
      activityId: "reduced-b",
      objectRef: objectB,
      repositoryPath: "apps/web/src/world-entry/WorldRoom.tsx",
      requestId: b1,
      state: "navigating",
    });
    fixture.movements.set(agentA.sessionId, {
      requestId: a1,
      objectRef: objectA,
      layoutGeneration,
      speed: 12,
      sequence: 1,
    });
    fixture.movements.set(agentB.sessionId, {
      requestId: b1,
      objectRef: objectB,
      layoutGeneration,
      speed: 12,
      sequence: 1,
    });
    const settled = await observeUntil(
      page,
      receipt,
      "reduced motion exact static coding placement",
      (scene) =>
        scene.workStates[agentA.sessionId]?.state === "coding" &&
        scene.workStates[agentA.sessionId]?.objectRef === objectA &&
        scene.workStates[agentB.sessionId]?.state === "coding" &&
        scene.workStates[agentB.sessionId]?.objectRef === objectB,
      4_000,
    );
    addCheck(
      receipt,
      "imported renderer genuinely mounted",
      settled.renderer === "imported",
      settled.renderer,
    );
    addCheck(
      receipt,
      "reduced motion retains exact independent object semantics",
      settled.workStates[agentA.sessionId]?.objectRef === objectA &&
        settled.workStates[agentB.sessionId]?.objectRef === objectB,
      settled.workStates,
    );
    addCheck(
      receipt,
      "reduced motion uses demand render loop",
      settled.renderLoopMode === "demand-reduced-motion",
      settled.renderLoopMode,
    );
    const samples: SceneObservation[] = [];
    for (let index = 0; index < 8; index += 1) {
      samples.push(await readScene(page));
      await page.waitForTimeout(75);
    }
    const uniquePositions = new Set(
      samples.map((sample) => JSON.stringify(sample.positions)),
    );
    addCheck(
      receipt,
      "reduced motion has no animated traversal claim",
      uniquePositions.size === 1,
      [...uniquePositions],
    );
    addCheck(
      receipt,
      "reduced motion imported mixer does not advance",
      new Set(samples.map((sample) => sample.mixerTime)).size === 1,
      samples.map((sample) => sample.mixerTime),
    );
    const overlap = positionsDoNotOverlap(settled.positions);
    addCheck(
      receipt,
      "portrait agents do not overlap",
      overlap.agentsSeparated,
      settled.positions,
    );
    addCheck(
      receipt,
      "portrait agents do not overlap repository objects",
      overlap.objectsSeparated,
      settled.positions,
    );
    const geometry = await viewportGeometry(page);
    addCheck(
      receipt,
      "portrait controls, badges, canvas, halo host, and HUD are in bounds",
      geometry.overflowX <= 0 &&
        geometry.bounds
          .filter((bound) => bound.visible)
          .every(
            (bound) =>
              bound.left >= -0.5 &&
              bound.top >= -0.5 &&
              bound.right <= geometry.viewport.width + 0.5 &&
              bound.bottom <= geometry.viewport.height + 0.5,
          ),
      geometry,
    );
    addCheck(
      receipt,
      "no Dig semantic is claimed under reduced motion",
      !/\bDig\b/u.test(await page.locator("body").innerText()) &&
        !/\bDig\b/u.test(JSON.stringify(receipt.observations)),
    );
    receipt.transitions = fixture.transitions;
    await captureScreenshots(page, receipt, "static-coding");
    await runAxe(page, receipt);
    addCheck(
      receipt,
      "browser issue monitor stayed empty",
      Object.values(issues).every((values) => values.length === 0),
      issues,
    );
  } catch (error) {
    receipt.checks.push({
      label: "headed journey completed without harness exception",
      passed: false,
      detail:
        error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
    throw error;
  } finally {
    await finishReceipt(receipt);
  }
});

test("no-WebGL normal World keeps exact two-agent semantic and accessibility truth", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const issues = monitorBrowser(page);
  const receipt = newReceipt(
    "semantic-no-webgl",
    "semantic",
    { width: 1024, height: 768 },
    true,
    importedAgents,
    issues,
  );
  try {
    const fixture = await installTwoAgentFixture(
      page,
      importedAgents,
      issues,
      false,
    );
    await connectTwoAgents(page, importedAgents, false);
    await loadRepository(page);
    const [agentA, agentB] = importedAgents;
    const a1 = "e1000000-0000-4000-8000-000000000001";
    const b1 = "f1000000-0000-4000-8000-000000000002";
    fixture.focuses.set(agentA.sessionId, {
      activityId: "semantic-a",
      objectRef: objectA,
      repositoryPath: "apps/web/src/world-entry/WorldEntryExperience.tsx",
      requestId: a1,
      state: "navigating",
    });
    fixture.focuses.set(agentB.sessionId, {
      activityId: "semantic-b",
      objectRef: objectB,
      repositoryPath: "apps/web/src/world-entry/WorldRoom.tsx",
      requestId: b1,
      state: "navigating",
    });
    fixture.movements.set(agentA.sessionId, {
      requestId: a1,
      objectRef: objectA,
      layoutGeneration,
      speed: 12,
      sequence: 1,
    });
    fixture.movements.set(agentB.sessionId, {
      requestId: b1,
      objectRef: objectB,
      layoutGeneration,
      speed: 12,
      sequence: 1,
    });
    const semantic = await observeUntil(
      page,
      receipt,
      "no-WebGL exact static semantic coding",
      (scene) =>
        scene.workStates[agentA.sessionId]?.state === "coding" &&
        scene.workStates[agentA.sessionId]?.objectRef === objectA &&
        scene.workStates[agentB.sessionId]?.state === "coding" &&
        scene.workStates[agentB.sessionId]?.objectRef === objectB,
      20_000,
    );
    addCheck(
      receipt,
      "no-WebGL semantic renderer genuinely mounted",
      semantic.renderer === "semantic",
      semantic.renderer,
    );
    addCheck(
      receipt,
      "semantic fallback keeps exactly two independently coding agents",
      semantic.workStates[agentA.sessionId]?.state === "coding" &&
        semantic.workStates[agentA.sessionId]?.objectRef === objectA &&
        semantic.workStates[agentB.sessionId]?.state === "coding" &&
        semantic.workStates[agentB.sessionId]?.objectRef === objectB,
      semantic.workStates,
    );
    addCheck(
      receipt,
      "semantic fallback exposes no animated traversal or mixer claim",
      semantic.renderLoopMode === null && semantic.mixerTime === null,
      {
        renderLoopMode: semantic.renderLoopMode,
        mixerTime: semantic.mixerTime,
      },
    );
    await expect(page.getByText(/Semantic scene active/u)).toBeVisible();
    await captureScreenshots(page, receipt, "semantic-coding");
    await runAxe(page, receipt);
    receipt.transitions = fixture.transitions;
    addCheck(
      receipt,
      "no Dig semantic is claimed in semantic mode",
      !/\bDig\b/u.test(await page.locator("body").innerText()),
    );
    addCheck(
      receipt,
      "browser issue monitor stayed empty",
      Object.values(issues).every((values) => values.length === 0),
      issues,
    );
  } catch (error) {
    receipt.checks.push({
      label: "headed journey completed without harness exception",
      passed: false,
      detail:
        error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
    throw error;
  } finally {
    await finishReceipt(receipt);
  }
});

function documentText(value: string) {
  return value;
}
