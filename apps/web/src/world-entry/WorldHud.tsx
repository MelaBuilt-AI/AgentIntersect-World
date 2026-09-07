import { useEffect, useRef, type ReactNode } from "react";

import {
  createWorldChatInputHistory,
  recallWorldChatHistory,
  recordWorldChatSubmission,
  shouldConsumeWorldChatShortcut,
  type WorldTranscriptItem,
} from "./world-chat-model.js";
import type { WorldAgentSession } from "../sessions/session-client.js";
import { WorldPushToTalk } from "./WorldPushToTalk.js";

const inlineTokens = (text: string, keyPrefix: string): ReactNode[] => {
  const tokens = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__)/gu);
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.startsWith("`") && token.endsWith("`"))
      return <code key={key}>{token.slice(1, -1)}</code>;
    if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    )
      return <strong key={key}>{token.slice(2, -2)}</strong>;
    return token;
  });
};

const blockStart = (line: string) =>
  /^ {0,3}(?:```|#{1,3}\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/u.test(line);

function AssistantText({ text }: { readonly text: string }) {
  const lines = text.replace(/\r\n?/gu, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^ {0,3}```\s*([a-z0-9+#.-]{0,24}).*$/iu.exec(line);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (
        index < lines.length &&
        !/^ {0,3}```\s*$/u.test(lines[index] ?? "")
      ) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={`block-${blocks.length}`}>
          <code data-language={fence[1] || undefined}>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = /^ {0,3}(#{1,3})\s+(.+)$/u.exec(line);
    if (heading) {
      const content = inlineTokens(
        heading[2] ?? "",
        `heading-${blocks.length}`,
      );
      const key = `block-${blocks.length}`;
      blocks.push(
        heading[1]?.length === 1 ? (
          <h3 key={key}>{content}</h3>
        ) : heading[1]?.length === 2 ? (
          <h4 key={key}>{content}</h4>
        ) : (
          <h5 key={key}>{content}</h5>
        ),
      );
      index += 1;
      continue;
    }

    const unordered = /^ {0,3}[-*+]\s+(.+)$/u.exec(line);
    if (unordered) {
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = /^ {0,3}[-*+]\s+(.+)$/u.exec(lines[index] ?? "");
        if (!item) break;
        items.push(
          <li key={`item-${items.length}`}>
            {inlineTokens(item[1] ?? "", `ul-${blocks.length}-${items.length}`)}
          </li>,
        );
        index += 1;
      }
      blocks.push(<ul key={`block-${blocks.length}`}>{items}</ul>);
      continue;
    }

    const ordered = /^ {0,3}\d+[.)]\s+(.+)$/u.exec(line);
    if (ordered) {
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = /^ {0,3}\d+[.)]\s+(.+)$/u.exec(lines[index] ?? "");
        if (!item) break;
        items.push(
          <li key={`item-${items.length}`}>
            {inlineTokens(item[1] ?? "", `ol-${blocks.length}-${items.length}`)}
          </li>,
        );
        index += 1;
      }
      blocks.push(<ol key={`block-${blocks.length}`}>{items}</ol>);
      continue;
    }

    const quote = /^ {0,3}>\s?(.*)$/u.exec(line);
    if (quote) {
      const quoted: string[] = [];
      while (index < lines.length) {
        const part = /^ {0,3}>\s?(.*)$/u.exec(lines[index] ?? "");
        if (!part) break;
        quoted.push(part[1] ?? "");
        index += 1;
      }
      blocks.push(
        <blockquote key={`block-${blocks.length}`}>
          {inlineTokens(quoted.join(" "), `quote-${blocks.length}`)}
        </blockquote>,
      );
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      Boolean(lines[index]?.trim()) &&
      !blockStart(lines[index] ?? "")
    ) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(
      <p key={`block-${blocks.length}`}>
        {inlineTokens(paragraph.join(" "), `paragraph-${blocks.length}`)}
      </p>,
    );
  }
  return <div className="world-transcript__assistant-content">{blocks}</div>;
}

export function WorldHud({
  recipient,
  status,
  busy,
  queuedCount,
  message,
  transcript,
  pushToTalkAvailable,
  voiceSession = null,
  onMessage,
  onSend,
  onVoiceSend = () => undefined,
}: {
  readonly recipient: string;
  readonly status: string;
  readonly busy: boolean;
  readonly queuedCount: number;
  readonly message: string;
  readonly transcript: readonly WorldTranscriptItem[];
  readonly pushToTalkAvailable: boolean;
  readonly voiceSession?: WorldAgentSession | null;
  readonly onMessage: (message: string) => void;
  readonly onSend: () => void;
  readonly onVoiceSend?: (message: string) => void;
}) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputHistory = useRef(createWorldChatInputHistory());
  const sendUnavailable = !message.trim();
  useEffect(() => {
    const rail = transcriptRef.current;
    if (rail) rail.scrollTop = rail.scrollHeight;
  }, [transcript]);
  useEffect(() => {
    const focusChat = (event: KeyboardEvent) => {
      if (
        !shouldConsumeWorldChatShortcut({
          key: event.key,
          target: event.target,
          worldActive: document.visibilityState === "visible",
          dialogOpen: Boolean(
            document.querySelector('[role="dialog"], dialog[open]'),
          ),
        })
      )
        return;
      const input = inputRef.current;
      if (!input) return;
      event.preventDefault();
      input.focus({ preventScroll: true });
      if (message.length === 0) onMessage("/");
      window.requestAnimationFrame(() => {
        const end = input.value.length;
        input.setSelectionRange(end, end);
      });
    };
    window.addEventListener("keydown", focusChat, true);
    return () => window.removeEventListener("keydown", focusChat, true);
  }, [message, onMessage]);
  return (
    <div className="world-hud" data-testid="world-hud">
      <div className="world-hud__captions" aria-live="polite" role="status">
        <span>{status}</span>
        {queuedCount > 0 ? <span>{queuedCount} queued</span> : null}
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
                  {item.recipient ??
                    (item.kind === "user"
                      ? "You"
                      : item.kind === "assistant"
                        ? recipient
                        : item.kind === "tool"
                          ? "Activity"
                          : "Error")}
                </strong>
                {item.kind === "assistant" ? (
                  <AssistantText text={item.text} />
                ) : (
                  <span>{item.text}</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="world-hud__chat-dock">
        <p className="world-hud__wheel-hint">
          Press Middle Mouse to open the Code Wheel
        </p>
        <div className="world-hud__controls">
          <form
            className="world-chat"
            aria-busy={busy}
            onSubmit={(event) => {
              event.preventDefault();
              if (!sendUnavailable) {
                inputHistory.current = recordWorldChatSubmission(
                  inputHistory.current,
                  message,
                );
                onSend();
              }
            }}
          >
            <label className="sr-only" htmlFor="world-chat-message">
              Message {recipient}
            </label>
            <input
              ref={inputRef}
              id="world-chat-message"
              aria-label={`Message ${recipient}`}
              value={message}
              maxLength={4_000}
              placeholder={`Message ${recipient}`}
              onChange={(event) => {
                if (inputHistory.current.index !== null)
                  inputHistory.current = {
                    ...inputHistory.current,
                    index: null,
                    draft: event.target.value,
                  };
                onMessage(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                  return;
                const direction = event.key === "ArrowUp" ? "up" : "down";
                if (
                  inputHistory.current.entries.length === 0 ||
                  (direction === "down" && inputHistory.current.index === null)
                )
                  return;
                event.preventDefault();
                const recalled = recallWorldChatHistory(
                  inputHistory.current,
                  direction,
                  message,
                );
                inputHistory.current = recalled.history;
                onMessage(recalled.message);
                window.requestAnimationFrame(() => {
                  const input = inputRef.current;
                  if (!input) return;
                  const end = input.value.length;
                  input.setSelectionRange(end, end);
                });
              }}
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
              Send
            </button>
          </form>
          <WorldPushToTalk
            available={pushToTalkAvailable}
            session={voiceSession}
            onAcceptedText={onVoiceSend}
          />
        </div>
      </div>
    </div>
  );
}
