import { WorldTypeLine } from "./WorldEntryLogo.js";

const artwork = "/assets/loading/intersection-traces.webp";
const trailColors = ["#78dcff", "#a699ff", "#ffd582"] as const;

/** Presentational loading surface; its caller owns completion and error state. */
export function WorldLoadingIndicator({
  reducedMotion = false,
  label = "Loading",
}: {
  readonly reducedMotion?: boolean;
  readonly label?: string;
}) {
  return (
    <div
      className="world-loading-indicator"
      role="status"
      aria-label={label}
      data-reduced-motion={reducedMotion}
    >
      <div className="world-loading-indicator__art" aria-hidden="true">
        <svg viewBox="-110 -110 1180 1180" focusable="false">
          {/* Preserve the complete original composition; never detach its endpoints. */}
          <image href={artwork} width="960" height="960" />
          {Array.from({ length: 12 }, (_, index) => (
            <circle
              key={index}
              className="world-loading-indicator__trail"
              cx="480"
              cy="480"
              r={505 + (index % 4) * 20}
              pathLength="100"
              fill="none"
              stroke={trailColors[index % trailColors.length]}
              strokeWidth={index % 3 === 0 ? 3 : 1.5}
              strokeDasharray={`${7 + (index % 3) * 4} 100`}
              strokeLinecap="round"
              opacity={index % 3 === 0 ? 0.8 : 0.45}
              style={{
                animationDuration: `${0.85 + (index % 4) * 0.15}s`,
                animationDelay: `${-index * 0.137}s`,
                animationDirection: index % 2 === 0 ? "normal" : "reverse",
              }}
            />
          ))}
        </svg>
      </div>
      <WorldTypeLine
        text="Loading..."
        reducedMotion={reducedMotion}
        className="world-loading-indicator__label"
      />
    </div>
  );
}
