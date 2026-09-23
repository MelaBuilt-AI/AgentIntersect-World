import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  AUDIO_INITIAL_STATE,
  WorldAudio,
  registerWorldAudio,
} from "./world-audio.js";
import type { AudioCue } from "./catalog.js";
import "./audio-player.css";

const AudioPlayerDetails = lazy(async () => ({
  default: (await import("./AudioPlayerDetails.js")).AudioPlayerDetails,
}));

export function AudioPlayer() {
  const controller = useRef<WorldAudio | null>(null);
  const [state, setState] = useState(AUDIO_INITIAL_STATE);
  const [expanded, setExpanded] = useState(false);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const update = () =>
      document.documentElement.style.setProperty(
        "--world-audio-height",
        `${element.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--world-audio-height");
    };
  }, []);
  useEffect(() => {
    const audio = new WorldAudio();
    controller.current = audio;
    registerWorldAudio(audio);
    const unsubscribe = audio.subscribe(() => setState(audio.snapshot()));
    try {
      // Each launch starts setup music enabled; mute remains a session control.
      audio.setMuted("music", false);
      audio.setMuted(
        "effects",
        localStorage.getItem("aiw.audio.effects-muted") === "true",
      );
    } catch {
      /* Audio remains usable when browser storage is disabled. */
    }
    const pointer = (event: PointerEvent) => {
      if (!(
        event.target instanceof Element && event.target.closest(".world-audio")
      ))
        audio.unlock();
      const target =
        event.target instanceof Element
          ? event.target.closest('button, [role="button"]')
          : null;
      if (target?.matches(':disabled, [aria-disabled="true"]'))
        audio.cue("ui-unavailable");
    };
    const keyboard = (event: KeyboardEvent) => {
      if (!(
        event.target instanceof Element && event.target.closest(".world-audio")
      ))
        audio.unlock();
    };
    const click = (event: MouseEvent) => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('button, [role="button"]')
          : null;
      if (
        !button ||
        button.matches(':disabled, [aria-disabled="true"]') ||
        button.dataset.audio === "handled"
      )
        return;
      if (button.dataset.audioCue) {
        audio.cue(button.dataset.audioCue as AudioCue);
        return;
      }
      if (
        button instanceof HTMLButtonElement &&
        button.type === "submit" &&
        button.form
      )
        return;
      if (
        /^(back|cancel|return)\b/i.test(
          button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "",
        )
      )
        audio.cue("ui-back");
      else audio.randomCue("ui-click");
    };
    const submit = () => audio.cue("ui-activate");
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("click", click, true);
    document.addEventListener("submit", submit, true);
    // Autoplay is attempted, never assumed. Rejection is visible in the player.
    void audio.play();
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("submit", submit, true);
      unsubscribe();
      registerWorldAudio(null);
      controller.current = null;
      audio.dispose();
    };
  }, []);
  const mute = (bus: "music" | "effects") => {
    const muted = !(bus === "music" ? state.musicMuted : state.effectsMuted);
    controller.current?.setMuted(bus, muted);
    try {
      localStorage.setItem(`aiw.audio.${bus}-muted`, String(muted));
    } catch {
      /* Session controls still work. */
    }
  };
  return (
    <aside
      ref={panel}
      className="world-audio"
      data-world-ui="true"
      aria-label="World audio player"
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="world-audio__bar">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="world-audio-details"
          aria-label={
            expanded ? "Collapse audio player" : "Expand audio player"
          }
          onClick={() => setExpanded(!expanded)}
        >
          ♫
        </button>
        <span className="world-audio__title" title={state.title}>
          {state.title}
        </span>
        <button
          type="button"
          aria-label={state.playing ? "Pause music" : "Play music"}
          onClick={() =>
            state.playing
              ? controller.current?.pause()
              : void controller.current?.play()
          }
        >
          {state.playing ? "Ⅱ" : "▶"}
        </button>
      </div>
      {expanded && (
        <Suspense fallback={<p role="status">Loading audio controls…</p>}>
          <AudioPlayerDetails
            state={state}
            controller={controller}
            mute={mute}
          />
        </Suspense>
      )}
      {state.notice && (
        <p role="status" className="world-audio__notice">
          {state.notice}
        </p>
      )}
    </aside>
  );
}
