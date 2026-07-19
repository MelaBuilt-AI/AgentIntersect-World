import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ServerStatus } from "../src/index.js";

describe("ServerStatus", () => {
  it("announces an unavailable local server accessibly", () => {
    const html = renderToStaticMarkup(
      <ServerStatus
        state={{ status: "unavailable", message: "Local server unavailable" }}
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Local server unavailable");
  });
});
