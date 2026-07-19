import { useEffect, useState } from "react";

import { useReducedMotion } from "../motion/use-reduced-motion.js";

export const WORLD_HERO_TYPE_LINE =
  "Select a local harness intent, then explore shareable World objects";

const TYPEWRITER_TICK_MS = 32;
const TYPEWRITER_CHARACTERS_PER_TICK = 3;

export function ProgressiveTypeLine() {
  const reducedMotion = useReducedMotion();
  const [visibleCharacters, setVisibleCharacters] = useState(() =>
    reducedMotion ? WORLD_HERO_TYPE_LINE.length : 0,
  );

  useEffect(() => {
    if (reducedMotion) {
      const timer = window.setTimeout(
        () => setVisibleCharacters(WORLD_HERO_TYPE_LINE.length),
        0,
      );
      return () => window.clearTimeout(timer);
    }
    const timer = window.setInterval(() => {
      setVisibleCharacters((current) => {
        const next = Math.min(
          WORLD_HERO_TYPE_LINE.length,
          current + TYPEWRITER_CHARACTERS_PER_TICK,
        );
        if (next === WORLD_HERO_TYPE_LINE.length) window.clearInterval(timer);
        return next;
      });
    }, TYPEWRITER_TICK_MS);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  const complete = visibleCharacters === WORLD_HERO_TYPE_LINE.length;
  return (
    <p
      className="typewriter-line"
      data-testid="typewriter-line"
      data-state={complete ? "complete" : "typing"}
      data-visible-characters={visibleCharacters}
    >
      <span aria-hidden="true">
        {WORLD_HERO_TYPE_LINE.slice(0, visibleCharacters)}
      </span>
      <span className="sr-only">{WORLD_HERO_TYPE_LINE}</span>
      <span
        className="terminal-cursor terminal-cursor--inline"
        data-testid="inline-cursor"
        aria-hidden="true"
      />
    </p>
  );
}
