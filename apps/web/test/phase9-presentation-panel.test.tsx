import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PresentationPanel } from "../src/presentation/PresentationPanel.js";
import { PHASE9_PRESENTATION_FIXTURE } from "../src/presentation/presentation-fixtures.js";

describe("Phase 9 presentation lane", () => {
  it("renders room/privacy/transport, peers, durable state, orphans, sync truth, and bounded controls", () => {
    const html = renderToStaticMarkup(
      <PresentationPanel
        state={PHASE9_PRESENTATION_FIXTURE}
        actions={{
          connect: vi.fn(),
          disconnect: vi.fn(),
          addAnnotation: vi.fn(),
          addBookmark: vi.fn(),
          setLayout: vi.fn(),
          present: vi.fn(),
          follow: vi.fn(),
          exportDocument: vi.fn(),
          deleteDocument: vi.fn(),
          clearLocal: vi.fn(),
        }}
      />,
    );
    for (const value of [
      "Presentation sync",
      "Current room",
      "private · one trusted operator",
      "ws/http · loopback",
      "2 / 16 peers",
      "Agent focus",
      "Presenter: Left desk",
      "Following: Left desk",
      "Annotations",
      "Bookmarks",
      "Layout overrides",
      "1 orphan",
      "Reconnect / offline",
      "Last sync",
      "Previous sync",
      "Export sanitized JSON",
      "Delete server state",
      "Clear local cache",
      "Presentation-only. No command authority.",
    ])
      expect(html).toContain(value);
    expect(html).not.toMatch(/\/home\/|token|terminal output|command intent/i);
  });

  it("renders disabled actions grey when no authoritative room exists", () => {
    const html = renderToStaticMarkup(
      <PresentationPanel
        state={{
          ...PHASE9_PRESENTATION_FIXTURE,
          documentId: null,
          connection: "offline",
          peers: [],
          authoritativeMessage:
            "Index a repository to establish the authoritative presentation room.",
        }}
      />,
    );
    expect(html).toContain("disabled");
    expect(html).toContain("Index a repository");
  });

  it("defaults durable actions to the authoritative current World object", () => {
    const html = renderToStaticMarkup(
      <PresentationPanel
        state={{
          ...PHASE9_PRESENTATION_FIXTURE,
          currentObjectId: "00000000000000000000000000000005",
        }}
      />,
    );
    expect(html).toContain('value="00000000000000000000000000000005"');
    expect(html).not.toContain("object_01jz8presentation");
  });
});
