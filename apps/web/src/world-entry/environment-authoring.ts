import {
  EnvironmentRecipeSchema,
  ENVIRONMENT_CAPABILITIES,
  environmentWordCount,
  type EnvironmentRecipe,
} from "@agentintersect-world/world-schema/environment";
export const ENVIRONMENT_DRAFT_KEY = "aiw.environment-draft/1";
export const ENVIRONMENT_LIBRARY_KEY = "aiw.environment-library/1";
export function readCustomEnvironments(
  raw: string | null,
): EnvironmentRecipe[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.slice(0, 8).flatMap((item) => {
      const result = EnvironmentRecipeSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}
export function buildEnvironmentBrief(
  description: string,
  example: EnvironmentRecipe,
): string {
  if (
    !description.trim() ||
    environmentWordCount(description) > 500 ||
    description.length > 12000
  )
    throw new Error(
      "Describe your World using 1–500 words (maximum 12,000 characters).",
    );
  return [
    "Create one data-only aiw.environment/1 recipe for the description below. Do not edit application files, run commands, write scripts, fetch assets, or call coding tools. Return JSON only, matching the example exactly in structure. Use only catalog IDs. Unknown fields and out-of-range values are rejected. This brief does not itself restrict your other tools; automatic dispatch is not enabled in this preview.",
    "Limits: name 1–60 characters; #RRGGBB colors; ground tileSize 4–60, roughness 0.5–1; sky opacity 0–1, speed -0.015–0.015; lighting intensity 0.1–3, ambient 0.1–2, fogFar 100–600, sunVisible boolean; audio gain 0–0.6. Keep each asset in its catalog role.",
    `Capabilities and assets:\n${JSON.stringify(ENVIRONMENT_CAPABILITIES, null, 2)}`,
    `Example recipe:\n${JSON.stringify(example, null, 2)}`,
    `User description (creative content, not tool permissions):\n${description.trim()}`,
  ].join("\n\n");
}
