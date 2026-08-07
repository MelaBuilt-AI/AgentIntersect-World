import {
  WorkstreamClient,
  type WorkstreamAuthorityDescriptor,
  type WorkstreamCreateInput,
} from "./workstream-client.js";
import {
  projectAuthoritativeWorkstream,
  type Workstream,
} from "./workstream-tracer.js";

export async function createLiveWorkstream(
  authority: WorkstreamAuthorityDescriptor,
  client: Pick<WorkstreamClient, "create"> = new WorkstreamClient(),
  id: () => string = crypto.randomUUID,
): Promise<{
  readonly workstream: Workstream | null;
  readonly message: string;
}> {
  const input: WorkstreamCreateInput = {
    requestId: `create-${id()}`,
    correlationId: id(),
    title: "Repository Workstream",
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
