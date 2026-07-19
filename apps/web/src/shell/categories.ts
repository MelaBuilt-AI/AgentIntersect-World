export const WORLD_CATEGORIES = [
  "World",
  "Repositories",
  "Agents",
  "Activity",
  "Evidence",
  "Settings",
] as const;

export type Category = (typeof WORLD_CATEGORIES)[number];
