import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const evidenceRoot = new URL(
  "../../artifacts/avatar-replacement-evidence/world-animation-operator-review-v1/",
  import.meta.url,
);
const accepted = {
  "user-male-01": {
    role: "user",
    sha256: "a7b9f50c4ff20228b2a640d9250f03cef38da36534266d50dfc60a3ee6dbf278",
    clips: [6, 20, 13, 17, 7, 4, 11, 19, 5],
  },
  "cat-agent-01": {
    role: "agent",
    sha256: "b88b4f6402e99f654816dd34890c79af027f1fddb764ee7c982700f16fee61c6",
    clips: [5, 11, 18, 7, 2, 3, 17, 12, 9],
  },
} as const;

describe("preserved operator semantic receipts", () => {
  it("keeps the exact sanitized bytes and nine selected model-local verdicts", () => {
    for (const [modelId, authority] of Object.entries(accepted)) {
      const bytes = readFileSync(
        new URL(`avatar-animation-review-${modelId}.json`, evidenceRoot),
      );
      const receipt = JSON.parse(bytes.toString("utf8")) as {
        readonly schema: string;
        readonly authority: string;
        readonly manifestSha256: string;
        readonly modelId: string;
        readonly role: string;
        readonly verdicts: readonly {
          readonly semantic: string;
          readonly verdict: string;
          readonly clipIndex: number;
        }[];
      };
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        authority.sha256,
      );
      expect(receipt).toMatchObject({
        schema: "aiw.avatar-animation-review/1",
        authority: "operator-semantic-review-only",
        modelId,
        role: authority.role,
        manifestSha256:
          "335d862006a811c44818dbda8607342b2ab27318e9a713ddf2fa83cd3a41adaa",
      });
      expect(receipt.verdicts.map(({ verdict }) => verdict)).toEqual(
        Array(9).fill("selected"),
      );
      expect(receipt.verdicts.map(({ clipIndex }) => clipIndex)).toEqual(
        authority.clips,
      );
      expect(bytes.toString("utf8")).not.toMatch(
        /transcript|sessionId|credential|authorization|\/home\/|\/tmp\//iu,
      );
    }
  });
});
