import type {
  AvatarDraft,
  AvatarLoadResult,
  AvatarProfile,
} from "@agentintersect-world/avatar-system";
import { useEffect, useState } from "react";
import { useReducedMotion } from "../motion/use-reduced-motion.js";
import { AvatarBuilder } from "./AvatarBuilder.js";

const IDENTIFY_TRANSITION_MS = 360;
export function IdentifyExperience({
  initialProfile,
  previousProfile,
  storageStatus,
  onComplete,
}: {
  readonly initialProfile: AvatarDraft;
  readonly previousProfile: AvatarProfile | null;
  readonly storageStatus: AvatarLoadResult["status"];
  readonly onComplete: (profile: AvatarDraft) => void;
}) {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<"opening" | "transition" | "appearance">(
    "opening",
  );
  useEffect(() => {
    if (stage !== "transition") return;
    const timer = window.setTimeout(
      () => setStage("appearance"),
      reducedMotion ? 0 : IDENTIFY_TRANSITION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, stage]);
  if (stage === "appearance")
    return (
      <main className="identify-shell identify-shell--builder">
        <AvatarBuilder
          initialProfile={initialProfile}
          currentProfile={null}
          previousProfile={previousProfile}
          storageStatus={storageStatus}
          onSave={onComplete}
        />
      </main>
    );
  if (stage === "transition")
    return (
      <main
        className="identify-shell identify-shell--transition"
        data-testid="identify-transition"
      >
        <section className="phase-transition" role="status" aria-live="polite">
          <span className="terminal-kicker">identity_signal_</span>
          <h1>Identity channel accepted</h1>
          <p>Opening the local 3D avatar builder…</p>
          <span className="phase-transition__scan" aria-hidden="true" />
        </section>
      </main>
    );
  return (
    <main className="identify-shell" data-testid="identify-opening">
      <div className="identify-grid" aria-hidden="true" />
      <section className="identify-opening" aria-labelledby="identify-title">
        <img
          src="/assets/dashboard/agentintersect_animated.svg"
          alt=""
          className="identify-mark"
          aria-hidden="true"
        />
        <p className="terminal-line" id="identify-title">
          identify_
          <span className="terminal-cursor" aria-hidden="true" />
        </p>
        <p>
          Establish a local, privacy-safe avatar before entering AgentIntersect
          World.
        </p>
        <button
          type="button"
          className="identify-action"
          onClick={() => setStage(reducedMotion ? "appearance" : "transition")}
        >
          Create Avatar
        </button>
      </section>
    </main>
  );
}
