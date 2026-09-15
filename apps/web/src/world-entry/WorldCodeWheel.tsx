import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type { WorldScreenId } from "@agentintersect-world/renderer-r3f";
import { SCREEN_LABELS, useWorldScreens } from "./world-screen-context.js";
import "./world-code-wheel.css";

export type CodeWheelAction =
  "load-repo" | "workbench" | "new-workstream" | "follow" | "stop";
export type CodeWheelAgent = {
  readonly rosterId: string;
  readonly name: string;
};
type Item = {
  id: string;
  label: string;
  disabled?: boolean;
  selected?: boolean;
  detail?: string;
  run: () => void;
};

import { wheelPosition, wheelSegment } from "./world-code-wheel-model.js";

export function WorldCodeWheel({
  position,
  agents,
  selectedRecipientId,
  reducedMotion,
  onSelect,
  onClear,
  onAction,
  onClose,
  onCodeScreen,
}: {
  readonly position: ReturnType<typeof wheelPosition>;
  readonly agents: readonly CodeWheelAgent[];
  readonly selectedRecipientId: string | null;
  readonly reducedMotion: boolean;
  readonly onSelect: (id: string) => void;
  readonly onClear: () => void;
  readonly onAction: (action: CodeWheelAction) => void;
  readonly onClose: () => void;
  readonly onCodeScreen: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const controller = useWorldScreens();
  const pattern = useId().replaceAll(":", "");
  const target = agents.find((agent) => agent.rosterId === selectedRecipientId);
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    const resize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const fitted = wheelPosition(
    position.x,
    position.y,
    viewport.width,
    viewport.height,
  );
  const items: Item[] = Array.from({ length: 4 }, (_, index) => {
    const agent = agents[index];
    const name =
      agent && agents.filter((other) => other.name === agent.name).length > 1
        ? `${agent.name} [${index + 1}]`
        : agent?.name;
    return {
      id: agent?.rosterId ?? `empty-${index}`,
      label: name ?? `Agent ${index + 1}`,
      disabled: !agent,
      selected: agent?.rosterId === selectedRecipientId,
      detail: agent ? `Send next message to ${name}` : "Not connected",
      run: () => agent && onSelect(agent.rosterId),
    };
  });
  for (const [id, label] of [
    ["load-repo", "Load Repo"],
    ["workbench", "Workbench"],
    ["new-workstream", "New Workstream"],
    ["follow", "Follow me"],
    ["stop", "Agent Stop"],
  ] as const) {
    items.push({
      id,
      label,
      run: () => {
        if (
          id === "load-repo" ||
          id === "workbench" ||
          id === "new-workstream"
        ) {
          onClose();
        }
        onAction(id);
      },
    });
  }
  items.push({
    id: "screens",
    label: "Screens",
    selected: expanded,
    run: () => setExpanded(!expanded),
  });
  const screens: Item[] = (
    ["director", "workbench", "preview", "code"] as WorldScreenId[]
  ).map((id) => {
    const binding = controller?.screens.find((screen) => screen.id === id);
    const available = Boolean(
      controller?.enabled && binding && !controller.dragging,
    );
    return {
      id,
      label: SCREEN_LABELS[id],
      selected: Boolean(binding?.spatial),
      disabled: !available,
      detail: !binding
        ? `Open ${SCREEN_LABELS[id]} first`
        : binding.spatial
          ? `Return ${SCREEN_LABELS[id]} to HUD`
          : `Place ${SCREEN_LABELS[id]} in nearest clear space`,
      run: () => (id === "code" ? onCodeScreen() : controller?.toggle(id)),
    };
  });
  const renderItem = (
    item: Item,
    index: number,
    count: number,
    inner: number,
    outer: number,
  ) => {
    const shape = wheelSegment(index, count, inner, outer);
    const label =
      item.label.length > 24 ? `${item.label.slice(0, 22)}…` : item.label;
    const words = label.split(" ");
    const split = words.length > 1 ? Math.ceil(words.length / 2) : words.length;
    const lines =
      words.length > 1
        ? [words.slice(0, split).join(" "), words.slice(split).join(" ")]
        : [label];
    return (
      <g
        key={item.id}
        className="code-wheel__item"
        data-wheel-action={item.id}
        data-selected={Boolean(item.selected)}
        data-disabled={Boolean(item.disabled)}
      >
        <g
          role="button"
          tabIndex={item.disabled ? -1 : 0}
          aria-label={
            item.detail && agents.some((agent) => agent.rosterId === item.id)
              ? item.detail
              : item.label
          }
          aria-disabled={Boolean(item.disabled)}
          aria-pressed={Boolean(item.selected)}
          aria-expanded={item.id === "screens" ? expanded : undefined}
          onClick={() => {
            if (!item.disabled) item.run();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              if (!item.disabled) item.run();
            }
          }}
        >
          <title>{item.detail ?? item.label}</title>
          <path
            d={shape.path}
            className="code-wheel__face"
            stroke={`url(#${pattern})`}
            strokeWidth="6"
          />
          <text
            x={shape.x}
            y={shape.y - (lines.length - 1) * 8}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {lines.map((line, lineIndex) => (
              <tspan
                key={lineIndex}
                x={shape.x}
                dy={lineIndex ? 16 : 0}
                textLength={
                  count === 4 && line.length > 7
                    ? 60
                    : line.length > 10
                      ? 81
                      : undefined
                }
                lengthAdjust="spacingAndGlyphs"
              >
                {line}
              </tspan>
            ))}
          </text>
        </g>
        {item.selected && agents.some((agent) => agent.rosterId === item.id) ? (
          <g
            role="button"
            tabIndex={0}
            aria-label={`Clear ${item.label} and send to all agents`}
            className="code-wheel__clear"
            transform={`translate(${shape.x * 0.78},${shape.y * 0.78})`}
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onClear();
              }
            }}
          >
            <circle r="12" stroke={`url(#${pattern})`} strokeWidth="3" />
            <text textAnchor="middle" dominantBaseline="central">
              ×
            </text>
          </g>
        ) : null}
      </g>
    );
  };
  return createPortal(
    <div
      className="code-wheel"
      data-world-ui="true"
      data-reduced-motion={reducedMotion}
      style={{
        left: fitted.x,
        top: fitted.y,
        transform: `translate(-50%, -50%) scale(${fitted.scale})`,
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.button === 1) {
          event.preventDefault();
          onClose();
        }
      }}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
      onAuxClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg viewBox="-292 -292 584 584" aria-label="Code Wheel" role="group">
        <defs>
          <pattern
            id={pattern}
            width="1024"
            height="1024"
            patternUnits="userSpaceOnUse"
          >
            <g className="code-wheel__stream">
              <image
                href="/assets/code-world/02_terminal_rain_wheel.webp"
                y="-1024"
                width="1024"
                height="1024"
              />
              <image
                href="/assets/code-world/02_terminal_rain_wheel.webp"
                width="1024"
                height="1024"
              />
            </g>
          </pattern>
        </defs>
        <circle
          r={expanded ? 286 : 196}
          className="code-wheel__rim"
          stroke={`url(#${pattern})`}
          strokeWidth="10"
        />
        {items.map((item, index) =>
          renderItem(item, index, items.length, 88, 187),
        )}
        {expanded ? (
          <g className="code-wheel__outer">
            {screens.map((item, index) =>
              renderItem(item, index, screens.length, 208, 276),
            )}
          </g>
        ) : null}
        <g
          role="button"
          tabIndex={0}
          aria-label="All agents"
          className="code-wheel__center"
          onClick={onClear}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onClear();
            }
          }}
        >
          <circle r="78" stroke={`url(#${pattern})`} strokeWidth="5" />
          <text y="-22" textAnchor="middle" className="code-wheel__title">
            CODE WHEEL
          </text>
          <text
            y="2"
            textAnchor="middle"
            textLength={target && target.name.length > 14 ? 125 : undefined}
            lengthAdjust="spacingAndGlyphs"
          >
            {target ? target.name.slice(0, 18) : "All agents"}
          </text>
          <text y="25" textAnchor="middle" className="code-wheel__hint">
            click to clear
          </text>
          <text y="43" textAnchor="middle" className="code-wheel__hint">
            middle click · close
          </text>
        </g>
      </svg>
      {controller?.placementMessage ? (
        <p className="code-wheel__message" role="status">
          {controller.placementMessage}
        </p>
      ) : null}
    </div>,
    document.body,
  );
}
