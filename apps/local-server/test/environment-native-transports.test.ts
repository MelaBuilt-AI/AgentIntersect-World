import { it, expect, vi } from "vitest";
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
import path from "node:path";
import { AgentEnvironmentExecution } from "../src/agent-environment.js";
import { runEnvironmentModel } from "../src/environment-model.js";

it("uses the selected OpenClaw public zero-tool completion API, not agent exec or coding chat", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "world-openclaw-sdk-"));
  try {
    const install = path.join(root, "install");
    await mkdir(install);
    await writeFile(
      path.join(install, "package.json"),
      JSON.stringify({
        name: "openclaw",
        type: "module",
        exports: {
          "./plugin-sdk/simple-completion-runtime": "./sdk.js",
          "./plugin-sdk/config-runtime": "./config.js",
        },
      }),
    );
    await writeFile(path.join(install, "openclaw.mjs"), "");
    await writeFile(
      path.join(install, "config.js"),
      "export const loadConfig=()=>({agents:{entries:{designer:{model:'fixture/model'}}}});",
    );
    await writeFile(
      path.join(install, "sdk.js"),
      `export async function prepareSimpleCompletionModelForAgent(p){if(p.agentId!=='designer'||!p.skipAgentDiscovery)throw Error('selection');return {model:{id:'model'},auth:{fixture:true}};} export async function runHostPreparedIsolatedCompletion(p){if(p.authorization.owner!=='host'||!p.prompt.includes('FIXTURE')||p.timeoutMs!==150000)throw Error('scope');return {assistant:{stopReason:'stop',content:[{type:'text',text:'{"name":"fixture"}'}]}};} export const extractAssistantText=a=>a.content[0].text;`,
    );
    const runs = path.join(root, "runs");
    expect(
      await runEnvironmentModel({
        kind: "openclaw",
        executable: path.join(install, "openclaw.mjs"),
        profile: root,
        agentId: "designer",
        root: runs,
        prompt: "FIXTURE",
      }),
    ).toBe('{"name":"fixture"}');
    expect(await readdir(runs)).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("routes a restricted Claude turn through native execution with mapped private state and no ambient provider leakage", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "world-native-recipe-"));
  try {
    const profile = path.join(root, "profile");
    await mkdir(profile);
    await writeFile(
      path.join(profile, "settings.json"),
      JSON.stringify({ model: "selected-cloud-model" }),
    );
    const cli = path.join(root, "cli");
    await writeFile(
      cli,
      `#!${process.execPath}\nconst fs=require('fs'); const a=process.argv;if(a[a.indexOf('--model')+1]!=='selected-cloud-model'||a[a.indexOf('--tools')+1]!==''||process.env.ANTHROPIC_BASE_URL||!process.env.HOME.includes('environment-'))process.exit(4);process.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({result:'{"name":"native"}'})));`,
    );
    await chmod(cli, 0o700);
    const registration = {
      adapterId: "claude-code",
      executablePath: cli,
      environment: { id: "local", kind: "linux" },
      identity: { profilePath: profile },
      homePath: root,
    } as ConstructorParameters<typeof AgentEnvironmentExecution>[0];
    const execution = new AgentEnvironmentExecution(
      registration,
      { platform: process.platform },
      "python3",
    );
    const nativeSpawn = vi.spyOn(execution, "spawn");
    const runs = path.join(root, "runs");
    const old = process.env.ANTHROPIC_BASE_URL;
    process.env.ANTHROPIC_BASE_URL = "http://unselected.invalid";
    try {
      expect(
        await runEnvironmentModel({
          kind: "claude-code",
          executable: cli,
          profile,
          root: runs,
          prompt: "FIXTURE",
          execution,
        }),
      ).toBe('{"name":"native"}');
      expect(nativeSpawn).toHaveBeenCalledOnce();
      expect(await readdir(runs)).toEqual([]);
      expect(
        JSON.parse(await readFile(path.join(profile, "settings.json"), "utf8"))
          .model,
      ).toBe("selected-cloud-model");
    } finally {
      if (old === undefined) delete process.env.ANTHROPIC_BASE_URL;
      else process.env.ANTHROPIC_BASE_URL = old;
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("selects the bounded model record from a native Codex catalog larger than a credential file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "world-native-catalog-"));
  try {
    const profile = path.join(root, "profile");
    await mkdir(profile);
    await writeFile(path.join(profile, "auth.json"), "{}");
    await writeFile(
      path.join(profile, "models_cache.json"),
      JSON.stringify({
        models: [
          { slug: "unused", padding: "x".repeat(300000) },
          { slug: "gpt-5.6-sol", shell_type: "default" },
        ],
      }),
    );
    const cli = path.join(root, "cli");
    await writeFile(
      cli,
      `#!${process.execPath}\nconst fs=require('fs');const arg=process.argv.find(a=>a.startsWith('model_catalog_json='));const c=JSON.parse(fs.readFileSync(JSON.parse(arg.split('=').slice(1).join('=')),'utf8'));if(c.models.length!==1||c.models[0].shell_type!=='disabled')process.exit(3);process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'{"name":"native-codex"}'}}));console.log(JSON.stringify({type:'turn.completed'}));});`,
    );
    await chmod(cli, 0o700);
    const registration = {
      adapterId: "codex",
      executablePath: cli,
      environment: { id: "local", kind: "linux" },
      identity: { profilePath: profile },
      homePath: root,
    } as ConstructorParameters<typeof AgentEnvironmentExecution>[0];
    const execution = new AgentEnvironmentExecution(
      registration,
      { platform: process.platform },
      "python3",
    );
    expect(
      await runEnvironmentModel({
        kind: "codex",
        executable: cli,
        profile,
        root: path.join(root, "runs"),
        prompt: "FIXTURE",
        execution,
      }),
    ).toBe('{"name":"native-codex"}');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each(["codex", "claude-code"] as const)(
  "keeps %s credential refresh in its canonical native owner",
  async (kind) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "world-auth-owner-"));
    try {
      const profile = path.join(root, "profile");
      await mkdir(profile);
      await writeFile(path.join(profile, "auth.json"), "{}");
      await writeFile(
        path.join(profile, "models_cache.json"),
        JSON.stringify({ models: [{ slug: "gpt-5.6-sol" }] }),
      );
      const cli = path.join(root, "cli");
      await writeFile(
        cli,
        `#!${process.execPath}\nconst fs=require('fs');const profile=${JSON.stringify(profile)};const actual=process.env.CODEX_HOME;const claude=process.env.CLAUDE_CONFIG_DIR;const kind=${JSON.stringify(kind)};if((kind==='codex'?actual:claude)!==profile)process.exit(3);process.stdin.resume();process.stdin.on('end',()=>{if(kind==='claude-code')console.log(JSON.stringify({result:'{}'}));else{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'{}'}}));console.log(JSON.stringify({type:'turn.completed'}));}});`,
      );
      await chmod(cli, 0o700);
      expect(
        await runEnvironmentModel({
          kind,
          executable: cli,
          profile,
          root: path.join(root, "runs"),
          prompt: "FIXTURE",
        }),
      ).toBe("{}");
      expect(await readdir(path.join(root, "runs"))).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
