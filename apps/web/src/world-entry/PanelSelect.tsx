import { useId, useRef, useState, useLayoutEffect } from "react";

/** In-flow choices share the screen's CSS3D transform, clipping and scrolling. */
export function PanelSelect({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly { value: string; label: string }[];
  readonly onChange: (value: string) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (open) list.current?.scrollIntoView({ block: "nearest" });
  }, [open]);
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const show = () => {
    setActive(selected);
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  return (
    <div
      className="panel-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        className="panel-select__trigger world-action--enabled"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (
            ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
          ) {
            event.preventDefault();
            event.stopPropagation();
            const index = !open
              ? selected
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        options.length - 1,
                        active + (event.key === "ArrowDown" ? 1 : -1),
                      ),
                    );
            setActive(index);
            setOpen(true);
            requestAnimationFrame(() =>
              document
                .getElementById(`${id}-${index}`)
                ?.scrollIntoView({ block: "nearest" }),
            );
          } else if (open && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            choose(active);
          } else if (event.key === "Tab") setOpen(false);
        }}
      >
        <span>{options[selected]?.label}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <div
        ref={list}
        id={id}
        role="listbox"
        aria-label={label}
        hidden={!open}
        className="panel-select__options"
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            id={`${id}-${index}`}
            type="button"
            role="option"
            aria-selected={option.value === value}
            data-active={active === index}
            tabIndex={-1}
            className="world-action--enabled"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => choose(index)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
