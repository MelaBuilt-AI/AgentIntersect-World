import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

import { WorldScreen, WorldScreenToggle } from "./WorldScreen.js";

export type AdminShellKind = "terminal" | "powershell";

const TITLES: Record<AdminShellKind, string> = {
  terminal: "Admin Terminal",
  powershell: "Admin PowerShell",
};

export function WorldAdminShell({
  kind,
  onClose,
}: {
  readonly kind: AdminShellKind;
  readonly onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Requesting admin shell…");
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      theme: { background: "#050b16", foreground: "#e6fbff" },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(element);
    let socket: WebSocket | null = null;
    let disposed = false;
    const sendSize = () => {
      try {
        fit.fit();
      } catch {
        return;
      }
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(
          JSON.stringify({
            type: "resize",
            cols: terminal.cols,
            rows: terminal.rows,
          }),
        );
    };
    const resize = new ResizeObserver(sendSize);
    resize.observe(element);
    const input = terminal.onData((data) => {
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "input", data }));
    });

    void (async () => {
      try {
        const response = await fetch("/api/admin-shells", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind }),
        });
        if (!response.ok) throw new Error();
        const { data } = (await response.json()) as {
          data: {
            websocketPath: string;
            ticket: string;
            elevation: "uac" | "sudo";
          };
        };
        if (disposed) return;
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        socket = new WebSocket(
          `${protocol}//${window.location.host}/api${data.websocketPath}?ticket=${data.ticket}`,
        );
        socket.onopen = () => {
          sendSize();
          terminal.focus();
        };
        socket.onmessage = (event) => {
          const message = JSON.parse(String(event.data)) as {
            type: string;
            data?: string;
            message?: string;
          };
          if (message.type === "output" && message.data) {
            setStatus(
              data.elevation === "uac"
                ? "Running as administrator"
                : "Enter your password for sudo when asked",
            );
            terminal.write(message.data);
          } else if (message.type === "status" && message.message)
            setStatus(message.message);
          else if (message.type === "exit") setEnded(true);
        };
        socket.onclose = () => setEnded(true);
      } catch {
        setStatus("Admin shells are unavailable on this World server.");
        setEnded(true);
      }
    })();

    return () => {
      disposed = true;
      resize.disconnect();
      input.dispose();
      socket?.close();
      terminal.dispose();
    };
  }, [kind]);

  return (
    <WorldScreen id={kind}>
      <section
        className={`world-admin-shell world-admin-shell--${kind}`}
        aria-label={TITLES[kind]}
        data-shell-ended={ended}
      >
        <header className="world-admin-shell__header">
          <WorldScreenToggle id={kind} />
          <strong>{TITLES[kind]}</strong>
          <span role="status">{ended ? "Shell closed" : status}</span>
          <button
            type="button"
            className="world-action--enabled"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <div ref={host} className="world-admin-shell__terminal" />
      </section>
    </WorldScreen>
  );
}
