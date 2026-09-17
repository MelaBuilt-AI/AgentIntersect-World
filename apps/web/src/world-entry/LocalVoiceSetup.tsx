import { useRef, useState } from "react";

type SetupStatus = {
  state: "unsupported" | "not-installed" | "installing" | "ready" | "failed";
  platform: string;
  message: string;
  downloadBytes: number;
};
export function LocalVoiceSetup({
  onReady,
}: {
  readonly onReady?: () => void;
}) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const load = async (install = false) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage(
      install
        ? "Downloading and verifying… You can keep using typed chat. Microphone remains off."
        : "Checking local voice…",
    );
    try {
      const response = await fetch(
        "/api/voice/setup",
        install
          ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ consent: true }),
            }
          : undefined,
      );
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new Error(
          payload.error?.message ??
            "Local voice setup unavailable. Check connectivity and retry.",
        );
      const next = payload.data as SetupStatus;
      setStatus(next);
      setMessage(next.message);
      if (next.state === "ready") onReady?.();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Local voice setup unavailable. Retry later; typed chat remains available.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <details
      className="local-voice-setup"
      onToggle={(event) => {
        if (event.currentTarget.open && !status) void load();
      }}
    >
      <summary>Local voice setup (optional)</summary>
      <p>
        Install whisper.cpp v1.9.1 and the English base model from GitHub and
        Hugging Face on the computer running World. Audio is transcribed
        locally, with final captions only. No cloud fallback.
      </p>
      {status ? (
        <p>
          {status.platform} · {Math.ceil(status.downloadBytes / 1_000_000)} MB
          download · MIT licensed runtime and model
        </p>
      ) : null}
      <p role="status">
        {message ||
          "Expand to check readiness. No download or microphone access without your action."}
      </p>
      {status && status.state !== "ready" && status.state !== "unsupported" ? (
        <>
          <label>
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(event) => setConsent(event.target.checked)}
            />{" "}
            I agree to download and install local voice on this computer
          </label>
          <button
            type="button"
            className={consent && !busy ? "world-action--enabled" : undefined}
            disabled={!consent || busy}
            onClick={() => void load(true)}
          >
            Install local voice
          </button>
        </>
      ) : null}
      <button
        type="button"
        className={!busy ? "world-action--enabled" : undefined}
        disabled={busy}
        onClick={() => void load()}
      >
        Recheck local voice
      </button>
      <p>
        Optional—continue without voice. Later: Escape → Agent Setup → Local
        voice setup. Installation does not enable or record your microphone.
      </p>
    </details>
  );
}
