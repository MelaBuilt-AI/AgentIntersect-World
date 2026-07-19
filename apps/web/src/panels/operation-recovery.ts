type RecoverableOperation = {
  readonly status: string;
};

export function recoverActiveOrRecent<T extends RecoverableOperation>(
  newestFirst: readonly T[],
): T | null {
  return (
    newestFirst.find((operation) => operation.status === "running") ??
    newestFirst[0] ??
    null
  );
}
