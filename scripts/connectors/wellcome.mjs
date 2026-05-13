// Wellcome Collection connector.
// Wellcome ships a Next.js site whose detail pages embed a tidy
// `__NEXT_DATA__` JSON blob with the full event record — no need to scrape
// the rendered DOM. The connector follows event links from the /events
// listing, then reads JSON from each detail page.

const DEFAULT_LISTINGS = [
  "https://wellcomecollection.org/events",
];

const SKIP_SLUGS = new Set(["past", "future", "now"]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeEntities(s) {
  return (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function absoluteUrl(href, base) {
  try { return new URL(decodeEntities(href), base).toString(); } catch { return null; }
}

function slugFromUrl(url) {
  try { return new URL(url).pathname.replace(/\/$/, "").split("/").pop() || ""; } catch { return ""; }
}

function clean(s, max = 700) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function bodyToText(blocks) {
  if (!Array.isArray(blocks)) return "";
  const out = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    if (typeof block.text === "string" && block.text.trim()) out.push(block.text.trim());
    if (Array.isArray(block.value)) out.push(bodyToText(block.value));
  }
  return out.join(" ");
}

function extractEventLinks(html, baseUrl) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/href="(\/events\/[^"#?]+)"/g)) {
    const url = absoluteUrl(m[1], baseUrl);
    if (!url) continue;
    const slug = slugFromUrl(url);
    if (!slug || SKIP_SLUGS.has(slug)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function pickLocation(event) {
  if (event.isOnline) return { venue: "Online", area: "Online", format: "Online" };
  const loc = (event.locations || []).map((l) => l && l.title).filter(Boolean).join(", ");
  if (!loc) return { venue: "Wellcome Collection", area: "Euston", format: "In person" };
  return { venue: loc, area: "Euston", format: "In person" };
}

function pickPrice(event) {
  if (event.isFree === true) return 0;
  if (event.bookingType && /free/i.test(event.bookingType)) return 0;
  return 0;
}

function tagsFromEvent(event, scoringText) {
  const tags = new Set();
  const fmt = event.format && event.format.title;
  if (fmt) tags.add(fmt);
  for (const l of event.primaryLabels || []) {
    if (l && l.title) tags.add(l.title);
  }
  for (const l of event.secondaryLabels || []) {
    if (l && l.title && tags.size < 4) tags.add(l.title);
  }
  if (/health|medicine|medical/i.test(scoringText)) tags.add("Healthcare");
  if (/exhibition|tour/i.test(scoringText)) tags.add("Exhibition");
  tags.add("Open to all");
  return [...tags].slice(0, 5);
}

function nextDataFromHtml(html) {
  const m = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function normalizeDetail({ html, url }) {
  const next = nextDataFromHtml(html);
  const event = next && next.props && next.props.pageProps && next.props.pageProps.event;
  if (!event) return null;
  const times = Array.isArray(event.times) ? event.times : [];
  const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
  // Prefer the next future slot; fall back to the first slot if every slot is past.
  let chosen = null;
  for (const t of times) {
    if (!t || !t.range || !t.range.startDateTime) continue;
    const ms = Date.parse(t.range.startDateTime.value);
    if (!Number.isFinite(ms)) continue;
    if (ms < cutoffMs) continue;
    if (!chosen || ms < Date.parse(chosen.range.startDateTime.value)) chosen = t;
  }
  if (!chosen) chosen = times.find((t) => t && t.range && t.range.startDateTime);
  if (!chosen) return null;

  const start = new Date(chosen.range.startDateTime.value);
  const end = chosen.range.endDateTime && chosen.range.endDateTime.value
    ? new Date(chosen.range.endDateTime.value)
    : null;
  if (Number.isNaN(start.getTime())) return null;
  const durationMin = end && end > start
    ? Math.min(Math.max(Math.round((end - start) / 60000), 30), 600)
    : 90;

  const slug = slugFromUrl(url);
  const title = (event.title || "").trim();
  if (!title) return null;
  const promoCaption = event.promo && event.promo.caption ? event.promo.caption.trim() : "";
  const bodyText = bodyToText(event.untransformedBody);
  const desc = clean(promoCaption || bodyText || title, 700);
  const location = pickLocation(event);
  const image = (event.promo && event.promo.image && event.promo.image.contentUrl)
    || (event.image && event.image.contentUrl)
    || null;

  const scoringText = `${title} ${desc} ${(event.format && event.format.title) || ""}`;

  return {
    id: `wc:${slug}`,
    sourceEventId: event.uid || event.id || slug,
    title,
    desc,
    source: "WC",
    date: start.toISOString().replace(".000Z", "+00:00"),
    durationMin,
    venue: location.venue,
    area: location.area,
    price: pickPrice(event),
    tags: tagsFromEvent(event, scoringText),
    format: location.format,
    match: 78,
    url,
    image,
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

export async function fetchWellcomeEvents({ config = {}, log = console } = {}) {
  const listingUrls = config.listingUrls || DEFAULT_LISTINGS;
  const maxDetailPages = Math.max(4, Math.min(40, config.maxDetailPages ?? 20));
  const userAgent = config.userAgent || "Signal-app/0.1";
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const candidates = new Set();
  const errors = [];

  for (const listingUrl of listingUrls) {
    try {
      const html = await fetchHtml(listingUrl, userAgent);
      for (const url of extractEventLinks(html, listingUrl)) candidates.add(url);
      log.info(`[wellcome] ${listingUrl}: ${candidates.size} candidate links total`);
    } catch (err) {
      log.warn(`[wellcome] listing ${listingUrl}: ${err.message}`);
      errors.push({ url: listingUrl, error: err.message });
    }
  }

  const events = [];
  const seenIds = new Set();
  let processed = 0;
  for (const url of candidates) {
    if (processed >= maxDetailPages) break;
    processed += 1;
    try {
      await sleep(150);
      const html = await fetchHtml(url, userAgent);
      const ev = normalizeDetail({ html, url });
      if (!ev) continue;
      const startMs = Date.parse(ev.date);
      if (Number.isFinite(startMs) && startMs < cutoff) continue;
      if (seenIds.has(ev.id)) continue;
      seenIds.add(ev.id);
      events.push(ev);
    } catch (err) {
      log.warn(`[wellcome] detail ${url}: ${err.message}`);
      errors.push({ url, error: err.message });
    }
  }

  return { events, errors, skipped: false };
}
