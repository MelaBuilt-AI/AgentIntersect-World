import { afterEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const state = vi.hoisted(() => ({
  expanded: true,
  controller: {
    enabled: true,
    dragging: false,
    screens: [] as { id: string; spatial: boolean }[],
    toggle: vi.fn(),
  },
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useState: (initial: unknown) => [
    typeof initial === "boolean" ? state.expanded : initial,
    vi.fn(),
  ],
  useEffect: vi.fn(),
  useId: () => "wheel-test",
}));
vi.mock("react-dom", () => ({
  createPortal: (children: ReactNode) => children,
}));
vi.mock("../src/world-entry/world-screen-context.js", async () => ({
  ...(await vi.importActual("../src/world-entry/world-screen-context.js")),
  useWorldScreens: () => state.controller,
}));
import { WorldCodeWheel } from "../src/world-entry/WorldCodeWheel.js";

function buttons(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...buttons(node.props.children as ReactNode)];
}
function render() {
  vi.stubGlobal("window", { innerWidth: 1280, innerHeight: 720 });
  vi.stubGlobal("document", { body: {} });
  const onAction = vi.fn();
  const onClose = vi.fn();
  const tree = WorldCodeWheel({
    position: { x: 640, y: 360, scale: 1 },
    agents: [],
    selectedRecipientId: null,
    reducedMotion: false,
    onSelect: vi.fn(),
    onClear: vi.fn(),
    onAction,
    onClose,
    onCodeScreen: vi.fn(),
  });
  return { nodes: buttons(tree), onAction, onClose };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  state.controller.screens = [];
  state.controller.dragging = false;
  state.expanded = true;
});
it.each([
  ["terminal", "Terminal"],
  ["powershell", "PowerShell"],
] as const)(
  "opens %s from Screens without a pre-existing shell",
  (kind, label) => {
    const { nodes, onAction, onClose } = render();
    const button = nodes.find((node) => node.props["aria-label"] === label);
    expect(button).toBeDefined();
    expect(button!.props["aria-disabled"]).toBe(false);
    (button!.props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledWith(kind);
  },
);
it.each([
  ["terminal", "Terminal"],
  ["powershell", "PowerShell"],
] as const)(
  "toggles existing %s placement instead of creating another shell",
  (kind, label) => {
    state.controller.screens = [{ id: kind, spatial: true }];
    const { nodes, onAction } = render();
    const button = nodes.find((node) => node.props["aria-label"] === label);
    expect(button).toBeDefined();
    expect(button!.props["aria-pressed"]).toBe(true);
    (button!.props.onKeyDown as (event: unknown) => void)({
      key: "Enter",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    expect(state.controller.toggle).toHaveBeenCalledWith(kind);
    expect(onAction).not.toHaveBeenCalled();
  },
);
it("keeps shell shortcuts inside Screens and disables them during placement", () => {
  state.expanded = false;
  expect(
    render().nodes.some((node) => node.props["aria-label"] === "Terminal"),
  ).toBe(false);
  state.expanded = true;
  state.controller.dragging = true;
  const { nodes, onAction } = render();
  const button = nodes.find((node) => node.props["aria-label"] === "Terminal");
  expect(button).toBeDefined();
  expect(button!.props["aria-disabled"]).toBe(true);
  (button!.props.onClick as () => void)();
  expect(onAction).not.toHaveBeenCalled();
});
