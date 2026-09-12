import { useCallback, useEffect, useRef, useState } from "react";

import { isEditableWorldTarget } from "./world-navigation-model.js";
import {
  worldEscapeMenuOwner,
  type WorldDisplayPreferences,
} from "./world-escape-menu-model.js";

type WorldEscapeView = "menu" | "settings" | "avatar-target" | "reset";

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function WorldEscapeMenu({
  userName,
  agentName,
  preferences,
  onPreferences,
  onLogout,
  onResetSession,
  onChangeAvatar,
  onChangeAgent,
  entryOnly = false,
}: {
  readonly entryOnly?: boolean;
  readonly userName: string;
  readonly agentName: string;
  readonly preferences: WorldDisplayPreferences;
  readonly onPreferences: (preferences: WorldDisplayPreferences) => void;
  readonly onLogout: () => void;
  readonly onResetSession: () => void;
  readonly onChangeAvatar: (target: "user" | "agent") => void;
  readonly onChangeAgent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<WorldEscapeView>("menu");
  const dialogRef = useRef<HTMLElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const restoreFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      const opener = openerRef.current;
      const destination =
        opener?.isConnected === true
          ? opener
          : document.querySelector<HTMLElement>('[data-scene-id="world-room"]');
      destination?.focus({ preventScroll: true });
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setView("menu");
    restoreFocus();
  }, [restoreFocus]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      const setupOpen = document.querySelector("[data-agent-setup]") !== null;
      const owner = worldEscapeMenuOwner(
        setupOpen,
        document.querySelector("[data-world-menu-owner]") !== null,
      );
      if ((owner === "entry") !== entryOnly) return;
      if (!entryOnly && !setupOpen && isEditableWorldTarget(event.target))
        return;
      if (
        document.querySelector(
          '[role="dialog"][aria-modal="true"]:not([data-agent-setup])',
        ) ||
        document.querySelector(
          '[data-mouse-look="active"], [data-screen-dragging="true"], [data-code-focused="true"], .world-view[data-input-owner="preview"]',
        )
      )
        return;
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      event.preventDefault();
      event.stopPropagation();
      setView("menu");
      setOpen(true);
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [close, open, entryOnly]);

  useEffect(() => {
    if (!open) return;
    initialFocusRef.current?.focus({ preventScroll: true });
  }, [open, view]);

  if (!open)
    return entryOnly ? null : <span hidden data-world-menu-owner="true" />;

  const act = (action: () => void) => {
    setOpen(false);
    setView("menu");
    action();
  };
  const trapFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const focusable = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ??
        []),
    ];
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const current = document.activeElement;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="world-escape-backdrop"
      data-world-menu-owner={entryOnly ? undefined : "true"}
    >
      <section
        ref={dialogRef}
        className="world-escape-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="world-escape-title"
        data-large-text={preferences.largeMenuText}
        onKeyDown={trapFocus}
      >
        {view === "menu" ? (
          <>
            <span className="terminal-kicker">world_menu_</span>
            <h2 id="world-escape-title">World menu</h2>
            <div className="world-escape-actions">
              <button
                ref={initialFocusRef}
                type="button"
                className="world-action--enabled"
                onClick={() => setView("settings")}
              >
                Settings
              </button>
              <button
                type="button"
                className="world-action--enabled"
                onClick={() =>
                  act(() =>
                    window.dispatchEvent(new Event("aiw:open-agent-setup")),
                  )
                }
              >
                Agent Setup Menu
              </button>
              <button
                type="button"
                className="world-action--enabled"
                disabled={entryOnly}
                onClick={() => act(onLogout)}
              >
                Logout
              </button>
              <button
                type="button"
                className="world-action--enabled"
                disabled={entryOnly}
                onClick={() => setView("reset")}
              >
                Reset Session
              </button>
              <button
                type="button"
                className="world-action--enabled"
                disabled={entryOnly}
                onClick={() => setView("avatar-target")}
              >
                Change Avatar
              </button>
              <button
                type="button"
                className="world-action--enabled"
                disabled={entryOnly}
                onClick={() => act(onChangeAgent)}
              >
                Change Agent
              </button>
            </div>
          </>
        ) : null}
        {view === "settings" ? (
          <>
            <span className="terminal-kicker">world_settings_</span>
            <h2 id="world-escape-title">World settings</h2>
            <label className="world-escape-setting">
              <input
                type="checkbox"
                checked={preferences.showControlHints}
                onChange={(event) =>
                  onPreferences({
                    ...preferences,
                    showControlHints: event.target.checked,
                  })
                }
              />
              Show World control hints
            </label>
            <label className="world-escape-setting">
              <input
                type="checkbox"
                checked={preferences.largeMenuText}
                onChange={(event) =>
                  onPreferences({
                    ...preferences,
                    largeMenuText: event.target.checked,
                  })
                }
              />
              Large menu text
            </label>
            <button
              ref={initialFocusRef}
              type="button"
              className="world-action--enabled"
              onClick={() => setView("menu")}
            >
              Back to World menu
            </button>
          </>
        ) : null}
        {view === "avatar-target" ? (
          <>
            <span className="terminal-kicker">change_avatar_</span>
            <h2 id="world-escape-title">Choose avatar to change</h2>
            <div className="world-escape-actions">
              <button
                ref={initialFocusRef}
                type="button"
                className="world-action--enabled"
                onClick={() => act(() => onChangeAvatar("user"))}
              >
                {userName} · user
              </button>
              <button
                type="button"
                className="world-action--enabled"
                onClick={() => act(() => onChangeAvatar("agent"))}
              >
                {agentName} · connected agent
              </button>
              <button
                type="button"
                className="world-action--enabled"
                onClick={() => setView("menu")}
              >
                Back to World menu
              </button>
            </div>
          </>
        ) : null}
        {view === "reset" ? (
          <>
            <span className="terminal-kicker">reset_session_</span>
            <h2 id="world-escape-title">Reset current World session?</h2>
            <p>
              This clears only this browser’s World attachment and presentation.
              Your saved identity, avatars, and native agent history remain.
            </p>
            <div className="world-escape-actions">
              <button
                ref={initialFocusRef}
                type="button"
                className="world-action--enabled"
                onClick={() => setView("menu")}
              >
                Cancel reset
              </button>
              <button
                type="button"
                className="world-action--enabled"
                onClick={() => act(onResetSession)}
              >
                Reset current session
              </button>
            </div>
          </>
        ) : null}
        <button
          type="button"
          className="world-escape-close world-action--enabled"
          aria-label="Close World menu"
          onClick={close}
        >
          Close
        </button>
      </section>
    </div>
  );
}
