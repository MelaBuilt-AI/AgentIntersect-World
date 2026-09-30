#!/usr/bin/env node
// Runs one World admin shell under a PTY and streams it to the local World
// server. On Windows the server starts this helper through a UAC prompt, so the
// shell is elevated; on Linux the shell starts `sudo` itself.
import { homedir } from "node:os";
import pty from "@lydell/node-pty";
import WebSocket from "ws";

const [url, kind] = process.argv.slice(2);
const windows = process.platform === "win32";
const shell = windows
  ? kind === "powershell"
    ? "powershell.exe"
    : "cmd.exe"
  : process.env.SHELL || "/bin/bash";

const socket = new WebSocket(url);
socket.on("error", () => process.exit(1));
socket.on("open", () => {
  const terminal = pty.spawn(shell, windows ? [] : ["-l"], {
    name: "xterm-256color",
    cols: 100,
    rows: 30,
    cwd: homedir(),
    env: { ...process.env, TERM: "xterm-256color" },
  });
  if (!windows && process.env.AIW_ADMIN_SHELL_NO_SUDO !== "1")
    terminal.write(kind === "powershell" ? "sudo pwsh\r" : "sudo -i\r");
  terminal.onData((data) =>
    socket.send(JSON.stringify({ type: "output", data })),
  );
  terminal.onExit(({ exitCode }) => {
    socket.send(JSON.stringify({ type: "exit", code: exitCode }));
    socket.close();
  });
  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (message.type === "input" && typeof message.data === "string")
      terminal.write(message.data);
    else if (
      message.type === "resize" &&
      Number.isInteger(message.cols) &&
      Number.isInteger(message.rows) &&
      message.cols > 0 &&
      message.rows > 0 &&
      message.cols <= 500 &&
      message.rows <= 200
    )
      terminal.resize(message.cols, message.rows);
  });
  socket.on("close", () => {
    try {
      terminal.kill();
    } catch {
      // Already exited.
    }
    process.exit(0);
  });
});
