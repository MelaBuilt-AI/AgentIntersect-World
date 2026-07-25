export function resolveAppSurface(
  path: string,
  developerFlag: string | undefined,
): "world-entry" | "internal-dashboard" | "internal-unavailable" {
  if (path !== "/internal/dashboard") return "world-entry";
  return developerFlag === "1" ? "internal-dashboard" : "internal-unavailable";
}
