import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { prepareHermesEnvironment } from "./environment-native.js";
import { prepareOpenClawEnvironment } from "./environment-openclaw.js";
import type { AgentEnvironmentExecution } from "./agent-environment.js";

/** Fresh recipe turn: never resumes a coding transcript or loads its tool configuration. */
export async function runEnvironmentModel(options: {
  kind: "codex" | "claude-code" | "hermes" | "openclaw";
  execution?: AgentEnvironmentExecution;
  agentId?: string;
  executable: string;
  root: string;
  profile: string;
  authPath?: string;
  model?: string;
  prompt: string;
  signal?: AbortSignal;
  environment?: NodeJS.ProcessEnv;
}): Promise<string> {
  options.signal?.throwIfAborted();
  await mkdir(options.root, { recursive: true });
  // Hermes native auth has a canonical-root read-through owner. Keep its
  // disposable config beneath that root, rather than cloning refresh tokens.
  const homeRoot =
    options.kind === "hermes"
      ? path.join(options.profile, "runs", "world-recipes")
      : options.root;
  await mkdir(homeRoot, { recursive: true, mode: 0o700 });
  const home = await mkdtemp(path.join(homeRoot, "environment-"));
  try {
    const cwd = path.join(home, "workspace");
    await mkdir(cwd);
    const execution = options.execution;
    const nativePath =
      execution?.registration.environment.kind === "windows"
        ? path.win32
        : path;
    const mapPath = (value: string) =>
      execution ? execution.mapPath(value) : value;
    const readProfile = (filename: string) =>
      execution
        ? execution.readNativeFile(filename)
        : readFile(filename, "utf8");
    let args: string[];
    let executable = options.executable;
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      LANG: process.env.LANG,
      ...(!execution ? options.environment : {}),
      HOME: mapPath(home),
      USERPROFILE: mapPath(home),
      CODEX_HOME: mapPath(home),
      CLAUDE_CONFIG_DIR: mapPath(path.join(home, ".claude")),
      XDG_CONFIG_HOME: mapPath(path.join(home, ".config")),
      XDG_CACHE_HOME: mapPath(path.join(home, ".cache")),
      XDG_DATA_HOME: mapPath(path.join(home, ".local/share")),
      XDG_STATE_HOME: mapPath(path.join(home, ".local/state")),
    };
    if (options.kind === "codex") {
      // Let the selected native CLI refresh its canonical auth owner. Never clone
      // rotating refresh tokens into a throwaway home and then discard the update.
      env.CODEX_HOME = options.profile;
      const cache = JSON.parse(
        execution
          ? await execution.pythonCommand(
              "import sys,pathlib,json; p=pathlib.Path(sys.argv[1]); assert p.stat().st_size<=4194304; d=json.loads(p.read_text(encoding='utf-8')); print(json.dumps(dict(models=[m for m in d['models'] if m.get('slug')=='gpt-5.6-sol'])))",
              [nativePath.join(options.profile, "models_cache.json")],
            )
          : await readProfile(
              nativePath.join(options.profile, "models_cache.json"),
            ),
      ) as { models: Array<Record<string, unknown>> };
      const source = cache.models.find((m) => m.slug === "gpt-5.6-sol");
      if (!source)
        throw new Error(
          "Connect Codex once to populate its model catalog before creating a World.",
        );
      const catalog = path.join(home, "models.json");
      await writeFile(
        catalog,
        JSON.stringify({
          models: [
            {
              ...source,
              shell_type: "disabled",
              apply_patch_tool_type: null,
              experimental_supported_tools: [],
              supports_image_detail_original: false,
            },
          ],
        }),
      );
      args = [
        "exec",
        "--model",
        "gpt-5.6-sol",
        "-c",
        'model_reasoning_effort="high"',
        "--ignore-user-config",
        "--ignore-rules",
        "--ephemeral",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--json",
        "-c",
        `model_catalog_json=${JSON.stringify(mapPath(catalog))}`,
        "-c",
        'web_search="disabled"',
        "-c",
        "tools.update_plan.enabled=false",
        "-c",
        "project_doc_max_bytes=0",
        "-c",
        "mcp_servers={}",
        "-c",
        "analytics.enabled=false",
      ];
      for (const feature of [
        "shell_tool",
        "unified_exec",
        "apply_patch_freeform",
        "js_repl",
        "code_mode",
        "multi_agent",
        "collab",
        "apps",
        "connectors",
        "plugins",
        "hooks",
        "codex_hooks",
        "plugin_hooks",
        "memory_tool",
        "memories",
        "view_image",
        "image_generation",
        "browser_use",
        "computer_use",
        "tool_search",
        "tool_suggest",
        "skill_search",
        "workspace_dependencies",
        "agent_message_board",
        "goals",
        "sleep_tool",
        "request_permissions",
        "search_tool",
        "standalone_web_search",
      ])
        args.push("-c", `features.${feature}=false`);
      args.push("-");
    } else if (options.kind === "openclaw") {
      if (execution)
        throw new Error(
          "OpenClaw recipe generation requires a same-environment SDK installation.",
        );
      args = await prepareOpenClawEnvironment(
        options.executable,
        options.profile,
        options.agentId ?? "main",
        home,
        env,
      );
      executable = process.execPath;
    } else if (options.kind === "hermes") {
      args = await prepareHermesEnvironment(options.profile, home, cwd, env);
    } else {
      const settings = JSON.parse(
        await readProfile(
          nativePath.join(options.profile, "settings.json"),
        ).catch(() => "{}"),
      ) as { env?: Record<string, string>; model?: string };
      for (const key of [
        "ANTHROPIC_BASE_URL",
        "ANTHROPIC_AUTH_TOKEN",
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_MODEL",
        "CLAUDE_CODE_OAUTH_TOKEN",
      ])
        if (typeof settings.env?.[key] === "string")
          env[key] = settings.env[key];
      env.CLAUDE_CONFIG_DIR = options.profile;
      args = [
        "-p",
        "--safe-mode",
        "--output-format",
        "json",
        "--tools",
        "",
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers":{}}',
        "--disable-slash-commands",
        "--no-session-persistence",
        "--setting-sources",
        "",
        "--permission-mode",
        "dontAsk",
        "--settings",
        '{"disableAllHooks":true}',
        "--system-prompt",
        "You are an environment recipe designer. Output only the requested JSON. No tools are available.",
      ];
      const model = options.model ?? settings.model ?? env.ANTHROPIC_MODEL;
      if (model) args.push("--model", model);
    }
    const nativeEnv = Object.fromEntries(
      Object.entries(env).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" &&
          !["PATH", "SystemRoot"].includes(entry[0]),
      ),
    );
    const child = execution
      ? await execution.spawn(args, cwd, nativeEnv)
      : spawn(executable, args, {
          cwd,
          env,
          detached: process.platform !== "win32",
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        });
    const output = await new Promise<string>((resolve, reject) => {
      let bytes = 0;
      let stdout = "";
      let failure: Error | null = null;
      const stop = (reason: string) => {
        if (failure) return;
        failure = new Error(reason);
        if (execution) {
          void execution.terminate(child);
          return;
        }
        if (child.pid) {
          try {
            if (process.platform !== "win32")
              process.kill(-child.pid, "SIGKILL");
            else child.kill();
          } catch {
            /* Already exited. */
          }
        }
      };
      const abort = () =>
        stop("World creation cancelled. Your previous World is unchanged.");
      const timer = setTimeout(
        () => stop("World creation timed out. Try a shorter description."),
        180000,
      );
      options.signal?.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 262144) stop("Environment response exceeded its bound");
        else stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 262144) stop("Environment response exceeded its bound");
      });
      child.on("error", () => {
        failure = new Error(
          "The selected environment generator could not start.",
        );
      });
      child.stdin.on("error", () =>
        stop("The environment generator disconnected."),
      );
      child.once("close", (code) => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        if (failure || code !== 0)
          reject(
            failure ??
              new Error(
                "The selected generator could not complete a restricted recipe turn.",
              ),
          );
        else resolve(stdout);
      });
      if (execution) execution.writeInput(child, options.prompt);
      else child.stdin.end(options.prompt);
      if (options.signal?.aborted) abort();
    });
    if (options.kind === "hermes") {
      const start = output.indexOf("{");
      const end = output.lastIndexOf("}");
      if (start < 0 || end < start)
        throw new Error("Hermes did not return a recipe.");
      return output.slice(start, end + 1);
    }
    if (options.kind === "claude-code" || options.kind === "openclaw") {
      const payload =
        options.kind === "openclaw"
          ? output
              .split(/\r?\n/u)
              .findLast((line) => line.startsWith("AIW_ENVIRONMENT_RESULT:"))
              ?.slice("AIW_ENVIRONMENT_RESULT:".length)
          : output;
      if (!payload)
        throw new Error("OpenClaw did not return a restricted recipe result.");
      const result = JSON.parse(payload) as {
        result?: string;
        is_error?: boolean;
      };
      if (result.is_error || typeof result.result !== "string")
        throw new Error("The agent did not complete its environment recipe.");
      return result.result;
    }
    let text: string | undefined;
    let completed = false;
    for (const line of output.trim().split(/\r?\n/u)) {
      const event = JSON.parse(line) as {
        type: string;
        item?: { type: string; text?: string };
      };
      if (event.type === "turn.completed") completed = true;
      if (
        event.item &&
        [
          "command_execution",
          "file_change",
          "mcp_tool_call",
          "web_search",
        ].includes(event.item.type)
      )
        throw new Error(
          "Restricted generator unexpectedly reported tool activity; recipe refused.",
        );
      if (
        event.type === "item.completed" &&
        event.item?.type === "agent_message"
      )
        text = event.item.text;
    }
    if (!completed || !text)
      throw new Error("The agent did not complete its environment recipe.");
    return text;
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
