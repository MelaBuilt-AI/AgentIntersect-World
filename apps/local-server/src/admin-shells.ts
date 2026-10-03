import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { fileURLToPath } from "node:url";

import WebSocket, { WebSocketServer } from "ws";

import {
  ensureWindowsHelper,
  isWslHost,
  WINDOWS_POWERSHELL,
} from "./windows-shell-helper.js";

export type AdminShellKind = "terminal" | "powershell";

type ShellSession = {
  readonly kind: AdminShellKind;
  readonly ticket: string;
  readonly helperToken: string;
  readonly expiresAt: number;
  browser?: WebSocket;
  helper?: WebSocket;
  resize?: string;
  timer?: NodeJS.Timeout;
};

export type AdminShellOptions = {
  readonly server: Server;
  readonly allowedOrigin: string;
  readonly allowedHost: string;
  readonly platform?: NodeJS.Platform;
  /** True when World runs inside WSL: PowerShell then opens elevated on Windows. */
  readonly wsl?: boolean;
  /** Seconds to wait for the helper (and the UAC prompt) before giving up. */
  readonly helperTimeoutSeconds?: number;
};

const HELPER = fileURLToPath(
  new URL("../admin-shell-helper.mjs", import.meta.url),
);
const PATH = /^\/(admin-shell|admin-shell-helper)\/(shell_[a-f0-9-]{36})$/;

export const isLoopbackAddress = (address: string): boolean => {
  const normalized = address.replace(/^::ffff:/, "");
  return normalized === "::1" || normalized.startsWith("127.");
};

/**
 * In-World admin shells. The browser gets a one-time ticket; the shell runs in
 * a helper process (elevated through UAC on Windows) that connects back over
 * loopback with its own one-time token. This service only relays frames.
 */
export class AdminShellService {
  readonly #options: AdminShellOptions;
  readonly #platform: NodeJS.Platform;
  readonly #wsl: boolean;
  readonly #sessions = new Map<string, ShellSession>();
  readonly #websockets = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024,
  });

  constructor(options: AdminShellOptions) {
    this.#options = options;
    this.#platform = options.platform ?? process.platform;
    this.#wsl = options.wsl ?? isWslHost();
    options.server.on("upgrade", this.#upgrade);
  }

  create(kind: AdminShellKind) {
    const sessionId = `shell_${randomUUID()}`;
    const ticket = randomBytes(24).toString("hex");
    this.#sessions.set(sessionId, {
      kind,
      ticket,
      helperToken: randomBytes(24).toString("hex"),
      expiresAt: Date.now() + 60_000,
    });
    return {
      sessionId,
      ticket,
      websocketPath: `/admin-shell/${sessionId}`,
      elevation: this.#usesUac(kind) ? "uac" : "sudo",
    } as const;
  }

  #usesUac(kind: AdminShellKind): boolean {
    return this.#platform === "win32" || (this.#wsl && kind === "powershell");
  }

  close(): void {
    for (const id of [...this.#sessions.keys()]) this.#end(id);
    this.#options.server.off("upgrade", this.#upgrade);
    this.#websockets.close();
  }

  #upgrade = (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const url = new URL(request.url ?? "/", "http://local");
    const match = PATH.exec(url.pathname);
    if (!match) return;
    const [, role, sessionId] = match as unknown as [string, string, string];
    const session = this.#sessions.get(sessionId);
    const reject = (status: string) => {
      socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    if (!isLoopbackAddress(request.socket.remoteAddress ?? ""))
      return reject("403 Forbidden");
    if (role === "admin-shell") {
      if (
        request.headers.origin !== this.#options.allowedOrigin ||
        request.headers.host !== this.#options.allowedHost
      )
        return reject("403 Forbidden");
      if (
        !session ||
        session.browser ||
        Date.now() > session.expiresAt ||
        url.searchParams.get("ticket") !== session.ticket
      )
        return reject("401 Unauthorized");
      this.#websockets.handleUpgrade(request, socket, head, (websocket) =>
        this.#connectBrowser(sessionId, session, websocket),
      );
      return;
    }
    if (
      !session?.browser ||
      session.helper ||
      url.searchParams.get("token") !== session.helperToken
    )
      return reject("401 Unauthorized");
    this.#websockets.handleUpgrade(request, socket, head, (websocket) =>
      this.#connectHelper(sessionId, session, websocket),
    );
  };

  #connectBrowser(id: string, session: ShellSession, browser: WebSocket) {
    session.browser = browser;
    browser.on("message", (data) => {
      const text = String(data);
      if (session.helper) session.helper.send(text);
      else if (text.includes('"resize"')) session.resize = text;
    });
    browser.on("close", () => this.#end(id));
    const windows = this.#platform === "win32";
    const viaWsl = !windows && this.#usesUac(session.kind);
    this.#status(
      session,
      windows || viaWsl
        ? "Waiting for administrator permission (UAC)…"
        : "Starting shell…",
    );
    session.timer = setTimeout(
      () => this.#end(id, "The admin shell did not start in time."),
      (this.#options.helperTimeoutSeconds ?? 120) * 1000,
    );
    const port = (this.#options.server.address() as AddressInfo).port;
    const url = `ws://127.0.0.1:${port}/admin-shell-helper/${id}?token=${session.helperToken}`;
    if (viaWsl) {
      clearTimeout(session.timer);
      this.#status(
        session,
        "Preparing Windows PowerShell (first use downloads Node.js)…",
      );
      ensureWindowsHelper(HELPER).then(
        ({ node, helper }) => {
          if (!this.#sessions.has(id)) return;
          // The first-use download must not eat into the UAC wait.
          clearTimeout(session.timer);
          session.timer = setTimeout(
            () => this.#end(id, "The admin shell did not start in time."),
            (this.#options.helperTimeoutSeconds ?? 120) * 1000,
          );
          this.#status(session, "Waiting for administrator permission (UAC)…");
          this.#elevate(
            id,
            WINDOWS_POWERSHELL,
            node,
            `"${helper}" "${url}" powershell`,
          );
        },
        (error: unknown) =>
          this.#end(
            id,
            error instanceof Error
              ? `Windows PowerShell is unavailable: ${error.message}`
              : "Windows PowerShell is unavailable.",
          ),
      );
      return;
    }
    if (windows) {
      this.#elevate(
        id,
        "powershell.exe",
        process.execPath,
        `"${HELPER}" "${url}" ${session.kind}`,
      );
      return;
    }
    const child = spawn(process.execPath, [HELPER, url, session.kind], {
      stdio: "ignore",
    });
    child.on("error", () => this.#end(id, "The admin shell could not start."));
  }

  /** Starts the helper through a UAC prompt; declining ends the session. */
  #elevate(id: string, powershell: string, node: string, args: string) {
    const child = spawn(
      powershell,
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Start-Process -FilePath '${quote(node)}' -ArgumentList '${quote(args)}' -Verb RunAs -WindowStyle Hidden`,
      ],
      { stdio: "ignore", windowsHide: true },
    );
    child.on("error", () => this.#end(id, "The admin shell could not start."));
    child.on("exit", (code) => {
      if (code !== 0)
        this.#end(id, "Administrator permission was not granted.");
    });
  }

  #connectHelper(id: string, session: ShellSession, helper: WebSocket) {
    clearTimeout(session.timer);
    session.helper = helper;
    if (session.resize) helper.send(session.resize);
    helper.on("message", (data) => session.browser?.send(String(data)));
    helper.on("close", () => this.#end(id));
  }

  #status(session: ShellSession, message: string) {
    session.browser?.send(JSON.stringify({ type: "status", message }));
  }

  #end(id: string, message?: string) {
    const session = this.#sessions.get(id);
    if (!session) return;
    this.#sessions.delete(id);
    clearTimeout(session.timer);
    if (message) this.#status(session, message);
    session.browser?.send(JSON.stringify({ type: "exit" }));
    session.browser?.close();
    session.helper?.close();
  }
}

const quote = (value: string) => value.replaceAll("'", "''");
