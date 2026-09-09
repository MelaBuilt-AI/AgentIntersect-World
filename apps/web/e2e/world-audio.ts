import { expect, type Page, type TestInfo } from "@playwright/test";
import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";

export async function instrumentAudio(page: Page) {
  await page.addInitScript(() => {
    const instances: HTMLAudioElement[] = [];
    const events: { src: string; event: string }[] = [];
    Object.assign(window, {
      __worldAudioElements: instances,
      __worldAudioEvents: events,
    });
    const OriginalAudio = window.Audio;
    window.Audio = class extends OriginalAudio {
      constructor(src?: string) {
        super(src);
        instances.push(this);
        this.addEventListener("playing", () =>
          events.push({ src: this.src, event: "playing" }),
        );
      }
      override play() {
        events.push({ src: this.src, event: "requested" });
        return super.play();
      }
    };
  });
}
export async function assertAudioCues(
  page: Page,
  testInfo: TestInfo,
  cues: readonly string[],
) {
  const events = await page.evaluate(
    () =>
      (
        window as unknown as {
          __worldAudioEvents: { src: string; event: string }[];
        }
      ).__worldAudioEvents,
  );
  await writeFile(
    testInfo.outputPath("audio-cue-events.json"),
    JSON.stringify(events, null, 2),
  );
  for (const cue of cues)
    expect(
      events.some((event) => event.src.includes(cue)),
      cue,
    ).toBe(true);
  expect(
    events.some(
      (event) => event.event === "playing" && event.src.includes("code-canopy"),
    ),
  ).toBe(true);
  // This surface fixture deliberately leaves its Workstream working. Its one
  // coding loop is still owned; only held-screen loops have been released.
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            __worldAudioElements: HTMLAudioElement[];
          }
        ).__worldAudioElements.filter(
          (audio) => !audio.paused && audio.src.includes("agent-coding-loop"),
        ).length,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            __worldAudioElements: HTMLAudioElement[];
          }
        ).__worldAudioElements.filter(
          (audio) => !audio.paused && /object-hold-loop/.test(audio.src),
        ).length,
    ),
  ).toBe(0);
}
export async function exerciseAudio(page: Page, testInfo: TestInfo) {
  const player = page.getByRole("complementary", {
    name: "World audio player",
  });
  await player.getByRole("button", { name: "Expand audio player" }).click();
  const assertClearHints = async () => {
    // World HUD can mount before the lazy room. Sample both boxes together
    // after that boundary instead of keeping a pre-room player rectangle.
    let geometry: { player: DOMRect; hints: DOMRect; clear: boolean } | null =
      null;
    await expect
      .poll(async () => {
        geometry = await player.evaluate((el) => {
          const hints = document
            .querySelector(".world-room__controls")
            ?.getBoundingClientRect();
          if (!hints) return null;
          const player = el.getBoundingClientRect();
          return {
            player: player.toJSON(),
            hints: hints.toJSON(),
            clear: player.top >= hints.bottom,
          };
        });
        return geometry?.clear ?? false;
      })
      .toBe(true);
    await testInfo.attach("audio-geometry", {
      contentType: "application/json",
      body: JSON.stringify(geometry),
    });
  };
  await assertClearHints();
  const music = () =>
    page.evaluate(
      () =>
        (
          window as unknown as { __worldAudioElements: HTMLAudioElement[] }
        ).__worldAudioElements.findLast(
          (audio) =>
            audio.src.includes("/music/") || audio.src.startsWith("blob:"),
        )?.currentTime ?? 0,
    );
  await expect(player).toContainText("Idle Voltage");
  await expect.poll(music).toBeGreaterThan(0.2);
  await player
    .getByRole("button", { name: "Pause music", exact: true })
    .click();
  const paused = await music();
  await page.waitForTimeout(300);
  expect(await music()).toBeCloseTo(paused, 2);
  await player.getByRole("button", { name: "Next track" }).click();
  await expect(player).toContainText("Neon Branches");
  await player.getByRole("button", { name: "Previous track" }).click();
  await expect(player).toContainText("Idle Voltage");
  await player.getByRole("button", { name: "Play music", exact: true }).click();
  await player.getByRole("button", { name: "Mute music", exact: true }).click();
  expect(
    await page.evaluate(() => {
      const a = (
        window as unknown as { __worldAudioElements: HTMLAudioElement[] }
      ).__worldAudioElements;
      return {
        music: a.findLast((x) => x.src.includes("/music/"))?.muted,
        ambience: a.findLast((x) => x.src.includes("code-canopy"))?.muted,
      };
    }),
  ).toEqual({ music: true, ambience: false });
  await player
    .getByRole("button", { name: "Mute effects", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __worldAudioElements: HTMLAudioElement[] }
        ).__worldAudioElements.findLast((x) => x.src.includes("code-canopy"))
          ?.muted,
    ),
  ).toBe(true);
  await player
    .getByRole("button", { name: "Unmute music", exact: true })
    .click();
  await player
    .getByRole("button", { name: "Unmute effects", exact: true })
    .click();
  const sequence: string[] = [];
  for (let i = 0; i < 12; i++) {
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const m = (
            window as unknown as { __worldAudioElements: HTMLAudioElement[] }
          ).__worldAudioElements.findLast((a) => a.src.includes("/music/"));
          return !!m && m.readyState >= 2 && Number.isFinite(m.duration);
        }),
      )
      .toBe(true);
    const before = await player.locator(".world-audio__title").innerText();
    sequence.push(before);
    await page.evaluate(() => {
      const m = (
        window as unknown as { __worldAudioElements: HTMLAudioElement[] }
      ).__worldAudioElements.findLast((a) => a.src.includes("/music/"))!;
      m.currentTime = m.duration - 0.12;
    });
    await expect(player.locator(".world-audio__title")).not.toHaveText(before);
  }
  await expect(player).toContainText("Idle Voltage");
  expect(new Set(sequence).size).toBe(12);
  await player
    .getByLabel("Choose local music files")
    .setInputFiles([
      "apps/web/public/audio/black-circuit/music/03-cache-district.ogg",
      "apps/web/public/audio/black-circuit/music/04-copper-rain.ogg",
    ]);
  await expect(player).toContainText("Local playlist");
  await expect(player).toContainText("03-cache-district.ogg");
  await expect.poll(music).toBeGreaterThan(0.2);
  await player.getByRole("button", { name: "Next track" }).click();
  await expect(player).toContainText("04-copper-rain.ogg");
  await player.getByLabel("Choose local music files").setInputFiles([
    {
      name: "mix.m3u8",
      mimeType: "audio/x-mpegurl",
      buffer: Buffer.from("#EXTM3U\n04-copper-rain.ogg\n03-cache-district.ogg"),
    },
    ...(await Promise.all(
      ["03-cache-district.ogg", "04-copper-rain.ogg"].map(async (name) => ({
        name,
        mimeType: "audio/ogg",
        buffer: await readFile(
          `apps/web/public/audio/black-circuit/music/${name}`,
        ),
      })),
    )),
  ]);
  await expect(player).toContainText("04-copper-rain.ogg");
  await expect.poll(music).toBeGreaterThan(0.2);
  await player.getByRole("button", { name: "Next track" }).click();
  await expect(player).toContainText("03-cache-district.ogg");
  const folder = testInfo.outputPath("local-folder");
  await mkdir(folder, { recursive: true });
  await writeFile(
    `${folder}/mix.m3u`,
    "04-copper-rain.ogg\n03-cache-district.ogg",
  );
  for (const name of ["03-cache-district.ogg", "04-copper-rain.ogg"])
    await copyFile(
      `apps/web/public/audio/black-circuit/music/${name}`,
      `${folder}/${name}`,
    );
  await player.getByLabel("Choose local music folder").setInputFiles(folder);
  await expect(player).toContainText("04-copper-rain.ogg");
  await expect.poll(music).toBeGreaterThan(0.2);
  await player.getByRole("button", { name: "Return to Black Circuit" }).click();
  await expect(player).toContainText("Idle Voltage");
  await page.screenshot({
    path: testInfo.outputPath("audio-world-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await player.evaluate(
      (el) =>
        el.getBoundingClientRect().right <= innerWidth &&
        el.getBoundingClientRect().left >= 0,
    ),
  ).toBe(true);
  await assertClearHints();
  await page.screenshot({
    path: testInfo.outputPath("audio-world-portrait.png"),
  });
  await testInfo.attach("audio-sequence", {
    body: JSON.stringify(sequence),
    contentType: "application/json",
  });
}
