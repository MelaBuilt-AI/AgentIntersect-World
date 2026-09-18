const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

/** Same upward cell assembly, then fully extinguish its final edge before restore. */
export function cityAssemblyFrame(elapsed: number, reducedMotion: boolean) {
  const age = Math.max(0, elapsed - 1);
  const progress = reducedMotion ? (elapsed >= 1 ? 1 : 0) : clamp(age / 4.8);
  return {
    progress,
    shaderProgress: reducedMotion
      ? progress * 1.22
      : clamp(age / 3.2) + 0.22 * smooth((age - 3.2) / 1.6),
    complete: progress >= 1 - 1e-9,
  };
}

/** Continuous code phase: decelerate upward, reverse gently, then fall steadily. */
export function cityLaunchFrame(age: number, reducedMotion: boolean) {
  if (reducedMotion) return { reach: 1, down: 1, spark: 0, offset: 0 };
  const reach = smooth(age / 2.8);
  const turn = clamp((age - 2.8) / 1.4);
  const down = smooth(turn);
  // Integral of the changing velocity keeps the glyph phase continuous.
  const offset =
    age < 2.8
      ? -age * 0.25
      : age < 4.2
        ? -0.7 + 1.4 * (-0.25 * turn + 0.305 * (turn ** 3 - 0.5 * turn ** 4))
        : -0.7 + 1.4 * (-0.25 + 0.305 * 0.5) + (age - 4.2) * 0.055;
  return { reach, down, spark: (1 - down) * smooth(age / 0.25), offset };
}
