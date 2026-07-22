import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  PHASE14_JOURNEY_FIXTURE,
  Phase14JourneyExperience,
} from "../src/phase14/Phase14JourneyPanel.js";
import { Phase14Client } from "../src/phase14/phase14-client.js";

describe("Phase 14 semantic developer journey", () => {
  it("renders all ten numbered steps and distinct action/evidence/status regions", () => {
    const html = renderToStaticMarkup(
      <Phase14JourneyExperience
        state={PHASE14_JOURNEY_FIXTURE}
        onAction={() => undefined}
      />,
    );
    expect(html.match(/phase14-step__/g) ?? []).toHaveLength(10);
    expect(html).toContain("1. Attach fixture session");
    expect(html).toContain("10. Stop, clean, correlate");
    expect(html).toContain('aria-label="Phase 14 actions"');
    expect(html).toContain('aria-label="Phase 14 evidence"');
    expect(html).toContain('aria-label="Phase 14 authoritative status"');
    expect(html).toContain('aria-live="polite"');
  });

  it("shows exact file/symbol, explanation labels, current/previous diff, test, preview, and correlation", () => {
    const html = renderToStaticMarkup(
      <Phase14JourneyExperience
        state={PHASE14_JOURNEY_FIXTURE}
        onAction={() => undefined}
      />,
    );
    for (const text of [
      "src/greeting.mjs",
      "greeting",
      "source-fact",
      "runtime-observation",
      "test-result",
      "interpretation",
      "Previous source",
      "Current source",
      "node --test test/greeting.test.mjs",
      "http://127.0.0.1:43114/",
      "aiw://evidence/phase14-fixture-preview-health",
    ])
      expect(html).toContain(text);
  });

  it("uses blue enabled primary actions, grey disabled controls, and exposes revoke/cancel/stop", () => {
    const html = renderToStaticMarkup(
      <Phase14JourneyExperience
        state={{ ...PHASE14_JOURNEY_FIXTURE, step: 4, status: "active" }}
        onAction={() => undefined}
      />,
    );
    expect(html).toMatch(/class="phase14-primary"[^>]*>Approve once/);
    expect(html).toMatch(/class="phase14-primary"[^>]*disabled="">Apply edit/);
    expect(html).toContain("Revoke approval");
    expect(html).toContain("Cancel operation");
    expect(html).toContain("Stop preview");
  });

  it("keeps success authoritative and does not render thought/reasoning theater", () => {
    const html = renderToStaticMarkup(
      <Phase14JourneyExperience
        state={PHASE14_JOURNEY_FIXTURE}
        onAction={() => undefined}
      />,
    );
    expect(html).toContain("Authoritative event state");
    expect(html).not.toMatch(
      /chain.of.thought|hidden reasoning|thought bubble/i,
    );
  });

  it("allows a new disposable journey after retained terminal evidence", () => {
    const html = renderToStaticMarkup(
      <Phase14JourneyExperience
        state={PHASE14_JOURNEY_FIXTURE}
        onAction={() => undefined}
      />,
    );
    expect(html).toMatch(/<button[^>]*>Attach fixture session<\/button>/);
    expect(html).not.toMatch(
      /<button[^>]*disabled=""[^>]*>Attach fixture session<\/button>/,
    );
  });
});

describe("Phase 14 narrow API client", () => {
  it("uses only predeclared journey routes and never sends root/command authority", async () => {
    const fetcher = vi.fn(
      async (_url: string, init?: RequestInit) =>
        new Response(JSON.stringify(PHASE14_JOURNEY_FIXTURE), {
          status: init?.method === "POST" ? 201 : 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new Phase14Client(fetcher as typeof fetch);
    await client.create();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/phase14/journeys",
      expect.objectContaining({ method: "POST", body: "{}" }),
    );
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/rootPath|command/);
  });
});
