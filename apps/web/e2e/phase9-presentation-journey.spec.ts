import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const profile = {
  schema: "aiw.avatar-store/0.11",
  current: {
    schema: "aiw.avatar/0.11",
    profileId: "avatar_0123456789abcdef0123456789abcdef",
    agentRef: null,
    agentName: "Codex",
    species: "human",
    head: "round",
    hands: "hands",
    feet: "feet",
    fur: "none",
    tail: "none",
    markings: "solid",
    bodyColor: "warm-light",
    shirt: "Codex",
    mappingConsent: false,
    sourceDisclosure: "manual-local-input",
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: "2026-07-20T12:00:00.000Z",
  },
  previous: null,
};

let fixtureRoot = "";
let worldObjectId = "";
const presentationRoot = "/tmp/aiw-phase9-playwright-presentation";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  await rm(presentationRoot, { recursive: true, force: true });
  fixtureRoot = await mkdtemp(join(tmpdir(), "aiw-phase9-e2e-"));
  await writeFile(
    join(fixtureRoot, "package.json"),
    JSON.stringify({ name: "phase9-presentation-fixture" }),
  );
  await writeFile(join(fixtureRoot, "island.ts"), "export const island = 9;\n");
  const started = await request.post("/api/repository-indexes", {
    headers: { "idempotency-key": "phase9-presentation-fixture-v1" },
    data: { rootPath: fixtureRoot },
  });
  expect(started.ok()).toBe(true);
  const operationId = started.json().then((body) => body.data.id as string);
  await expect
    .poll(async () => {
      const response = await request.get(
        `/api/repository-indexes/${await operationId}`,
      );
      return (await response.json()).data.status as string;
    })
    .toBe("succeeded");
  const world = await request.get("/api/world/current");
  expect(world.ok()).toBe(true);
  const files = (await world.json()).data.snapshot.objects
    .filter((object: { kind: string }) => object.kind === "file")
    .sort((left: { id: string }, right: { id: string }) =>
      left.id.localeCompare(right.id),
    );
  worldObjectId = files[0]?.id as string;
  expect(worldObjectId).toMatch(/^[a-f0-9]{32}$/);
});

test.afterAll(async () => {
  await Promise.all([
    fixtureRoot
      ? rm(fixtureRoot, { recursive: true, force: true })
      : Promise.resolve(),
    rm(presentationRoot, { recursive: true, force: true }),
  ]);
});

test("two browser contexts converge durable and ephemeral presentation state", async ({
  browser,
}) => {
  const leftContext = await browser.newContext();
  const rightContext = await browser.newContext();
  for (const context of [leftContext, rightContext]) {
    await context.addInitScript(
      (value) =>
        localStorage.setItem("aiw.avatar.profile.0.11", JSON.stringify(value)),
      profile,
    );
  }
  const left = await leftContext.newPage();
  const right = await rightContext.newPage();
  const browserErrors: string[] = [];
  for (const page of [left, right]) {
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
  }
  await Promise.all([
    left.goto("/internal/dashboard?view=left"),
    right.goto("/internal/dashboard?view=right"),
  ]);
  const leftLane = left.getByRole("region", { name: "Presentation sync" });
  const rightLane = right.getByRole("region", { name: "Presentation sync" });
  await expect(leftLane.getByText("connected", { exact: true })).toBeVisible();
  await expect(
    rightLane.getByText("2 / 16 peers", { exact: true }),
  ).toBeVisible();
  const room = await leftLane
    .getByText("Current room", { exact: true })
    .locator("..")
    .locator("strong")
    .textContent();
  expect(room).toMatch(/^doc_[a-f0-9]{32}$/);
  await expect(rightLane).toContainText(room ?? "missing-room");
  await expect(rightLane).toContainText(`Agent focus: ${worldObjectId}`);
  await expect(rightLane).toContainText("0 owned agents");
  await expect(leftLane.getByLabel("Opaque object ID")).toHaveValue(
    worldObjectId,
  );

  await leftLane
    .getByLabel("Shared plain-text note")
    .fill("Phase 9 shared note");
  await leftLane.getByRole("button", { name: "Add annotation" }).click();
  await expect(
    rightLane.getByText("Annotations", { exact: true }).locator(".."),
  ).toContainText("1");
  await leftLane.getByRole("button", { name: "Add bookmark" }).click();
  await leftLane.getByRole("button", { name: "Set layout override" }).click();
  await expect(
    rightLane.getByText("Bookmarks", { exact: true }).locator(".."),
  ).toContainText("1");
  await expect(
    rightLane.getByText("Layout overrides", { exact: true }).locator(".."),
  ).toContainText("1");
  await expect(rightLane).toContainText("0 orphans");

  await leftLane.getByRole("button", { name: "Present this view" }).click();
  await expect(rightLane).toContainText("Presenter: Left desk");
  await rightLane.getByRole("button", { name: "Follow presenter" }).click();
  await expect(rightLane).toContainText("Following: Left desk");

  await rightLane.getByRole("button", { name: "Work offline" }).click();
  await expect(leftLane).toContainText("1 / 16 peers");
  await leftLane.getByRole("button", { name: "Add annotation" }).click();
  await rightLane
    .getByLabel("Shared plain-text note")
    .fill("Right offline note");
  await rightLane.getByRole("button", { name: "Add annotation" }).click();
  await rightLane.getByRole("button", { name: "Reconnect" }).click();
  await expect(rightLane.getByText("connected", { exact: true })).toBeVisible();
  await expect(
    leftLane.getByText("Annotations", { exact: true }).locator(".."),
  ).toContainText("3");
  await expect(
    rightLane.getByText("Annotations", { exact: true }).locator(".."),
  ).toContainText("3");

  const exported = await right.evaluate(async (documentId) => {
    const response = await fetch(
      `/api/presentation/documents/${documentId}/export`,
    );
    return { ok: response.ok, text: await response.text() };
  }, room ?? "invalid");
  expect(exported.ok).toBe(true);
  const exportText = exported.text;
  expect(exportText).toContain("Phase 9 shared note");
  expect(exportText).not.toMatch(
    /\/home\/|bearer|commandIntents|terminal output/i,
  );

  await leftContext.close();
  await expect(rightLane).toContainText("1 / 16 peers");
  await expect(rightLane).toContainText("Following: none");
  await right.setViewportSize({ width: 390, height: 844 });
  expect(
    await right.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(browserErrors).toEqual([]);
  await rightContext.close();
});
