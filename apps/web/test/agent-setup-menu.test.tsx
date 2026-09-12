import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

it("shows one discovery action, all four harnesses and truthful found-versus-attached state", async () => {
  const module = await import("../src/world-entry/AgentSetupMenu.js").catch(
    () => null,
  );
  expect(module?.AgentSetupMenu).toBeTypeOf("function");
  if (!module) return;
  const html = renderToStaticMarkup(
    <module.AgentSetupMenu
      state={{
        schema: "aiw.agent-setup/1",
        completed: false,
        registrations: [],
      }}
      discovery={{
        environments: [
          {
            id: "wsl:Ubuntu",
            label: "Ubuntu",
            status: "stopped",
            message: "Start this distribution yourself, then Recheck.",
          },
        ],
        installations: [
          {
            id: "windows-codex",
            adapterId: "codex",
            environment: { id: "windows", kind: "windows", label: "Windows" },
            executablePath: "C:\\Agent Tools\\codex.cmd",
            homePath: "C:\\Users\\Example",
            identities: [
              {
                id: "work",
                label: "Work",
                kind: "profile",
                profilePath: "C:\\Users\\Example\\.codex",
              },
            ],
            status: "found",
          },
        ],
      }}
      busy={false}
      message="Discovery finished."
      onDiscover={() => {}}
      onAttach={() => {}}
      onRecheck={() => {}}
      onComplete={() => {}}
    />,
  );
  expect(html).toContain('role="dialog"');
  expect(html).toContain("Agent Setup Menu");
  expect(html.match(/>Discover Agents</g)).toHaveLength(1);
  for (const label of ["Hermes", "OpenClaw", "Codex", "Claude Code"])
    expect(html).toContain(label);
  expect(html).toContain("Windows");
  expect(html).toContain("Native identity");
  expect(html).toContain("Attach to Agent Intersect World");
  expect(html).toContain("Agent name");
  expect(html).toContain("Preview prerequisites");
  expect(html).toContain("Recheck selected identity");
  expect(html).toContain("Found — not attached");
  expect(html).toContain("Start this distribution yourself");
  expect(html).toMatch(/disabled=""[^>]*>Continue to Agent Select/);
});
