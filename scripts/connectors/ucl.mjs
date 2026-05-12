// UCL connector for high-signal AI / healthcare event detail pages.

const MONTHS = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function decodeEntities(s) {
  return (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s) {
  return decodeEntities((s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function textLines(html) {
  return decodeEntities(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<(br|p|li|h\d|div|section|article|time)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function clean(s, max = 700) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function metaContent(html, key) {
  const re = new RegExp(`<meta\\b[^>]*(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, "i");
  const m = re.exec(html);
  return m ? decodeEntities(m[1]) : null;
}

function h1(html) {
  const m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return m ? stripTags(m[1]) : null;
}

function slugFromUrl(url) {
  try {
    return new URL(url).pathname.replace(/\/$/, "").split("/").pop() || "";
  } catch {
    return "";
  }
}

function parseDateLine(line) {
  const m = /\b(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2}),?\s+(\d{1,2}):(\d{2})\s*(am|pm)?\s*[–-]\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(line || "");
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2].toLowerCase()];
  const year = Number(m[3]);
  let startHour = Number(m[4]);
  const startMin = Number(m[5]);
  const startAp = (m[6] || "").toLowerCase();
  let endHour = Number(m[7]);
  const endMin = Number(m[8]);
  const endAp = (m[9] || startAp).toLowerCase();
  if (startAp === "pm" && startHour < 12) startHour += 12;
  if (startAp === "am" && startHour === 12) startHour = 0;
  if (endAp === "pm" && endHour < 12) endHour += 12;
  if (endAp === "am" && endHour === 12) endHour = 0;
  if (month === undefined) return null;
  const start = new Date(Date.UTC(year, month, day, startHour, startMin));
  const end = new Date(Date.UTC(year, month, day, endHour, endMin));
  return {
    iso: start.toISOString().replace(".000Z", "+01:00"),
    durationMin: end > start ? Math.min(Math.round((end - start) / 60000), 480) : 60,
  };
}

function pickDate(lines) {
  for (const line of lines) {
    const parsed = parseDateLine(line);
    if (parsed) return { parsed, line };
  }
  return null;
}

function pickVenue(lines) {
  const dateIdx = lines.findIndex((line) => parseDateLine(line));
  for (let i = dateIdx + 1; i < Math.min(lines.length, dateIdx + 8); i++) {
    const line = lines[i] || "";
    if (/london|united kingdom|ucl|zoom|online|theatre|building|room/i.test(line)) return line;
  }
  return lines.some((line) => /online|zoom/i.test(line)) ? "Online" : "UCL campus";
}

function pickDesc(lines, title) {
  const start = lines.findIndex((line) => line === title);
  const out = [];
  for (let i = Math.max(0, start + 1); i < lines.length; i++) {
    const line = lines[i];
    if (/^(book|register|further information|ticketing|cost|open to|availability|organiser)$/i.test(line)) break;
    if (parseDateLine(line)) continue;
    if (line.length > 35) out.push(line);
    if (out.join(" ").length > 450) break;
  }
  return clean(out.join(" "), 700);
}

function tagsFromText(text) {
  const tags = [];
  if (/artificial intelligence|\bai\b|machine learning/i.test(text)) tags.push("AI");
  if (/health|healthcare|digital health|medical|medicine/i.test(text)) tags.push("Healthcare");
  if (/behavioural|behaviour change/i.test(text)) tags.push("Behaviour");
  tags.push("Open to all");
  return [...new Set(tags)];
}

function normalize({ html, url }) {
  const lines = textLines(html);
  const date = pickDate(lines);
  if (!date) return null;
  const title = decodeEntities(h1(html) || metaContent(html, "og:title") || slugFromUrl(url));
  const desc = pickDesc(lines, title) || clean(metaContent(html, "og:description") || title);
  const venue = pickVenue(lines);
  const text = `${title} ${desc} ${url}`;

  return {
    id: `ucl:${slugFromUrl(url)}`,
    sourceEventId: slugFromUrl(url),
    title,
    desc,
    source: "UCL",
    date: date.parsed.iso,
    durationMin: date.parsed.durationMin,
    venue,
    area: /online|zoom/i.test(venue) ? "Online" : "Bloomsbury",
    price: 0,
    tags: tagsFromText(text),
    format: /online|zoom/i.test(venue) ? "Online" : "In person",
    match: /health/i.test(text) && /\b(ai|artificial intelligence)\b/i.test(text) ? 86 : 78,
    url,
    image: metaContent(html, "og:image") || metaContent(html, "twitter:image"),
  };
}

async function fetchHtml(url, userAgent) {
  const res = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "text/html" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

export async function fetchUclEvents({ config = {}, log = console } = {}) {
  const detailUrls = config.detailUrls || [];
  const userAgent = config.userAgent || "Signal-app/0.1";
  const events = [];
  const errors = [];
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  for (const url of detailUrls) {
    try {
      const html = await fetchHtml(url, userAgent);
      const ev = normalize({ html, url });
      if (!ev) continue;
      const startMs = Date.parse(ev.date);
      if (Number.isFinite(startMs) && startMs < cutoff) continue;
      events.push(ev);
    } catch (err) {
      log.warn(`[ucl] ${url}: ${err.message}`);
      errors.push({ url, error: err.message });
    }
  }

  return { events, errors, skipped: false };
}
