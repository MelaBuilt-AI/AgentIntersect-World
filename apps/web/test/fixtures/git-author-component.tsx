import { createRoot } from "react-dom/client";
import { RepositoryWorkbench } from "../../src/world-entry/RepositoryWorkbench.js";
import "../../src/styles.css";

createRoot(document.getElementById("root")!).render(
  <RepositoryWorkbench
    repositoryId="fixture-repo"
    agentName="Fixture agent"
    onClose={() => {}}
    onContinue={async () => ""}
    onInspect={() => {}}
    onNew={() => {}}
  />,
);
