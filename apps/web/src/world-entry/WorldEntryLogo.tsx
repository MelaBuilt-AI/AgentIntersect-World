import { useEffect, useState } from "react";

export function WorldTypeLine({
  text,
  reducedMotion,
  className = "",
}: {
  readonly text: string;
  readonly reducedMotion: boolean;
  readonly className?: string;
}) {
  const [visible, setVisible] = useState(reducedMotion ? text.length : 0);
  useEffect(() => {
    if (reducedMotion) {
      const timer = window.setTimeout(() => setVisible(text.length), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setInterval(() => {
      setVisible((current) => {
        const next = Math.min(text.length, current + 1);
        if (next === text.length) window.clearInterval(timer);
        return next;
      });
    }, 42);
    return () => window.clearInterval(timer);
  }, [reducedMotion, text]);
  return (
    <span
      className={`world-type-line ${className}`.trim()}
      data-state={visible === text.length ? "complete" : "typing"}
    >
      <span aria-hidden="true">{text.slice(0, visible)}</span>
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
      <span className="terminal-cursor" aria-hidden="true">
        _
      </span>
    </span>
  );
}

export function WorldEntryLogo({
  userName,
  stage,
  reducedMotion,
  singleSelected,
  multiSelected = false,
  selectedHarness = null,
  connectionPending = false,
  rosterFull = false,
  onSingle,
  onMulti = () => undefined,
  onHarness,
  onHermes,
}: {
  readonly userName: string;
  readonly stage: "identity" | "session" | "constellation" | "prompt" | "ready";
  readonly reducedMotion: boolean;
  readonly singleSelected: boolean;
  readonly multiSelected?: boolean;
  readonly selectedHarness?:
    "hermes" | "openclaw" | "claude-code" | "codex" | null;
  readonly connectionPending?: boolean;
  readonly rosterFull?: boolean;
  readonly onSingle: () => void;
  readonly onMulti?: () => void;
  readonly onHarness?: (
    harness: "hermes" | "openclaw" | "claude-code" | "codex",
  ) => void;
  readonly onHermes?: () => void;
}) {
  const showSessions = stage === "session" || stage === "constellation";
  const showHarnesses =
    stage === "constellation" || stage === "prompt" || stage === "ready";
  return (
    <section
      className="world-entry-logo"
      aria-label="AgentIntersect World identity and agent constellation"
      style={{ fontFamily: "Consolas, 'Liberation Mono', monospace" }}
    >
      <div className="world-entry-logo__mark">
        <img
          src="/assets/dashboard/agentintersect_animated.svg"
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        <strong className="world-entry-logo__name">{userName}</strong>
        {showHarnesses ? (
          <div
            className="world-entry-logo__endpoints"
            aria-label="Agent harnesses"
            data-selected-harness={selectedHarness ?? "none"}
          >
            {(
              [
                ["openclaw", "openclaw_", "openclaw"],
                ["hermes", "hermes_", "hermes"],
                ["claude-code", "claude_", "claude"],
                ["codex", "codex_", "codex"],
              ] as const
            ).map(([harness, label, modifier]) => {
              const disabled = connectionPending || rosterFull;
              const selected = selectedHarness === harness;
              return (
                <button
                  key={harness}
                  type="button"
                  className={`world-harness world-harness--${modifier} ${
                    disabled
                      ? "world-action--unavailable"
                      : "world-action--enabled"
                  }`}
                  aria-label={`Connect ${label.slice(0, -1)}`}
                  aria-pressed={selected}
                  aria-disabled={disabled}
                  disabled={disabled}
                  onClick={() => {
                    onHarness?.(harness);
                    if (harness === "hermes") onHermes?.();
                  }}
                >
                  {label}
                  <span className="sr-only">
                    {selected ? " — selected" : " — available"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="world-entry-logo__terminal">
        <WorldTypeLine text="AgentIntersect" reducedMotion={reducedMotion} />
        {showSessions ? (
          <div className="world-entry-logo__session-choices">
            <button
              type="button"
              className="world-session-choice world-action--enabled"
              aria-pressed={singleSelected}
              aria-disabled="false"
              onClick={onSingle}
            >
              Single Agent
              <span className="sr-only"> — available</span>
            </button>
            <button
              type="button"
              className="world-session-choice world-action--enabled"
              aria-pressed={multiSelected}
              aria-disabled="false"
              onClick={onMulti}
            >
              Multi Agent
              <span className="sr-only"> — available</span>
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
