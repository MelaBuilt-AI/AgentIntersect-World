import { it, expect } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  chmod,
} from "node:fs/promises";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { runEnvironmentModel } from "../src/environment-model.js";

it("preserves the configured local Claude model rather than falling back to a cloud alias", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "world-claude-model-"));
  try {
    const cli = path.join(root, "cli");
    await writeFile(
      cli,
      `#!${process.execPath}\nif(process.argv[process.argv.indexOf('--model')+1]!=='local-configured-model')process.exit(9);process.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({result:'{"name":"local"}'})));`,
    );
    await chmod(cli, 0o700);
    await expect(
      runEnvironmentModel({
        kind: "claude-code",
        executable: cli,
        profile: root,
        root: path.join(root, "runs"),
        model: "local-configured-model",
        prompt: "fixture",
      }),
    ).resolves.toBe('{"name":"local"}');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each(["hermes"] as const)(
  "runs %s with private state and an empty tool surface without copying refresh credentials",
  async (kind) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "world-recipe-native-"));
    try {
      const profile = path.join(root, ".hermes");
      await mkdir(profile);
      await writeFile(
        path.join(profile, "config.yaml"),
        JSON.stringify({
          model: { default: "test-model", provider: "openai-codex" },
        }),
      );
      await writeFile(path.join(profile, "auth.json"), '{"fixture":true}');
      await writeFile(
        path.join(profile, "openclaw.json"),
        JSON.stringify({
          agents: { defaults: { model: { primary: "openai/test-model" } } },
        }),
      );
      const auth = path.join(profile, "agents/main/agent");
      await mkdir(auth, { recursive: true });
      const db = new DatabaseSync(path.join(auth, "openclaw-agent.sqlite"));
      db.exec(
        "CREATE TABLE auth_profile_store(store_key TEXT,store_json TEXT,updated_at INTEGER)",
      );
      db.prepare("INSERT INTO auth_profile_store VALUES(?,?,?)").run(
        "primary",
        JSON.stringify({
          profiles: {
            fixture: {
              provider: "openai",
              type: "oauth",
              access: "fixture-only",
              refresh: "do-not-copy",
              expires: Date.now() + 900000,
            },
          },
        }),
        Date.now(),
      );
      db.close();
      const executable = path.join(root, "cli");
      await writeFile(
        executable,
        `#!${process.execPath}\nconst fs=require('fs'); let input=''; process.stdin.on('data',x=>input+=x);process.stdin.on('end',()=>{ const kind=${JSON.stringify(kind)}; const home=process.env.HERMES_HOME||process.argv[process.argv.indexOf('--state-dir')+1];if(fs.existsSync(home+'/auth.json'))process.exit(12);const cfg=JSON.parse(fs.readFileSync(home+(kind==='hermes'?'/config.yaml':'/openclaw.json'),'utf8'));if(kind==='hermes' ? cfg.platform_toolsets.cli.length!==0 : cfg.tools.deny[0]!=='*')process.exit(7);if(!input.includes('DESIGN_FIXTURE'))process.exit(8);console.log(kind==='hermes' ? '{"name":"fixture"}' : JSON.stringify({ok:true,status:'ok',final:'{"name":"fixture"}'}));});`,
      );
      await chmod(executable, 0o700);
      const runs = path.join(root, "runs");
      const result = await runEnvironmentModel({
        kind,
        executable,
        root: runs,
        profile,
        prompt: "DESIGN_FIXTURE",
      });
      expect(result).toBe('{"name":"fixture"}');
      expect(await readdir(runs)).toEqual([]);
      expect(
        JSON.parse(await readFile(path.join(profile, "auth.json"), "utf8")),
      ).toEqual({ fixture: true });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
