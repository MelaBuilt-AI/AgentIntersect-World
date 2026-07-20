import type { AvatarProfile } from "@agentintersect-world/avatar-system";
import { lazy, Suspense, useEffect, useState } from "react";

import { useAuthorityState } from "../authority/use-authority.js";
import { AvatarBuilder } from "../avatar/AvatarBuilder.js";
import { AvatarPreview } from "../avatar/AvatarPreview.js";
import { CommandIntentPanel } from "../commands/CommandIntentPanel.js";
import { EvidencePanelLoader } from "../evidence/EvidencePanel.js";
import { PHASE8_EVIDENCE_FIXTURE } from "../evidence/evidence-fixtures.js";
import { IntegrationPanel } from "../integration/IntegrationPanel.js";
import { useIntegration } from "../integration/use-integration.js";
import { AuthorityPanel } from "../panels/AuthorityPanel.js";
import { RepositoryIndexPanel } from "../panels/RepositoryIndexPanel.js";
import { requestRepositorySelection } from "../repository/repository-selection.js";
import { useInvalidateWorld } from "../repository/use-invalidate-world.js";
import { HARNESS_OPTIONS, type HarnessId } from "../state/harness-intent.js";
import { useHarnessIntent } from "../state/use-harness-intent.js";
import { WORLD_CATEGORIES, type Category } from "./categories.js";
import { ProgressiveTypeLine } from "./ProgressiveTypeLine.js";

const PresentationPanelLoader = lazy(async () => {
  const module = await import("../presentation/PresentationPanelLoader.js");
  return { default: module.PresentationPanelLoader };
});

const RepositoryWorldPanel = lazy(async () => {
  const module = await import("../repository/RepositoryWorldPanel.js");
  return { default: module.RepositoryWorldPanel };
});

export function DashboardShell({
  profile,
  onProfileSave,
}: {
  readonly profile: AvatarProfile;
  readonly onProfileSave: (profile: AvatarProfile) => void;
}) {
  const constrainedCosmetics =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency <= 2;
  const authority = useAuthorityState();
  const invalidateWorld = useInvalidateWorld();
  const [activePanel, setActivePanel] = useState<Category | null>(null);
  const [lastResult, setLastResult] = useState(
    "World shell ready. Choose a category.",
  );
  const harness = useHarnessIntent();
  const integration = useIntegration(harness.currentHarness);
  const fixtureValue =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("fixture");
  const fixture =
    fixtureValue === "phase10-100k"
      ? "phase10-100k"
      : fixtureValue === "phase10-10k"
        ? "phase10-10k"
        : fixtureValue === "phase10-graph"
          ? "phase10"
          : fixtureValue === "phase8-evidence"
            ? "phase8"
            : fixtureValue === "phase5-10k"
              ? "10k"
              : fixtureValue === "phase5-paths"
                ? "absolute-paths"
                : fixtureValue === "phase5";
  const phase7Fixture = fixtureValue === "phase7-job";
  const phase8Fixture = fixtureValue === "phase8-evidence";
  const commandsEnabled =
    phase7Fixture ||
    (authority.status === "ready" &&
      authority.ready.config.agentIntersectCommandsEnabled);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePanel(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const togglePanel = (category: Category) => {
    setActivePanel((current) => {
      const next = current === category ? null : category;
      setLastResult(
        next === null
          ? `${category} overlay closed.`
          : `${category} overlay opened.`,
      );
      return next;
    });
  };
  const setDefault = (id: HarnessId) => {
    harness.setDefaultHarness(id);
    setLastResult(
      `${HARNESS_OPTIONS.find((item) => item.id === id)?.label} saved as default selection intent. No readiness claimed.`,
    );
  };
  const setCurrent = (id: HarnessId) => {
    harness.setCurrentHarness(id);
    setLastResult(
      `${HARNESS_OPTIONS.find((item) => item.id === id)?.label} saved as current selection intent. No connection or execution claimed.`,
    );
  };
  return (
    <main
      className={`dashboard-shell${constrainedCosmetics ? " dashboard-shell--constrained-cosmetics" : ""}`}
      data-cosmetic-quality={constrainedCosmetics ? "constrained" : "full"}
    >
      <header className="dashboard-header">
        <a
          href="#world-hero"
          className="dashboard-brand"
          aria-label="AgentIntersect World home"
        >
          <img
            src="/assets/dashboard/agentintersect_header_static_dark_square.svg"
            alt=""
            aria-hidden="true"
          />
          <span>
            AgentIntersect <strong>World</strong>
          </span>
        </a>
        <span className="phase-pill">local / trusted LAN</span>
      </header>

      <section className="world-hero" id="world-hero" data-testid="world-hero">
        <div className="world-hero__identity">
          <img
            src={
              constrainedCosmetics
                ? "/assets/dashboard/agentintersect_header_static_dark_square.svg"
                : "/assets/dashboard/agentintersect_animated.svg"
            }
            alt=""
            aria-hidden="true"
            className="world-hero__mark"
          />
          <AvatarPreview profile={profile} compact />
        </div>
        <div className="world-hero__console">
          <span className="terminal-kicker">agentintersect_world_</span>
          <h1>One local operator. One living repository island.</h1>
          <ProgressiveTypeLine />
          <div
            className="harness-controls"
            aria-label="Local harness selection intent"
          >
            <label>
              Default harness intent
              <select
                value={harness.defaultHarness}
                onChange={(event) =>
                  setDefault(event.target.value as HarnessId)
                }
              >
                {HARNESS_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Current harness intent
              <select
                value={harness.currentHarness}
                onChange={(event) =>
                  setCurrent(event.target.value as HarnessId)
                }
              >
                {HARNESS_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="truthful-copy">
            Selected harness read status:{" "}
            {integration.loading
              ? "loading"
              : (integration.readiness?.status ??
                integration.state?.status ??
                "offline")}
            . Phase 7 enables only the bounded command-intent action when its
            dedicated authority is configured.
          </p>
        </div>
      </section>

      <nav className="terminal-nav" aria-label="World categories">
        {WORLD_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            aria-expanded={activePanel === category}
            aria-controls="world-overlay"
            onClick={() => togglePanel(category)}
          >
            <span>{category}</span>
            {activePanel === category && (
              <span className="nav-cursor" aria-hidden="true" />
            )}
          </button>
        ))}
      </nav>

      <section
        className="persistent-output"
        aria-label="Persistent World output and status"
      >
        <div>
          <span>status_</span>
          <strong>
            {authority.status === "ready"
              ? "local authority available"
              : authority.status}
          </strong>
        </div>
        <div>
          <span>integration_</span>
          <strong>
            {integration.loading
              ? "loading"
              : `${integration.state?.status ?? "offline"} · ${harness.currentHarness}`}
          </strong>
        </div>
        <div
          className="persistent-output__result"
          role="status"
          aria-live="polite"
        >
          <span>result_</span>
          <strong>{lastResult}</strong>
        </div>
      </section>

      <Suspense
        fallback={
          <section className="panel-state" role="status">
            Loading local presentation synchronization…
          </section>
        }
      >
        <PresentationPanelLoader />
      </Suspense>

      {activePanel !== null && (
        <section
          className="world-overlay"
          id="world-overlay"
          aria-label={`${activePanel} panel`}
        >
          <header className="world-overlay__header">
            <span>{activePanel.toLocaleLowerCase()}_</span>
            <button
              type="button"
              onClick={() => togglePanel(activePanel)}
              aria-label={`Close ${activePanel} panel`}
            >
              Close
            </button>
          </header>
          {activePanel === "World" && (
            <div className="stacked-panels">
              {integration.state ? (
                <IntegrationPanel
                  state={integration.state}
                  readiness={integration.readiness}
                />
              ) : (
                <section className="panel-state" role="status">
                  Loading AgentIntersect read integration…
                </section>
              )}
              <Suspense
                fallback={
                  <section className="panel-state" role="status">
                    Loading repository World…
                  </section>
                }
              >
                <RepositoryWorldPanel fixture={fixture} />
              </Suspense>
              <AuthorityPanel authority={authority} />
            </div>
          )}
          {activePanel === "Repositories" && (
            <RepositoryIndexPanel
              authorityReady={authority.status === "ready"}
              onIndexed={invalidateWorld}
            />
          )}
          {activePanel === "Agents" &&
            (integration.state ? (
              <IntegrationPanel
                state={integration.state}
                readiness={integration.readiness}
              />
            ) : (
              <section className="panel-state" role="status">
                Loading observed roster…
              </section>
            ))}
          {activePanel === "Activity" &&
            (integration.state ? (
              <div className="stacked-panels">
                <CommandIntentPanel
                  harness={harness.currentHarness}
                  readiness={integration.readiness}
                  phaseId={
                    integration.state.projection.phaseBoard.current?.id ?? null
                  }
                  commandsEnabled={commandsEnabled}
                  fixtureMode={phase7Fixture}
                />
                <IntegrationPanel
                  state={integration.state}
                  readiness={integration.readiness}
                />
              </div>
            ) : (
              <section className="panel-state" role="status">
                Loading normalized timeline…
              </section>
            ))}
          {activePanel === "Evidence" && (
            <EvidencePanelLoader
              {...(phase8Fixture ? { fixture: PHASE8_EVIDENCE_FIXTURE } : {})}
              onSelectObject={(ref, relativePath) => {
                requestRepositorySelection(ref, relativePath);
                setActivePanel("World");
                setLastResult(
                  `${relativePath} selected and focused through the repository browser.`,
                );
              }}
            />
          )}
          {activePanel === "Settings" && (
            <AvatarBuilder
              key={`${profile.body}-${profile.accent}-${String(profile.showHelmet)}`}
              initialProfile={profile}
              title="Edit avatar appearance"
              onSave={(next) => {
                onProfileSave(next);
                setLastResult("Avatar appearance updated locally.");
              }}
            />
          )}
        </section>
      )}

      <footer className="dashboard-footer">
        <span>Phase 9 local presentation synchronization</span>
        <span>Relative, shareable World metadata only</span>
      </footer>
    </main>
  );
}
