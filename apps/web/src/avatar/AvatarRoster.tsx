import {
  mapRosterProfileInput,
  opaqueRosterAgentRef,
  projectAvatarAnimation,
  revokeAvatarMapping,
  type AvatarAction,
  type AvatarProfile,
} from "@agentintersect-world/avatar-system";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { IntegrationState } from "../integration/types.js";
import { useReducedMotion } from "../motion/use-reduced-motion.js";
import { AvatarPreview } from "./AvatarPreview.js";

type Roster = IntegrationState["projection"]["roster"];
const AvatarRosterScene = lazy(async () => {
  const module = await import("./AvatarRosterScene.js");
  return { default: module.AvatarRosterScene };
});
export function AvatarRoster({
  roster,
  integrationStatus,
  profile,
  onProfileSave,
  constrained = false,
}: {
  readonly roster: Roster;
  readonly integrationStatus: IntegrationState["status"];
  readonly profile: AvatarProfile;
  readonly onProfileSave: (profile: AvatarProfile) => unknown;
  readonly constrained?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [terminalTransitions, setTerminalTransitions] = useState<
    Record<string, string>
  >({});
  const priorStatuses = useRef<Record<string, string>>(
    Object.fromEntries(
      roster.slice(0, 64).map((agent) => [agent.id, agent.status ?? "unknown"]),
    ),
  );
  useEffect(() => {
    let active = true;
    void Promise.all(
      roster
        .slice(0, 64)
        .map(
          async (entry) =>
            [entry.id, await opaqueRosterAgentRef(entry.id)] as const,
        ),
    ).then((pairs) => {
      if (active) setRefs(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [roster]);
  useEffect(() => {
    const changed = roster
      .slice(0, 64)
      .map((agent) => [agent.id, agent.status ?? "unknown"] as const)
      .filter(
        ([id, status]) =>
          priorStatuses.current[id] !== status &&
          (status === "completed" || status === "failed"),
      );
    priorStatuses.current = Object.fromEntries(
      roster.slice(0, 64).map((agent) => [agent.id, agent.status ?? "unknown"]),
    );
    if (changed.length === 0) return;
    let finishTimer: number | undefined;
    const beginTimer = window.setTimeout(() => {
      setTerminalTransitions((current) => ({
        ...current,
        ...Object.fromEntries(changed),
      }));
      finishTimer = window.setTimeout(() => {
        setTerminalTransitions((current) => {
          const next = { ...current };
          for (const [id, status] of changed)
            if (next[id] === status) delete next[id];
          return next;
        });
      }, 2_200);
    }, 0);
    return () => {
      window.clearTimeout(beginTimer);
      if (finishTimer !== undefined) window.clearTimeout(finishTimer);
    };
  }, [roster]);
  const configure = (id: string, displayLabel: string) => {
    const mapped = mapRosterProfileInput(
      { agentRef: refs[id], displayLabel },
      true,
    );
    if (mapped)
      onProfileSave({
        ...profile,
        ...mapped,
        updatedAt: new Date().toISOString(),
      });
  };
  return (
    <section className="avatar-roster" aria-labelledby="avatar-roster-heading">
      <header>
        <span className="terminal-kicker">owned_agent_avatars_</span>
        <h2 id="avatar-roster-heading">
          Configured avatars and truthful roster
        </h2>
        <p>
          {constrained
            ? "3D cosmetics are disabled on constrained hardware; "
            : "Up to 12 visible 3D avatars; "}
          all {Math.min(roster.length, 64)} bounded rows remain semantic. Status
          text is authoritative.
        </p>
      </header>
      <ul>
        {roster.slice(0, 64).map((agent, index) => {
          const configured =
            profile.agentRef !== null && profile.agentRef === refs[agent.id];
          const status = agent.status ?? "unknown";
          const projection = projectAvatarAnimation({
            lifecycle: status,
            integrationStatus,
            accepted:
              integrationStatus === "ready" && agent.status !== undefined,
            reducedMotion,
            elapsedMs: terminalTransitions[agent.id] === status ? 0 : 2_201,
          });
          const displayLabel = (agent.harness ?? "Owned agent").slice(0, 32);
          return (
            <li
              key={agent.id}
              data-avatar-configured={configured}
              data-lifecycle={status}
            >
              <div className="avatar-roster__truth">
                <strong>{configured ? profile.agentName : displayLabel}</strong>
                <span>
                  Current: {status} · {projection.action}
                  {projection.animate ? "" : " static"}
                </span>
                <span>Previous: none observed in this view</span>
                <small>
                  {agent.harness ?? "unknown harness"} · opaque owned-agent row
                </small>
                {configured ? (
                  <button
                    type="button"
                    onClick={() => onProfileSave(revokeAvatarMapping(profile))}
                  >
                    Revoke roster mapping
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!refs[agent.id]}
                    onClick={() => configure(agent.id, displayLabel)}
                  >
                    Opt in and use this public label
                  </button>
                )}
              </div>
              {configured && index < 12 ? (
                <AvatarPreview
                  profile={profile}
                  compact
                  textOnly={constrained}
                  action={projection.action}
                  animate={projection.animate}
                />
              ) : (
                <div className="avatar-roster__placeholder">
                  {configured
                    ? "Static over-cap avatar summary"
                    : "Unconfigured — no fake avatar assigned"}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {roster.length === 0 && (
        <p>No owned agent observations. No avatar identity was invented.</p>
      )}
      {roster.length > 64 && (
        <p>
          {roster.length - 64} additional rows omitted by the 64-row semantic
          bound.
        </p>
      )}
    </section>
  );
}

export function AvatarPerformanceFixture({
  profile,
  constrained = false,
}: {
  readonly profile: AvatarProfile;
  readonly constrained?: boolean;
}) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const species = ["human", "dog", "cat"] as const;
  const heads = {
    human: ["round", "angular", "soft", "square"],
    dog: ["labrador", "shepherd", "husky", "beagle"],
    cat: ["shorthair", "siamese", "maine-coon", "bengal"],
  } as const;
  const avatars = Array.from({ length: 12 }, (_, index) => {
    const kind = species[Math.floor(index / 4)]!;
    const action: AvatarAction = !settled
      ? "Idle"
      : index % 3 === 0
        ? "Work"
        : index % 3 === 1
          ? "Idle"
          : "Offline";
    return {
      selection: {
        ...profile,
        agentName: `Fixture avatar ${index + 1}`,
        species: kind,
        head: heads[kind][index % 4]!,
        tail: (kind === "human"
          ? "none"
          : `${kind}-${index % 2 ? "curled" : "straight"}`) as AvatarProfile["tail"],
        fur: (kind === "human"
          ? "none"
          : index % 2
            ? "long"
            : "short") as AvatarProfile["fur"],
      },
      action,
      animate: false,
    };
  });
  const visibleAvatars = constrained ? [] : avatars;
  return (
    <section
      className="avatar-performance-fixture"
      data-testid="avatar-performance-fixture"
      data-visible-avatar-limit={visibleAvatars.length}
      aria-label={`Fixture-only ${visibleAvatars.length} visible avatar renderer`}
    >
      <h3>
        Fixture-only renderer capacity: {visibleAvatars.length} visible avatars
        {constrained ? " on constrained hardware" : ""}
      </h3>
      {constrained ? (
        <div
          className="avatar-kit-roster-static"
          data-avatar-count="0"
          role="status"
        >
          3D cosmetics disabled on constrained hardware. All avatar identities
          and lifecycle actions remain in the semantic summaries below.
        </div>
      ) : (
        <Suspense fallback={<p>Loading one shared avatar kit…</p>}>
          <AvatarRosterScene avatars={visibleAvatars} />
        </Suspense>
      )}
      <ol>
        {avatars.map((avatar, index) => (
          <li key={index}>
            <strong>{avatar.selection.agentName}</strong> ·{" "}
            {avatar.selection.species} · {avatar.action}
          </li>
        ))}
      </ol>
    </section>
  );
}
