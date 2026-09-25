import { realpath, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Use only public exports from the selected installation, never a bundled/private module filename. */
export async function prepareOpenClawEnvironment(
  executable: string,
  profile: string,
  agentId: string,
  home: string,
  env: NodeJS.ProcessEnv,
): Promise<string[]> {
  let directory = path.dirname(await realpath(executable));
  let packagePath: string | undefined;
  while (true) {
    const candidate = path.join(directory, "package.json");
    const manifest = await readFile(candidate, "utf8")
      .then((s) => JSON.parse(s) as { name?: string })
      .catch(() => null);
    if (manifest?.name === "openclaw") {
      packagePath = candidate;
      break;
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  if (!packagePath)
    throw new Error(
      "The selected OpenClaw installation does not expose its restricted completion SDK. Update OpenClaw and Recheck.",
    );
  env.OPENCLAW_STATE_DIR = profile;
  env.OPENCLAW_CONFIG_PATH = path.join(profile, "openclaw.json");
  env.OPENCLAW_LOG_FILE = path.join(home, "openclaw.log");
  const script = path.join(home, "openclaw-recipe.mjs");
  await writeFile(script, OPENCLAW_RECIPE_RUNNER, { mode: 0o600 });
  return [script, packagePath, agentId];
}

// Separate plain-Node process: TS loaders can alter the selected SDK's ESM plugin resolution.
// The public host-prepared completion passes tools:[] internally and never runs an agent loop.
export const OPENCLAW_RECIPE_RUNNER = String.raw`
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
try {
  const require=createRequire(process.argv[2]);
  const sdk=await import(pathToFileURL(require.resolve('openclaw/plugin-sdk/simple-completion-runtime')).href);
  const {loadConfig}=await import(pathToFileURL(require.resolve('openclaw/plugin-sdk/config-runtime')).href);
  const cfg=loadConfig();
  const agentId=process.argv[3];
  const agentDir=path.join(process.cwd(),'agent');
  await mkdir(agentDir,{recursive:true});
  const prepared=await sdk.prepareSimpleCompletionModelForAgent({cfg,agentId,agentDir,workspaceDir:process.cwd(),skipAgentDiscovery:true,allowBundledStaticCatalogFallback:true});
  if(prepared.error||!prepared.model||!prepared.auth)throw Error('OpenClaw model/auth preparation unavailable');
  let prompt='';for await(const chunk of process.stdin)prompt+=chunk;
  const {assistant}=await sdk.runHostPreparedIsolatedCompletion({
    authorization:{owner:'host',model:prepared.model,auth:prepared.auth},config:cfg,
    prompt,systemPrompt:'Design a cosmetic World recipe. Return only the requested JSON. No tools.',
    timeoutMs:150000,thinkLevel:'high',streamParams:{maxTokens:6000},outputTextPolicy:'strict-visible'
  });
  if(assistant.stopReason!=='stop'||assistant.content.some(c=>c.type==='toolCall'))throw Error('Non-text completion');
  process.stdout.write('\nAIW_ENVIRONMENT_RESULT:'+JSON.stringify({result:sdk.extractAssistantText(assistant)})+'\n');
} catch { process.stderr.write('OpenClaw restricted completion failed. Check the selected native model/authentication and SDK support.');process.exitCode=1; }
`;
