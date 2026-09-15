import { expect, it, vi } from "vitest";
import { WorldAudio } from "../src/audio/world-audio.js";

it("plays the materialization WAV on the effects bus and respects mute and disposal", async () => {
  const { audio, media } = fixture();
  await audio.play();
  audio.cue("avatar-materialize");
  const arrivals = () =>
    media.filter((m) => m.src.endsWith("/avatar-materialize.wav"));
  expect(arrivals()).toHaveLength(1);
  expect(arrivals()[0]!.paused).toBe(false);
  expect(arrivals()[0]!.loop).toBe(false);
  audio.setMuted("effects", true);
  expect(arrivals()[0]!.muted).toBe(true);
  audio.cue("avatar-materialize");
  expect(arrivals()).toHaveLength(1);
  audio.dispose();
  expect(media.every((m) => m.paused)).toBe(true);
});

it("imports a local M3U in its stated order without fetching external URLs", async () => {
  const { audio } = fixture();
  const a = new File(["a"], "a.ogg", { type: "audio/ogg" }),
    b = new File(["b"], "b.ogg", { type: "audio/ogg" });
  await audio.importFiles([
    a,
    b,
    new File(["#EXTM3U\nb.ogg\na.ogg\n"], "mix.m3u"),
  ]);
  expect(audio.snapshot().title).toBe("b.ogg");
  audio.skip(1);
  expect(audio.snapshot().title).toBe("a.ogg");
  await audio.importFiles([
    a,
    new File(["https://example.com/song.ogg"], "remote.m3u"),
  ]);
  expect(audio.snapshot().notice).toMatch(/local audio files together/i);
  expect(audio.snapshot().title).toBe("a.ogg");
  audio.dispose();
});

it("resolves folder-relative M3U paths and reports missing or unsupported selections", async () => {
  const { audio } = fixture();
  const track = (path: string) =>
    Object.assign(new File(["ogg"], "song.ogg", { type: "audio/ogg" }), {
      webkitRelativePath: path,
    });
  const a = track("album/first/song.ogg"),
    b = track("album/second/song.ogg");
  const playlist = Object.assign(
    new File(["second/song.ogg\nfirst/song.ogg"], "mix.m3u8"),
    { webkitRelativePath: "album/mix.m3u8" },
  );
  await audio.importFiles([a, b, playlist]);
  expect(audio.snapshot().source).toBe("local");
  expect(audio.snapshot().count).toBe(2);
  await audio.importFiles([a, new File(["missing.ogg"], "missing.m3u")]);
  expect(audio.snapshot().notice).toMatch(/local audio files together/i);
  audio.setLocalFiles([a, new File(["text"], "notes.txt")]);
  expect(audio.snapshot().notice).toMatch(/1 unsupported/);
  audio.dispose();
});

it("does not resurrect an owned loop after removal while play is pending", async () => {
  const { audio, media } = fixture();
  await audio.play();
  audio.setWorld(true);
  audio.setAgent("one", "coding");
  const loop = media.find((m) => m.src.includes("agent-coding-loop"))!;
  loop.pause();
  let finish!: () => void;
  vi.mocked(loop.play).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = () => {
          Object.assign(loop, { paused: false });
          resolve();
        };
      }),
  );
  audio.setHeld(true); // Reconcile an existing loop with a pending play.
  audio.setAgent("one", "idle");
  finish();
  await Promise.resolve();
  await Promise.resolve();
  expect(loop.paused).toBe(true);
  audio.dispose();
});

it("loops the coding cue during connection outside World and stops on resolution or disposal", async () => {
  const { audio, media } = fixture();
  await audio.play();
  audio.setConnecting(true);
  const loop = media.find((item) => item.src.includes("agent-coding-loop"))!;
  expect(loop.loop).toBe(true);
  expect(loop.paused).toBe(false);
  audio.setConnecting(true);
  expect(
    media.filter((item) => item.src.includes("agent-coding-loop")),
  ).toHaveLength(1);
  audio.setConnecting(false);
  expect(loop.paused).toBe(true);
  audio.setConnecting(true);
  audio.dispose();
  expect(media.every((item) => item.paused)).toBe(true);
});

function fixture() {
  const media: HTMLAudioElement[] = [];
  const audio = new WorldAudio(() => {
    const element = Object.assign(new EventTarget(), {
      src: "",
      currentTime: 0,
      loop: false,
      muted: false,
      volume: 1,
      preload: "none",
      paused: true,
      play: vi.fn(async function (this: { paused: boolean }) {
        this.paused = false;
      }),
      pause: vi.fn(function (this: { paused: boolean }) {
        this.paused = true;
      }),
      load: vi.fn(),
      removeAttribute: vi.fn(),
      canPlayType: () => "probably",
    }) as unknown as HTMLAudioElement;
    media.push(element);
    return element;
  });
  return { audio, media };
}
it("loops the intro then plays the twelve World tracks in order while buses stay independent", async () => {
  const { audio, media } = fixture();
  await audio.play();
  expect(media[0]!.src).toContain("00-black-circuit");
  expect(media[0]!.loop).toBe(true);
  audio.setWorld(true);
  await audio.play();
  expect(media[0]!.src).toContain("01-idle-voltage");
  expect(media[0]!.loop).toBe(false);
  for (let i = 2; i <= 12; i++) {
    media[0]!.dispatchEvent(new Event("ended"));
    expect(audio.snapshot().trackIndex).toBe(i - 1);
  }
  media[0]!.dispatchEvent(new Event("ended"));
  expect(audio.snapshot().trackIndex).toBe(0);
  audio.setMuted("music", true);
  expect(media[0]!.muted).toBe(true);
  const ambience = media.find((m) => m.src.includes("code-canopy"))!;
  expect(ambience.loop).toBe(true);
  expect(ambience.muted).toBe(false);
  audio.setMuted("effects", true);
  expect(ambience.muted).toBe(true);
  audio.pause();
  expect(media[0]!.paused).toBe(true);
  audio.skip(-1);
  expect(audio.snapshot().trackIndex).toBe(11);
  expect(media[0]!.paused).toBe(true);
  audio.setWorld(false);
  expect(ambience.paused).toBe(true);
  audio.dispose();
  expect(media.every((m) => m.paused)).toBe(true);
});
it("does not duplicate held/coding loops and never reports failure as success", async () => {
  const { audio, media } = fixture();
  await audio.play();
  audio.setWorld(true);
  audio.setAgent("one", "coding");
  audio.setAgent("one", "coding");
  audio.setAgent("two", "coding");
  const loops = media.filter((m) => m.src.includes("agent-coding-loop"));
  expect(loops).toHaveLength(2);
  audio.setAgent("one", "failed");
  expect(loops[0]!.paused).toBe(true);
  expect(loops[1]!.paused).toBe(false);
  audio.setAgent("two", "complete");
  expect(loops[1]!.paused).toBe(true);
  audio.setAgent("two", "coding");
  audio.setAgent("two", "idle"); // Removal/stale authority clears this owner only.
  expect(
    media
      .filter((m) => m.src.includes("agent-coding-loop"))
      .every((m) => m.paused),
  ).toBe(true);
  expect(media.filter((m) => m.src.includes("agent-complete"))).toHaveLength(1);
  audio.setHeld(true);
  audio.setHeld(true);
  expect(media.filter((m) => m.src.includes("object-hold-loop"))).toHaveLength(
    1,
  );
  audio.setHeld(false);
  expect(media.find((m) => m.src.includes("object-hold-loop"))!.paused).toBe(
    true,
  );
  audio.dispose();
});
it("surfaces autoplay rejection and local replacement revokes only its own URLs", async () => {
  const { audio, media } = fixture();
  vi.mocked(media[0]!.play).mockRejectedValueOnce(
    new DOMException("gesture required", "NotAllowedError"),
  );
  await audio.play();
  expect(audio.snapshot().notice).toContain("Play");
  expect(audio.snapshot().playing).toBe(false);
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValueOnce("blob:owned-one")
    .mockReturnValueOnce("blob:owned-two");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  audio.setLocalFiles([
    new File(["test"], "first.mp3", { type: "audio/mpeg" }),
  ]);
  audio.setLocalFiles([
    new File(["test"], "second.wav", { type: "audio/wav" }),
  ]);
  expect(revoke).toHaveBeenCalledWith("blob:owned-one");
  expect(audio.snapshot().title).toBe("second.wav");
  audio.useAlbum();
  expect(revoke).toHaveBeenCalledWith("blob:owned-two");
  audio.dispose();
  create.mockRestore();
  revoke.mockRestore();
});
