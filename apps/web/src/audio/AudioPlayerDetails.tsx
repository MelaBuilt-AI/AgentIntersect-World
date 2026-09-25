import type { WorldAudio, AUDIO_INITIAL_STATE } from "./world-audio.js";

export function AudioPlayerDetails({
  state,
  controller,
  mute,
}: {
  readonly state: typeof AUDIO_INITIAL_STATE;
  readonly controller: { readonly current: WorldAudio | null };
  readonly mute: (bus: "music" | "effects") => void;
}) {
  return (
    <div id="world-audio-details" className="world-audio__details">
      <small>
        {state.source === "local" ? "Local playlist" : "Black Circuit"} ·{" "}
        {state.trackIndex + 1}/{state.count}
      </small>
      <div className="world-audio__controls">
        <button
          type="button"
          aria-label="Previous track"
          onClick={() => controller.current?.skip(-1)}
        >
          ⏮
        </button>
        <button
          type="button"
          aria-label="Next track"
          onClick={() => controller.current?.skip(1)}
        >
          ⏭
        </button>
        <button
          type="button"
          aria-pressed={state.musicMuted}
          onClick={() => mute("music")}
        >
          {state.musicMuted ? "Unmute music" : "Mute music"}
        </button>
        <button
          type="button"
          aria-pressed={state.effectsMuted}
          onClick={() => mute("effects")}
        >
          {state.effectsMuted ? "Unmute effects" : "Mute effects"}
        </button>
      </div>
      <label className="world-audio__browse">
        Browse local music / playlist
        <input
          type="file"
          aria-label="Choose local music files"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.m3u,.m3u8"
          multiple
          onChange={(event) => {
            void controller.current?.importFiles(
              Array.from(event.target.files ?? []),
            );
            event.target.value = "";
          }}
        />
      </label>
      <label className="world-audio__browse">
        Browse music folder
        <input
          type="file"
          aria-label="Choose local music folder"
          multiple
          {...{ webkitdirectory: "" }}
          onChange={(event) => {
            void controller.current?.importFiles(
              Array.from(event.target.files ?? []),
            );
            event.target.value = "";
          }}
        />
      </label>
      <small>
        Select multiple tracks, a folder, or an M3U and its audio files
        together. Files stay in this browser; choose them again after reload.
      </small>
      {state.source === "local" && (
        <button type="button" onClick={() => controller.current?.useAlbum()}>
          Return to Black Circuit
        </button>
      )}
      <button
        type="button"
        disabled
        title="Reserved for a future pass; no streaming service is connected"
      >
        Streaming services · coming later
      </button>
    </div>
  );
}
