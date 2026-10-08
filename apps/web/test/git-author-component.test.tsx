import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect as browserExpect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { expect, it } from "vitest";

it("opens a separate modal, cancels without a write, resumes the checkpoint, and skips configured identity (component transport fixture)", async () => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    plugins: [
      react(),
      {
        name: "author-component-fixture",
        configureServer(vite) {
          vite.middlewares.use(
            "/__author_fixture",
            async (_request, response) => {
              response.setHeader("content-type", "text/html");
              response.end(
                await vite.transformIndexHtml(
                  "/__author_fixture",
                  '<div id="root"></div><script type="module" src="/test/fixtures/git-author-component.tsx"></script>',
                ),
              );
            },
          );
        },
      },
    ],
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const browser = await chromium.launch({ headless: true });
  const output = process.env.AIW_TEST_EVIDENCE_DIR;
  if (output) await mkdir(output, { recursive: true });
  try {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let configured = false;
      let completed = false;
      let changed = false;
      const writes: Record<string, unknown>[] = [];
      const status = () => ({
        head: completed ? "a".repeat(40) : null,
        branch: "main",
        upstream: null,
        remotes: [],
        changes: changed ? [{ path: "selected.txt", status: "??" }] : [],
        commits: [],
        commitIdentity: {
          name: configured ? "Fixture Author" : "",
          email: configured ? "fixture@example.invalid" : "",
          ready: configured,
        },
      });
      await page.route("**/api/**", async (route) => {
        const url = route.request().url();
        let data: unknown;
        if (url.includes("/selected?"))
          data = {
            project: {
              id: "fixture-project",
              name: "Fixture project",
              rootPath: "C:\\Projects\\Fixture",
            },
          };
        else if (url.includes("/workstreams/history"))
          data = { workstreams: [] };
        else if (route.request().method() === "POST") {
          const body = route.request().postDataJSON();
          writes.push(body);
          configured = true;
          completed = true;
          changed = false;
          data = { status: status(), message: "Fixture checkpoint created" };
        } else data = status();
        await route.fulfill({ json: { ok: true, data } });
      });
      const url = `${server.resolvedUrls!.local[0]}__author_fixture`;
      await page.goto(url);
      await page.getByLabel("Confirm initial local checkpoint").check();
      const checkpoint = page.getByRole("button", {
        name: "Create initial checkpoint",
        exact: true,
      });
      await checkpoint.click();
      const dialog = page.getByRole("dialog", {
        name: "Set up your commit author",
        exact: true,
      });
      await browserExpect(dialog).toBeVisible();
      expect(writes).toHaveLength(0);
      await browserExpect(
        dialog.getByRole("button", { name: "Save and continue" }),
      ).toBeDisabled();
      const bounds = await dialog.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
      if (output)
        await page.screenshot({
          path: `${output}/author-dialog-${viewport.width}.png`,
        });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await browserExpect(dialog).toHaveCount(0);
      expect(writes).toHaveLength(0);
      await checkpoint.click();
      await page.keyboard.press("Escape");
      await browserExpect(dialog).toHaveCount(0);
      expect(writes).toHaveLength(0);
      await checkpoint.click();
      await dialog.getByLabel("Commit author name").fill("Fixture Author");
      await dialog
        .getByLabel("Commit author email")
        .fill("fixture@example.invalid");
      await dialog.getByRole("button", { name: "Save and continue" }).click();
      await browserExpect(
        page.getByText("Ready · this repository already has a commit.", {
          exact: false,
        }),
      ).toBeVisible();
      expect(writes).toHaveLength(1);
      expect(writes[0]).toMatchObject({
        action: "checkpoint",
        confirm: true,
        expectedHead: null,
        expectedBranch: "main",
        identity: { name: "Fixture Author", email: "fixture@example.invalid" },
      });
      completed = false;
      await page.reload();
      await page.getByLabel("Confirm initial local checkpoint").check();
      await checkpoint.click();
      await browserExpect(
        page.getByText("Ready · this repository already has a commit.", {
          exact: false,
        }),
      ).toBeVisible();
      expect(writes).toHaveLength(2);
      expect(writes[1]).not.toHaveProperty("identity");
      await browserExpect(dialog).toHaveCount(0);
      // The other entry point is the normal selected-file commit panel.
      configured = false;
      changed = true;
      await page.reload();
      await page.getByRole("checkbox", { name: /selected\.txt/ }).check();
      await page
        .getByLabel("Commit message", { exact: true })
        .fill("Selected-file fixture");
      await page
        .getByRole("button", { name: "Review commit (1 files)" })
        .click();
      await page
        .getByRole("button", { name: "Confirm commit", exact: true })
        .click();
      await browserExpect(dialog).toBeVisible();
      expect(writes).toHaveLength(2);
      await dialog.getByLabel("Commit author name").fill("Fixture Author");
      await dialog.getByLabel("Commit author email").fill("not-an-email");
      await browserExpect(
        dialog.getByRole("button", { name: "Save and continue" }),
      ).toBeDisabled();
      await dialog
        .getByLabel("Commit author email")
        .fill("fixture@example.invalid");
      await dialog.getByRole("button", { name: "Save and continue" }).click();
      await browserExpect(dialog).toHaveCount(0);
      expect(writes).toHaveLength(3);
      expect(writes[2]).toMatchObject({
        action: "commit",
        files: ["selected.txt"],
        message: "Selected-file fixture",
        identity: { name: "Fixture Author", email: "fixture@example.invalid" },
      });
      expect(errors).toEqual([]);
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
}, 60000);
