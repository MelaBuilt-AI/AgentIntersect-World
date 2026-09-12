import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  AgentSetupState,
  DiscoveryResult,
} from "@agentintersect-world/world-schema/agent-setup";
import { AgentSetupMenu } from "./AgentSetupMenu.js";
import { AgentSetupContext } from "./agent-setup-context.js";
import {
  attachSetupAgent,
  completeAgentSetup,
  discoverSetupAgents,
  loadAgentSetup,
  recheckSetupAgent,
} from "./agent-setup-client.js";
import { WorldEscapeMenu } from "./WorldEscapeMenu.js";
import {
  DEFAULT_WORLD_DISPLAY_PREFERENCES,
  loadWorldDisplayPreferences,
  saveWorldDisplayPreferences,
} from "./world-escape-menu-model.js";

const empty: AgentSetupState = {
  schema: "aiw.agent-setup/1",
  completed: false,
  registrations: [],
};
export function AgentSetupBoundary({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [state, setState] = useState<AgentSetupState | null>(null);
  const [opening, setOpening] = useState(true);
  const [open, setOpen] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState(() =>
    typeof window === "undefined"
      ? DEFAULT_WORLD_DISPLAY_PREFERENCES
      : loadWorldDisplayPreferences(window.localStorage),
  );
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => setOpening(false), 1200);
    void loadAgentSetup()
      .then((next) => {
        if (active) setState(next);
      })
      .catch((error: unknown) => {
        if (active)
          setMessage(
            error instanceof Error ? error.message : "Agent Setup unavailable",
          );
      });
    const show = () => setOpen(true);
    window.addEventListener("aiw:open-agent-setup", show);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener("aiw:open-agent-setup", show);
    };
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Agent Setup unavailable. Try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const visible = open || (!opening && state !== null && !state.completed);
  return (
    <AgentSetupContext.Provider
      value={state?.registrations.length ? state : null}
    >
      {state?.completed && !opening ? (
        <div inert={visible || undefined}>{children}</div>
      ) : (
        <main className="identify-shell" data-testid="agent-setup-opening">
          <img
            className="identify-mark"
            src="/assets/dashboard/agentintersect_animated.svg"
            alt="AgentIntersect World"
          />
          {!opening && state === null ? (
            <section role="status">
              <p>{message || "Loading Agent Setup…"}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => setState(await loadAgentSetup()))
                }
              >
                Retry Agent Setup
              </button>
            </section>
          ) : null}
        </main>
      )}
      <span className="agent-setup-escape-hint">Escape for Menu</span>
      {visible ? (
        <AgentSetupMenu
          state={state ?? empty}
          discovery={discovery}
          busy={busy}
          message={message}
          onDiscover={(additionalDirectory) =>
            void run(async () => {
              setDiscovery(
                await discoverSetupAgents(fetch, additionalDirectory),
              );
              setMessage(
                "Discovery finished. Select a native identity to attach.",
              );
            })
          }
          onAttach={(input) =>
            void run(async () => {
              const result = await attachSetupAgent(input);
              setState(await loadAgentSetup());
              setMessage(result.check.message);
            })
          }
          onRecheck={(id) =>
            void run(async () => {
              setMessage((await recheckSetupAgent(id)).message);
            })
          }
          onComplete={() =>
            void run(async () => {
              setState(await completeAgentSetup());
              setOpen(false);
            })
          }
          {...(state?.completed ? { onClose: () => setOpen(false) } : {})}
        />
      ) : null}
      <WorldEscapeMenu
        entryOnly
        userName="User"
        agentName="Agent"
        preferences={preferences}
        onPreferences={(next) => {
          setPreferences(next);
          saveWorldDisplayPreferences(window.localStorage, next);
        }}
        onLogout={() => {}}
        onResetSession={() => {}}
        onChangeAvatar={() => {}}
        onChangeAgent={() => {}}
      />
    </AgentSetupContext.Provider>
  );
}
