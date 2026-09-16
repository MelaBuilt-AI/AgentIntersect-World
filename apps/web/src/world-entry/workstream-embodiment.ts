import {
  reduceRepositoryCity,
  type RepositoryCityInstance,
} from "@agentintersect-world/renderer-r3f";
import type { Workstream } from "./workstream-tracer.js";
import type { BrowserAgentWorkFocus } from "./agent-work-focus-model.js";
import type { AgentMovementRequest } from "./world-agent-movement-model.js";

// Opaque presentation keys, not authority or security identifiers.
function presentationKey(value: string): string {
  let hash = 2_166_136_261;
  for (const character of value)
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16_777_619);
  return (hash >>> 0).toString(16);
}

/** A Workstream has its own live code object, even before its first new file. */
export function createWorkstreamSlab(
  work: Workstream | null,
  instances: readonly RepositoryCityInstance[],
): RepositoryCityInstance | null {
  if (
    !work?.authority ||
    ["missing", "removed"].includes(work.authority.worktreeState)
  )
    return null;
  const id = work.workstreamId;
  const projected = reduceRepositoryCity(
    { instances },
    {
      type: "event",
      event: {
        id,
        type: "file.updated",
        position: { x: -6, z: -4 },
        status:
          work.status === "working"
            ? "active"
            : work.status === "blocked"
              ? "failure"
              : "idle",
        linkedRepoData: {
          ref: `aiw://object/workstream-${id}`,
          path: `workstream:${id}`,
          label: work.title,
          kind: "workstream",
          workstreamId: id,
          repositoryRef: work.authority.repository.repositoryId,
        },
      },
    },
  );
  return (
    projected.instances.find(
      (instance) => instance.linkedRepoData?.workstreamId === id,
    ) ?? null
  );
}

/** Stable file objects for current Workstream changes, including untracked files. */
export function createWorkstreamObjects(
  work: Workstream | null,
  instances: readonly RepositoryCityInstance[],
): RepositoryCityInstance[] {
  const slab = createWorkstreamSlab(work, instances);
  if (!slab || !work?.authority) return [];
  const active = work.authority.projection.activeFile;
  const paths = [
    ...new Set([
      ...work.authority.projection.changedFiles.map((file) => file.path),
      ...(active ? [active.path] : []),
    ]),
  ].slice(0, 256);
  let city: ReturnType<typeof reduceRepositoryCity> = {
    instances: [...instances, slab],
  };
  const added = [slab];
  for (const path of paths) {
    const existing = instances.find(
      (object) => object.linkedRepoData?.path === path,
    );
    const change = work.authority.projection.changedFiles.find(
      (file) => file.path === path,
    )?.change;
    if (existing) {
      added.push({
        ...existing,
        status:
          change === "deleted"
            ? "failure"
            : work.status === "working" && active?.path === path
              ? "active"
              : "idle",
        linkedRepoData: {
          ...existing.linkedRepoData,
          workstreamId: work.workstreamId,
          change: change ?? null,
        },
      });
      continue;
    }
    const ref = `aiw://object/workstream-file-${work.workstreamId}-${presentationKey(path)}`;
    city = reduceRepositoryCity(city, {
      type: "event",
      event: {
        id: ref,
        type: "file.updated",
        position: { x: -6, z: -4 },
        status:
          work.status === "working" && active?.path === path
            ? "active"
            : "idle",
        linkedRepoData: {
          ref,
          path,
          label: path,
          kind: "file",
          change: change ?? null,
          workstreamId: work.workstreamId,
          repositoryRef: work.authority.repository.repositoryId,
        },
      },
    });
    const object = city.instances.find(
      (item) => item.linkedRepoData?.ref === ref,
    );
    if (object) added.push(object);
  }
  const evidence = [
    ...(work.diff?.patch || work.changedFiles.length
      ? [
          {
            kind: "diff",
            type: "diff.created",
            label: "Current work diff",
            status: "idle" as const,
          },
        ]
      : []),
    ...(work.validation.length
      ? [
          {
            kind: "validation",
            type: work.validation.some((check) => check.state === "failed")
              ? "test.failed"
              : "test.passed",
            label: "Current work validation",
            status: work.validation.some((check) => check.state === "failed")
              ? ("failure" as const)
              : work.validation.every((check) => check.state === "passed")
                ? ("active" as const)
                : ("pending" as const),
          },
        ]
      : []),
  ];
  for (const item of evidence) {
    const id = `workstream-evidence:${work.workstreamId}:${item.kind}`;
    city = reduceRepositoryCity(city, {
      type: "event",
      event: {
        id,
        type: item.type,
        status: item.status,
        linkedRepoData: {
          ref: id,
          workstreamId: work.workstreamId,
          kind: item.kind,
          label: item.label,
          repositoryRef: work.authority.repository.repositoryId,
        },
      },
    });
    const instance = city.instances.at(-1)!;
    // This is a snapshot-derived summary, not a newly emitted test/diff event.
    added.push({ ...instance, instanceId: id, sourceEvent: null });
  }
  return added;
}

/** Local presentation intent from explicit Workstream authority, never prose. */
export function workstreamEmbodiment(
  work: Workstream | null,
  slab: RepositoryCityInstance | null,
  actorId: string,
  layoutGeneration: string,
  objects: readonly RepositoryCityInstance[] = [],
): {
  focus: BrowserAgentWorkFocus;
  request: AgentMovementRequest | null;
} | null {
  if (!work?.authority || !slab || work.authority.agent.agentId !== actorId)
    return null;
  const active = work.status === "working";
  const turn =
    work.authority.events.findLast((event) => event.status === "working")
      ?.eventId ?? work.workstreamId;
  const turnIndex = work.authority.events.findLastIndex(
    (event) => event.status === "working",
  );
  const file = work.authority.projection.activeFile;
  const target =
    (active && file
      ? objects.find((object) => object.linkedRepoData?.path === file.path)
      : null) ?? slab;
  const objectRef = String(target.linkedRepoData!.ref);
  const activityId =
    active && file && target !== slab ? `${turn}:${objectRef}` : turn;
  const requestId = `workstream-scene:${work.workstreamId}:${turnIndex}:${presentationKey(`${layoutGeneration}:${objectRef}`)}`;
  return {
    focus: {
      activityId,
      rosterId: actorId,
      worldSessionId: actorId,
      objectRef,
      repositoryPath:
        target === slab ? work.title : String(target.linkedRepoData!.path),
      layoutGeneration,
      movementRequestId: requestId,
      source: "workstream-turn",
      state: active
        ? "targeted"
        : work.status === "blocked"
          ? "failed"
          : "completed",
    },
    request: active
      ? {
          schema: "aiw.agent-movement/1",
          requestId,
          actorId,
          source: "user-directed",
          speed: 5,
          target: {
            kind: "repository-object",
            objectId: objectRef,
            layoutGeneration,
          },
        }
      : null,
  };
}
