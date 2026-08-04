export function resolveAppSurface(
  path: string,
  developerFlag: string | undefined,
):
  | "world-entry"
  | "internal-dashboard"
  | "internal-avatar-review"
  | "internal-unavailable" {
  const internalSurface =
    path === "/internal/dashboard"
      ? "internal-dashboard"
      : path === "/internal/avatar-animation-review"
        ? "internal-avatar-review"
        : null;
  if (!internalSurface) return "world-entry";
  return developerFlag === "1" ? internalSurface : "internal-unavailable";
}
