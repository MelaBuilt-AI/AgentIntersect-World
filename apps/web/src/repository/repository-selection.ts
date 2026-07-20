let requestedSelection: { ref: string; path: string } | null = null;

export function requestRepositorySelection(ref: string, path: string): void {
  requestedSelection = { ref, path };
}

export function currentRepositorySelection(): {
  ref: string;
  path: string;
} | null {
  return requestedSelection;
}
