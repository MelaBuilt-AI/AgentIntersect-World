import {
  WorkstreamClient,
  type WorkstreamAuthorityDescriptor,
  type WorkstreamApiRecord,
  type WorkstreamCreateInput,
} from "./workstream-client.js";
import {
  projectAuthoritativeWorkstream,
  type Workstream,
} from "./workstream-tracer.js";
import type {
  WorkstreamConversationAction,
  WorldTranscriptItem,
} from "./world-chat-model.js";

export type WorkstreamConversationResolution =
  | { readonly kind: "create"; readonly task: string }
  | {
      readonly kind: "continue";
      readonly task: string;
      readonly agentId: string;
    }
  | { readonly kind: "unavailable"; readonly message: string };

export function resolveWorkstreamConversationRequest(
  workstream: WorkstreamApiRecord | null,
  authority: WorkstreamAuthorityDescriptor | null,
  task: string,
): WorkstreamConversationResolution {
  if (!authority)
    return {
      kind: "unavailable",
      message:
        "Load a repository and connect one agent before starting a Workstream.",
    };
  if (!workstream || ["completed", "cancelled"].includes(workstream.status))
    return { kind: "create", task };
  if (
    workstream.repository.repositoryId !== authority.repository.repositoryId ||
    workstream.agent.agentId !== authority.agent.agentId ||
    (workstream.agent.rootNativeSessionId ??
      workstream.agent.nativeSessionId) !==
      (authority.agent.rootNativeSessionId ?? authority.agent.nativeSessionId)
  )
    return { kind: "create", task };
  if (workstream.status === "cleanup-required")
    return {
      kind: "unavailable",
      message: "Current Workstream needs cleanup before more work can start.",
    };
  if (workstream.repository.revision !== authority.repository.revision)
    return {
      kind: "unavailable",
      message:
        "Current Workstream authority is stale. Reload the repository or reconnect its agent.",
    };
  return {
    kind: "continue",
    task,
    agentId: workstream.agent.agentId,
  };
}

export async function executeWorkstreamConversation(
  action: WorkstreamConversationAction,
  authority: WorkstreamAuthorityDescriptor | null,
  client: Pick<
    WorkstreamClient,
    "current" | "create" | "iterate" | "cancel"
  > = new WorkstreamClient(),
  enqueue: (text: string, agentId: string) => void,
  id: () => string = () => crypto.randomUUID(),
): Promise<{
  readonly workstream: Workstream | null;
  readonly message: string | null;
  readonly openInspector: boolean;
  readonly continued: boolean;
}> {
  try {
    const current = await client.current();
    if (action.action === "inspect")
      return current
        ? {
            workstream: projectAuthoritativeWorkstream(current),
            message: `Current Workstream is ${current.status}.`,
            openInspector: true,
            continued: false,
          }
        : {
            workstream: null,
            message: "No current Workstream.",
            openInspector: false,
            continued: false,
          };
    if (action.action === "cancel") {
      if (!current)
        return {
          workstream: null,
          message: "No current Workstream to cancel.",
          openInspector: false,
          continued: false,
        };
      const commandId = id();
      const result = await client.cancel(current, {
        requestId: `cancel-${commandId}`,
        correlationId: id(),
      });
      const workstream = projectAuthoritativeWorkstream(result.workstream);
      return {
        workstream,
        message: `Current Workstream is ${workstream.status}.`,
        openInspector: true,
        continued: false,
      };
    }
    const resolution = resolveWorkstreamConversationRequest(
      current,
      authority,
      action.task,
    );
    if (resolution.kind === "unavailable")
      return {
        workstream: current ? projectAuthoritativeWorkstream(current) : null,
        message: resolution.message,
        openInspector: false,
        continued: false,
      };
    if (resolution.kind === "create") {
      const outcome = await createLiveWorkstream(
        authority!,
        resolution.task,
        client,
        id,
      );
      return {
        workstream: outcome.workstream,
        message: outcome.message,
        openInspector: false,
        continued: false,
      };
    }
    const commandId = id();
    const iteration = await client.iterate(current!, resolution.task, {
      requestId: `iterate-${commandId}`,
      correlationId: id(),
    });
    enqueue(resolution.task, resolution.agentId);
    return {
      workstream: projectAuthoritativeWorkstream(iteration.workstream),
      message: null,
      openInspector: false,
      continued: true,
    };
  } catch (error) {
    return {
      workstream: null,
      message: `Workbench error · ${
        error instanceof Error ? error.message : "Request failed"
      }.`,
      openInspector: false,
      continued: false,
    };
  }
}

export function resolveWorkstreamTask(
  transcript: readonly WorldTranscriptItem[],
  busy: boolean,
): { readonly task: string | null; readonly unavailableReason: string | null } {
  if (busy)
    return {
      task: null,
      unavailableReason: "Wait for the current agent turn to finish.",
    };
  const task = [...transcript]
    .reverse()
    .find((item) => item.kind === "user")
    ?.text.trim();
  if (!task)
    return {
      task: null,
      unavailableReason: "Send a feature request in World chat first.",
    };
  if (new TextEncoder().encode(task).byteLength > 2_000)
    return {
      task: null,
      unavailableReason:
        "The latest feature request is too long for a Workstream.",
    };
  return { task, unavailableReason: null };
}

export async function createLiveWorkstream(
  authority: WorkstreamAuthorityDescriptor,
  task: string,
  client: Pick<WorkstreamClient, "create"> = new WorkstreamClient(),
  id: () => string = () => crypto.randomUUID(),
): Promise<{
  readonly workstream: Workstream | null;
  readonly message: string;
}> {
  const input: WorkstreamCreateInput = {
    requestId: `create-${id()}`,
    correlationId: id(),
    title: [...task].slice(0, 160).join(""),
    task,
    ...authority,
  };
  try {
    const result = await client.create(input);
    const workstream = projectAuthoritativeWorkstream(result.workstream);
    return {
      workstream,
      message: `Current Workstream is ${workstream.status}.`,
    };
  } catch (error) {
    return {
      workstream: null,
      message: `Workbench error · ${
        error instanceof Error ? error.message : "Create failed"
      }.`,
    };
  }
}
