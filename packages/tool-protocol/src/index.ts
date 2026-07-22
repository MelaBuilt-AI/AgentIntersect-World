import { z } from "zod";

export const TOOL_EVENT_PROTOCOL = "aiw.tool-event/0.14" as const;
export const CODE_EXPLANATION_PROTOCOL = "aiw.code-explanation/0.14" as const;

export const TOOL_EVENT_LIMITS = Object.freeze({
  requestTtlMs: 15 * 60 * 1000,
  approvalTtlMs: 5 * 60 * 1000,
  maximumReplayEvents: 100,
  maximumEventBytes: 32 * 1024,
  maximumDisplayArgumentBytes: 4 * 1024,
  maximumExplanationBytes: 16 * 1024,
  maximumClaimBytes: 1024,
  maximumDiffBytes: 16 * 1024,
  maximumReplacementBytes: 8 * 1024,
  maximumSourceBytes: 64 * 1024,
  maximumTestStreamBytes: 64 * 1024,
  maximumPreviewLogBytes: 64 * 1024,
});

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function boundedUtf8(maximum: number, minimum = 0) {
  return z
    .string()
    .min(minimum)
    .refine((value) => utf8ByteLength(value) <= maximum, {
      message: `Must be at most ${maximum} UTF-8 bytes`,
    });
}

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const Sha256AttestationSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const OpaqueRefSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
const EvidenceRefSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^aiw:\/\/(?:evidence|object|path)\/[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const ToolOperationSchema = z.enum([
  "read",
  "search",
  "edit",
  "test",
  "preview",
]);

export const ToolLifecycleSchema = z.enum([
  "requested",
  "accepted",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "superseded",
]);

const RepositoryBindingSchema = z
  .object({
    repositoryId: z
      .string()
      .min(1)
      .max(256)
      .regex(/^aiw:\/\/object\/[A-Za-z0-9][A-Za-z0-9._:-]*$/),
    rootAttestation: Sha256AttestationSchema,
    fixtureRevision: z.string().min(1).max(128),
  })
  .strict();

const ProvenanceSchema = z
  .object({
    adapterId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    source: z.enum(["world-owned", "adapter-attested"]),
    observedAt: z.string().datetime({ offset: true }),
  })
  .strict();

const RedactionSchema = z
  .object({
    applied: z.boolean(),
    count: z.number().int().nonnegative(),
    truncated: z.boolean(),
  })
  .strict();

export const ToolEventSchema = z
  .object({
    schema: z.literal(TOOL_EVENT_PROTOCOL),
    operationId: z.string().uuid(),
    eventId: z.string().uuid(),
    correlationId: z.string().uuid(),
    parentId: z.string().uuid().nullable(),
    sequence: z.number().int().nonnegative(),
    operation: ToolOperationSchema,
    state: ToolLifecycleSchema,
    occurredAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    worldSessionId: z.string().uuid(),
    adapterSessionRef: OpaqueRefSchema,
    rootSessionRef: OpaqueRefSchema.nullable(),
    repository: RepositoryBindingSchema,
    provenance: ProvenanceSchema,
    target: z
      .object({
        path: z.literal("src/greeting.mjs"),
        symbol: z.literal("greeting"),
      })
      .strict()
      .nullable(),
    displayArguments: boundedUtf8(
      TOOL_EVENT_LIMITS.maximumDisplayArgumentBytes,
    ),
    evidence: z
      .object({
        currentRef: EvidenceRefSchema.nullable(),
        previousRef: EvidenceRefSchema.nullable(),
      })
      .strict(),
    redaction: RedactionSchema,
    digest: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const occurred = Date.parse(value.occurredAt);
    const expires = Date.parse(value.expiresAt);
    if (
      expires < occurred ||
      expires - occurred > TOOL_EVENT_LIMITS.requestTtlMs
    ) {
      context.addIssue({
        code: "custom",
        message: "Tool request expiry must be no more than 15 minutes",
      });
    }
    if (
      utf8ByteLength(JSON.stringify(value)) >
      TOOL_EVENT_LIMITS.maximumEventBytes
    ) {
      context.addIssue({
        code: "custom",
        message: "Tool event exceeds 32 KiB",
      });
    }
  });

export type ToolEvent = z.infer<typeof ToolEventSchema>;
export type ToolOperation = z.infer<typeof ToolOperationSchema>;
export type ToolLifecycle = z.infer<typeof ToolLifecycleSchema>;

function truncateUtf8(value: string, maximumBytes: number): string {
  if (utf8ByteLength(value) <= maximumBytes) return value;
  let result = "";
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    const characterBytes =
      code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes + characterBytes > maximumBytes) break;
    result += character;
    bytes += characterBytes;
  }
  return result;
}

export type ToolEventProjection = Pick<
  ToolEvent,
  "eventId" | "sequence" | "operation" | "state"
> & { readonly evidenceRef: string | null };

export function projectToolEvents(
  events: readonly ToolEvent[],
): readonly ToolEventProjection[] {
  return [...events]
    .sort(
      (left, right) =>
        left.sequence - right.sequence ||
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.eventId.localeCompare(right.eventId),
    )
    .slice(-TOOL_EVENT_LIMITS.maximumReplayEvents)
    .map((event) => ({
      eventId: event.eventId,
      sequence: event.sequence,
      operation: event.operation,
      state: event.state,
      evidenceRef: event.evidence.currentRef,
    }));
}

export type UnifiedDiffLine = {
  readonly kind: "header" | "hunk" | "addition" | "deletion" | "context";
  readonly text: string;
};

export function renderUnifiedDiffProjection(input: string): {
  readonly byteLength: number;
  readonly truncated: boolean;
  readonly lines: readonly UnifiedDiffLine[];
} {
  const maximumBytes = TOOL_EVENT_LIMITS.maximumReplacementBytes;
  const truncated = utf8ByteLength(input) > maximumBytes;
  const bounded = truncateUtf8(input, maximumBytes);
  return {
    byteLength: utf8ByteLength(bounded),
    truncated,
    lines: bounded
      .split("\n")
      .filter(Boolean)
      .map((text) => ({
        kind:
          text.startsWith("--- ") || text.startsWith("+++ ")
            ? "header"
            : text.startsWith("@@")
              ? "hunk"
              : text.startsWith("+")
                ? "addition"
                : text.startsWith("-")
                  ? "deletion"
                  : "context",
        text,
      })),
  };
}

export function truncateProcessOutput(
  input: string,
  maximumBytes = TOOL_EVENT_LIMITS.maximumTestStreamBytes,
): {
  readonly text: string;
  readonly truncated: boolean;
  readonly originalBytes: number;
  readonly retainedBytes: number;
} {
  const originalBytes = utf8ByteLength(input);
  if (originalBytes <= maximumBytes) {
    return {
      text: input,
      truncated: false,
      originalBytes,
      retainedBytes: originalBytes,
    };
  }
  const marker = "\n[output truncated]\n";
  const text = `${truncateUtf8(input, maximumBytes - utf8ByteLength(marker))}${marker}`;
  return {
    text,
    truncated: true,
    originalBytes,
    retainedBytes: utf8ByteLength(text),
  };
}

const DISPLAY_SECRET_PATTERNS: readonly RegExp[] = [
  /\b(?:token|bearer|api|sk)[-_][A-Za-z0-9._-]{6,}\b/gi,
  /(?:^|\s)(?:\/[A-Za-z0-9._-]+){2,}/g,
];

export function boundedDisplayArguments(input: string): {
  text: string;
  redaction: z.infer<typeof RedactionSchema>;
} {
  let count = 0;
  let text = input;
  for (const pattern of DISPLAY_SECRET_PATTERNS) {
    text = text.replace(pattern, (match) => {
      count += 1;
      return match.startsWith(" ") ? " [redacted]" : "[redacted]";
    });
  }
  const truncated =
    utf8ByteLength(text) > TOOL_EVENT_LIMITS.maximumDisplayArgumentBytes;
  text = truncateUtf8(text, TOOL_EVENT_LIMITS.maximumDisplayArgumentBytes);
  return {
    text,
    redaction: { applied: count > 0, count, truncated },
  };
}

type ReplayResult =
  | { readonly kind: "accepted" }
  | { readonly kind: "duplicate" }
  | { readonly kind: "conflict"; readonly statusCode: 409 }
  | { readonly kind: "expired" };

export class ToolEventReplay {
  readonly #events = new Map<string, ToolEvent>();

  accept(input: unknown, now = Date.now()): ReplayResult {
    const parsed = ToolEventSchema.parse(input);
    if (Date.parse(parsed.expiresAt) < now) return { kind: "expired" };
    const prior = this.#events.get(parsed.eventId);
    if (prior) {
      return prior.digest === parsed.digest
        ? { kind: "duplicate" }
        : { kind: "conflict", statusCode: 409 };
    }
    this.#events.set(parsed.eventId, parsed);
    if (this.#events.size > TOOL_EVENT_LIMITS.maximumReplayEvents) {
      const oldest = this.events()[0];
      if (oldest) this.#events.delete(oldest.eventId);
    }
    return { kind: "accepted" };
  }

  events(): readonly ToolEvent[] {
    return [...this.#events.values()].sort(
      (left, right) =>
        left.sequence - right.sequence ||
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.eventId.localeCompare(right.eventId),
    );
  }
}

const claim = <Label extends string>(label: Label) =>
  z
    .object({
      label: z.literal(label),
      text: boundedUtf8(TOOL_EVENT_LIMITS.maximumClaimBytes, 1),
    })
    .strict();

export const CodeExplanationSchema = z
  .object({
    schema: z.literal(CODE_EXPLANATION_PROTOCOL),
    explanationId: z.string().uuid(),
    operationId: z.string().uuid(),
    repositoryId: z
      .string()
      .regex(/^aiw:\/\/object\/[A-Za-z0-9][A-Za-z0-9._:-]*$/),
    fixtureRevision: z.string().min(1).max(128),
    fileEvidenceRef: EvidenceRefSchema,
    path: z.literal("src/greeting.mjs"),
    symbol: z.literal("greeting"),
    lineRange: z
      .object({
        start: z.number().int().positive(),
        end: z.number().int().positive(),
      })
      .strict()
      .refine(({ start, end }) => end >= start, "Invalid line range"),
    sourceHash: Sha256Schema,
    originatingEventId: z.string().uuid(),
    continuity: z
      .object({
        state: z.enum(["current", "stale", "moved", "missing"]),
        reason: boundedUtf8(1024, 1).nullable(),
      })
      .strict(),
    claims: z
      .object({
        sourceFacts: z.array(claim("source-fact")).max(16),
        runtimeObservations: z.array(claim("runtime-observation")).max(16),
        testResults: z.array(claim("test-result")).max(16),
        interpretations: z.array(claim("interpretation")).max(16),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      utf8ByteLength(JSON.stringify(value)) >
      TOOL_EVENT_LIMITS.maximumExplanationBytes
    ) {
      context.addIssue({
        code: "custom",
        message: "Code explanation exceeds 16 KiB",
      });
    }
    if (
      value.continuity.state === "current" &&
      value.continuity.reason !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "Current explanation has no stale reason",
      });
    }
    if (
      value.continuity.state !== "current" &&
      value.continuity.reason === null
    ) {
      context.addIssue({
        code: "custom",
        message: "Stale continuity requires a reason",
      });
    }
  });

export type CodeExplanation = z.infer<typeof CodeExplanationSchema>;

const FixtureFileSchema = z
  .object({
    path: z.enum(["src/greeting.mjs", "test/greeting.test.mjs", "preview.mjs"]),
    sha256: Sha256Schema,
  })
  .strict();

export const FixtureManifestSchema = z
  .object({
    schema: z.literal("aiw.phase14-fixture/1"),
    revision: z.literal("phase14-magic-slice/1"),
    repositoryId: z.literal("aiw://object/repository-phase14-magic-slice"),
    provenance: z
      .object({
        owner: z.literal("AgentIntersect World"),
        kind: z.literal("world-owned"),
        created: z.iso.date(),
        externalDependencies: z.literal(false),
      })
      .strict(),
    files: z
      .array(FixtureFileSchema)
      .length(3)
      .refine(
        (files) => new Set(files.map(({ path }) => path)).size === files.length,
        "Fixture paths must be unique",
      ),
    target: z
      .object({
        path: z.literal("src/greeting.mjs"),
        symbol: z.literal("greeting"),
        initialSource: boundedUtf8(TOOL_EVENT_LIMITS.maximumSourceBytes, 1),
        initialSha256: Sha256Schema,
        replacementSource: boundedUtf8(
          TOOL_EVENT_LIMITS.maximumReplacementBytes,
          1,
        ),
        replacementSha256: Sha256Schema,
        patchDigest: Sha256Schema,
      })
      .strict(),
    commands: z
      .object({
        test: z.tuple([
          z.literal("$NODE"),
          z.literal("--test"),
          z.literal("test/greeting.test.mjs"),
        ]),
        preview: z.tuple([
          z.literal("$NODE"),
          z.literal("preview.mjs"),
          z.literal("--host"),
          z.literal("127.0.0.1"),
          z.literal("--port"),
          z.literal("0"),
        ]),
      })
      .strict(),
    health: z
      .object({
        path: z.literal("/health"),
        expected: z
          .object({
            ok: z.literal(true),
            schema: z.literal("aiw.phase14-preview/1"),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .superRefine((manifest, context) => {
    const target = manifest.files.find(
      ({ path }) => path === manifest.target.path,
    );
    if (target?.sha256 !== manifest.target.initialSha256) {
      context.addIssue({
        code: "custom",
        message: "Target file hash must equal the initial source hash",
      });
    }
  });

export type FixtureManifest = z.infer<typeof FixtureManifestSchema>;
