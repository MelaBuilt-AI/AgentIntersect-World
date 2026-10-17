import { createRoot } from "react-dom/client";
import { WorldAdminShell } from "../../src/world-entry/WorldAdminShell.js";
import "../../src/styles.css";

createRoot(document.getElementById("root")!).render(
  <WorldAdminShell kind="powershell" onClose={() => undefined} />,
);
