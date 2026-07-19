export const WORLD_EVENT_PROTOCOL = {
  schema: "aiw.event/0.1",
  phase: "contract-only",
} as const;

export type WorldEventContract = {
  schema: typeof WORLD_EVENT_PROTOCOL.schema;
  id: string;
  type: `aiw.${string}`;
  occurredAt: string;
  correlationId: string;
  payload: Readonly<Record<string, unknown>>;
};
