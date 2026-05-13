#!/usr/bin/env node
// Refresh data/events.json from real external sources.
//
// Pipeline:
//   1. Load .env (so MEETUP_* credentials are available)
//   2. Read the current data/events.json
//   3. For each enabled connector, fetch + normalize
//   4. Drop any existing entries whose id matches the connector's prefix
//      (e.g. "mu:*" for meetup), then append the freshly normalized ones
//   5. Write data/events.json back, pretty-printed
//
// Run anytime:
//
//   npm run fetch

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { fetchMeetupEvents } from "./connectors/meetup.mjs";
import { fetchKclEvents } from "./connectors/kcl.mjs";
import { fetchImperialEvents } from "./connectors/imperial.mjs";
import { fetchLseEvents } from "./connectors/lse.mjs";
import { fetchUclEvents } from "./connectors/ucl.mjs";
import { fetchTuringEvents } from "./connectors/turing.mjs";
import { fetchWellcomeEvents } from "./connectors/wellcome.mjs";
import { fetchRoyalSocietyEvents } from "./connectors/royal-society.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const EVENTS_PATH = join(ROOT, "data", "events.json");
const MEETUP_GROUPS_PATH = join(ROOT, "data", "sources", "meetup-groups.json");
const KCL_CONFIG_PATH = join(ROOT, "data", "sources", "kcl.json");
const IMPERIAL_CONFIG_PATH = join(ROOT, "data", "sources", "imperial.json");
const LSE_CONFIG_PATH = join(ROOT, "data", "sources", "lse.json");
const UCL_CONFIG_PATH = join(ROOT, "data", "sources", "ucl.json");
const TURING_CONFIG_PATH = join(ROOT, "data", "sources", "turing.json");
const WELLCOME_CONFIG_PATH = join(ROOT, "data", "sources", "wellcome.json");
const ROYAL_SOCIETY_CONFIG_PATH = join(ROOT, "data", "sources", "royal-society.json");
const ENV_PATH = join(ROOT, ".env");

// Minimal .env loader — no dotenv dependency. Skips comments and blank lines.
// Values are not quote-stripped unless wrapped in matching ' or ".
async function loadDotenv(path) {
  let raw;
  try { raw = await readFile(path, "utf8"); } catch { return {}; }
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

async function readJson(path, fallback) {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT" && fallback !== undefined) return fallback;
    throw err;
  }
}

const CONNECTORS = [
  {
    name: "kcl",
    idPrefix: "kcl:",
    async run() {
      const config = await readJson(KCL_CONFIG_PATH, {});
      return fetchKclEvents({ config });
    },
  },
  {
    name: "imperial",
    idPrefix: "ic:",
    async run() {
      const config = await readJson(IMPERIAL_CONFIG_PATH, {});
      return fetchImperialEvents({ config });
    },
  },
  {
    name: "lse",
    idPrefix: "lse:",
    async run() {
      const config = await readJson(LSE_CONFIG_PATH, {});
      return fetchLseEvents({ config });
    },
  },
  {
    name: "ucl",
    idPrefix: "ucl:",
    async run() {
      const config = await readJson(UCL_CONFIG_PATH, {});
      return fetchUclEvents({ config });
    },
  },
  {
    name: "turing",
    idPrefix: "turing:",
    async run() {
      const config = await readJson(TURING_CONFIG_PATH, {});
      return fetchTuringEvents({ config });
    },
  },
  {
    name: "wellcome",
    idPrefix: "wc:",
    async run() {
      const config = await readJson(WELLCOME_CONFIG_PATH, {});
      return fetchWellcomeEvents({ config });
    },
  },
  {
    name: "royal-society",
    idPrefix: "rs:",
    async run() {
      const config = await readJson(ROYAL_SOCIETY_CONFIG_PATH, {});
      return fetchRoyalSocietyEvents({ config });
    },
  },
  {
    name: "meetup",
    idPrefix: "mu:",
    async run({ env }) {
      const cfg = await readJson(MEETUP_GROUPS_PATH, { groups: [] });
      const groups = cfg.groups || [];
      return fetchMeetupEvents({ env, groups });
    },
  },
];

async function main() {
  const env = { ...process.env, ...(await loadDotenv(ENV_PATH)) };
  const existing = await readJson(EVENTS_PATH, []);
  if (!Array.isArray(existing)) {
    throw new Error("data/events.json is not an array");
  }

  let merged = existing;
  const summaries = [];

  for (const conn of CONNECTORS) {
    const result = await conn.run({ env });
    if (result.skipped) {
      summaries.push(`${conn.name}: skipped`);
      continue;
    }
    const kept = merged.filter((e) => !String(e.id || "").startsWith(conn.idPrefix));
    merged = [...kept, ...result.events];
    summaries.push(
      `${conn.name}: +${result.events.length} events` +
      (result.errors.length ? ` (${result.errors.length} errors)` : "")
    );
  }

  await writeFile(EVENTS_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8");

  console.log("\nDone.");
  for (const s of summaries) console.log(`  ${s}`);
  console.log(`  total in events.json: ${merged.length} from sources`);
}

main().catch((err) => {
  console.error("\nFetch failed:", err.message);
  process.exit(1);
});
