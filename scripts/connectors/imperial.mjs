// Imperial College London connector.
//
// Two-pass fetch:
//   1. /events/ landing page → list of upcoming events (id, slug, baseline date)
//   2. /events/{id}/{slug}/ → schema.org/Event microdata + rich description
//
// Imperial annotates every event detail page with proper structured fields:
//   <h1 itemprop="name">…</h1>
//   <meta itemprop="startDate" content="…ISO…">  <meta itemprop="endDate" …>
//   <meta itemprop="image" content="…canonical poster URL…">
//   <meta itemprop="isAccessibleForFree" content="true|false">
//   <meta itemprop="audienceType" content="…">
//   <span itemprop="about">Lecture</span>
//   <div itemprop="description">… multi-paragraph rich text …</div>
//   <div itemprop="location" itemscope itemtype=".../Place">
//     <meta itemprop="name" content="…venue…">
//     <div itemprop="address" itemscope itemtype=".../PostalAddress">
//       <meta itemprop="streetAddress" content="…">
//       <meta itemprop="addressLocality" content="…">
//       <meta itemprop="postalCode" content="…">
//     </div>
//   </div>
//   <a class="event-details__btn--cta-register" href="…rsvp URL…">
//   <a class="event-details__btn--cta-live"     href="…livestream URL…">
//
// We extract those first, fall back to listing-card text for any field the
// detail page is missing. Detail fetches run sequentially with a small delay
// so we stay polite (≈ 5–6 seconds for the ~20 events).

const DEFAULT_LISTING = "https://www.imperial.ac.uk/events/";
const DETAIL_DELAY_MS = 200;

const AREA_HINTS = [
  ["White City Campus", "White City"],
  ["South Kensington Campus", "South Kensington"],
  ["Charing Cross Campus", "Charing Cross"],
  ["Hammersmith Campus", "Hammersmith"],
  ["St Mary's Campus", "Paddington"],
  ["Silwood Park", "Silwood Park"],
  ["Online", "Online"],
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

function slugToTitle(slug) {
  return (slug || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function clip(s, max) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function durationMin(fromIso, toIso) {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a)) return 60;
  if (!Number.isFinite(b) || b <= a) return 60;
  const mins = Math.round((b - a) / 60000);
  return Math.min(Math.max(mins, 15), 480);
}

function areaFromVenue(venue) {
  if (!venue) return "South Kensington";
  const v = venue.toLowerCase();
  for (const [needle, label] of AREA_HINTS) {
    if (v.includes(needle.toLowerCase())) return label;
  }
  return "South Kensington";
}

// ---------------------------------------------------------------------------
// Listing-page parsing (lightweight — just enough to find the event URLs)
// ---------------------------------------------------------------------------
const LISTING_BLOCK = /<a\b[^>]*\bhref="\/events\/(\d+)\/([a-z0-9-]+)\/?"[^>]*\btitle="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
const LISTING_TIME = /<time\b[^>]*\bdatetime="([^"]+)"[^>]*>/gi;
const LISTING_TITLE = /<h3\b[^>]*\bclass="title"[^>]*>([\s\S]*?)<\/h3>/i;
const LISTING_VENUE = /<p\b[^>]*\bclass="venue"[^>]*>([\s\S]*?)<\/p>/i;
const LISTING_TAGS = /<ul\b[^>]*\bclass="tags"[^>]*>([\s\S]*?)<\/ul>/i;
const LISTING_TAG_ITEM = /<li\b[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/li>/gi;

function parseListing(html) {
  const seen = new Set();
  const out = [];
  for (const m of html.matchAll(LISTING_BLOCK)) {
    const id = m[1];
    const slug = m[2];
    if (seen.has(id)) continue;
    const titleAttr = stripTags(m[3] || "");
    const inner = m[4] || "";
    const times = [...inner.matchAll(LISTING_TIME)].map((t) => t[1]);
    if (!times.length) continue;
    const titleMatch = LISTING_TITLE.exec(inner);
    const venueMatch = LISTING_VENUE.exec(inner);
    const tagsMatch = LISTING_TAGS.exec(inner);
    const tags = [];
    if (tagsMatch) {
      for (const t of tagsMatch[1].matchAll(LISTING_TAG_ITEM)) {
        const label = stripTags(t[1]);
        if (label && !/^featured$/i.test(label)) tags.push(label);
      }
    }
    seen.add(id);
    out.push({
      id,
      slug,
      titleAttr,
      titleFromH3: titleMatch ? stripTags(titleMatch[1]) : "",
      venueRaw: venueMatch ? stripTags(venueMatch[1]) : "",
      tags,
      startIso: times[0],
      endIso: times[1] || null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Detail-page parsing (schema.org/Event microdata + content-hero image)
// ---------------------------------------------------------------------------
function metaItemprop(html, prop) {
  const re = new RegExp(`<meta\\b[^>]*\\bitemprop="${prop}"[^>]*\\bcontent="([^"]*)"`, "i");
  const m = re.exec(html);
  return m ? decodeEntities(m[1]) : null;
}

function itempropName(html) {
  // The <h1 itemprop="name"> sits at the top of the page; take the first.
  const m = /<h1\b[^>]*\bitemprop="name"[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return m ? stripTags(m[1]) : null;
}

function itempropAbout(html) {
  const m = /<span\b[^>]*\bitemprop="about"[^>]*>([\s\S]*?)<\/span>/i.exec(html);
  return m ? stripTags(m[1]) : null;
}

function detailTags(html) {
  // <ul class="event-details__tags"><li><a>…</a></li>…</ul>
  const block = /<ul\b[^>]*\bclass="event-details__tags"[^>]*>([\s\S]*?)<\/ul>/i.exec(html);
  if (!block) return [];
  const out = [];
  for (const lm of block[1].matchAll(/<li\b[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi)) {
    const t = stripTags(lm[1]);
    if (t) out.push(t);
  }
  return out;
}

function campusLi(html) {
  const m = /<li\b[^>]*\bclass="event-details__venue"[^>]*>([\s\S]*?)<\/li>/i.exec(html);
  if (!m) return null;
  // The visible text follows a label span; stripTags collapses both. Trim the
  // trailing " Campus" so the area field matches the seed-data convention
  // ("South Kensington" rather than "South Kensington Campus").
  return stripTags(m[1])
    .replace(/^Campus:\s*/i, "")
    .replace(/\s+Campus$/i, "");
}

function descriptionBlock(html) {
  // Match the FULL itemprop="description" block, including nested divs.
  // Imperial's body has paragraphs (<p>) and headings (<h3>) we want to keep
  // as separate paragraphs in plain text. We do a balanced-ish scan: anchor
  // on the opening tag, then walk the string tracking <div> depth.
  const openRe = /<div\b[^>]*\bitemprop="description"[^>]*>/i;
  const openMatch = openRe.exec(html);
  if (!openMatch) return null;
  let i = openMatch.index + openMatch[0].length;
  let depth = 1;
  const tagRe = /<(\/?)div\b[^>]*>/gi;
  tagRe.lastIndex = i;
  let last = i;
  let body = "";
  let m;
  while ((m = tagRe.exec(html))) {
    if (m[1] === "/") depth -= 1;
    else depth += 1;
    if (depth === 0) {
      body = html.slice(last, m.index);
      break;
    }
  }
  if (!body) return null;

  // Convert paragraph / heading boundaries to newlines, then strip tags.
  const blocks = [];
  const blockRe = /<(p|h\d|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let bm;
  while ((bm = blockRe.exec(body))) {
    const text = stripTags(bm[2]);
    if (text) blocks.push(text);
  }
  // De-duplicate adjacent identical lines (Imperial occasionally repeats).
  const cleaned = [];
  for (const b of blocks) {
    if (cleaned[cleaned.length - 1] !== b) cleaned.push(b);
  }
  return cleaned.join("\n\n");
}

function detailImage(html) {
  // Prefer the canonical <meta itemprop="image"> (a featured-crop JPEG at
  // 1086w or similar), which is wide and clean for the detail hero. Fall
  // back to the content-hero <picture> srcset's landscape variant.
  const metaImg = metaItemprop(html, "image");
  if (metaImg) {
    return /^https?:/i.test(metaImg) ? metaImg : `https://www.imperial.ac.uk${metaImg.startsWith("/") ? "" : "/"}${metaImg}`;
  }
  const hero = /<div\b[^>]*\bclass="[^"]*content-hero[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (!hero) return null;
  // Prefer the eventlandscape2018 variant (mid-width, full poster, low crop)
  const ll = /\/[^"\s]+eventlandscape2018_x05\.(?:webp|jpg)/i.exec(hero[1]);
  const lf = /\/[^"\s]+eventfeatured2018_x05\.(?:webp|jpg)/i.exec(hero[1]);
  const lp = /\/[^"\s]+eventpanel2018_x05\.(?:webp|jpg)/i.exec(hero[1]);
  const m = ll || lf || lp;
  if (!m) return null;
  return `https://www.imperial.ac.uk${m[0]}`;
}

function detailRegistrationUrl(html) {
  const m = /<a\b[^>]*\bclass="[^"]*event-details__btn--cta-register[^"]*"[^>]*\bhref="([^"]+)"/i.exec(html);
  return m ? decodeEntities(m[1]) : null;
}

function detailLivestreamUrl(html) {
  const m = /<a\b[^>]*\bclass="[^"]*event-details__btn--cta-live[^"]*"[^>]*\bhref="([^"]+)"/i.exec(html);
  return m ? decodeEntities(m[1]) : null;
}

function parseDetail(html) {
  const venueName = metaItemprop(html, "name") || null; // first Place->name
  const streetAddress = metaItemprop(html, "streetAddress");
  const locality = metaItemprop(html, "addressLocality");
  const region = metaItemprop(html, "addressRegion");

  // Build the "full venue text" — what someone reading the source page sees:
  // the visible room/building line plus the campus line. We dedupe phrases
  // so "Lecture theatre G16, Sir Alexander Fleming Building" + Place.name
  // "Sir Alexander Fleming Building, South Kensington Campus" doesn't repeat
  // the building.
  const parts = [];
  if (streetAddress) parts.push(streetAddress);
  if (locality) parts.push(locality);
  let fullVenue = parts.filter(Boolean).join(", ");
  if (!fullVenue) fullVenue = venueName || null;

  return {
    title: itempropName(html),
    startIso: metaItemprop(html, "startDate"),
    endIso: metaItemprop(html, "endDate"),
    venueName: fullVenue || venueName,
    locality: locality || null,
    region: region || null,
    campus: campusLi(html),
    description: descriptionBlock(html),
    isAccessibleForFree: metaItemprop(html, "isAccessibleForFree") === "true",
    audienceType: metaItemprop(html, "audienceType"),
    eventType: itempropAbout(html),
    tags: detailTags(html),
    image: detailImage(html),
    registrationUrl: detailRegistrationUrl(html),
    livestreamUrl: detailLivestreamUrl(html),
  };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------
function isOnlineFromDetail(detail, listingVenue) {
  const v = (detail.venueName || listingVenue || "").toLowerCase();
  if (/\bonline\b/.test(v)) return true;
  // Detail page has only a livestream link and no physical venue → online.
  if (!detail.venueName && detail.livestreamUrl) return true;
  return false;
}

function priceFromDetail(detail) {
  if (detail.isAccessibleForFree === true) return 0;
  // Imperial events are virtually always free; if isAccessibleForFree is
  // absent, default to 0. Numeric parsing of "£N" could be added later.
  return 0;
}

function mergeTags(listingTags, detail) {
  const seen = new Set();
  const out = [];
  const push = (t) => {
    const v = (t || "").trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };
  push(detail.eventType);            // "Lecture", "Symposium", …
  for (const t of detail.tags) push(t); // detail tag list
  for (const t of listingTags) push(t); // listing tag list (already de-Featured)
  if (detail.audienceType) push(detail.audienceType);
  return out.slice(0, 5);
}

function normalize(listing, detail) {
  const merged = detail || {};
  const startIso = merged.startIso || listing.startIso;
  const endIso = merged.endIso || listing.endIso;
  const online = isOnlineFromDetail(merged, listing.venueRaw);
  const venue = online
    ? "Online"
    : (merged.venueName || listing.venueRaw || "Imperial College London");
  const area = online
    ? "Online"
    : (merged.campus || areaFromVenue(merged.venueName || listing.venueRaw));

  const title =
    merged.title ||
    listing.titleFromH3 ||
    (listing.titleAttr && listing.titleAttr.length <= 120 ? listing.titleAttr : "") ||
    slugToTitle(listing.slug);

  // Description: prefer the detail-page rich block; fall back to listing's
  // anchor title attribute. Cap at ~800 chars but preserve paragraph breaks.
  const descSrc = merged.description || listing.titleAttr || "";
  const desc = clip(descSrc, 800);

  return {
    id: `ic:${listing.id}`,
    sourceEventId: listing.id,
    title,
    desc,
    source: "IC",
    date: startIso,
    durationMin: durationMin(startIso, endIso),
    venue,
    area,
    price: priceFromDetail(merged),
    tags: mergeTags(listing.tags, merged),
    format: online ? "Online" : "In person",
    match: 72,
    url: `https://www.imperial.ac.uk/events/${listing.id}/${listing.slug}/`,
    image: merged.image || null,
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
async function fetchHtml(url, userAgent) {
  const res = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "text/html" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function fetchImperialEvents({ config = {}, log = console } = {}) {
  const listingUrl = config.listingUrl || DEFAULT_LISTING;
  const userAgent = config.userAgent || "Signal-app/0.1";

  let listingHtml;
  try {
    listingHtml = await fetchHtml(listingUrl, userAgent);
  } catch (err) {
    log.warn(`[imperial] listing fetch failed: ${err.message}`);
    return { events: [], errors: [{ url: listingUrl, error: err.message }], skipped: false };
  }

  const listing = parseListing(listingHtml);
  log.info(`[imperial] parsed ${listing.length} listing cards from ${listingUrl}`);

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const upcoming = listing.filter((ev) => {
    const startMs = Date.parse(ev.startIso);
    return !(Number.isFinite(startMs) && startMs < cutoff);
  });

  const events = [];
  const errors = [];
  let enriched = 0;
  let bare = 0;

  for (const ev of upcoming) {
    const detailUrl = `https://www.imperial.ac.uk/events/${ev.id}/${ev.slug}/`;
    let detail = null;
    try {
      const html = await fetchHtml(detailUrl, userAgent);
      detail = parseDetail(html);
      enriched += 1;
    } catch (err) {
      log.warn(`[imperial] detail ${ev.id}: ${err.message}`);
      errors.push({ id: ev.id, error: err.message });
      bare += 1;
    }
    events.push(normalize(ev, detail));
    await sleep(DETAIL_DELAY_MS);
  }

  log.info(`[imperial] enriched ${enriched} via detail page, ${bare} listing-only`);
  return { events, errors, skipped: false };
}
