import { access, copyFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);

// Process-local only: child agents/terminals inherit Git; Windows/user PATH and
// Git identity/configuration are never modified. Source checkouts have no bundle.
export async function configureBundledGit(
  root,
  env = process.env,
  platform = process.platform,
) {
  if (platform !== "win32") return;
  try {
    await access(root);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  await access(join(root, "cmd", "git.exe"));
  await access(join(root, "bin", "bash.exe"));
  const pathKey =
    Object.keys(env).find((key) => key.toLowerCase() === "path") || "Path";
  env[pathKey] = [join(root, "cmd"), join(root, "bin"), env[pathKey]]
    .filter(Boolean)
    .join(";");
  env.CLAUDE_CODE_GIT_BASH_PATH ||= join(root, "bin", "bash.exe");
  let needsSetup = false;
  try {
    await access(join(root, "post-install.bat"));
    needsSetup = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (needsSetup) {
    // Upstream requires this after manual extraction. It initializes only this
    // private Git tree and removes its own script. Run on the target, not builder.
    // Upstream deletes post-install.bat. Execute identical bytes under a temporary
    // filename so cmd does not fail reopening the self-deleted executing script.
    const script = `world-post-install-${process.pid}.bat`;
    await copyFile(join(root, "post-install.bat"), join(root, script));
    try {
      await execute(
        join(root, "git-bash.exe"),
        ["--no-needs-console", "--hide", "--no-cd", `--command=${script}`],
        { cwd: root, env, windowsHide: true, timeout: 30000 },
      );
    } finally {
      await rm(join(root, script), { force: true });
    }
  }
}
