import { DEFAULT_AVATAR_DRAFT } from "@agentintersect-world/avatar-system";
import {
  importedAvatarAssetsForRole,
  createOriginalImportedAvatarSource,
} from "@agentintersect-world/avatar-system/imported-avatar";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AvatarBuilder } from "../src/avatar/AvatarBuilder.js";

describe("minimal avatar onboarding", () => {
  for (const role of ["user", "agent"] as const) {
    it(`renders only the ${role} name, image choices, preview and acceptance control`, () => {
      const onSave = vi.fn();
      const html = renderToStaticMarkup(
        <AvatarBuilder
          onboarding
          role={role}
          initialProfile={{ ...DEFAULT_AVATAR_DRAFT, agentName: "Aaron" }}
          onSave={onSave}
        />,
      );
      const label =
        role === "user" ? "Accept user Avatar" : "Accept Agent Avatar";
      expect(html).toContain(`>${label}</button>`);
      expect(html.match(/<input\b/g)).toHaveLength(1);
      expect(html.match(/<button\b/g)).toHaveLength(
        importedAvatarAssetsForRole(role).length + 1,
      );
      expect(html).not.toMatch(
        /<h[1-6]|<select|type="checkbox"|<legend|<figcaption|avatar-nameplate/,
      );
      expect(html).not.toContain("Use Complete Avatar");
      expect(html).not.toContain("Result:");
      expect(html).not.toContain("<strong>");
      expect(onSave).not.toHaveBeenCalled();
    });
    for (const asset of importedAvatarAssetsForRole(role)) {
      it(`uses the accepted Idle mapping for ${asset.id}`, () => {
        const html = renderToStaticMarkup(
          <AvatarBuilder
            onboarding
            role={role}
            initialProfile={{
              ...DEFAULT_AVATAR_DRAFT,
              agentName: "Preview",
              avatarSource: createOriginalImportedAvatarSource(asset.id),
            }}
            onSave={vi.fn()}
          />,
        );
        expect(html).toContain(`data-avatar-imported-id="${asset.id}"`);
        expect(html).toContain(
          `data-avatar-preview-clip="${asset.semanticClips.Idle.clipIndex}"`,
        );
      });
    }
  }
});
