import type {
  ImportedAvatarReviewPlaybackCommand,
  ImportedAvatarReviewPlaybackState,
} from "@agentintersect-world/renderer-r3f/imported-avatar-review";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useReducedMotion } from "../motion/use-reduced-motion.js";
import {
  AVATAR_REVIEW_SEMANTICS,
  createAvatarReviewReceipt,
  loadImportedAvatarReviewManifest,
  reviewClipReuse,
  serializeAvatarReviewReceipt,
  unresolvedAvatarReviewVerdicts,
  validateAvatarReviewReceipt,
  type AvatarReviewVerdicts,
  type ImportedAvatarReviewAsset,
  type ImportedAvatarReviewManifest,
} from "./avatar-animation-review-contract.js";
import { hasAvatarReviewWebGl } from "./avatar-review-webgl.js";

const ReviewCanvas = lazy(async () => {
  const module =
    await import("@agentintersect-world/renderer-r3f/imported-avatar-review");
  return { default: module.ImportedAvatarReviewCanvas };
});

const shortHash = (value: string) =>
  `${value.slice(0, 12)}…${value.slice(-12)}`;
const emptyPlayback: ImportedAvatarReviewPlaybackState = {
  status: "paused",
  currentTimeSeconds: 0,
};

export function AvatarAnimationReview() {
  const reducedMotion = useReducedMotion();
  const [manifest, setManifest] = useState<ImportedAvatarReviewManifest | null>(
    null,
  );
  const [loadError, setLoadError] = useState("");
  const [target, setTarget] = useState<"agent" | "user">("agent");
  const [agentModelId, setAgentModelId] = useState("");
  const [userModelId, setUserModelId] = useState("");
  const [clipIndex, setClipIndex] = useState(0);
  const [command, setCommand] = useState<ImportedAvatarReviewPlaybackCommand>({
    sequence: 0,
    kind: "pause",
  });
  const [playback, setPlayback] = useState(emptyPlayback);
  const [renderReady, setRenderReady] = useState(false);
  const [verdictsByModel, setVerdictsByModel] = useState<
    Readonly<Record<string, AvatarReviewVerdicts>>
  >({});
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<{
    readonly kind: "valid" | "refused";
    readonly message: string;
  } | null>(null);
  const [webGlAvailable] = useState(() => hasAvatarReviewWebGl());
  const handlePlaybackStateChange = useCallback(
    (state: ImportedAvatarReviewPlaybackState) => {
      setPlayback(state);
      setRenderReady(true);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    loadImportedAvatarReviewManifest().then(
      (next) => {
        if (active) setManifest(next);
      },
      (error: unknown) => {
        if (active)
          setLoadError(
            error instanceof Error ? error.message : "Manifest unavailable",
          );
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const asset: ImportedAvatarReviewAsset | null = useMemo(() => {
    if (!manifest) return null;
    const modelId =
      target === "agent"
        ? agentModelId || manifest.defaultAgentAsset.id
        : userModelId;
    if (!modelId) return null;
    try {
      return manifest.selectAsset(modelId, target);
    } catch {
      return null;
    }
  }, [agentModelId, manifest, target, userModelId]);
  const clip = asset?.clips[clipIndex] ?? null;
  const verdicts = asset
    ? (verdictsByModel[asset.id] ?? unresolvedAvatarReviewVerdicts())
    : null;
  const reuse = verdicts ? reviewClipReuse(verdicts) : [];
  const receipt = useMemo(() => {
    if (!manifest || !asset || !verdicts) return null;
    try {
      return createAvatarReviewReceipt(manifest, asset.id, target, verdicts);
    } catch {
      return null;
    }
  }, [asset, manifest, target, verdicts]);
  const receiptText = receipt ? serializeAvatarReviewReceipt(receipt) : "";

  const resetPlayback = () => {
    setPlayback(emptyPlayback);
    setRenderReady(false);
    setImportStatus(null);
  };
  const selectTarget = (next: "agent" | "user") => {
    setTarget(next);
    setClipIndex(0);
    resetPlayback();
  };
  const selectUserModel = (modelId: string) => {
    setUserModelId(modelId);
    setClipIndex(0);
    resetPlayback();
  };
  const selectAgentModel = (modelId: string) => {
    setAgentModelId(modelId);
    setClipIndex(0);
    resetPlayback();
  };
  const selectClip = (index: number) => {
    setClipIndex(index);
    resetPlayback();
  };

  const issue = (kind: "play" | "replay" | "pause", sample?: number) =>
    setCommand(
      (current) =>
        ({
          sequence: current.sequence + 1,
          kind,
          ...(sample === undefined ? {} : { sample }),
        }) as ImportedAvatarReviewPlaybackCommand,
    );
  const scrub = (sample: number) =>
    setCommand((current) => ({
      sequence: current.sequence + 1,
      kind: "scrub",
      sample,
    }));
  const setVerdict = (
    semantic: (typeof AVATAR_REVIEW_SEMANTICS)[number],
    verdict: "unresolved" | "selected" | "ambiguous" | "unsupported",
  ) => {
    if (!asset || !renderReady) return;
    setVerdictsByModel((current) => ({
      ...current,
      [asset.id]: {
        ...(current[asset.id] ?? unresolvedAvatarReviewVerdicts()),
        [semantic]: {
          verdict,
          clipIndex: verdict === "selected" ? clipIndex : null,
        },
      },
    }));
  };
  const validateImport = () => {
    if (!manifest || !asset) return;
    try {
      const validated = validateAvatarReviewReceipt(
        JSON.parse(importText) as unknown,
        manifest,
        asset.id,
        target,
      );
      const next = Object.fromEntries(
        validated.verdicts.map((decision) => [
          decision.semantic,
          { verdict: decision.verdict, clipIndex: decision.clipIndex },
        ]),
      ) as unknown as AvatarReviewVerdicts;
      setVerdictsByModel((current) => ({ ...current, [asset.id]: next }));
      setImportStatus({
        kind: "valid",
        message: `Receipt valid for ${asset.id}; loaded into review-only state.`,
      });
    } catch (error) {
      setImportStatus({
        kind: "refused",
        message: `Receipt refused: ${error instanceof Error ? error.message : "invalid receipt"}`,
      });
    }
  };
  const downloadReceipt = () => {
    if (!receipt) return;
    const url = URL.createObjectURL(
      new Blob([serializeAvatarReviewReceipt(receipt)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `avatar-animation-review-${receipt.modelId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loadError)
    return (
      <main className="avatar-review-shell">
        <section role="alert" className="avatar-review-card">
          <h1>Avatar animation review</h1>
          <p>{loadError}</p>
        </section>
      </main>
    );
  if (!manifest)
    return (
      <main className="avatar-review-shell" role="status">
        Loading repository-owned avatar review manifest…
      </main>
    );

  return (
    <main
      className="avatar-review-shell"
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <header className="avatar-review-header">
        <span className="terminal-kicker">local review only_</span>
        <h1>Avatar animation review</h1>
        <p id="avatar-review-truth" data-testid="review-runtime-truth">
          Direct raw model-local playback. Verdicts are review-only and never
          activate World runtime semantics.
        </p>
      </header>

      <section
        className="avatar-review-card avatar-review-model"
        aria-labelledby="review-model-heading"
      >
        <h2 id="review-model-heading">1. Select exact model</h2>
        <label>
          Review target
          <select
            value={target}
            onChange={(event) =>
              selectTarget(event.currentTarget.value as "agent" | "user")
            }
          >
            <option value="agent">Agent model</option>
            <option value="user">Explicit user model</option>
          </select>
        </label>
        {target === "agent" ? (
          <label>
            Agent model
            <select
              value={agentModelId || manifest.defaultAgentAsset.id}
              onChange={(event) => selectAgentModel(event.currentTarget.value)}
            >
              {manifest.agentAssets.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label} · {candidate.id}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            User model
            <select
              value={userModelId}
              onChange={(event) => selectUserModel(event.currentTarget.value)}
            >
              <option value="">Select a role-valid user model…</option>
              {manifest.userAssets.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label} · {candidate.id}
                </option>
              ))}
            </select>
          </label>
        )}
        {asset ? (
          <dl className="avatar-review-binding">
            <div>
              <dt>Model ID</dt>
              <dd data-testid="review-model-id">{asset.id}</dd>
            </div>
            <div>
              <dt>Source GLB SHA-256</dt>
              <dd title={asset.sourceGlbSha256}>
                {shortHash(asset.sourceGlbSha256)}
              </dd>
            </div>
            <div>
              <dt>Manifest SHA-256</dt>
              <dd title={manifest.manifestSha256}>
                {shortHash(manifest.manifestSha256)}
              </dd>
            </div>
          </dl>
        ) : (
          <p role="status">
            Choose the exact user model before playback or review.
          </p>
        )}
      </section>

      {asset && clip ? (
        <>
          <section
            className="avatar-review-card avatar-review-playback"
            aria-labelledby="review-playback-heading"
          >
            <div>
              <h2 id="review-playback-heading">2. Inspect one raw clip</h2>
              <label>
                Model-local clip
                <select
                  value={clipIndex}
                  onChange={(event) =>
                    selectClip(Number(event.currentTarget.value))
                  }
                >
                  {asset.clips.map((candidate) => (
                    <option key={candidate.index} value={candidate.index}>
                      {String(candidate.index).padStart(2, "0")} ·{" "}
                      {candidate.name} · {candidate.durationSeconds.toFixed(3)}{" "}
                      s
                    </option>
                  ))}
                </select>
              </label>
              <dl className="avatar-review-binding">
                <div>
                  <dt>Clip index</dt>
                  <dd>{clip.index}</dd>
                </div>
                <div>
                  <dt>Anonymous name</dt>
                  <dd>{clip.name}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{clip.durationSeconds.toFixed(6)} s</dd>
                </div>
                <div>
                  <dt>Motion SHA-256</dt>
                  <dd title={clip.motionChannelSha256}>
                    {shortHash(clip.motionChannelSha256)}
                  </dd>
                </div>
                <div>
                  <dt>Timing SHA-256</dt>
                  <dd title={clip.inputTimingSha256}>
                    {shortHash(clip.inputTimingSha256)}
                  </dd>
                </div>
                <div>
                  <dt>Pose SHA-256</dt>
                  <dd title={clip.outputPoseSha256}>
                    {shortHash(clip.outputPoseSha256)}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="avatar-review-stage">
              {webGlAvailable ? (
                <Suspense fallback={<p role="status">Loading 3D playback…</p>}>
                  <ReviewCanvas
                    selection={{
                      assetId: asset.id,
                      assetUrl: asset.assetUrl,
                      clip,
                      position: asset.preview.position,
                      rotation: asset.preview.rotation,
                      scale: asset.preview.scale,
                    }}
                    command={command}
                    onPlaybackStateChange={handlePlaybackStateChange}
                  />
                </Suspense>
              ) : (
                <div
                  className="avatar-review-no-webgl"
                  role="status"
                  data-testid="review-no-webgl"
                >
                  WebGL playback unavailable. No animation proof is shown and
                  verdict controls remain unavailable.
                </div>
              )}
              <div
                className="avatar-review-controls"
                aria-describedby="avatar-review-truth"
              >
                <span>
                  Playback:{" "}
                  <strong data-testid="review-playback-state">
                    {playback.status}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => issue("play")}
                  disabled={!renderReady || playback.status === "playing"}
                >
                  Start clip
                </button>
                <button
                  type="button"
                  onClick={() => issue("replay")}
                  disabled={!renderReady}
                >
                  Replay clip
                </button>
                <button
                  type="button"
                  onClick={() => issue("pause")}
                  disabled={!renderReady || playback.status !== "playing"}
                >
                  Pause clip
                </button>
                <label>
                  Clip position
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={
                      clip.durationSeconds > 0
                        ? playback.currentTimeSeconds / clip.durationSeconds
                        : 0
                    }
                    disabled={!renderReady}
                    onChange={(event) =>
                      scrub(Number(event.currentTarget.value))
                    }
                  />
                </label>
                <div
                  className="avatar-review-samples"
                  aria-label="Deterministic clip samples"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      disabled={!renderReady}
                      onClick={() => scrub(sample)}
                    >
                      Sample {Math.round(sample * 100)}%
                    </button>
                  ))}
                </div>
                <span data-testid="review-sample-position">
                  {Math.round(
                    (clip.durationSeconds > 0
                      ? playback.currentTimeSeconds / clip.durationSeconds
                      : 0) * 100,
                  )}
                  % · {playback.currentTimeSeconds.toFixed(3)} s
                </span>
              </div>
            </div>
          </section>

          <section
            className="avatar-review-card"
            aria-labelledby="review-verdict-heading"
          >
            <h2 id="review-verdict-heading">3. Record operator verdicts</h2>
            <p>
              Every semantic starts unresolved. “Selected clip” records the
              currently displayed exact clip.
            </p>
            <div className="avatar-review-verdicts">
              {AVATAR_REVIEW_SEMANTICS.map((semantic) => {
                const decision = verdicts?.[semantic] ?? {
                  verdict: "unresolved",
                  clipIndex: null,
                };
                return (
                  <label key={semantic}>
                    <span>{semantic}</span>
                    <select
                      aria-label={`${semantic} verdict`}
                      value={decision.verdict}
                      disabled={!renderReady}
                      onChange={(event) =>
                        setVerdict(
                          semantic,
                          event.currentTarget.value as
                            | "unresolved"
                            | "selected"
                            | "ambiguous"
                            | "unsupported",
                        )
                      }
                    >
                      <option value="unresolved">Unresolved</option>
                      <option value="selected">
                        {decision.verdict === "selected"
                          ? `Selected clip ${String(decision.clipIndex).padStart(2, "0")}`
                          : `Use current clip ${String(clipIndex).padStart(2, "0")}`}
                      </option>
                      <option value="ambiguous">Ambiguous</option>
                      <option value="unsupported">Unsupported</option>
                    </select>
                    <button
                      type="button"
                      disabled={!renderReady}
                      aria-label={`Assign current clip to ${semantic}`}
                      onClick={() => setVerdict(semantic, "selected")}
                    >
                      Assign current clip {String(clipIndex).padStart(2, "0")}
                    </button>
                    <span className="avatar-review-verdict-detail">
                      {decision.verdict === "selected"
                        ? `clip ${decision.clipIndex}`
                        : decision.verdict}
                    </span>
                  </label>
                );
              })}
            </div>
            {reuse.map((claim) => (
              <p
                key={claim.clipIndex}
                role="status"
                className="avatar-review-reuse"
              >
                Explicit clip reuse: clip {claim.clipIndex} is claimed by{" "}
                {claim.semantics.join(", ")}.
              </p>
            ))}
          </section>

          <section
            className="avatar-review-card"
            aria-labelledby="review-receipt-heading"
          >
            <h2 id="review-receipt-heading">4. Export or validate receipt</h2>
            <label>
              Review receipt
              <textarea
                readOnly
                rows={12}
                value={receiptText}
                placeholder="Resolve all nine semantics to generate a deterministic receipt."
              />
            </label>
            <button type="button" onClick={downloadReceipt} disabled={!receipt}>
              Download receipt
            </button>
            <label>
              Import review receipt
              <textarea
                rows={8}
                value={importText}
                onChange={(event) => setImportText(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              onClick={validateImport}
              disabled={!importText.trim()}
            >
              Validate imported receipt
            </button>
            {importStatus ? (
              <p role={importStatus.kind === "refused" ? "alert" : "status"}>
                {importStatus.message}
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
