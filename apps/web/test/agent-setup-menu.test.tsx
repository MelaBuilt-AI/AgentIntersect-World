import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AgentSetupMenu } from "../src/world-entry/AgentSetupMenu.js";

it("groups installations by environment and collapses only verified attachments into green success", () => {
  const installation = {
    id: "codex-one",
    adapterId: "codex" as const,
    environment: {
      id: "wsl:Ubuntu",
      kind: "wsl" as const,
      label: "WSL (Ubuntu)",
      distro: "Ubuntu",
    },
    executablePath: "/bin/codex",
    homePath: "/home/user",
    identities: [
      {
        id: "default",
        label: "Default",
        kind: "profile" as const,
        profilePath: "/home/user/.codex",
      },
    ],
    status: "found" as const,
  };
  const registration = {
    id: "11111111-1111-4111-8111-111111111111",
    adapterId: installation.adapterId,
    environment: installation.environment,
    installationId: installation.id,
    executablePath: installation.executablePath,
    homePath: installation.homePath,
    identity: installation.identities[0]!,
    displayName: "Codex 1",
    connectedAt: "2026-09-13T12:00:00Z",
  };
  const props = {
    state: {
      schema: "aiw.agent-setup/1" as const,
      completed: true,
      registrations: [registration],
    },
    discovery: {
      environments: [
        { id: "wsl:Ubuntu", label: "WSL (Ubuntu)", status: "scanned" as const },
      ],
      installations: [
        installation,
        { ...installation, id: "codex-two", executablePath: "/other/codex" },
      ],
    },
    busy: false,
    message: "",
    onDiscover() {},
    onAttach() {},
    onRecheck() {},
    onComplete() {},
  };
  const ready = renderToStaticMarkup(
    <AgentSetupMenu
      {...props}
      checks={{ [registration.id]: { status: "ready", message: "Verified" } }}
    />,
  );
  expect(ready.match(/data-setup-environment="wsl"/g)).toHaveLength(1);
  expect(ready).toContain('class="agent-setup-success"');
  expect(ready).toContain("Successfully Connected");
  expect(ready).toContain("Codex 1");
  const offline = renderToStaticMarkup(
    <AgentSetupMenu
      {...props}
      checks={{
        [registration.id]: {
          status: "needs-attention",
          message: "Disconnected",
        },
      }}
    />,
  );
  expect(offline).not.toContain("Successfully Connected");
  expect(offline).toContain('value="Codex 1"');
});

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
