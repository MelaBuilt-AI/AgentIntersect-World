import { AUDIO_CATALOG, audioAsset, type AudioCue } from "./catalog.js";
import type {
  EnvironmentRecipe,
  EnvironmentWeather,
} from "@agentintersect-world/world-schema/environment";

export type AgentAudioState = "coding" | "complete" | "failed" | "idle";
type Track = { title: string; src: string; gain: number };
export type AudioSource = "album" | "local"; // Streaming providers are deliberately not connected in pass 1.
const intro = AUDIO_CATALOG[0];
const album: readonly Track[] = AUDIO_CATALOG.filter(
  (asset) => asset.category === "music",
).slice(1);
export const AUDIO_INITIAL_STATE = {
  title: intro.title as string,
  trackIndex: 0,
  count: 1,
  source: "album" as AudioSource,
  playing: false,
  musicMuted: false,
  effectsMuted: false,
  notice: "Press Play or interact to start audio.",
};

/** One streamed music element; effects are created on demand, never a decoded album in RAM. */
export class WorldAudio {
  readonly #makeAudio: () => HTMLAudioElement;
  readonly #music: HTMLAudioElement;
  readonly #effects = new Set<HTMLAudioElement>();
  readonly #loops = new Map<string, HTMLAudioElement>();
  readonly #agents = new Map<string, AgentAudioState>();
  readonly #listeners = new Set<() => void>();
  #state = { ...AUDIO_INITIAL_STATE };
  #world = false;
  #connecting = false;
  #hacking = false;
  #wanted = true;
  #unlocked = false;
  #disposed = false;
  #held = false;
  #local: Track[] = [];
  #generation = 0;
  #environment: EnvironmentRecipe["audio"] | null = null;
  #weatherGeneration = 0;
  #weatherOwner:
    import("./environment-weather-audio.js").EnvironmentWeatherAudio | null =
    null;
  #weatherLoading: Promise<
    typeof import("./environment-weather-audio.js")
  > | null = null;
  #ambientId: AudioCue | null = null;
  #ambientFade: ReturnType<typeof setInterval> | null = null;
  #fadingId: AudioCue | null = null;
  constructor(makeAudio: () => HTMLAudioElement = () => new Audio()) {
    this.#makeAudio = makeAudio;
    this.#music = makeAudio();
    this.#music.preload = "none";
    this.#music.addEventListener("ended", () => this.skip(1));
    this.#music.addEventListener("error", () =>
      this.#update({
        playing: false,
        notice:
          "Music could not be loaded. Choose another track or local file.",
      }),
    );
    this.#select(0);
  }
  snapshot = () => this.#state;
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  #update(patch: Partial<typeof AUDIO_INITIAL_STATE>) {
    this.#state = { ...this.#state, ...patch };
    this.#listeners.forEach((listener) => listener());
  }
  #tracks(): readonly Track[] {
    return this.#state.source === "local"
      ? this.#local
      : this.#world
        ? album
        : [intro];
  }
  #select(index: number) {
    const tracks = this.#tracks();
    const normalized =
      ((index % tracks.length) + tracks.length) % tracks.length;
    const track = tracks[normalized]!;
    this.#generation++;
    this.#music.pause();
    this.#music.src = track.src;
    this.#music.load();
    this.#music.loop = this.#state.source === "album" && !this.#world;
    this.#music.volume = track.gain;
    // Explicit load commits the new source before play; src already resets playback.
    this.#update({
      title: track.title,
      trackIndex: normalized,
      count: tracks.length,
      playing: false,
      notice: "",
    });
    if (this.#wanted && this.#unlocked) void this.play();
  }
  async play() {
    if (this.#disposed) return;
    this.#wanted = true;
    this.#unlocked = true;
    const generation = this.#generation;
    try {
      await this.#music.play();
      if (!this.#disposed && generation === this.#generation && this.#wanted)
        this.#update({ playing: true, notice: "" });
    } catch (error) {
      if (this.#disposed || generation !== this.#generation || !this.#wanted)
        return;
      if (error instanceof DOMException && error.name === "NotAllowedError")
        this.#unlocked = false;
      this.#update({
        playing: false,
        notice:
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Press Play to enable audio in this browser."
            : "Music could not play. Try another track or local file.",
      });
    }
    this.#syncLoops();
  }
  unlock() {
    if (!this.#unlocked && this.#wanted) void this.play();
  }
  pause() {
    this.#wanted = false;
    this.#music.pause();
    this.#update({ playing: false });
  }
  skip(direction: number) {
    this.#select(this.#state.trackIndex + direction);
  }
  setMuted(bus: "music" | "effects", muted: boolean) {
    if (bus === "music") {
      this.#music.muted = muted;
      this.#update({ musicMuted: muted });
    } else {
      if (muted) this.#weatherOwner?.stopEvents();
      this.#effects.forEach((effect) => {
        effect.muted = muted;
      });
      this.#update({ effectsMuted: muted });
    }
  }
  setWorld(world: boolean) {
    if (world === this.#world) return;
    this.#world = world;
    if (!world) {
      this.#weatherOwner?.stopEvents();
      for (const id of this.#agents.keys())
        this.#loop("agent-coding-loop", false, `agent:${id}`);
      this.#agents.clear();
      this.#held = false;
      this.#hacking = false;
      this.#effects.forEach((effect) => effect.pause());
    }
    if (this.#state.source === "album") this.#select(0);
    this.#syncLoops();
  }
  async importFiles(files: readonly File[]) {
    const playlist = files.find((file) => /\.m3u8?$/i.test(file.name));
    if (!playlist) {
      this.setLocalFiles(files);
      return;
    }
    const generation = ++this.#generation;
    try {
      if (playlist.size > 256_000)
        throw new Error("Playlist document is too large.");
      const entries = (await playlist.text())
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
      const directory =
        playlist.webkitRelativePath?.split("/").slice(0, -1).join("/") ?? "";
      const ordered = entries.map((entry) => {
        const path = entry.replace(/\\/g, "/").replace(/^\.\//, "");
        const name = path.split("/").at(-1);
        const exact = files.filter(
          (file) =>
            file !== playlist &&
            file.webkitRelativePath === `${directory}/${path}`,
        );
        const matches = exact.length
          ? exact
          : files.filter((file) => file !== playlist && file.name === name);
        if (
          /^[a-z][a-z0-9+.-]*:/i.test(path) ||
          path.startsWith("//") ||
          matches.length !== 1
        )
          throw new Error(
            "Choose the playlist and its local audio files together. Remote URLs and ambiguous filenames are not imported.",
          );
        return matches[0]!;
      });
      if (!this.#disposed && generation === this.#generation)
        this.setLocalFiles(ordered);
    } catch (error) {
      if (!this.#disposed && generation === this.#generation)
        this.#update({
          notice:
            error instanceof Error
              ? error.message
              : "Playlist could not be read.",
        });
    }
  }
  setLocalFiles(files: readonly File[]) {
    const playable = files.filter(
      (file) =>
        file.type.startsWith("audio/") ||
        /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/i.test(file.name),
    );
    if (!playable.length) {
      this.#update({
        notice:
          "Choose playable audio files; playlist documents and remote URLs are not imported.",
      });
      return;
    }
    this.#music.pause();
    this.#releaseLocal();
    this.#local = playable.map((file) => ({
      title: file.name,
      src: URL.createObjectURL(file),
      gain: 0.5,
    }));
    this.#update({ source: "local" });
    this.#select(0);
    const unsupported = files.length - playable.length;
    if (unsupported)
      this.#update({ notice: `${unsupported} unsupported file(s) skipped.` });
  }
  useAlbum() {
    this.#music.pause();
    this.#releaseLocal();
    this.#update({ source: "album" });
    this.#select(0);
  }
  #releaseLocal() {
    this.#local.forEach((track) => URL.revokeObjectURL(track.src));
    this.#local = [];
  }
  cue(id: AudioCue) {
    if (!this.#unlocked || this.#disposed || this.#state.effectsMuted) return;
    const asset = audioAsset(id);
    const effect = this.#makeAudio();
    effect.src = asset.src;
    effect.load();
    effect.volume = asset.gain;
    effect.muted = this.#state.effectsMuted;
    effect.preload = "none";
    this.#effects.add(effect);
    const release = () => {
      effect.pause();
      effect.removeAttribute("src");
      effect.load();
      this.#effects.delete(effect);
    };
    effect.addEventListener("ended", release, { once: true });
    effect.addEventListener("error", release, { once: true });
    // Frequent UI clicks are bounded instead of creating unbounded overlapping media.
    if (this.#effects.size > 20) {
      const oldest = [...this.#effects].find(
        (item) => ![...this.#loops.values()].includes(item),
      );
      if (oldest) {
        oldest.pause();
        oldest.removeAttribute("src");
        oldest.load();
        this.#effects.delete(oldest);
      }
    }
    void effect.play().catch(release);
    return effect;
  }
  randomCue(group: "ui-click" | "repo-select") {
    this.cue(`${group}-0${1 + Math.floor(Math.random() * 3)}` as AudioCue);
  }
  #loop(id: AudioCue, active: boolean, owner: string = id) {
    let element = this.#loops.get(owner);
    if (!active || !this.#unlocked || this.#disposed) {
      if (element) {
        element.pause();
        element.removeAttribute("src");
        element.load();
        this.#effects.delete(element);
        this.#loops.delete(owner);
      }
      return;
    }
    if (!element) {
      const asset = audioAsset(id);
      element = this.#makeAudio();
      element.src = asset.src;
      element.load();
      element.volume = asset.gain;
      element.loop = true;
      element.preload = "none";
      this.#loops.set(owner, element);
      this.#effects.add(element);
    }
    element.muted = this.#state.effectsMuted;
    if (element.paused) {
      const playing = element;
      void playing
        .play()
        .then(() => {
          if (this.#disposed || this.#loops.get(owner) !== playing)
            playing.pause();
        })
        .catch(() => {
          if (!this.#disposed && this.#loops.get(owner) === playing)
            this.#update({
              notice: "An effect could not play. Use Play to retry audio.",
            });
        });
    }
  }
  setConnecting(connecting: boolean) {
    this.#connecting = connecting;
    this.#syncLoops();
  }
  #syncLoops() {
    this.#loop(
      "glitch-static-crackle",
      this.#world && this.#hacking,
      "environment-static",
    );
    this.#loop(
      "screen-flicker",
      this.#world && this.#hacking,
      "environment-flicker",
    );
    this.#loop("agent-coding-loop", this.#connecting, "agent-connection");
    this.#syncAmbience();
    this.#weatherOwner?.sync();
    for (const [id, state] of this.#agents)
      this.#loop(
        "agent-coding-loop",
        this.#world && state === "coding",
        `agent:${id}`,
      );
    this.#loop("object-hold-loop", this.#world && this.#held);
  }
  setEnvironment(environment: EnvironmentRecipe["audio"] | null) {
    this.#environment = environment;
    this.#syncAmbience();
  }
  setEnvironmentHacking(active: boolean) {
    this.#hacking = active;
    this.#syncLoops();
  }
  async setWeather(weather: EnvironmentWeather | null) {
    const generation = ++this.#weatherGeneration;
    this.#weatherOwner?.setWeather(null);
    if (!weather || this.#disposed) return;
    try {
      const { EnvironmentWeatherAudio } = await (this.#weatherLoading ??=
        import("./environment-weather-audio.js"));
      if (this.#disposed || generation !== this.#weatherGeneration) return;
      this.#weatherOwner ??= new EnvironmentWeatherAudio({
        active: () => this.#world && this.#unlocked && !this.#disposed,
        canCue: () => !this.#state.effectsMuted,
        loop: (id, active, gain) => {
          this.#loop(id, active, "weather");
          const element = this.#loops.get("weather");
          if (element) element.volume = gain;
        },
        cue: (id) => this.cue(id),
        release: (effect) => {
          effect.pause();
          effect.removeAttribute("src");
          effect.load();
          this.#effects.delete(effect);
        },
      });
      this.#weatherOwner.setWeather(weather);
    } catch {
      if (!this.#disposed && generation === this.#weatherGeneration)
        this.#update({
          notice:
            "Weather audio could not load. Visual weather is still available.",
        });
      this.#weatherLoading = null;
    }
  }
  weatherStrike(strike: { local: boolean; variant: number }) {
    this.#weatherOwner?.strike(strike);
  }
  #stopFade() {
    if (this.#ambientFade) clearInterval(this.#ambientFade);
    this.#ambientFade = null;
    if (this.#fadingId) this.#loop(this.#fadingId, false);
    this.#fadingId = null;
  }
  #syncAmbience() {
    if (!this.#world || !this.#unlocked || this.#disposed) {
      this.#stopFade();
      if (this.#ambientId) this.#loop(this.#ambientId, false);
      this.#ambientId = null;
      return;
    }
    const id: AudioCue = this.#environment
      ? `environment-${this.#environment.ambience}`
      : "code-canopy";
    const gain =
      this.#environment?.gain ??
      AUDIO_CATALOG.find((a) => a.id === "code-canopy")!.gain;
    if (id === this.#ambientId) {
      if (!this.#ambientFade) {
        const current = this.#loops.get(id);
        if (current) current.volume = gain;
        this.#loop(id, true);
      }
      return;
    }
    this.#stopFade();
    const previousId = this.#ambientId;
    const previous = previousId ? this.#loops.get(previousId) : undefined;
    const initialGain = previous?.volume ?? 0;
    this.#ambientId = id;
    this.#loop(id, true);
    const next = this.#loops.get(id)!;
    // Preserve the unchanged original entry sound; crossfade only on replacement.
    if (!previous) {
      next.volume = gain;
      return;
    }
    next.volume = 0;
    this.#fadingId = previousId;
    let step = 0;
    this.#ambientFade = setInterval(() => {
      const mix = Math.min(1, ++step / 12);
      previous.volume = initialGain * (1 - mix);
      next.volume = gain * mix;
      if (mix === 1) this.#stopFade();
    }, 50);
  }
  setAgent(id: string, state: AgentAudioState) {
    if (!this.#world || this.#disposed) return;
    const previous = this.#agents.get(id);
    if (previous === state) return;
    this.#agents.set(id, state);
    if (this.#world) {
      if (state === "coding") this.cue("agent-activate");
      else if (previous === "coding" && state === "complete")
        this.cue("agent-complete");
      else if (state === "failed" && previous !== undefined)
        this.cue("agent-cancel");
    }
    this.#syncLoops();
  }
  setHeld(held: boolean) {
    if (held === this.#held) return;
    this.#held = held;
    this.cue(held ? "object-grab" : "object-drop");
    this.#syncLoops();
  }
  dispose() {
    this.#weatherGeneration++;
    this.#weatherOwner?.setWeather(null);
    this.#disposed = true;
    this.#stopFade();
    this.#generation++;
    for (const element of [this.#music, ...this.#effects]) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    }
    this.#releaseLocal();
    this.#effects.clear();
    this.#loops.clear();
    this.#listeners.clear();
  }
}

let activeAudio: WorldAudio | null = null;
export function registerWorldAudio(audio: WorldAudio | null) {
  activeAudio = audio;
}
export function audioCue(id: AudioCue) {
  activeAudio?.cue(id);
}
export function randomAudioCue(group: "ui-click" | "repo-select") {
  activeAudio?.randomCue(group);
}
export function worldAudioState(world: boolean) {
  activeAudio?.setWorld(world);
}
export function connectingAudioState(connecting: boolean) {
  activeAudio?.setConnecting(connecting);
}
export function agentAudioState(id: string, state: AgentAudioState) {
  activeAudio?.setAgent(id, state);
}
export function heldAudioState(held: boolean) {
  activeAudio?.setHeld(held);
}
export function environmentAudioState(
  environment: EnvironmentRecipe["audio"] | null,
) {
  activeAudio?.setEnvironment(environment);
}
export function environmentHackingAudioState(active: boolean) {
  activeAudio?.setEnvironmentHacking(active);
}
export function environmentWeatherAudioState(
  weather: EnvironmentWeather | null,
) {
  activeAudio?.setWeather(weather);
}
export function environmentStrikeAudio(strike: {
  local: boolean;
  variant: number;
}) {
  activeAudio?.weatherStrike(strike);
}
