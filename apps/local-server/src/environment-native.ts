import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { parseEnv } from "node:util";
/** Only provider configuration/credentials enter the throwaway home. No native tools, history, plugins or hooks. */
export async function prepareHermesEnvironment(
  profile: string,
  home: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
) {
  const config = parseYaml(
    await readFile(path.join(profile, "config.yaml"), "utf8"),
  ) as {
    model?: { default?: string; provider?: string; base_url?: string };
    providers?: unknown;
  };
  const model = config.model;
  if (!model?.default || !model.provider)
    throw new Error(
      "The selected Hermes profile needs an explicit model and provider.",
    );
  env.HERMES_HOME = home;
  const secrets = parseEnv(
    await readFile(path.join(profile, ".env"), "utf8").catch(() => ""),
  );
  for (const [key, value] of Object.entries(secrets))
    if (
      /^(OPENAI|OPENROUTER|ANTHROPIC|NOUS|GEMINI|GOOGLE|GROQ|MISTRAL|DEEPSEEK|XAI|OLLAMA|OPENCODE)_/.test(
        key,
      ) &&
      /(?:KEY|TOKEN|BASE_URL|HOST)$/.test(key)
    )
      env[key] = value;
  // Hermes owns refresh and writes through to the original global auth store.
  // A differently rooted named OAuth profile must not fall back to another account.
  if (
    path.basename(profile) !== ".hermes" &&
    /oauth|codex|nous/.test(model.provider)
  )
    throw new Error(
      "Restricted Hermes OAuth generation currently requires the default native profile; no credential copy or account fallback is used.",
    );
  env.HOME = path.dirname(profile);
  await writeFile(
    path.join(home, "config.yaml"),
    JSON.stringify({
      model,
      ...(config.providers ? { providers: config.providers } : {}),
      platform_toolsets: { cli: [] },
      toolsets: [],
      mcp_servers: {},
      plugins: { enabled: false },
      agent: { max_turns: 1 },
      memory: { memory_enabled: false, user_profile_enabled: false },
      terminal: { cwd },
      display: { show_session_id: false },
    }),
    { mode: 0o600 },
  );
  return [
    "chat",
    "--query-file",
    "-",
    "--oneshot",
    "-Q",
    "--ignore-rules",
    "--source",
    "tool",
    "--max-turns",
    "1",
    "--run-budget",
    "150",
  ];
}
