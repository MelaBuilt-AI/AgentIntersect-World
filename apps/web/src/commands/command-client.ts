import {
  CommandIntentListDataSchema,
  CommandIntentRecordSchema,
  type CommandIntentRecord,
  type CommandIntentRequest,
} from "@agentintersect-world/world-schema";

import { apiRequest, type LocalApiResult } from "../health-client.js";

export async function createCommandIntent(
  token: string,
  idempotencyKey: string,
  request: CommandIntentRequest,
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<CommandIntentRecord>> {
  return await apiRequest(
    "/commands/intents",
    CommandIntentRecordSchema,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(request),
    },
    fetcher,
  );
}

export async function listCommandIntents(
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<{ intents: readonly CommandIntentRecord[] }>> {
  return await apiRequest(
    "/commands/intents",
    CommandIntentListDataSchema,
    {},
    fetcher,
  );
}

export async function getCommandIntent(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<CommandIntentRecord>> {
  return await apiRequest(
    `/commands/intents/${encodeURIComponent(id)}`,
    CommandIntentRecordSchema,
    {},
    fetcher,
  );
}
