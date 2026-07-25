import {
  createAvatarProfile,
  deleteAvatarProfiles,
  loadAvatarProfiles,
  saveAvatarProfile,
  type AvatarDraft,
  type AvatarLoadResult,
  type AvatarProfile,
} from "@agentintersect-world/avatar-system";
import { lazy, Suspense, useEffect, useState } from "react";

import { IdentifyExperience } from "./avatar/IdentifyExperience.js";
import { useReducedMotion } from "./motion/use-reduced-motion.js";
import { resolveAppSurface } from "./world-entry/app-surface.js";
import { WorldEntryExperience } from "./world-entry/WorldEntryExperience.js";

const InternalDashboard = lazy(async () => {
  const module = await import("./shell/DashboardShell.js");
  return { default: module.DashboardShell };
});

const WORLD_ENTRY_TRANSITION_MS = 420;
const emptyState = (): AvatarLoadResult => ({
  status: "unconfigured",
  current: null,
  previous: null,
  draft: {
    agentName: "",
    species: "human",
    head: "round",
    hands: "hands",
    feet: "feet",
    fur: "none",
    tail: "none",
    markings: "solid",
    bodyColor: "warm-light",
    shirt: "Codex",
    mappingConsent: false,
    agentRef: null,
    sourceDisclosure: "manual-local-input",
  },
});

function initialAvatarState(): AvatarLoadResult {
  return typeof window === "undefined"
    ? emptyState()
    : loadAvatarProfiles(window.localStorage);
}

export function App() {
  const reducedMotion = useReducedMotion();
  const [store, setStore] = useState(initialAvatarState);
  const [identified, setIdentified] = useState(store.current !== null);
  const [enteringWorld, setEnteringWorld] = useState(false);
  const surface = resolveAppSurface(
    typeof window === "undefined" ? "/" : window.location.pathname,
    import.meta.env.VITE_AIW_LOCAL_DEVELOPER_UI,
  );
  const save = (draft: AvatarDraft): AvatarProfile => {
    const next = createAvatarProfile(draft, store.current);
    const saved = saveAvatarProfile(window.localStorage, next);
    setStore(loadAvatarProfiles(window.localStorage));
    return saved;
  };
  const completeIdentification = (draft: AvatarDraft) => {
    save(draft);
    if (reducedMotion) setIdentified(true);
    else setEnteringWorld(true);
  };
  const remove = () => {
    deleteAvatarProfiles(window.localStorage);
    const next = loadAvatarProfiles(window.localStorage);
    setStore(next);
    setIdentified(false);
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

  if (enteringWorld)
    return (
      <main className="identify-shell" data-testid="world-entry-transition">
        <section className="phase-transition" role="status" aria-live="polite">
          <span className="terminal-kicker">avatar_saved_</span>
          <h1>Personalizing AgentIntersect World</h1>
          <p>Restoring your World identity…</p>
          <span className="phase-transition__scan" aria-hidden="true" />
        </section>
      </main>
    );
  if (!identified || store.current === null)
    return (
      <IdentifyExperience
        initialProfile={store.draft}
        previousProfile={store.previous}
        storageStatus={store.status}
        onComplete={completeIdentification}
      />
    );
  if (surface === "internal-unavailable")
    return (
      <main className="internal-unavailable">
        <section role="status" aria-live="polite">
          <span className="terminal-kicker">local only_</span>
          <h1>Internal dashboard unavailable</h1>
          <p>This route requires the explicit local developer UI flag.</p>
        </section>
      </main>
    );
  if (surface === "internal-dashboard")
    return (
      <Suspense
        fallback={
          <main className="internal-unavailable" role="status">
            Loading internal dashboard…
          </main>
        }
      >
        <InternalDashboard
          profile={store.current}
          previousProfile={store.previous}
          onProfileSave={save}
          onProfileDelete={remove}
        />
      </Suspense>
    );
  return <WorldEntryExperience profile={store.current} />;
}
