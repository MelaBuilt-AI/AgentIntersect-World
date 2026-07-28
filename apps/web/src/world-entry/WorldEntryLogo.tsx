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
  onSingle,
  onHermes,
}: {
  readonly userName: string;
  readonly stage: "identity" | "session" | "constellation" | "prompt" | "ready";
  readonly reducedMotion: boolean;
  readonly singleSelected: boolean;
  readonly onSingle: () => void;
  readonly onHermes: () => void;
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
          >
            <button
              type="button"
              className="world-harness world-harness--openclaw world-action--unavailable"
              aria-disabled="true"
              disabled
              title="Unavailable until Phase 19"
            >
              openclaw_
              <span className="sr-only"> — unavailable until Phase 19</span>
            </button>
            <button
              type="button"
              className={
                singleSelected
                  ? "world-harness world-harness--hermes world-action--enabled"
                  : "world-harness world-harness--hermes world-action--unavailable"
              }
              aria-disabled={singleSelected ? "false" : "true"}
              disabled={!singleSelected}
              onClick={onHermes}
            >
              hermes_
              <span className="sr-only">
                {singleSelected ? " — available" : " — select Single Agent"}
              </span>
            </button>
            <button
              type="button"
              className="world-harness world-harness--claude world-action--unavailable"
              aria-disabled="true"
              disabled
              title="Unavailable until Phase 19"
            >
              claude_
              <span className="sr-only"> — unavailable until Phase 19</span>
            </button>
            <button
              type="button"
              className="world-harness world-harness--codex world-action--unavailable"
              aria-disabled="true"
              disabled
              title="Unavailable until Phase 19"
            >
              codex_
              <span className="sr-only"> — unavailable until Phase 19</span>
            </button>
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
              className="world-session-choice world-action--unavailable"
              aria-disabled="true"
              disabled
              title="Unavailable until Phase 19"
            >
              Multi Agent
              <span className="sr-only"> — unavailable until Phase 19</span>
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
