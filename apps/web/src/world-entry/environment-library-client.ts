import {
  EnvironmentSlotSchema,
  type EnvironmentSlot,
  type EnvironmentRecipe,
  type EnvironmentPreset,
} from "@agentintersect-world/world-schema/environment";

export type EnvironmentSlots = (EnvironmentSlot | null)[];
export function customSlotPresets(
  slots: EnvironmentSlots,
): EnvironmentPreset[] {
  return slots.flatMap((recipe, index) =>
    recipe ? [customSlotPreset(recipe, index + 1)] : [],
  );
}
export function customSlotPreset(
  saved: EnvironmentSlot,
  slot: number,
): EnvironmentPreset {
  const { originalDescription, ...recipe } = saved;
  return {
    id: `slot-${slot}`,
    name: recipe.name,
    recipe,
    ...(originalDescription !== undefined ? { originalDescription } : {}),
  };
}
async function request(path = "", options?: RequestInit) {
  const response = await fetch(`/api/environment-library${path}`, options);
  const value = await response.json();
  if (!response.ok)
    throw new Error(
      value.error ?? "Custom slots unavailable. Your preview is not saved.",
    );
  return value;
}
export async function loadEnvironmentSlots(): Promise<EnvironmentSlots> {
  const { slots } = await request();
  if (!Array.isArray(slots) || slots.length !== 8)
    throw new Error("Custom slots unavailable.");
  return slots.map((recipe) =>
    recipe === null ? null : EnvironmentSlotSchema.parse(recipe),
  );
}
export async function saveEnvironmentSlot(
  slot: number,
  recipe: EnvironmentRecipe,
  replace: boolean,
  originalDescription?: string,
) {
  await request(`/${slot}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipe, replace, originalDescription }),
  });
  // A successful write is not the read-back authority for the cycling lineup.
  return loadEnvironmentSlots();
}
export async function removeEnvironmentSlot(slot: number) {
  await request(`/${slot}`, { method: "DELETE" });
  return loadEnvironmentSlots();
}
