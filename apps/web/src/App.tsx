import {
  DEFAULT_AVATAR_PROFILE,
  hasSavedAvatarProfile,
  loadAvatarProfile,
  saveAvatarProfile,
  type AvatarProfile,
} from "@agentintersect-world/avatar-system";
import { useEffect, useState } from "react";

import { IdentifyExperience } from "./avatar/IdentifyExperience.js";
import { useReducedMotion } from "./motion/use-reduced-motion.js";
import { DashboardShell } from "./shell/DashboardShell.js";

const WORLD_ENTRY_TRANSITION_MS = 420;

function initialAvatarState() {
  if (typeof window === "undefined") {
    return { profile: DEFAULT_AVATAR_PROFILE, identified: false };
  }
  return {
    profile: loadAvatarProfile(window.localStorage),
    identified: hasSavedAvatarProfile(window.localStorage),
  };
}

export function App() {
  const reducedMotion = useReducedMotion();
  const [initial] = useState(initialAvatarState);
  const [profile, setProfile] = useState(initial.profile);
  const [identified, setIdentified] = useState(initial.identified);
  const [enteringWorld, setEnteringWorld] = useState(false);
  const save = (next: AvatarProfile): AvatarProfile => {
    const saved = saveAvatarProfile(window.localStorage, next);
    setProfile(saved);
    return saved;
  };

  const completeIdentification = (next: AvatarProfile) => {
    save(next);
    if (reducedMotion) setIdentified(true);
    else setEnteringWorld(true);
  };

  useEffect(() => {
    if (!enteringWorld) return;
    const timer = window.setTimeout(
      () => {
        setEnteringWorld(false);
        setIdentified(true);
      },
      reducedMotion ? 0 : WORLD_ENTRY_TRANSITION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [enteringWorld, reducedMotion]);

  if (enteringWorld) {
    return (
      <main className="identify-shell" data-testid="world-entry-transition">
        <section className="phase-transition" role="status" aria-live="polite">
          <span className="terminal-kicker">appearance_saved_</span>
          <h1>Entering AgentIntersect World</h1>
          <p>Composing the local repository dashboard…</p>
          <span className="phase-transition__scan" aria-hidden="true" />
        </section>
      </main>
    );
  }
  if (!identified) {
    return (
      <IdentifyExperience
        initialProfile={profile}
        onComplete={completeIdentification}
      />
    );
  }
  return (
    <DashboardShell
      profile={profile}
      onProfileSave={(next) => void save(next)}
    />
  );
}
