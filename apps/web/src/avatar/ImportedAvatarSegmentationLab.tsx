import type { ImportedAvatarAssetId } from "@agentintersect-world/avatar-system/imported-avatar";
import type { ImportedAvatarPart } from "@agentintersect-world/renderer-r3f/imported-avatar";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  importedAvatarPartGroups,
  isolateImportedAvatarGroup,
  loadImportedAvatarManifest,
  toggleImportedAvatarGroup,
  type ImportedAvatarManifestAsset,
} from "./imported-avatar-manifest.js";

export function ImportedAvatarSegmentationLab({
  assetId,
  initialHiddenPartIds,
  onChange,
}: {
  readonly assetId: ImportedAvatarAssetId;
  readonly initialHiddenPartIds: readonly string[];
  readonly onChange: (
    assetId: ImportedAvatarAssetId,
    parts: readonly ImportedAvatarPart[],
    hiddenPartIds: readonly string[],
  ) => void;
}) {
  const initialHiddenPartIdsRef = useRef(initialHiddenPartIds);
  const [asset, setAsset] = useState<ImportedAvatarManifestAsset>();
  const [hiddenPartIds, setHiddenPartIds] =
    useState<readonly string[]>(initialHiddenPartIds);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void loadImportedAvatarManifest()
      .then((manifest) => {
        if (!active) return;
        const resolved = manifest.assets.find(
          (candidate) => candidate.id === assetId,
        );
        if (!resolved)
          throw new Error("Verified part inventory is unavailable.");
        setAsset(resolved);
        onChange(assetId, resolved.parts, initialHiddenPartIdsRef.current);
      })
      .catch(() => {
        if (!active) return;
        setError("Verified part inventory failed to load.");
        onChange(assetId, [], []);
      });
    return () => {
      active = false;
    };
  }, [assetId, onChange]);
  const groups = useMemo(
    () => (asset ? importedAvatarPartGroups(asset) : []),
    [asset],
  );
  const updateHidden = (next: readonly string[]) => {
    setHiddenPartIds(next);
    onChange(assetId, asset?.parts ?? [], next);
  };
  return (
    <fieldset
      className="segmentation-lab"
      data-testid="segmentation-lab"
      data-segmentation-asset={assetId}
      data-hidden-part-count={hiddenPartIds.length}
    >
      <legend>Segmentation Lab (experimental)</legend>
      <p>
        <strong>
          {hiddenPartIds.length === 0
            ? "Complete intact model"
            : `${hiddenPartIds.length} verified parts hidden`}
        </strong>
        . Part groups come from deterministic bounds and dominant skin weights.
      </p>
      <p>
        No cross-model compatibility is claimed. This lab changes visibility
        only; it does not rebind or swap meshes.
      </p>
      <p>
        Verified incompatibility: Cat Agent has 42 joints (including
        neutral_bone) and 26 clips; Futuristic Robot has 41 joints and 28 clips,
        with different inverse-bind matrices.
      </p>
      <button
        type="button"
        disabled={hiddenPartIds.length === 0}
        onClick={() => updateHidden([])}
      >
        Restore all parts
      </button>
      {error ? (
        <p role="alert">{error} The complete intact model remains visible.</p>
      ) : !asset ? (
        <p role="status">Loading verified part inventory…</p>
      ) : (
        <>
          <div className="segmentation-groups">
            {groups.map((group) => {
              const visible = group.parts.every(
                (part) => !hiddenPartIds.includes(part.partId),
              );
              return (
                <section key={group.region}>
                  <label>
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() =>
                        updateHidden(
                          toggleImportedAvatarGroup(hiddenPartIds, group),
                        )
                      }
                    />
                    {group.label} ({group.parts.length})
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      updateHidden(
                        isolateImportedAvatarGroup(asset, group.region),
                      )
                    }
                  >
                    Isolate {group.label}
                  </button>
                </section>
              );
            })}
          </div>
          <details>
            <summary>{asset.parts.length} stable asset-owned part IDs</summary>
            <ul>
              {asset.parts.map((part) => (
                <li key={part.partId}>
                  <code>{part.partId}</code> ·{" "}
                  {part.classification.region.replaceAll("-", " ")} · dominant{" "}
                  {part.classification.dominantJoint}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </fieldset>
  );
}
