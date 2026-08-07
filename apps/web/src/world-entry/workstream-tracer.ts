import type { RepositoryCityInstance } from "@agentintersect-world/renderer-r3f";

import type { Phase14JourneyState } from "../phase14/phase14-client.js";
import type { WorkstreamApiRecord } from "./workstream-client.js";

export type WorkstreamStatus =
  | "planning"
  | "working"
  | "validating"
  | "ready-for-review"
  | "blocked"
  | "cleanup-required"
  | "cancelled"
  | "completed";

export type WorkstreamChangedFile = {
  readonly path: string;
  readonly change: "added" | "modified" | "deleted" | "renamed";
  readonly diffSummaryRef: string;
};

export type WorkstreamValidationCheck = {
  readonly id: string;
  readonly label: string;
  readonly state: "queued" | "running" | "passed" | "failed" | "skipped";
  readonly summary: string;
};

export type WorkstreamAssetLink = {
  readonly repositoryPath: string;
  readonly role: "workstream" | "changed-file" | "validation";
};

export type Workstream = {
  readonly workstreamId: string;
  readonly title: string;
  readonly status: WorkstreamStatus;
  readonly plan: readonly string[];
  readonly currentActivity: string;
  readonly changedFiles: readonly WorkstreamChangedFile[];
  readonly validation: readonly WorkstreamValidationCheck[];
  readonly assetLinks: readonly WorkstreamAssetLink[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly authority?: WorkstreamApiRecord | undefined;
};

type WorkstreamEventBase = {
  readonly eventId: string;
  readonly workstreamId: string;
  readonly occurredAt: string;
};

export type WorkstreamEvent =
  | (WorkstreamEventBase & {
      readonly type: "workstream.started";
      readonly title: string;
      readonly status: WorkstreamStatus;
      readonly plan: readonly string[];
      readonly assetLinks: readonly WorkstreamAssetLink[];
    })
  | (WorkstreamEventBase & {
      readonly type: "workstream.activity-updated";
      readonly activity: string;
    })
  | (WorkstreamEventBase & {
      readonly type: "workstream.file-changed";
      readonly file: WorkstreamChangedFile;
    })
  | (WorkstreamEventBase & {
      readonly type: "workstream.validation-updated";
      readonly check: WorkstreamValidationCheck;
    })
  | (WorkstreamEventBase & {
      readonly type: "workstream.status-updated";
      readonly status: WorkstreamStatus;
    });

const replaceByKey = <Value>(
  values: readonly Value[],
  replacement: Value,
  key: (value: Value) => string,
): readonly Value[] => {
  const index = values.findIndex((value) => key(value) === key(replacement));
  if (index === -1) return [...values, replacement];
  return values.map((value, valueIndex) =>
    valueIndex === index ? replacement : value,
  );
};

export function replayWorkstreamEvents(
  events: readonly WorkstreamEvent[],
): Workstream | null {
  const seenEventIds = new Set<string>();
  let workstream: Workstream | null = null;

  for (const event of events) {
    if (seenEventIds.has(event.eventId)) continue;
    seenEventIds.add(event.eventId);
    if (workstream && event.workstreamId !== workstream.workstreamId)
      throw new Error("Workstream event journal mixed workstream ids");

    if (event.type === "workstream.started") {
      if (workstream) continue;
      workstream = {
        workstreamId: event.workstreamId,
        title: event.title,
        status: event.status,
        plan: event.plan,
        currentActivity: "Waiting for work activity.",
        changedFiles: [],
        validation: [],
        assetLinks: event.assetLinks,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      };
      continue;
    }

    if (!workstream)
      throw new Error(
        "Workstream event journal must start with workstream.started",
      );

    if (event.type === "workstream.activity-updated")
      workstream = {
        ...workstream,
        currentActivity: event.activity,
        updatedAt: event.occurredAt,
      };
    else if (event.type === "workstream.file-changed")
      workstream = {
        ...workstream,
        changedFiles: replaceByKey(
          workstream.changedFiles,
          event.file,
          (file) => file.path,
        ),
        updatedAt: event.occurredAt,
      };
    else if (event.type === "workstream.validation-updated")
      workstream = {
        ...workstream,
        validation: replaceByKey(
          workstream.validation,
          event.check,
          (check) => check.id,
        ),
        updatedAt: event.occurredAt,
      };
    else
      workstream = {
        ...workstream,
        status: event.status,
        updatedAt: event.occurredAt,
      };
  }

  return workstream;
}

export function findWorkstreamForRepositorySelection(
  workstreams: readonly Workstream[],
  selection: RepositoryCityInstance | null,
): Workstream | null {
  const repositoryPath = selection?.linkedRepoData?.path;
  if (typeof repositoryPath !== "string") return null;
  return (
    workstreams.find((workstream) =>
      workstream.assetLinks.some(
        (link) => link.repositoryPath === repositoryPath,
      ),
    ) ?? null
  );
}

const DEMO_WORKSTREAM_EVENTS: readonly WorkstreamEvent[] = [
  {
    eventId: "workbench-demo-1",
    workstreamId: "demo-workstream-inspector",
    occurredAt: "2026-08-06T21:30:00.000Z",
    type: "workstream.started",
    title: "In-world Work Inspector tracer",
    status: "planning",
    plan: [
      "Project existing work facts into one read-only workstream.",
      "Bind repository-city selection to an accessible inspector.",
      "Validate the projection and inspector with focused tests.",
    ],
    assetLinks: [
      {
        repositoryPath: "apps/web/src/world-entry/WorldRoom.tsx",
        role: "changed-file",
      },
      {
        repositoryPath: "apps/web/test/workstream-tracer.test.ts",
        role: "validation",
      },
    ],
  },
  {
    eventId: "workbench-demo-2",
    workstreamId: "demo-workstream-inspector",
    occurredAt: "2026-08-06T21:31:00.000Z",
    type: "workstream.activity-updated",
    activity: "Demo fixture only — no live agent activity is connected.",
  },
  {
    eventId: "workbench-demo-3",
    workstreamId: "demo-workstream-inspector",
    occurredAt: "2026-08-06T21:32:00.000Z",
    type: "workstream.file-changed",
    file: {
      path: "apps/web/src/world-entry/WorldRoom.tsx",
      change: "modified",
      diffSummaryRef: "fixture:sample-diff-summary",
    },
  },
  {
    eventId: "workbench-demo-4",
    workstreamId: "demo-workstream-inspector",
    occurredAt: "2026-08-06T21:33:00.000Z",
    type: "workstream.validation-updated",
    check: {
      id: "focused-tests",
      label: "Focused tests",
      state: "queued",
      summary: "Fixture only — no check has run.",
    },
  },
  {
    eventId: "workbench-demo-5",
    workstreamId: "demo-workstream-inspector",
    occurredAt: "2026-08-06T21:34:00.000Z",
    type: "workstream.status-updated",
    status: "working",
  },
];

export function demoWorkstreamFromSearch(search: string): Workstream | null {
  const parameters = new URLSearchParams(search);
  if (parameters.get("workstreamTracer") !== "demo") return null;
  return replayWorkstreamEvents(DEMO_WORKSTREAM_EVENTS);
}

export type WorkstreamTracerSource = "demo" | "live" | "phase14";

export function workstreamTracerModeFromSearch(
  search: string,
): WorkstreamTracerSource | null {
  const value = new URLSearchParams(search).get("workstreamTracer");
  if (value === "demo") return "demo";
  if (value === "live") return "live";
  if (value === "phase14") return "phase14";
  return null;
}

export function projectAuthoritativeWorkstream(
  record: WorkstreamApiRecord,
): Workstream {
  const latestEvent = record.events.at(-1);
  return {
    workstreamId: record.workstreamId,
    title: record.title,
    status: record.status,
    plan: record.events.map((event) => event.summary),
    currentActivity:
      latestEvent?.summary ?? "No Workstream activity has been reported.",
    changedFiles: [],
    validation: [],
    assetLinks: [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    authority: record,
  };
}

const PHASE14_BOUNDED_PLAN = [
  "Phase 14 bounded stages · attach, read, and explain the fixture target.",
  "Phase 14 bounded stages · preview and explicitly approve the exact edit.",
  "Phase 14 bounded stages · apply the edit and run the focused test.",
  "Phase 14 bounded stages · verify, stop, and correlate loopback preview evidence.",
] as const;

const phase14ValidationState = (
  state: NonNullable<Phase14JourneyState["test"]>["state"],
): WorkstreamValidationCheck["state"] => {
  if (state === "requested") return "queued";
  if (state === "running") return "running";
  if (state === "succeeded") return "passed";
  if (state === "failed") return "failed";
  return "skipped";
};

export function projectPhase14Journey(
  journey: Phase14JourneyState,
): Workstream | null {
  if (
    !journey.operationId ||
    !journey.createdAt ||
    !journey.updatedAt ||
    !journey.disposable
  )
    return null;

  const latestEvent = [...journey.events].sort(
    (left, right) =>
      right.sequence - left.sequence ||
      right.occurredAt.localeCompare(left.occurredAt) ||
      right.eventId.localeCompare(left.eventId),
  )[0];
  const status: WorkstreamStatus =
    journey.status === "completed"
      ? "completed"
      : journey.status === "failed" || journey.status === "cancelled"
        ? "blocked"
        : journey.test?.state === "requested" ||
            journey.test?.state === "running"
          ? "validating"
          : "working";
  const changedFiles: readonly WorkstreamChangedFile[] = journey.edit
    ?.currentEvidenceRef
    ? [
        {
          path: journey.disposable.target,
          change: "modified",
          diffSummaryRef: journey.edit.currentEvidenceRef,
        },
      ]
    : [];
  const validation: readonly WorkstreamValidationCheck[] = journey.test
    ? [
        {
          id: "phase14-focused-test",
          label: "Phase 14 focused test",
          state: phase14ValidationState(journey.test.state),
          summary: `State ${journey.test.state} · exit ${journey.test.exitCode ?? "unavailable"} · timed out ${journey.test.timedOut ? "yes" : "no"}.`,
        },
      ]
    : [];

  return {
    workstreamId: journey.operationId,
    title: `Phase 14 bounded journey · ${journey.disposable.target}`,
    status,
    plan: PHASE14_BOUNDED_PLAN,
    currentActivity: latestEvent
      ? `Phase 14 ${latestEvent.operation} ${latestEvent.state}.`
      : `Phase 14 bounded journey is ${journey.status} at stage ${journey.step}.`,
    changedFiles,
    validation,
    assetLinks: [
      { repositoryPath: journey.disposable.target, role: "workstream" },
    ],
    createdAt: journey.createdAt,
    updatedAt: journey.updatedAt,
  };
}

export async function loadCurrentPhase14Workstream(
  readCurrentJourney: () => Promise<Phase14JourneyState>,
): Promise<Workstream | null> {
  return projectPhase14Journey(await readCurrentJourney());
}
