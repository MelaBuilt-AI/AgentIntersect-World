export const GRAPH_CANVAS_OBJECT_LIMIT = 2_000;
export const GRAPH_FALLBACK_OBJECT_LIMIT = 160;

export function repositoryProjectionLimit(
  graphRequested: boolean,
  semanticFallback: boolean,
): number {
  if (!graphRequested) return Number.POSITIVE_INFINITY;
  return semanticFallback
    ? GRAPH_FALLBACK_OBJECT_LIMIT
    : GRAPH_CANVAS_OBJECT_LIMIT;
}

export function supportedRepositoryProjection<
  T extends { readonly kind: string },
>(objects: readonly T[], limit: number): readonly T[] {
  const projected: T[] = [];
  for (const object of objects) {
    if (
      object.kind !== "package" &&
      object.kind !== "directory" &&
      object.kind !== "file"
    )
      continue;
    projected.push(object);
    if (projected.length >= limit) break;
  }
  return projected;
}
