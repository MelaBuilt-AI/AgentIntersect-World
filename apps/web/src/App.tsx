import { APP_METADATA } from "@agentintersect-world/config";
import { ServerStatus, type ServerHealthState } from "@agentintersect-world/ui";
import { useEffect, useState } from "react";

import { loadHealth } from "./health-client.js";

const foundations = [
  ["Workspace", "pnpm 11 + Turborepo"],
  ["Runtime", "Node 24 + Fastify"],
  ["Interface", "React 19 + Vite"],
] as const;

export function App() {
  const [serverState, setServerState] = useState<ServerHealthState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;
    void loadHealth().then((result) => {
      if (active) setServerState(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main>
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <header className="topbar">
        <a
          className="wordmark"
          href="#foundation"
          aria-label="AgentIntersect World home"
        >
          <span className="wordmark-mark" aria-hidden="true">
            AI
          </span>
          <span>AgentIntersect World</span>
        </a>
        <span className="phase-pill">Foundation online</span>
      </header>

      <section className="hero" id="foundation">
        <div className="eyebrow">Phase 1 · Engineering foundation</div>
        <h1>AgentIntersect World</h1>
        <p className="lede">
          A local-first spatial development world, beginning with a dependable
          workspace and a live connection to its local server.
        </p>

        <ServerStatus state={serverState} />

        <div className="foundation-grid" aria-label="Foundation technologies">
          {foundations.map(([label, value], index) => (
            <article key={label}>
              <span className="card-number">0{index + 1}</span>
              <h2>{label}</h2>
              <p>{value}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>{APP_METADATA.version}</span>
        <span>Local / trusted LAN</span>
      </footer>
    </main>
  );
}
