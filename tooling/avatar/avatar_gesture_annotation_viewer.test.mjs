import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execPath } from "node:process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { test } from "node:test";
import { clearTimeout, setTimeout } from "node:timers";

import { chromium } from "@playwright/test";

const root = normalize(join(dirname(fileURLToPath(import.meta.url)), "../.."));
const packageRelative =
  "artifacts/avatar-replacement-evidence/world-animation-metadata-investigation-v1/annotation-package";
const viewerPath = join(root, packageRelative, "viewer.html");
const templatePath = join(root, packageRelative, "annotation-template.json");
const contentTypes = new Map([
  [".glb", "model/gltf-binary"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
]);
const clone = (value) => JSON.parse(JSON.stringify(value));

function startStaticServer(responseGates) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url ?? "/", "http://127.0.0.1").pathname,
      );
      const gate = responseGates.get(pathname);
      if (gate) {
        gate.markRequested();
        await gate.release;
      }
      const resolved = normalize(join(root, pathname));
      if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const payload = await readFile(resolved);
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type":
          contentTypes.get(extname(resolved)) ?? "application/octet-stream",
      });
      response.end(payload);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object");
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function withTimeout(promise, label, milliseconds = 10_000) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

test("raw annotation viewer is fail-closed over its supported HTTP workflow", async (context) => {
  const viewer = await readFile(viewerPath, "utf8");
  const moduleSource = viewer.match(
    /<script type="module">(?<source>[\s\S]*?)<\/script>/,
  )?.groups?.source;
  assert(moduleSource, "generated viewer module must exist");
  const syntax = spawnSync(execPath, ["--input-type=module", "--check"], {
    encoding: "utf8",
    input: moduleSource,
  });
  assert.equal(syntax.status, 0, syntax.stderr);

  const responseGates = new Map();
  const { server, origin } = await startStaticServer(responseGates);
  const browser = await chromium.launch({ headless: true });
  context.after(async () => {
    server.closeAllConnections();
    server.close();
    await browser.close();
  });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    globalThis.requestAnimationFrame = (callback) =>
      globalThis.setTimeout(() => callback(globalThis.performance.now()), 50);
    globalThis.cancelAnimationFrame = (identifier) =>
      globalThis.clearTimeout(identifier);
  });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (!response.ok())
      errors.push(
        `HTTP ${response.status()} ${new URL(response.url()).pathname}`,
      );
  });

  await page.goto(`${origin}/${packageRelative}/viewer.html`);
  try {
    await page
      .getByText(/0 \/ 230 gesture decisions resolved/)
      .waitFor({ timeout: 10_000 });
  } catch (error) {
    throw new Error(`viewer failed to initialize: ${errors.join(" | ")}`, {
      cause: error,
    });
  }
  await page.getByText(/Raw clip ready/).waitFor({ timeout: 20_000 });
  assert.equal(
    await page.locator("#canvas").getAttribute("data-loaded-model-id"),
    "cat-agent-01",
  );

  const rawIdentity = await page.locator("#rawIdentity").textContent();
  assert.match(
    rawIdentity ?? "",
    /^cat-agent-01 · clip \d{2} · source name NlaTrack/,
  );
  assert.doesNotMatch(
    rawIdentity ?? "",
    /Jump|Dance|Clap|Cheer|Wave|Bow|Agree|Angry|Laugh|Dig/,
  );

  for (const selector of ["#play", "#loop", "#speed", "#scrub"]) {
    assert.equal(await page.locator(selector).count(), 1);
  }
  assert.equal(await page.locator('#decision option[value="Dig"]').count(), 1);
  await page.locator("#play").click();
  assert.equal(await page.locator("#play").textContent(), "Play");
  await page.locator("#play").click();
  assert.equal(await page.locator("#play").textContent(), "Pause");
  await page.locator("#loop").uncheck();
  assert.equal(await page.locator("#loop").isChecked(), false);
  await page.locator("#speed").selectOption("2");
  assert.equal(await page.locator("#speed").inputValue(), "2");
  await page.locator("#scrub").evaluate((element) => {
    element.value = String(Number(element.max) / 2);
    element.dispatchEvent(
      new element.ownerDocument.defaultView.Event("input", { bubbles: true }),
    );
  });
  assert.equal(await page.locator("#play").textContent(), "Play");

  await page.locator("#decision").selectOption("Jump");
  await page
    .locator("#evidence")
    .fill("human-temporal-review:headless/cat-agent-01/clip");
  await page
    .locator("#notes")
    .fill(
      "Complete temporal playback was reviewed in the headless workflow test.",
    );
  await page.getByText(/1 \/ 230 gesture decisions resolved/).waitFor();
  const jumpDecision = page.getByLabel("Jump decision", { exact: true });
  assert.equal(await jumpDecision.inputValue(), "selected");
  assert.match(
    (await jumpDecision.locator("option:checked").textContent()) ?? "",
    /^Selected · clip \d{2}$/,
  );
  await page
    .getByLabel("Dig decision", { exact: true })
    .selectOption("uncertain");
  await page
    .getByLabel("Dig decision evidence")
    .fill("human-temporal-review:headless/cat-agent-01/all-clips");
  await page
    .getByLabel("Dig decision notes")
    .fill("All raw clips were reviewed; Dig remains uncertain.");
  await page.getByText(/2 \/ 230 gesture decisions resolved/).waitFor();
  const digRefusal = page.getByLabel("Dig decision", { exact: true });
  assert.ok(
    (await digRefusal.evaluate(
      (element) => element.getBoundingClientRect().width,
    )) >= 208,
    "Dig decision state must be visibly legible",
  );
  await digRefusal.selectOption("");
  await page.getByText(/1 \/ 230 gesture decisions resolved/).waitFor();
  await page.locator("#clip").selectOption("1");
  await page.locator("#decision").selectOption("Jump");
  await page.getByText(/already has a decision/).waitFor();
  assert.equal(await page.locator("#decision").inputValue(), "uncertain");

  const template = JSON.parse(await readFile(templatePath, "utf8"));
  const malformed = clone(template);
  malformed.models[0].clips[0].annotation = {
    decision: "Jump",
    evidenceReference: "human-temporal-review:headless/malformed",
  };
  malformed.progress = {
    resolvedDecisionCount: 1,
    remainingDecisionCount: 229,
  };
  await page.locator("#importFile").setInputFiles({
    name: "malformed.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(malformed)),
  });
  await page.getByText(/malformed annotation fields/).waitFor();
  await page.getByText(/1 \/ 230 gesture decisions resolved/).waitFor();
  assert.equal(await page.locator("#decision").inputValue(), "uncertain");

  const duplicate = clone(template);
  for (const clip of duplicate.models[0].clips.slice(0, 2)) {
    clip.annotation = {
      decision: "Jump",
      evidenceReference: "human-temporal-review:headless/duplicate",
      notes: "Conclusive duplicate fixture.",
    };
  }
  duplicate.progress = {
    resolvedDecisionCount: 1,
    remainingDecisionCount: 229,
  };
  await page.locator("#importFile").setInputFiles({
    name: "duplicate.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(duplicate)),
  });
  await page.getByText(/duplicate semantic assignment/).waitFor();
  await page.getByText(/1 \/ 230 gesture decisions resolved/).waitFor();

  const conflict = clone(template);
  conflict.models[0].clips[0].annotation = {
    decision: "Jump",
    evidenceReference: "human-temporal-review:headless/conflict",
    notes: "Conclusive conflict fixture.",
  };
  conflict.models[0].unsupportedSemantics = [
    {
      semantic: "Jump",
      evidenceReference: "human-temporal-review:headless/conflict-model",
      notes: "Conflicting model-level fixture.",
    },
  ];
  conflict.progress = { resolvedDecisionCount: 1, remainingDecisionCount: 229 };
  await page.locator("#importFile").setInputFiles({
    name: "conflict.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(conflict)),
  });
  await page.getByText(/both assigned and unsupported/).waitFor();
  await page.getByText(/1 \/ 230 gesture decisions resolved/).waitFor();

  const staleCatalog = clone(template);
  staleCatalog.models[0].clips[0].sourceName = "stale-catalog-fixture";
  await page.locator("#importFile").setInputFiles({
    name: "stale-catalog.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(staleCatalog)),
  });
  await page.getByText(/stale raw clip identity/).waitFor();
  await page.getByText(/1 \/ 230 gesture decisions resolved/).waitFor();
  assert.equal(await page.locator("#decision").inputValue(), "uncertain");

  let releaseDelayedModel;
  let markDelayedRequest;
  const delayedRequest = new Promise((resolve) => {
    markDelayedRequest = resolve;
  });
  const release = new Promise((resolve) => {
    releaseDelayedModel = resolve;
  });
  responseGates.set(
    "/apps/web/public/assets/imported-avatars/cat-agent-02.glb",
    {
      markRequested: markDelayedRequest,
      release,
    },
  );
  try {
    await page.locator("#model").selectOption("1");
    await withTimeout(delayedRequest, "delayed model request");
    await page.locator("#model").selectOption("2");
    await page
      .locator('#canvas[data-loaded-model-id="cat-agent-03"]')
      .waitFor({ timeout: 20_000 });
  } finally {
    releaseDelayedModel();
  }
  await page.waitForTimeout(500);
  assert.equal(await page.locator("#model").inputValue(), "2");
  assert.equal(
    await page.locator("#canvas").getAttribute("data-selected-model-id"),
    "cat-agent-03",
  );
  assert.equal(
    await page.locator("#canvas").getAttribute("data-loaded-model-id"),
    "cat-agent-03",
  );
  assert.deepEqual(errors, []);
});
