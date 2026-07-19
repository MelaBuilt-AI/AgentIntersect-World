export type BrowserObject = {
  readonly ref: string;
  readonly kind:
    "workspace" | "repository" | "directory" | "package" | "file" | "tombstone";
  readonly name: string;
  readonly parentRef: string | null;
  readonly childRefs: readonly string[];
  readonly path?: string;
  readonly language?: string | null;
  readonly fileKind?: string;
  readonly packageKind?: string;
  readonly packageName?: string | null;
  readonly size?: number;
};

export type RepositoryBrowserModel<T extends BrowserObject = BrowserObject> = {
  readonly ordered: readonly T[];
  readonly byRef: ReadonlyMap<string, T>;
  readonly depthByRef: ReadonlyMap<string, number>;
};

export function createRepositoryBrowserModel<T extends BrowserObject>(
  objects: readonly T[],
): RepositoryBrowserModel<T> {
  const byRef = new Map(objects.map((object) => [object.ref, object]));
  const depthByRef = new Map<string, number>();
  const ordered: T[] = [];
  const visited = new Set<string>();
  const visit = (object: T, depth: number) => {
    if (visited.has(object.ref)) return;
    visited.add(object.ref);
    depthByRef.set(object.ref, depth);
    ordered.push(object);
    for (const ref of object.childRefs) {
      const child = byRef.get(ref);
      if (child !== undefined) visit(child, depth + 1);
    }
  };
  for (const object of objects) if (object.parentRef === null) visit(object, 0);
  for (const object of objects) visit(object, 0);
  return { ordered, byRef, depthByRef };
}

export function safeObjectPath(object: BrowserObject): string | null {
  const path = object.path;
  if (path === undefined || path.length === 0) return null;
  const normalized = path.replaceAll("\\", "/");
  const classified = normalized.trimStart();
  if (
    classified.startsWith("/") ||
    /^[A-Za-z]:\//.test(classified) ||
    /^file:/i.test(classified)
  )
    return null;
  return normalized;
}

export function searchRepositoryObjects<T extends BrowserObject>(
  model: RepositoryBrowserModel<T>,
  query: string,
): readonly T[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized.length === 0) return model.ordered;
  return model.ordered.filter((object) =>
    [
      object.name,
      safeObjectPath(object),
      object.kind,
      object.language ?? "unsupported language",
      object.fileKind,
      object.packageKind,
      object.packageName,
    ].some((value) => value?.toLocaleLowerCase().includes(normalized)),
  );
}

export function moveSelection<T extends BrowserObject>(
  model: RepositoryBrowserModel<T>,
  currentRef: string | null,
  direction: "next" | "previous" | "parent" | "first" | "last",
): string | null {
  if (model.ordered.length === 0) return null;
  if (direction === "first") return model.ordered[0]?.ref ?? null;
  if (direction === "last") return model.ordered.at(-1)?.ref ?? null;
  const current = currentRef === null ? undefined : model.byRef.get(currentRef);
  if (direction === "parent")
    return current?.parentRef ?? current?.ref ?? model.ordered[0]?.ref ?? null;
  const index = current === undefined ? -1 : model.ordered.indexOf(current);
  const delta = direction === "next" ? 1 : -1;
  const target = Math.max(0, Math.min(model.ordered.length - 1, index + delta));
  return model.ordered[target]?.ref ?? null;
}
