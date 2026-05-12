#!/usr/bin/env node
// Local preview server that can also refresh external event sources on a timer.

import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8000);
const FETCH_INTERVAL_MS = Number(process.env.FETCH_INTERVAL_MS || 30 * 60 * 1000);
const SHOULD_FETCH = process.env.AUTO_FETCH !== "0";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

let fetchRunning = false;

function runFetch(reason) {
  if (!SHOULD_FETCH || fetchRunning) return;
  fetchRunning = true;
  console.log(`[fetch] ${reason}`);

  const child = spawn(process.execPath, ["scripts/fetch.mjs"], {
    cwd: ROOT,
    stdio: "inherit",
  });

  child.on("close", (code) => {
    fetchRunning = false;
    const status = code === 0 ? "done" : `failed with exit ${code}`;
    console.log(`[fetch] ${status}`);
  });
}

function safePathFromUrl(url) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost:${PORT}`).pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const fullPath = normalize(join(ROOT, requested));
  if (!fullPath.startsWith(ROOT)) return null;
  return fullPath;
}

const server = createServer(async (req, res) => {
  const filePath = safePathFromUrl(req.url || "/");
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
  } catch {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const headers = {
    "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  };
  res.writeHead(200, headers);
  createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Signal preview: http://localhost:${PORT}/`);
  console.log(
    SHOULD_FETCH
      ? `Auto-fetch: every ${Math.round(FETCH_INTERVAL_MS / 60000)} min`
      : "Auto-fetch: off"
  );

  if (SHOULD_FETCH && existsSync(join(ROOT, "scripts", "fetch.mjs"))) {
    runFetch("startup");
    setInterval(() => runFetch("interval"), FETCH_INTERVAL_MS);
  }
});
