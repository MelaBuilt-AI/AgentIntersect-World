import { useEffect, useRef } from "react";

import type { WorldTranscriptItem } from "./world-chat-model.js";

export function WorldHud({
  recipient,
  status,
  busy,
  message,
  transcript,
  pushToTalkAvailable,
  onMessage,
  onSend,
}: {
  readonly recipient: string;
  readonly status: string;
  readonly busy: boolean;
  readonly message: string;
  readonly transcript: readonly WorldTranscriptItem[];
  readonly pushToTalkAvailable: boolean;
  readonly onMessage: (message: string) => void;
  readonly onSend: () => void;
}) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const sendUnavailable = busy || !message.trim();
  useEffect(() => {
    const rail = transcriptRef.current;
    if (rail) rail.scrollTop = rail.scrollHeight;
  }, [transcript]);
  return (
    <div className="world-hud" data-testid="world-hud">
      <div className="world-hud__captions" aria-live="polite" role="status">
        <span>{status}</span>
      </div>
      <div
        ref={transcriptRef}
        className="world-transcript"
        role="log"
        aria-label="Conversation and activity"
        aria-live="off"
        tabIndex={0}
      >
        {transcript.length === 0 ? (
          <p className="world-transcript__empty">
            Conversation and agent activity will remain here.
          </p>
        ) : (
          <ol>
            {transcript.map((item) => (
              <li
                key={item.id}
                className={`world-transcript__item world-transcript__item--${item.kind}`}
              >
                <strong>
                  {item.kind === "user"
                    ? "You"
                    : item.kind === "assistant"
                      ? "Mr Fluff"
                      : item.kind === "tool"
                        ? "Activity"
                        : "Error"}
                </strong>
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="world-hud__controls">
        <form
          className="world-chat"
          onSubmit={(event) => {
            event.preventDefault();
            if (!sendUnavailable) onSend();
          }}
        >
          <label className="sr-only" htmlFor="world-chat-message">
            Message {recipient}
          </label>
          <input
            id="world-chat-message"
            aria-label={`Message ${recipient}`}
            value={message}
            maxLength={4_000}
            disabled={busy}
            placeholder={`Message ${recipient}`}
            onChange={(event) => onMessage(event.target.value)}
          />
          <button
            type="submit"
            className={
              sendUnavailable
                ? "world-chat__send world-action--unavailable"
                : "world-chat__send world-action--enabled"
            }
            disabled={sendUnavailable}
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </form>
        <button
          type="button"
          className={
            pushToTalkAvailable
              ? "world-ptt world-action--enabled"
              : "world-ptt world-action--unavailable"
          }
          disabled={!pushToTalkAvailable}
          aria-disabled={!pushToTalkAvailable}
          aria-describedby={
            pushToTalkAvailable ? undefined : "world-ptt-unavailable"
          }
        >
          <span aria-hidden="true">◉</span>
          Push to talk
        </button>
      </div>
      {!pushToTalkAvailable ? (
        <p id="world-ptt-unavailable" className="world-hud__voice-reason">
          Voice provider unavailable. Text chat remains ready.
        </p>
      ) : null}
    </div>
  );
}
