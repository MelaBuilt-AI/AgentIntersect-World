import {
  WorkstreamClient,
  type WorkstreamAuthorityDescriptor,
  type WorkstreamCreateInput,
} from "./workstream-client.js";
import {
  projectAuthoritativeWorkstream,
  type Workstream,
} from "./workstream-tracer.js";
import type { WorldTranscriptItem } from "./world-chat-model.js";

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
