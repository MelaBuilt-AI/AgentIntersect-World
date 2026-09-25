import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ENVIRONMENT_PRESETS,
  type EnvironmentPreset,
} from "@agentintersect-world/world-schema/environment";
import { HackYourWorld } from "../../src/world-entry/HackYourWorld.js";
import { RepositoryAssetPalette } from "../../src/world-entry/RepositoryAssetPalette.js";
import "../../src/styles.css";

export function Fixture() {
  const [active, setActive] = useState<EnvironmentPreset>(
    ENVIRONMENT_PRESETS[0]!,
  );
  const [busy, setBusy] = useState(false);
  const [reduced, setReduced] = useState(false);
  return (
    <div className="world-room" style={{ position: "fixed", inset: 0 }}>
      <RepositoryAssetPalette
        mode="live"
        selected={null}
        onMode={() => {}}
        onPlace={() => {}}
        projectName="Fixture project"
      />
      <HackYourWorld
        active={active}
        phase={busy ? "generating" : "idle"}
        error=""
        reducedMotion={reduced}
        onSelect={setActive}
        onDialogChange={() => {}}
        agents={[
          { id: "fixture", name: "Fixture agent", sessionId: "fixture" },
        ]}
        onCreate={async () => {
          const candidate = {
            id: "preview",
            name: "Fixture Glacier",
            recipe: {
              ...ENVIRONMENT_PRESETS[2]!.recipe!,
              name: "Fixture Glacier",
            },
          };
          setActive(candidate);
          return candidate;
        }}
      />
      <div style={{ position: "fixed", bottom: 10 }}>
        <button onClick={() => setBusy(!busy)}>Fixture transition</button>
        <button onClick={() => setReduced(!reduced)}>
          Fixture reduced motion
        </button>
        <output aria-label="Active fixture">{active.id}</output>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
