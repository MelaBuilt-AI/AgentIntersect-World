export function matchesSelectedRepository(
  sessionRepositoryRef: string,
  selectedRepositoryRef: string,
): boolean {
  return (
    sessionRepositoryRef === "current" ||
    sessionRepositoryRef === selectedRepositoryRef
  );
}
