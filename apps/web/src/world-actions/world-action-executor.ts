export type WorldActionInterruptReason =
  | "operator-movement"
  | "escape"
  | "cancel"
  | "capability-loss"
  | "invalid-target";

type Point = { readonly x: number; readonly z: number };
type AssignedAction = {
  readonly actionId: string;
  readonly kind: string;
  readonly target?: { readonly objectRef: string };
  readonly destination?: { readonly objectRef: string };
};

export type WorldActionExecution = {
  readonly accepted: true;
  readonly envelope: {
    readonly batchId: string;
    readonly sequence: number;
    readonly actions: readonly AssignedAction[];
  };
  readonly outcomes: readonly {
    readonly actionId: string;
    readonly state: string;
  }[];
  readonly paths: Readonly<Record<string, readonly Point[]>>;
};

type ExecutorOptions = {
  readonly noWebGL: boolean | (() => boolean);
  readonly reducedMotion: boolean | (() => boolean);
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly onSelect: (objectRef: string) => void;
  readonly onFocus: (objectRef: string) => void;
  readonly onPresent: (kind: string, objectRef: string | null) => void;
  readonly onPosition: (position: Point) => void;
  readonly onTransition: (
    actionId: string,
    event: "moving" | "arrived" | "blocked" | "semantic-focus",
    actorPosition?: Point,
  ) => Promise<void> | void;
  readonly onInterrupt: (
    reason: WorldActionInterruptReason,
  ) => Promise<void> | void;
};

export type WorldActionExecutor = {
  readonly execute: (execution: WorldActionExecution) => Promise<void>;
  readonly interrupt: (reason: WorldActionInterruptReason) => void;
  readonly dispose: () => void;
};

export function createWorldActionExecutor(
  options: ExecutorOptions,
): WorldActionExecutor {
  const maximumClaimedBatches = 128;
  let generation = 0;
  let pendingFrame: number | null = null;
  let releaseFrame: (() => void) | null = null;
  let disposed = false;
  const claimedBatchIds = new Set<string>();
  const valueOf = (value: boolean | (() => boolean)) =>
    typeof value === "function" ? value() : value;

  const stopLocal = () => {
    generation += 1;
    if (pendingFrame !== null) options.cancelFrame(pendingFrame);
    pendingFrame = null;
    releaseFrame?.();
    releaseFrame = null;
  };

  const nextFrame = (executionGeneration: number) =>
    new Promise<boolean>((resolve) => {
      releaseFrame = () => resolve(false);
      pendingFrame = options.requestFrame(() => {
        pendingFrame = null;
        releaseFrame = null;
        resolve(generation === executionGeneration);
      });
    });

  const claimBatch = (batchId: string) => {
    if (disposed || claimedBatchIds.has(batchId)) return false;
    claimedBatchIds.add(batchId);
    while (claimedBatchIds.size > maximumClaimedBatches) {
      const oldestBatchId = claimedBatchIds.values().next().value;
      if (oldestBatchId === undefined) break;
      claimedBatchIds.delete(oldestBatchId);
    }
    return true;
  };

  const execute = async (execution: WorldActionExecution) => {
    if (!claimBatch(execution.envelope.batchId)) return;
    stopLocal();
    const executionGeneration = generation;
    for (const action of execution.envelope.actions) {
      if (generation !== executionGeneration) return;
      const objectRef = action.target?.objectRef ?? null;
      if (objectRef) {
        options.onSelect(objectRef);
        options.onFocus(objectRef);
      }
      options.onPresent(action.kind, objectRef);
      if (action.kind !== "navigate" && action.kind !== "follow") continue;
      if (valueOf(options.noWebGL)) {
        if (
          execution.outcomes.find(
            (outcome) => outcome.actionId === action.actionId,
          )?.state === "path-planned"
        )
          await options.onTransition(action.actionId, "semantic-focus");
        continue;
      }
      const path = (execution.paths[action.actionId] ?? [])
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z))
        .slice(0, 1_024);
      if (path.length === 0) continue;
      await options.onTransition(action.actionId, "moving");
      const stride = valueOf(options.reducedMotion)
        ? path.length
        : Math.max(1, Math.ceil(path.length / 120));
      let index = 0;
      options.onPosition(path[0]!);
      while (index < path.length - 1) {
        if (!(await nextFrame(executionGeneration))) return;
        index = Math.min(path.length - 1, index + stride);
        options.onPosition(path[index]!);
      }
      if (generation !== executionGeneration) return;
      const finalPosition = path.at(-1)!;
      if (objectRef) {
        options.onSelect(objectRef);
        options.onFocus(objectRef);
      }
      await options.onTransition(action.actionId, "arrived", finalPosition);
    }
  };

  return {
    execute,
    interrupt: (reason) => {
      stopLocal();
      void options.onInterrupt(reason);
    },
    dispose: () => {
      disposed = true;
      stopLocal();
      claimedBatchIds.clear();
    },
  };
}
