import { useEffect, useId, useRef, useState } from "react";
import { useHackMessage } from "./use-hack-message.js";
import {
  ENVIRONMENT_PRESETS,
  EnvironmentRecipeSchema,
  environmentWordCount,
  type EnvironmentPreset,
} from "@agentintersect-world/world-schema/environment";
import {
  buildEnvironmentBrief,
  ENVIRONMENT_DRAFT_KEY,
  ENVIRONMENT_LIBRARY_KEY,
  readCustomEnvironments,
} from "./environment-authoring.js";
import "./hack-your-world.css";
import {
  DEFAULT_ENVIRONMENT_CHOICES,
  applyEnvironmentChoices,
  type EnvironmentChoices,
} from "./environment-choices.js";
import { EnvironmentSettings } from "./EnvironmentSettings.js";
import {
  customSlotPresets,
  customSlotPreset,
  loadEnvironmentSlots,
  saveEnvironmentSlot,
  removeEnvironmentSlot,
  type EnvironmentSlots,
} from "./environment-library-client.js";
import {
  environmentCapability,
  type EnvironmentAgent,
  type EnvironmentCapability,
} from "./environment-client.js";
import type {
  EnvironmentPhase,
  EnvironmentCeremony,
} from "./environment-switcher.js";

function WorldDescription({
  label,
  description,
  onNotice,
}: {
  label: string;
  description: string | undefined;
  onNotice: (text: string) => void;
}) {
  const id = useId();
  return (
    <details className="hack-world__description">
      <summary>View description — {label}</summary>
      {description === undefined ? (
        <p>No original description was saved for this World.</p>
      ) : (
        <>
          <label htmlFor={id}>Original description — {label}</label>
          <textarea id={id} value={description} readOnly rows={4} />
          <button
            type="button"
            aria-label={`Copy description — ${label}`}
            onClick={() => {
              void navigator.clipboard.writeText(description).then(
                () =>
                  onNotice(
                    "Original description copied. No agent was contacted.",
                  ),
                () =>
                  onNotice(
                    "Clipboard unavailable. Select and copy the original description above.",
                  ),
              );
            }}
          >
            Copy description
          </button>
        </>
      )}
    </details>
  );
}

function HackFailureMessage({ text }: { text: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, []);
  return visible ? (
    <p className="hack-world__error" role="alert">
      {text}
    </p>
  ) : null;
}

export function HackYourWorld({
  active,
  phase,
  error,
  reducedMotion,
  onSelect,
  onDialogChange,
  agents = [],
  selectedAgentId,
  ceremony = null,
  onCreate,
  onCancel,
}: {
  readonly active: EnvironmentPreset;
  readonly phase: EnvironmentPhase;
  readonly agents?: readonly EnvironmentAgent[];
  readonly selectedAgentId?: string | null | undefined;
  readonly ceremony?: EnvironmentCeremony | null;
  readonly onCreate?: (
    agent: EnvironmentAgent,
    description: string,
    choices: EnvironmentChoices,
  ) => Promise<EnvironmentPreset | null>;
  readonly onCancel?: () => void;
  readonly error: string;
  readonly reducedMotion: boolean;
  readonly onSelect: (preset: EnvironmentPreset) => void;
  readonly onDialogChange: (open: boolean) => void;
}) {
  const hud = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = hud.current;
    const room = element?.closest<HTMLElement>(".world-room");
    if (!element || !room) return;
    const measure = () =>
      room.style.setProperty(
        "--hack-world-bottom",
        `${element.getBoundingClientRect().bottom - room.getBoundingClientRect().top + 12}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      room.style.removeProperty("--hack-world-bottom");
    };
  }, []);
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft, setDraft] = useState(() => {
    try {
      return localStorage.getItem(ENVIRONMENT_DRAFT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [legacy] = useState(() => {
    try {
      return readCustomEnvironments(
        localStorage.getItem(ENVIRONMENT_LIBRARY_KEY),
      );
    } catch {
      return [];
    }
  });
  const [slots, setSlots] = useState<EnvironmentSlots>(Array(8).fill(null));
  const [slotsReady, setSlotsReady] = useState(false);
  const [slotError, setSlotError] = useHackMessage();
  const [slot, setSlot] = useState(1);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [holding, setHolding] = useState(false);
  const [clickEffect, setClickEffect] = useState(0);
  useEffect(() => {
    let mounted = true;
    void loadEnvironmentSlots().then(
      (loaded) => {
        if (!mounted) return;
        setSlots(loaded);
        setSlotsReady(true);
        const empty = loaded.findIndex((recipe) => recipe === null);
        setSlot(empty < 0 ? 1 : empty + 1);
      },
      (error: Error) => {
        if (mounted) setSlotError(error.message);
      },
    );
    return () => {
      mounted = false;
    };
  }, [setSlotError]);
  const [json, setJson] = useState("");
  const [choices, setChoices] = useState(DEFAULT_ENVIRONMENT_CHOICES);
  const [visibleNotice, setNotice] = useHackMessage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<{
    before: EnvironmentPreset;
    candidate: EnvironmentPreset;
  } | null>(null);
  const busy = phase !== "idle" || ceremony !== null;
  const [chosenId, setChosenId] = useState<string | null>(null);
  const target =
    agents.find((agent) => agent.id === (chosenId ?? selectedAgentId)) ??
    agents[0];
  const [capability, setCapability] = useState<EnvironmentCapability | null>(
    null,
  );
  const targetSessionId = target?.sessionId;
  useEffect(() => {
    if (!dialogOpen || !targetSessionId) return;
    const controller = new AbortController();
    void environmentCapability(targetSessionId, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setCapability(result);
      },
      () => {
        if (!controller.signal.aborted)
          setCapability({
            available: false,
            reason:
              "Cannot reach the restricted environment connection. Reopen to retry.",
            sessionId: targetSessionId,
          });
      },
    );
    return () => controller.abort();
  }, [dialogOpen, targetSessionId]);
  const ready = Boolean(
    target &&
    capability?.sessionId === target.sessionId &&
    capability.available &&
    onCreate,
  );
  const words = environmentWordCount(draft);
  const validDescription = words > 0 && words <= 500;
  const presets: EnvironmentPreset[] = [
    ...ENVIRONMENT_PRESETS,
    ...customSlotPresets(slots),
  ];
  const cancelHold = () => {
    if (hold.current !== null) clearTimeout(hold.current);
    hold.current = null;
    setHolding(false);
  };
  useEffect(() => {
    const cancel = () => {
      if (hold.current !== null) clearTimeout(hold.current);
      hold.current = null;
      setHolding(false);
    };
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      window.removeEventListener("blur", cancel);
    };
  }, []);
  const open = () => {
    cancelHold();
    if (busy) return;
    document.exitPointerLock?.();
    dialog.current?.showModal();
    setDialogOpen(true);
    onDialogChange(true);
  };
  const close = () => {
    dialog.current?.close();
    setDialogOpen(false);
    onDialogChange(false);
    button.current?.focus();
  };
  const retrySlots = () => {
    void loadEnvironmentSlots().then(
      (loaded) => {
        setSlots(loaded);
        setSlotsReady(true);
        setSlotError("");
      },
      (error: Error) => setSlotError(error.message),
    );
  };
  const savePreview = async () => {
    if (!preview?.candidate.recipe || saving || !slotsReady) return;
    setSaving(true);
    setSlotError("");
    try {
      const loaded = await saveEnvironmentSlot(
        slot,
        preview.candidate.recipe,
        replaceConfirmed,
        preview.candidate.originalDescription,
      );
      setSlots(loaded);
      onSelect({ ...preview.candidate, id: `slot-${slot}` });
      setPreview(null);
      setReplaceConfirmed(false);
      setNotice(
        `Saved to Custom slot ${slot} on this PC — included in left-click cycling.`,
      );
    } catch (error) {
      setSlotError(
        error instanceof Error
          ? error.message
          : "Save failed. Your preview is not saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div
        ref={hud}
        className="hack-world"
        data-reduced-motion={reducedMotion}
        data-phase={phase}
        data-busy={busy}
        data-holding={holding}
      >
        <button
          ref={button}
          className="hack-world__trigger"
          type="button"
          disabled={busy || preview !== null}
          aria-label={`Hack your World — ${active.name}. Click to cycle; hold right-click or press Shift+F10 to describe.`}
          title="Click to cycle · Hold right-click to describe · Shift+F10"
          onClick={() => {
            setClickEffect((value) => value + 1);
            onSelect(
              presets[
                (Math.max(
                  0,
                  presets.findIndex((p) => p.id === active.id),
                ) +
                  1) %
                  presets.length
              ]!,
            );
          }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (event.button !== 2) return;
            event.preventDefault();
            event.stopPropagation();
            cancelHold();
            setHolding(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            hold.current = setTimeout(open, 550);
          }}
          onPointerUp={cancelHold}
          onPointerCancel={cancelHold}
          onLostPointerCapture={cancelHold}
          onKeyDown={(event) => {
            if (
              (event.shiftKey && event.key === "F10") ||
              event.key === "ContextMenu"
            ) {
              event.preventDefault();
              event.stopPropagation();
              open();
            }
          }}
        >
          {clickEffect > 0 ? (
            <span
              key={clickEffect}
              className="hack-world__click"
              aria-hidden="true"
            />
          ) : null}
          <svg
            className="hack-world__globe"
            viewBox="0 0 32 32"
            width="25"
            height="25"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="16" cy="16" r="10" />
            <ellipse cx="16" cy="16" rx="4.5" ry="10" />
            <path d="M6 16h20M8 11h16M8 21h16" />
            <g className="hack-world__orbit">
              <path className="hack-world__trail" d="M16 2a14 14 0 0 1 12 7" />
              <path className="hack-world__spark" d="m28 6-2 4h3l-2 4" />
              <circle cx="16" cy="30" r="1.25" className="hack-world__spark" />
            </g>
            <g className="hack-world__orbit hack-world__orbit--reverse">
              <path className="hack-world__trail" d="M3 11a14 14 0 0 1 7-7" />
              <circle cx="3" cy="11" r="1" className="hack-world__spark" />
            </g>
          </svg>
          <span>Hack your World</span>
          {holding ? (
            <span className="hack-world__hold" role="status">
              Hold to open Custom Create…
              <span className="hack-world__hold-track">
                <span />
              </span>
            </span>
          ) : null}
        </button>
        <span className="hack-world__gesture">
          L Click: Cycle · R Click + Hold: Custom Create
        </span>
        <span className="hack-world__status" role="status">
          {ceremony?.phase === "dance"
            ? "Hacking your World!"
            : ceremony?.phase === "bow"
              ? "Enter World."
              : phase === "loading"
                ? "Loading environment…"
                : busy
                  ? "Rewriting the atmosphere…"
                  : active.name}
        </span>
        {ceremony?.phase === "dance" ? (
          <button className="hack-world__cancel" onClick={onCancel}>
            Cancel creation
          </button>
        ) : null}
        {error ? <HackFailureMessage key={error} text={error} /> : null}
        {preview ? (
          <div className="hack-world__preview" aria-label="Environment preview">
            <span>
              {error
                ? "Preview failed — previous World retained"
                : `Preview: ${preview.candidate.name}`}
            </span>
            <strong>Save this World to a custom slot?</strong>
            <span>
              Saved slots stay on this PC and join left-click cycling.
            </span>
            <label className="hack-world__slot-label">
              Custom slot
              <select
                value={slot}
                disabled={saving || !slotsReady}
                onChange={(event) => {
                  setSlot(Number(event.target.value));
                  setReplaceConfirmed(false);
                }}
              >
                {slots.map((recipe, index) => (
                  <option key={index} value={index + 1}>
                    {`Custom ${index + 1} — ${recipe?.name ?? "Empty"}`}
                  </option>
                ))}
              </select>
            </label>
            {slots[slot - 1] ? (
              <label className="hack-world__replace">
                <input
                  type="checkbox"
                  checked={replaceConfirmed}
                  disabled={saving}
                  onChange={(event) =>
                    setReplaceConfirmed(event.target.checked)
                  }
                />
                Replace “{slots[slot - 1]!.name}” in Custom {slot}
              </label>
            ) : null}
            <button
              disabled={
                busy ||
                saving ||
                !slotsReady ||
                active !== preview.candidate ||
                Boolean(slots[slot - 1] && !replaceConfirmed)
              }
              onClick={() => void savePreview()}
            >
              {saving ? "Saving…" : `Save to Custom ${slot}`}
            </button>
            <button
              disabled={busy || saving || active !== preview.candidate}
              onClick={() => {
                setPreview(null);
                setNotice(
                  "Using this World for now — not saved to a custom slot.",
                );
              }}
            >
              Use without saving
            </button>
            <button
              disabled={busy || saving}
              onClick={() => {
                onSelect(preview.before);
                setPreview(null);
              }}
            >
              Revert
            </button>
          </div>
        ) : null}
        {slotError || !slotsReady ? (
          <div className="hack-world__error">
            {slotError ? <p role="alert">{slotError}</p> : null}
            <button onClick={retrySlots}>Retry slots</button>
          </div>
        ) : null}
        {visibleNotice && !dialogOpen ? (
          <p className="hack-world__notice" role="status">
            {visibleNotice}
          </p>
        ) : null}
      </div>
      <dialog
        ref={dialog}
        role={dialogOpen ? "dialog" : undefined}
        aria-modal={dialogOpen ? true : undefined}
        className="hack-world-dialog"
        aria-labelledby="hack-world-title"
        onCancel={(event) => {
          event.preventDefault();
          event.stopPropagation();
          close();
        }}
        onClose={() => {
          setDialogOpen(false);
          onDialogChange(false);
        }}
      >
        <form onSubmit={(event) => event.preventDefault()}>
          <h2 id="hack-world-title">Tell me what your World looks like…</h2>
          <label htmlFor="hack-world-description">Your World description</label>
          <textarea
            id="hack-world-description"
            autoFocus
            maxLength={12000}
            value={draft}
            rows={5}
            placeholder="A sunlit valley with soft clouds, distant mountains and birds…"
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              try {
                localStorage.setItem(ENVIRONMENT_DRAFT_KEY, value);
              } catch {
                setNotice("Draft cannot be saved in this browser.");
              }
            }}
          />
          <p
            aria-live="polite"
            className={words > 500 ? "hack-world__error" : ""}
          >
            {words} / 500 words
          </p>
          <button
            type="button"
            disabled={!ready || !validDescription || busy || preview !== null}
            onClick={() => {
              if (!ready || !target || !onCreate) return;
              const before = active;
              close();
              setNotice("");
              setReplaceConfirmed(false);

              void onCreate(target, draft, choices).then((candidate) => {
                if (candidate) setPreview({ before, candidate });
              });
            }}
          >
            Create with connected agent
          </button>
          {agents.length > 1 ? (
            <label>
              World designer
              <select
                value={target?.id ?? ""}
                onChange={(event) => {
                  setChosenId(event.target.value);
                  setCapability(null);
                }}
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p>
            {ready
              ? `${target!.name} will design a cosmetic preview in a separate restricted recipe turn. Your coding conversation stays untouched. Save it to a custom slot, use without saving, or revert afterward.`
              : capability?.sessionId === target?.sessionId
                ? capability?.reason
                : target
                  ? "Checking environment-only connection…"
                  : "Connect an agent to create your World."}
          </p>
          {active.recipe ? (
            <WorldDescription
              key={active.id}
              label="Current World"
              description={active.originalDescription}
              onNotice={setNotice}
            />
          ) : null}
          <EnvironmentSettings value={choices} onChange={setChoices} />
          <button
            type="button"
            disabled={busy || preview !== null}
            onClick={() => {
              const recipe = applyEnvironmentChoices(
                active.recipe ?? ENVIRONMENT_PRESETS[1]!.recipe!,
                choices,
              );
              const candidate = {
                id: "preview",
                name: recipe.name,
                recipe,
                ...(active.originalDescription !== undefined
                  ? { originalDescription: active.originalDescription }
                  : {}),
              };
              setPreview({ before: active, candidate });
              setReplaceConfirmed(false);
              setNotice("");

              close();
              onSelect(candidate);
            }}
          >
            Preview these settings
          </button>
          <details>
            <summary>Advanced: edit a World recipe (optional)</summary>
            <p>
              Weather and decorative cutouts are optional data fields; the
              normal controls above do not require JSON editing.
            </p>
            <p>
              You can skip this section: describe your World above and choose
              Create with connected agent. A recipe is a JSON list of visual
              settings, not executable code: terrain, sky layers, colors,
              lighting and ambience.
            </p>
            <p>
              Use current recipe fills the editor below with this World's
              settings (or Sunlit Trails when Original is active). It does not
              contact an agent or change your World. Edit those settings, then
              choose Preview recipe; Save to Custom stores the result on this PC
              and Revert restores the previous World.
            </p>
            <p>
              Copy environment brief copies your description and the allowed
              recipe format for use with an external assistant. Paste its JSON
              reply below to preview it manually. Only supplied asset IDs are
              allowed—no code, file paths or remote asset URLs.
            </p>
            <button
              type="button"
              disabled={!validDescription}
              onClick={() => {
                const brief = buildEnvironmentBrief(
                  draft,
                  applyEnvironmentChoices(
                    active.recipe ?? ENVIRONMENT_PRESETS[1]!.recipe!,
                    choices,
                  ),
                );
                void navigator.clipboard.writeText(brief).then(
                  () =>
                    setNotice(
                      "Environment brief copied. No agent was contacted.",
                    ),
                  () =>
                    setNotice(
                      "Clipboard unavailable. Your description is still saved.",
                    ),
                );
              }}
            >
              Copy environment brief
            </button>
            <button
              type="button"
              onClick={() =>
                setJson(
                  JSON.stringify(
                    active.recipe ?? ENVIRONMENT_PRESETS[1]!.recipe,
                    null,
                    2,
                  ),
                )
              }
            >
              Use current recipe as a starting point
            </button>
            <label htmlFor="hack-world-recipe">
              Data-only environment recipe
            </label>
            <textarea
              id="hack-world-recipe"
              rows={9}
              maxLength={12000}
              value={json}
              onChange={(event) => setJson(event.target.value)}
              spellCheck={false}
            />
            <button
              type="button"
              disabled={busy || preview !== null || !json.trim()}
              onClick={() => {
                try {
                  const result = EnvironmentRecipeSchema.safeParse(
                    JSON.parse(json),
                  );
                  if (!result.success) {
                    setNotice(
                      `Recipe refused: ${result.error.issues[0]?.path.join(".") || "recipe"} — ${result.error.issues[0]?.message}`,
                    );
                    return;
                  }
                  const candidate = {
                    id: "preview",
                    name: result.data.name,
                    recipe: result.data,
                  };
                  setPreview({ before: active, candidate });
                  setReplaceConfirmed(false);
                  setNotice("");
                  close();
                  onSelect(candidate);
                } catch {
                  setNotice(
                    "Recipe refused: enter a JSON object, not code or Markdown.",
                  );
                }
              }}
            >
              Preview recipe
            </button>
          </details>
          <details className="hack-world__library">
            <summary>Custom slots on this PC</summary>
            <p>
              Eight slots, shared by browsers using this World install. Saved
              Worlds join left-click cycling; empty slots are skipped.
            </p>
            {!slotsReady ? (
              <p>
                Slots unavailable or still loading.
                <button type="button" onClick={retrySlots}>
                  Retry slots
                </button>
              </p>
            ) : (
              <ul>
                {slots.map((recipe, index) => (
                  <li key={index}>
                    <span>
                      Custom {index + 1} — {recipe?.name ?? "Empty"}
                    </span>
                    {recipe ? (
                      <>
                        <button
                          type="button"
                          disabled={busy || saving || preview !== null}
                          onClick={() => {
                            close();
                            onSelect(customSlotPreset(recipe, index + 1));
                          }}
                        >
                          Load
                        </button>

                        {removing === index + 1 ? (
                          <>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => {
                                setSaving(true);
                                void removeEnvironmentSlot(index + 1)
                                  .then(
                                    (loaded) => {
                                      setSlots(loaded);
                                      setRemoving(null);
                                      setNotice(`Custom ${index + 1} cleared.`);
                                    },
                                    (error: Error) =>
                                      setSlotError(error.message),
                                  )
                                  .finally(() => setSaving(false));
                              }}
                            >
                              Confirm remove
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setRemoving(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={saving || busy || preview !== null}
                            onClick={() => setRemoving(index + 1)}
                          >
                            Remove
                          </button>
                        )}
                        <WorldDescription
                          label={`Custom ${index + 1}`}
                          description={recipe.originalDescription}
                          onNotice={setNotice}
                        />
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {legacy.length ? (
              <>
                <p>
                  Earlier browser-saved Worlds — preview one, then choose a PC
                  slot to import. Originals stay in this browser.
                </p>
                {legacy.map((recipe, index) => (
                  <button
                    key={index}
                    type="button"
                    disabled={busy || saving || preview !== null}
                    onClick={() => {
                      const candidate = {
                        id: "preview",
                        name: recipe.name,
                        recipe,
                      };
                      setPreview({ before: active, candidate });
                      setReplaceConfirmed(false);
                      setNotice("");
                      close();
                      onSelect(candidate);
                    }}
                  >
                    Import {recipe.name}
                  </button>
                ))}
              </>
            ) : null}
          </details>
          {visibleNotice ? <p role="status">{visibleNotice}</p> : null}
          <button type="button" onClick={close}>
            Back to World
          </button>
        </form>
      </dialog>
    </>
  );
}
