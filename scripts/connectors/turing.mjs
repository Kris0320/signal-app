// Alan Turing Institute connector.
// The /events landing page is the only stable, unauthenticated source: detail
// pages and most sub-listings are served behind a Cloudflare bot challenge.
// Drupal "teaser-new" cards on /events already include title, date and time
// range inline, which is enough to produce a usable event record without
// touching the protected detail pages.

const DEFAULT_KEYWORDS = [
  "ai",
  "artificial intelligence",
  "machine learning",
  "foundation model",
  "data science",
  "health",
  "healthcare",
];

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

function clean(s, max = 700) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function absoluteUrl(href, base) {
  try { return new URL(decodeEntities(href), base).toString(); } catch { return null; }
}

function slugFromUrl(url) {
  try { return new URL(url).pathname.replace(/\/$/, "").split("/").pop() || ""; } catch { return ""; }
}

function parseTeaserDate(text) {
  // Examples:
  //   "Tuesday 28 Apr 2026 | Time: 18:00 - 21:00"
  //   "Wednesday 27 May 2026"
  //   "12 May 2026 | Time: 09:30"
  const dateMatch = /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})/.exec(text);
  if (!dateMatch) return null;
  const day = Number(dateMatch[1]);
  const month = MONTHS[dateMatch[2].toLowerCase().slice(0, 3)];
  const year = Number(dateMatch[3]);
  if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year)) return null;

  const timeMatch = /Time[:\s]+(\d{1,2})[:.](\d{2})(?:\s*[-–]\s*(\d{1,2})[:.](\d{2}))?/i.exec(text);
  let startHour = 18, startMin = 0, durationMin = 90;
  if (timeMatch) {
    startHour = Number(timeMatch[1]);
    startMin = Number(timeMatch[2]);
    if (timeMatch[3]) {
      const endHour = Number(timeMatch[3]);
      const endMin = Number(timeMatch[4]);
      const diff = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      if (diff > 0) durationMin = Math.min(diff, 480);
    }
  } else {
    // No explicit time → assume an all-day event placeholder.
    startHour = 9;
    durationMin = 480;
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
  if (/artificial intelligence|\bai\b|machine learning|foundation model|llm/i.test(text)) tags.push("AI");
  if (/data science|data|analytics|statistics/i.test(text)) tags.push("Data science");
  if (/health|healthcare|medical|medicine|clinical|roche/i.test(text)) tags.push("Healthcare");
  if (/sustainab|environment|climate/i.test(text)) tags.push("Sustainability");
  tags.push("Open to all");
  return [...new Set(tags)].slice(0, 5);
}

function parseTeaser({ html, baseUrl, keywords }) {
  // Extract link
  const hrefMatch = /<a\b[^>]*href="(\/events\/[^"]+)"[^>]*class="absolute-link"/.exec(html)
    || /<h2[^>]*>\s*<a[^>]*href="(\/events\/[^"]+)"/.exec(html)
    || /href="(\/events\/[^"]+)"/.exec(html);
  if (!hrefMatch) return null;
  const url = absoluteUrl(hrefMatch[1], baseUrl);
  if (!url) return null;

  // Title — first <h2> inside the article wins; the listing uses
  // <h2><span class="field--title">…</span></h2>.
  const titleMatch = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(html);
  const title = stripTags(titleMatch ? titleMatch[1] : "") || stripTags(html.split("</article>")[0]).slice(0, 100);
  if (!title) return null;

  // Date range block
  const dateBlockMatch = /field-course-dates[\s\S]*?<\/div>\s*<\/div>/.exec(html);
  const dateText = dateBlockMatch ? stripTags(dateBlockMatch[0]) : "";
  const parsed = parseTeaserDate(dateText);
  if (!parsed) return null;

  // Image src is loaded lazily; data-src holds the real one.
  const imgMatch = /<img[^>]*data-src="([^"]+)"/.exec(html) || /<img[^>]*src="([^"]+)"/.exec(html);
  let image = imgMatch ? imgMatch[1] : null;
  if (image && image.startsWith("/")) image = absoluteUrl(image, baseUrl);

  const slug = slugFromUrl(url);
  const scoringText = `${title} ${slug.replace(/-/g, " ")} ${dateText}`;
  const score = keywordScore(scoringText, keywords);

  return {
    id: `turing:${slug}`,
    sourceEventId: slug,
    title,
    desc: clean(title, 700),
    source: "ATI",
    date: parsed.iso,
    durationMin: parsed.durationMin,
    venue: "Alan Turing Institute, British Library",
    area: "King's Cross",
    price: 0,
    tags: tagsFromText(scoringText),
    format: "In person",
    match: Math.min(90, 70 + score * 3),
    url,
    image,
    _score: score,
  };
}

async function fetchHtml(url, userAgent) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

export async function fetchTuringEvents({ config = {}, log = console } = {}) {
  const listingUrls = config.listingUrls || ["https://www.turing.ac.uk/events"];
  const keywords = config.keywords || DEFAULT_KEYWORDS;
  const userAgent = config.userAgent || "Signal-app/0.1";
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const seen = new Map();
  const errors = [];

  for (const listingUrl of listingUrls) {
    try {
      const html = await fetchHtml(listingUrl, userAgent);
      // Only parse upcoming events — Drupal also renders a past-events block lower
      // down in the same document.
      const pastIdx = html.indexOf("view-display-id-past_events");
      const upcomingHtml = pastIdx > 0 ? html.slice(0, pastIdx) : html;
      const teaserRegex = /<article[^>]*class="node node--type-event teaser-new[^"]*"[\s\S]*?<\/article>/g;
      let count = 0;
      for (const m of upcomingHtml.matchAll(teaserRegex)) {
        const ev = parseTeaser({ html: m[0], baseUrl: listingUrl, keywords });
        if (!ev) continue;
        if (!Number.isFinite(Date.parse(ev.date)) || Date.parse(ev.date) < cutoff) continue;
        // Prefer the higher-scoring duplicate if the same slug appears twice.
        const existing = seen.get(ev.id);
        if (existing && existing._score >= ev._score) continue;
        seen.set(ev.id, ev);
        count += 1;
      }
      log.info(`[turing] ${listingUrl}: ${count} cards`);
    } catch (err) {
      log.warn(`[turing] listing ${listingUrl}: ${err.message}`);
      errors.push({ url: listingUrl, error: err.message });
    }
  }

  const events = [...seen.values()].map(({ _score, ...rest }) => rest);
  return { events, errors, skipped: false };
}
