import { useState } from "react";
import { createRoot } from "react-dom/client";
import { WorldWorkstreamStatus } from "../../src/world-entry/WorkInspector.js";
import { WorldScreenContext } from "../../src/world-entry/world-screen-context.js";
import "../../src/styles.css";

export function Fixture() {
  const [spatial, setSpatial] = useState(true);
  return (
    <WorldScreenContext.Provider
      value={{
        enabled: true,
        dragging: false,
        modes: { workbench: spatial },
        poses: {},
        screens: [],
        toggle: () => setSpatial(!spatial),
        register: () => () => undefined,
        move: () => undefined,
        setDragging: () => undefined,
        setEnabled: () => undefined,
        updateAnchor: () => undefined,
      }}
    >
      <WorldWorkstreamStatus
        workstream={{
          workstreamId: "scroll-fixture",
          title: "Scrollable Workstream",
          status: "completed",
          currentActivity: "Inspect the completed changes",
          plan: Array.from(
            { length: 40 },
            (_, i) => `Plan step ${i + 1}: bounded local work`,
          ),
          changedFiles: [],
          validation: [],
          assetLinks: [],
          createdAt: "2026-10-17T00:00:00Z",
          updatedAt: "2026-10-17T00:00:00Z",
        }}
        open
        pending={false}
        message={null}
        onInspect={() => undefined}
        onCancel={() => undefined}
      />
    </WorldScreenContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
