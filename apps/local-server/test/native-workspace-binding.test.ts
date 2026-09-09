import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { CodexSessionAdapter } from "../src/codex-session-adapter.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

it("dispatches native work in the owned cwd with system context while keeping metadata separate", async () => {
  const root = await mkdtemp(join(tmpdir(), "aiw-native-cwd-"));
  roots.push(root);
  const workspace = join(root, "owned-worktree");
  const metadata = join(root, "metadata");
  const evidenceDirectory = join(root, "receipt-only");
  await mkdir(workspace);
  await mkdir(metadata);
  await mkdir(evidenceDirectory);
  const executablePath = join(root, "native.mjs");
  const record = join(root, "invocation.json");
  const authPath = join(root, "auth.json");
  await writeFile(authPath, "{}");
  await writeFile(
    executablePath,
    `#!/usr/bin/env node
import fs from 'node:fs';
let input = ''; for await (const chunk of process.stdin) input += chunk;
if (process.argv.includes('resume')) {
 fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({cwd:process.cwd(), home:process.env.CODEX_HOME, input, args:process.argv.slice(2)}));
 fs.writeFileSync('index.html', '<h1>Owned homepage</h1>');
}
for (const event of [{type:'thread.started',thread_id:'11111111-1111-4111-8111-111111111111'}, {type:'turn.started'}, {type:'item.completed',item:{type:'agent_message',text:'done'}}, {type:'turn.completed'}]) console.log(JSON.stringify(event));
`,
    { mode: 0o700 },
  );
  const adapter = new CodexSessionAdapter({
    executablePath,
    nativeSessionRoot: metadata,
    authPath,
  });
  const session = await adapter.createWorldSession("world-cwd", "Coder");
  const context = {
    mode: "collaborate" as const,
    workingDirectory: workspace,
    evidenceDirectory,
    systemMessage: "Use only the assigned worktree. No external hosting.",
  };
  await adapter.sendText(session.id, "Build homepage", context);
  const invoked = JSON.parse(await readFile(record, "utf8"));
  expect(invoked.cwd).toBe(workspace);
  expect(invoked.args.slice(0, 3)).toEqual([
    "exec",
    "--add-dir",
    evidenceDirectory,
  ]);
  expect(invoked.args.indexOf("--add-dir")).toBeLessThan(
    invoked.args.indexOf("resume"),
  );
  expect(invoked.home.startsWith(metadata)).toBe(true);
  expect(invoked.input).toContain(context.systemMessage);
  expect(invoked.input).toContain("Build homepage");
  expect(await readFile(join(workspace, "index.html"), "utf8")).toContain(
    "Owned homepage",
  );
  await expect(readFile(join(metadata, "index.html"))).rejects.toThrow();
  await adapter.endWorldSession("world-cwd", session.id);
});
