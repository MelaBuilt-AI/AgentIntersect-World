import { useEffect, useRef, useState } from "react";
import {
  ENVIRONMENT_PRESETS,
  EnvironmentRecipeSchema,
  environmentWordCount,
  type EnvironmentPreset,
  type EnvironmentRecipe,
} from "@agentintersect-world/world-schema/environment";
import {
  buildEnvironmentBrief,
  ENVIRONMENT_DRAFT_KEY,
  ENVIRONMENT_LIBRARY_KEY,
  readCustomEnvironments,
} from "./environment-authoring.js";
import "./hack-your-world.css";

export function HackYourWorld({
  active,
  phase,
  error,
  reducedMotion,
  onSelect,
  onDialogChange,
}: {
  readonly active: EnvironmentPreset;
  readonly phase: "idle" | "loading" | "out" | "in";
  readonly error: string;
  readonly reducedMotion: boolean;
  readonly onSelect: (preset: EnvironmentPreset) => void;
  readonly onDialogChange: (open: boolean) => void;
}) {
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
  const [saved, setSaved] = useState(() => {
    try {
      return readCustomEnvironments(
        localStorage.getItem(ENVIRONMENT_LIBRARY_KEY),
      );
    } catch {
      return [];
    }
  });
  const [json, setJson] = useState("");
  const [notice, setNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<{
    before: EnvironmentPreset;
    candidate: EnvironmentPreset;
  } | null>(null);
  const busy = phase !== "idle";
  const words = environmentWordCount(draft);
  const validDescription = words > 0 && words <= 500;
  const presets: EnvironmentPreset[] = [
    ...ENVIRONMENT_PRESETS,
    ...saved.map((recipe, i) => ({
      id: `custom-${i}`,
      name: recipe.name,
      recipe,
    })),
  ];
  const cancelHold = () => {
    if (hold.current !== null) clearTimeout(hold.current);
    hold.current = null;
  };
  useEffect(() => {
    const cancel = () => {
      if (hold.current !== null) clearTimeout(hold.current);
      hold.current = null;
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
  const persist = (recipes: EnvironmentRecipe[]) => {
    try {
      localStorage.setItem(ENVIRONMENT_LIBRARY_KEY, JSON.stringify(recipes));
      setSaved(recipes);
      return true;
    } catch {
      setNotice(
        "Browser storage unavailable; this preview has not been saved.",
      );
      return false;
    }
  };
  return (
    <>
      <div
        className="hack-world"
        data-reduced-motion={reducedMotion}
        data-phase={phase}
      >
        <button
          ref={button}
          className="hack-world__trigger"
          type="button"
          disabled={busy || preview !== null}
          aria-label={`Hack your World — ${active.name}. Click to cycle; hold right-click or press Shift+F10 to describe.`}
          title="Click to cycle · Hold right-click to describe · Shift+F10"
          onClick={() =>
            onSelect(
              presets[
                (Math.max(
                  0,
                  presets.findIndex((p) => p.id === active.id),
                ) +
                  1) %
                  presets.length
              ]!,
            )
          }
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (event.button !== 2) return;
            event.preventDefault();
            event.stopPropagation();
            cancelHold();
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
            <path
              className="hack-world__spark"
              d="m25 2-3 6h5l-3 7M6 20l-4 5h5l-2 5"
            />
          </svg>
          <span>Hack your World</span>
        </button>
        <span className="hack-world__status" role="status">
          {phase === "loading"
            ? "Loading environment…"
            : busy
              ? "Rewriting the atmosphere…"
              : active.name}
        </span>
        {error ? (
          <p className="hack-world__error" role="alert">
            {error}
          </p>
        ) : null}
        {preview ? (
          <div className="hack-world__preview" aria-label="Environment preview">
            <span>
              {error
                ? "Preview failed — previous World retained"
                : `Preview: ${preview.candidate.name}`}
            </span>
            <button
              disabled={busy || active !== preview.candidate}
              onClick={() => {
                if (!preview.candidate.recipe) return;
                const recipes = [
                  ...saved.filter((r) => r.name !== preview.candidate.name),
                  preview.candidate.recipe,
                ].slice(-8);
                if (persist(recipes)) {
                  const index = recipes.length - 1;
                  onSelect({ ...preview.candidate, id: `custom-${index}` });
                  setPreview(null);
                }
              }}
            >
              Keep
            </button>
            <button
              disabled={busy}
              onClick={() => {
                onSelect(preview.before);
                setPreview(null);
              }}
            >
              Revert
            </button>
          </div>
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
            disabled
            title="Restricted environment-only agent connector is not yet connected"
          >
            Create with connected agent
          </button>
          <p>
            Custom authoring preview: automatic agent creation is not connected
            yet. Your draft stays here. We will add the extension library and an
            environment-only agent connection without giving it application-code
            access.
          </p>
          <details>
            <summary>Recipe workshop — preview the safe layers now</summary>
            <p>
              Only the supplied preset textures and approved ambience are
              available. These floor images already combine their materials;
              independent material blending arrives with the library. No code or
              remote asset URLs are accepted.
            </p>
            <button
              type="button"
              disabled={!validDescription}
              onClick={() => {
                const brief = buildEnvironmentBrief(
                  draft,
                  active.recipe ?? ENVIRONMENT_PRESETS[1]!.recipe!,
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
            {saved.length ? (
              <ul>
                {saved.map((recipe, i) => (
                  <li key={`${recipe.name}-${i}`}>
                    {recipe.name}{" "}
                    <button
                      type="button"
                      disabled={busy || preview !== null}
                      onClick={() =>
                        persist(saved.filter((_, index) => index !== i))
                      }
                    >
                      Remove saved preset
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </details>
          {notice ? <p role="status">{notice}</p> : null}
          <button type="button" onClick={close}>
            Back to World
          </button>
        </form>
      </dialog>
    </>
  );
}
