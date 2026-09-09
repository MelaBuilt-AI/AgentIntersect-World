import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const contentTypes: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};
export async function startStaticSitePreview(directory: string, port: number) {
  const root = await realpath(directory);
  // A missing homepage fails startup/readiness, never a misleading directory listing.
  if (!(await stat(join(root, "index.html"))).isFile())
    throw Error(
      "Create index.html in the Workstream before previewing a static website.",
    );
  const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(
        new URL(request.url ?? "/", "http://127.0.0.1").pathname,
      );
      const parts = pathname.split("/").filter(Boolean);
      if (
        parts.some(
          (part) =>
            part.startsWith(".") || part.includes("\\") || part.includes("\0"),
        )
      )
        throw Error("private path");
      if (!parts.length || pathname.endsWith("/")) parts.push("index.html");
      const target = await realpath(join(root, ...parts));
      const inside = relative(root, target);
      if (
        isAbsolute(inside) ||
        inside.split(/[\\/]/).some((part) => part.startsWith("."))
      )
        throw Error("outside or private path");
      const type = contentTypes[extname(target).toLowerCase()];
      const info = await stat(target);
      if (!type || !info.isFile()) throw Error("not a public asset");
      response.writeHead(200, {
        "Content-Type": type,
        "Content-Length": info.size,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      if (request.method === "HEAD") response.end();
      else
        createReadStream(target)
          .on("error", () => response.destroy())
          .pipe(response);
    } catch {
      response.writeHead(404).end("Static preview file unavailable");
    }
  });
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      done();
    });
  });
  return server;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.argv[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("An owned loopback port is required");
  startStaticSitePreview(process.cwd(), port)
    .then(() =>
      console.log("World static website preview listening on loopback"),
    )
    .catch(() => {
      console.error(
        "Static preview unavailable: create index.html in the owned Workstream and retry.",
      );
      process.exitCode = 1;
    });
}
