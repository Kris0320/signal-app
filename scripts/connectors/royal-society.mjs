// Royal Society connector. Listing pages link to detail pages whose header
// markup is reliably structured (blog-header__date, blog-header__time,
// blog-header__location), so the connector reads those spans plus the
// standard og:* meta tags to produce a record per event.

const DEFAULT_LISTINGS = [
  "https://royalsociety.org/science-events-and-lectures/scientific/",
  "https://royalsociety.org/science-events-and-lectures/public/",
];

const DEFAULT_KEYWORDS = [
  "ai",
  "artificial intelligence",
  "machine learning",
  "data",
  "data science",
  "health",
  "healthcare",
  "medicine",
  "policy",
  "ethics",
  "climate",
  "quantum",
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

function clean(s, max = 700) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function absoluteUrl(href, base) {
  try { return new URL(decodeEntities(href), base).toString(); } catch { return null; }
}

function slugFromUrl(url) {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.slice(-3).join("-");
  } catch { return ""; }
}

function metaContent(html, key) {
  const re = new RegExp(`<meta\\b[^>]*(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, "i");
  const m = re.exec(html);
  return m ? decodeEntities(m[1]) : null;
}

function headerSpan(html, modifier) {
  const re = new RegExp(`<span class="[^"]*blog-header__${modifier}[^"]*"[^>]*>([\\s\\S]*?)</span>`, "i");
  const m = re.exec(html);
  return m ? stripTags(m[1]) : null;
}

function ticketPrice(html) {
  const m = /<span class="card__meta-item">[\s\S]*?fa-ticket[\s\S]*?<\/i>\s*([^<]+)<\/span>/i.exec(html);
  if (!m) return 0;
  const text = m[1].trim();
  if (/free/i.test(text)) return 0;
  const num = /£\s*(\d+(?:\.\d{1,2})?)/.exec(text);
  return num ? Number(num[1]) : 0;
}

function parseRsDate(dateText, timeText) {
  // dateText:  "11 - 12 May 2026" | "12 May 2026" | "30 September 2026"
  // timeText:  "09:30 - 17:00"    | "18:20"       | null
  if (!dateText) return null;
  const m = /(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\s+([A-Za-z]+)\s+(20\d{2})/.exec(dateText);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2].toLowerCase()];
  const year = Number(m[3]);
  if (month === undefined) return null;

  let startHour = 18, startMin = 0, durationMin = 90;
  if (timeText) {
    const t = /(\d{1,2})[:.](\d{2})(?:\s*[-–]\s*(\d{1,2})[:.](\d{2}))?/.exec(timeText);
    if (t) {
      startHour = Number(t[1]);
      startMin = Number(t[2]);
      if (t[3]) {
        const endHour = Number(t[3]);
        const endMin = Number(t[4]);
        const diff = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        if (diff > 0) durationMin = Math.min(diff, 600);
      }
    }
  }

  const start = new Date(Date.UTC(year, month, day, startHour, startMin));
  return {
    iso: start.toISOString().replace(".000Z", "+01:00"),
    durationMin,
  };
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

function tagsFromText(text) {
  const tags = [];
  if (/artificial intelligence|\bai\b|machine learning|llm/i.test(text)) tags.push("AI");
  if (/data science|analytics|statistics/i.test(text)) tags.push("Data science");
  if (/health|healthcare|medicine|medical|clinical|disease|cancer/i.test(text)) tags.push("Healthcare");
  if (/policy|ethics|governance|society/i.test(text)) tags.push("Policy");
  if (/climate|environment|sustainab|biodivers/i.test(text)) tags.push("Climate");
  if (/physics|quantum|astronom|cosmolog/i.test(text)) tags.push("Physics");
  tags.push("Open to all");
  return [...new Set(tags)].slice(0, 5);
}

function extractDetailLinks(html, baseUrl) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/href="(\/science-events-and-lectures\/20\d{2}\/\d{2}\/[a-z0-9][^"]+\/)"/g)) {
    const url = absoluteUrl(m[1], baseUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function normalizeDetail({ html, url, keywords }) {
  const dateText = headerSpan(html, "date");
  const timeText = headerSpan(html, "time");
  const venueText = headerSpan(html, "location") || "The Royal Society";
  const watchText = headerSpan(html, "watch");
  const parsed = parseRsDate(dateText, timeText);
  if (!parsed) return null;

  const titleMatch = /<h1[^>]*class="blog__title"[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const title = stripTags(titleMatch ? titleMatch[1] : "") || metaContent(html, "og:title") || "";
  if (!title) return null;

  const desc = clean(metaContent(html, "og:description") || title, 700);
  const image = metaContent(html, "og:image") || metaContent(html, "twitter:image");

  const isOnline = /online/i.test(venueText);
  const hybrid = !!watchText && !isOnline;
  const format = isOnline ? "Online" : hybrid ? "In person + online" : "In person";
  const area = isOnline ? "Online" : "Mayfair";

  const slug = slugFromUrl(url);
  const scoringText = `${title} ${desc} ${slug.replace(/-/g, " ")}`;
  const score = keywordScore(scoringText, keywords);

  return {
    id: `rs:${slug}`,
    sourceEventId: slug,
    title,
    desc,
    source: "RS",
    date: parsed.iso,
    durationMin: parsed.durationMin,
    venue: venueText,
    area,
    price: ticketPrice(html),
    tags: tagsFromText(scoringText),
    format,
    match: Math.min(90, 70 + score * 3),
    url,
    image,
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

export async function fetchRoyalSocietyEvents({ config = {}, log = console } = {}) {
  const listingUrls = config.listingUrls || DEFAULT_LISTINGS;
  const keywords = config.keywords || DEFAULT_KEYWORDS;
  const maxDetailPages = Math.max(8, Math.min(80, config.maxDetailPages ?? 40));
  const userAgent = config.userAgent || "Signal-app/0.1";
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const candidates = new Set();
  const errors = [];

  for (const listingUrl of listingUrls) {
    try {
      const html = await fetchHtml(listingUrl, userAgent);
      for (const url of extractDetailLinks(html, listingUrl)) candidates.add(url);
      log.info(`[royal-society] ${listingUrl}: ${candidates.size} candidate links total`);
    } catch (err) {
      log.warn(`[royal-society] listing ${listingUrl}: ${err.message}`);
      errors.push({ url: listingUrl, error: err.message });
    }
  }

  const events = [];
  let processed = 0;
  for (const url of candidates) {
    if (processed >= maxDetailPages) break;
    processed += 1;
    try {
      await sleep(150);
      const html = await fetchHtml(url, userAgent);
      const ev = normalizeDetail({ html, url, keywords });
      if (!ev) continue;
      const startMs = Date.parse(ev.date);
      if (Number.isFinite(startMs) && startMs < cutoff) continue;
      delete ev._score;
      events.push(ev);
    } catch (err) {
      log.warn(`[royal-society] detail ${url}: ${err.message}`);
      errors.push({ url, error: err.message });
    }
  }

  return { events, errors, skipped: false };
}
