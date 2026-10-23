// Download remote event thumbnails into data/images/ and point each event at
// the local copy, so the app does not hotlink UK sites (slow or blocked in
// mainland China). Idempotent: already-local paths are left alone, files are
// named by a hash of the source URL, and a failed download keeps the remote
// URL (the app already falls back when an image fails to load).

import { createHash } from "node:crypto";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const EXT_BY_TYPE = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/avif": ".avif",
};
// Some hosts (e.g. royalsociety.org) answer 403 to non-browser user agents.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MAX_BYTES = 8 * 1024 * 1024;

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function findCached(dir, hash) {
  const files = await readdir(dir);
  return files.find((f) => f.startsWith(hash + ".")) || null;
}

export async function localizeImages(events, { root, dirName = "data/images" }) {
  const dir = join(root, dirName);
  await mkdir(dir, { recursive: true });

  const keep = new Set();
  let downloaded = 0;
  let reused = 0;
  const failed = [];

  for (const ev of events) {
    const url = ev.image;
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) {
      keep.add(url.split("/").pop());
      continue;
    }
    const hash = createHash("sha1").update(url).digest("hex").slice(0, 16);
    let file = await findCached(dir, hash);
    if (file) {
      reused++;
    } else {
      try {
        const res = await fetch(url, {
          headers: {
            "user-agent": BROWSER_UA,
            accept: "image/avif,image/webp,image/*,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        const ext = EXT_BY_TYPE[type];
        if (!ext) throw new Error(`not an image (${type || "no content-type"})`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_BYTES) throw new Error(`too large (${buf.length} bytes)`);
        file = hash + ext;
        await writeFile(join(dir, file), buf);
        downloaded++;
      } catch (err) {
        failed.push(`${url} (${err.message})`);
        continue;
      }
    }
    keep.add(file);
    ev.image = `${dirName}/${file}`;
  }

  // Remove thumbnails no event uses any more.
  let pruned = 0;
  for (const f of await readdir(dir)) {
    if (!keep.has(f) && !f.startsWith(".")) {
      await unlink(join(dir, f));
      pruned++;
    }
  }

  return { downloaded, reused, pruned, failed };
}
