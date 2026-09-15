/** Poll after the previous read settles; never queue reads behind a slow agent.
 * The caller handles its own unavailable state. Stopping aborts the owned read.
 */
export function startWorldPolling(
  load: (signal: AbortSignal) => Promise<void>,
  intervalMs = 500,
): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = async () => {
    await load(controller.signal);
    if (!controller.signal.aborted)
      timer = setTimeout(() => void refresh(), intervalMs);
  };
  void refresh();
  return () => {
    controller.abort();
    clearTimeout(timer);
  };
}
