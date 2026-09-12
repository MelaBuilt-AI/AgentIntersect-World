import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

it("holds normal entry behind the opening logo and server-owned setup gate", async () => {
  const module = await import("../src/world-entry/AgentSetupBoundary.js").catch(
    () => null,
  );
  expect(module?.AgentSetupBoundary).toBeTypeOf("function");
  if (!module) return;
  const html = renderToStaticMarkup(
    <module.AgentSetupBoundary>
      <div>Agent selection sentinel</div>
    </module.AgentSetupBoundary>,
  );
  expect(html).toContain("agentintersect_animated.svg");
  expect(html).toContain("Escape for Menu");
  expect(html).not.toContain("Agent selection sentinel");
});
