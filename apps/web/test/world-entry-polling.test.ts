import { afterEach, expect, it, vi } from "vitest";
import { startWorldPolling } from "../src/world-entry/world-entry-polling.js";

afterEach(() => vi.useRealTimers());

it("waits for a slow read before scheduling the next poll", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const load = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const stop = startWorldPolling(load);
  await vi.advanceTimersByTimeAsync(2000);
  expect(load).toHaveBeenCalledTimes(1);
  release();
  await vi.advanceTimersByTimeAsync(499);
  expect(load).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(load).toHaveBeenCalledTimes(2);
  stop();
  release();
});

it("aborts an owned pending read and does not reschedule after cleanup", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const load = vi.fn<(signal: AbortSignal) => Promise<void>>(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const stop = startWorldPolling(load);
  const signal = load.mock.calls[0]![0];
  stop();
  expect(signal.aborted).toBe(true);
  release();
  await vi.advanceTimersByTimeAsync(2000);
  expect(load).toHaveBeenCalledTimes(1);
});
