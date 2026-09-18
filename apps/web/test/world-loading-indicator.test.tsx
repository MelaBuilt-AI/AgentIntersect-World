import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WorldLoadingIndicator } from "../src/world-entry/WorldLoadingIndicator.js";

it("keeps the supplied artwork intact with separate orbital trails and an accessible loading label", () => {
  const html = renderToStaticMarkup(
    <WorldLoadingIndicator label="Loading repository" />,
  );
  expect(html).toContain('role="status" aria-label="Loading repository"');
  expect(html).toContain("/assets/loading/intersection-traces.webp");
  expect(html.match(/<image /g)).toHaveLength(1);
  expect(html).not.toMatch(/<mask|<clipPath|__orb"|__swish/);
  expect(html.match(/class="world-loading-indicator__trail"/g)).toHaveLength(
    12,
  );
  expect(html).toContain('data-state="typing"');
  expect(html).toContain('class="terminal-cursor"');
});

it("uses the full caption immediately with reduced motion", () => {
  const html = renderToStaticMarkup(<WorldLoadingIndicator reducedMotion />);
  expect(html).toContain('data-reduced-motion="true"');
  expect(html).toContain('data-state="complete"');
  expect(html).toContain('aria-hidden="true">Loading...</span>');
});
