import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";

it("offers the globe beneath the menu hint and an accessible custom-description gesture", async () => {
  const module = await import("../src/world-entry/HackYourWorld.js").catch(
    () => null,
  );
  expect(module, "Hack your World control must exist").not.toBeNull();
  const HackYourWorld = module!.HackYourWorld;
  const html = renderToStaticMarkup(
    <HackYourWorld
      active={ENVIRONMENT_PRESETS[0]!}
      phase="idle"
      error=""
      reducedMotion={false}
      onSelect={vi.fn()}
      onDialogChange={vi.fn()}
    />,
  );
  expect(html).toContain("Hack your World");
  expect(html).toContain("Original World");
  expect(html).toContain("Shift+F10");
  expect(html).toContain("hack-world__globe");
  expect(html).not.toContain('role="dialog"'); // Closed authoring must not block World input.
  expect(html).not.toContain('aria-modal="true"');
});
it("retains only schema-valid custom recipes and refuses over-limit descriptions", async () => {
  const module =
    await import("../src/world-entry/environment-authoring.js").catch(
      () => null,
    );
  expect(module).not.toBeNull();
  const recipe = ENVIRONMENT_PRESETS[1]!.recipe!;
  expect(
    module!.readCustomEnvironments(JSON.stringify([recipe, { script: "bad" }])),
  ).toEqual([recipe]);
  expect(() =>
    module!.buildEnvironmentBrief("word ".repeat(501), recipe),
  ).toThrow(/500/);
  const brief = module!.buildEnvironmentBrief("A soft alien sunrise", recipe);
  expect(brief).toContain("aiw.environment/1");
  expect(brief).toContain("meadow-ground");
  expect(brief).toContain("Do not edit application files");
});
