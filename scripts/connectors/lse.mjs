// LSE connector. LSE pages are mostly server-rendered HTML with event detail
// pages linked from department and all-events listings. We collect event links,
// fetch details, then keep AI/data/health-related events first.

const DEFAULT_LISTINGS = [
  "https://www.lse.ac.uk/dsi/events/upcoming-dsi-events",
  "https://www.lse.ac.uk/events/search-events",
  "https://www.lse.ac.uk/health-policy/events",
  "https://www.lse.ac.uk/lse-health/events",
];

const DEFAULT_KEYWORDS = [
  "ai",
  "artificial intelligence",
  "machine learning",
  "data science",
  "health",
  "healthcare",
  "health policy",
  "digital health",
];

const MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const AREA_HINTS = [
  ["online", "Online"],
  ["marshall building", "Holborn"],
  ["old building", "Holborn"],
  ["centre building", "Holborn"],
  ["clm", "Holborn"],
  ["lse campus", "Holborn"],
  ["houghton street", "Holborn"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function absoluteUrl(href, base) {
  try {
    return new URL(decodeEntities(href), base).toString();
  } catch {
    return null;
  }
}

function slugFromUrl(url) {
  try {
    return new URL(url).pathname.replace(/\/$/, "").split("/").pop() || "";
  } catch {
    return "";
  }
}

function slugTitle(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
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

function extractEventLinks(html, baseUrl) {
  const links = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = absoluteUrl(m[1], baseUrl);
    if (!url) continue;
    const { hostname, pathname } = new URL(url);
    if (!hostname.endsWith("lse.ac.uk")) continue;
    if (!pathname.toLowerCase().includes("/events/")) continue;
    if (/search-events|upcoming-dsi-events|calendar|subscribe/i.test(pathname)) continue;
    const label = stripTags(m[2]);
    if (label.length < 4) continue;
    links.push({ url, label });
  }
  return links;
}

function keywordScore(text, keywords) {
  const hay = ` ${text.toLowerCase()} `;
  let score = 0;
  for (const raw of keywords) {
    const k = raw.toLowerCase();
    if (k.length <= 3) {
      if (new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(hay)) score += 2;
    } else if (hay.includes(k)) {
      score += 2;
    }
  }
  return score;
}

function parseTimePart(part) {
  const m = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i.exec(part || "");
  if (!m) return { hour: 12, minute: 0 };
  let hour = Number(m[1]);
  const minute = Number(m[2] || 0);
  const ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && hour < 12) hour += 12;
  if (ap === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

function parseDateLine(line) {
  const m = /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})(.*)$/i.exec(line || "");
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2].toLowerCase()];
  const year = Number(m[3]);
  if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year)) return null;
  const timeText = m[4] || "";
  const startTime = parseTimePart(timeText);
  const start = new Date(Date.UTC(year, month, day, startTime.hour, startTime.minute));
  const parts = timeText.split(/\s+(?:-|to)\s+/i);
  let duration = 90;
  if (parts.length > 1) {
    const endTime = parseTimePart(parts[1]);
    const end = new Date(Date.UTC(year, month, day, endTime.hour, endTime.minute));
    if (end > start) duration = Math.round((end - start) / 60000);
  }
  return {
    iso: start.toISOString().replace(".000Z", "+01:00"),
    durationMin: Math.min(Math.max(duration, 30), 480),
  };
}

function areaFromVenue(venue) {
  const v = (venue || "").toLowerCase();
  for (const [needle, area] of AREA_HINTS) {
    if (v.includes(needle)) return area;
  }
  return "Holborn";
}

function tagsFromText(text, keywords) {
  const tags = [];
  const lower = text.toLowerCase();
  if (/(^|\W)(ai|artificial intelligence|machine learning|llm|algorithm)/i.test(text)) tags.push("AI");
  if (/data science|data|analytics/i.test(text)) tags.push("Data science");
  if (/health|healthcare|medicine|medtech|digital health|pharmaceutical/i.test(text)) tags.push("Healthcare");
  for (const keyword of keywords) {
    if (tags.length >= 4) break;
    if (keyword.length > 3 && lower.includes(keyword.toLowerCase())) tags.push(keyword);
  }
  tags.push("Open to all");
  return [...new Set(tags)].slice(0, 5);
}

function pickVenue(lines, dateIndex) {
  for (let i = Math.max(0, dateIndex - 4); i < dateIndex; i++) {
    const line = lines[i];
    if (/online|building|theatre|room|campus|street|lse/i.test(line) && !/^hosted by/i.test(line)) {
      return line;
    }
  }
  return "LSE campus";
}

function pickDescription(lines, dateIndex) {
  const out = [];
  for (let i = dateIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^(speakers?|chair|hosted by|more info|add to calendar|share|topics|contact|event organiser)$/i.test(line)) break;
    if (/^(twitter|facebook|linkedin|email|print|download)$/i.test(line)) continue;
    if (line.length > 35) out.push(line);
    if (out.join(" ").length > 420) break;
  }
  return clean(out.join(" "), 700);
}

function normalizeDetail({ html, url, label, keywords }) {
  const lines = textLines(html);
  const dateIndex = lines.findIndex((line) => parseDateLine(line));
  if (dateIndex < 0) return null;
  const parsed = parseDateLine(lines[dateIndex]);
  const title = decodeEntities(h1(html) || metaContent(html, "og:title") || label || slugTitle(slugFromUrl(url)));
  const venue = pickVenue(lines, dateIndex);
  const desc = pickDescription(lines, dateIndex) || clean(metaContent(html, "og:description") || title);
  const scoringText = `${title} ${label} ${desc} ${url}`;
  const score = keywordScore(scoringText, keywords);

  return {
    id: `lse:${slugFromUrl(url)}`,
    sourceEventId: slugFromUrl(url),
    title,
    desc,
    source: "LSE",
    date: parsed.iso,
    durationMin: parsed.durationMin,
    venue,
    area: areaFromVenue(venue),
    price: 0,
    tags: tagsFromText(scoringText, keywords),
    format: /online/i.test(venue) ? "Online" : "In person",
    match: Math.min(86, 68 + score * 3),
    url,
    image: metaContent(html, "og:image") || metaContent(html, "twitter:image"),
    _score: score,
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

export async function fetchLseEvents({ config = {}, log = console } = {}) {
  const listingUrls = config.listingUrls || DEFAULT_LISTINGS;
  const keywords = config.keywords || DEFAULT_KEYWORDS;
  const maxDetailPages = Math.max(8, Math.min(80, config.maxDetailPages ?? 32));
  const userAgent = config.userAgent || "Signal-app/0.1";
  const candidateMap = new Map();
  const errors = [];

  for (const listingUrl of listingUrls) {
    try {
      const html = await fetchHtml(listingUrl, userAgent);
      for (const link of extractEventLinks(html, listingUrl)) {
        const current = candidateMap.get(link.url);
        if (!current || link.label.length > current.label.length) candidateMap.set(link.url, link);
      }
      log.info(`[lse] ${listingUrl}: ${candidateMap.size} candidate links total`);
    } catch (err) {
      log.warn(`[lse] listing ${listingUrl}: ${err.message}`);
      errors.push({ url: listingUrl, error: err.message });
    }
  }

  const candidates = [...candidateMap.values()]
    .sort((a, b) => keywordScore(b.label, keywords) - keywordScore(a.label, keywords))
    .slice(0, maxDetailPages);

  const events = [];
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const candidate of candidates) {
    try {
      await sleep(150);
      const html = await fetchHtml(candidate.url, userAgent);
      const event = normalizeDetail({ html, url: candidate.url, label: candidate.label, keywords });
      if (!event) continue;
      const startMs = Date.parse(event.date);
      if (Number.isFinite(startMs) && startMs < cutoff) continue;
      if (event._score === 0) continue;
      delete event._score;
      events.push(event);
    } catch (err) {
      log.warn(`[lse] detail ${candidate.url}: ${err.message}`);
      errors.push({ url: candidate.url, error: err.message });
    }
  }

  return { events, errors, skipped: false };
}
