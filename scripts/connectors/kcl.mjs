// KCL connector. No auth — KCL's events listing is a React SPA that server-
// renders the full upcoming-events JSON into the page HTML as
// `window.REDUX_DATA`, so we fetch the listing page for the current month
// (and N months ahead), pull the JSON out with a regex, and normalize each
// item into the Signal events.json schema.
//
// Each fetched month gives ~15 events (page 1, server-rendered). Further
// pages are loaded client-side via the Contensis API with an access token,
// which we deliberately don't reverse-engineer. 15/month is plenty for the
// discovery prototype and keeps the connector polite — one HTTP request per
// month, no scraping of fragile HTML.

const CALENDAR_URL = "https://www.kcl.ac.uk/events/events-calendar";

function monthsFromNow(count) {
  const now = new Date();
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return out;
}

function extractReduxData(html) {
  // Marker that anchors the JSON. The page assigns a single object literal:
  //   window.REDUX_DATA = {...};</script>
  // The value can contain raw `undefined` tokens (KCL's SSR uses
  // JSON.stringify with undefined-replacer disabled), so we substitute those
  // to `null` before JSON.parse.
  const marker = "window.REDUX_DATA = ";
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const end = html.indexOf("</script>", start);
  if (end < 0) return null;
  let raw = html.slice(start + marker.length, end).trim();
  if (raw.endsWith(";")) raw = raw.slice(0, -1);
  raw = raw.replace(/\bundefined\b/g, "null");
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clean(s, max = 700) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function durationMin(fromIso, toIso) {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 60;
  const mins = Math.round((b - a) / 60000);
  // Cap absurd multi-day spans (exhibitions, programmes) so they don't break
  // duration display or saved-event clash detection.
  return Math.min(Math.max(mins, 15), 480);
}

function isOnline(item) {
  return (item.type || []).some(
    (t) => t?.sys?.slug === "online" || (t?.entryTitle || "").toLowerCase() === "online"
  );
}

function pickTags(item) {
  const tags = [];
  for (const t of item.type || []) {
    const name = t?.entryTitle;
    if (name && name.toLowerCase() !== "online") tags.push(name);
  }
  for (const c of item.categories || []) {
    if (c?.title) tags.push(c.title);
  }
  for (const f of item.facultiesAndDepartments || []) {
    if (f?.entryTitle) tags.push(f.entryTitle);
  }
  // Dedupe and cap.
  return [...new Set(tags)].slice(0, 3);
}

function pickImage(item) {
  const uri = item?.image?.asset?.sys?.uri || item?.thumbnail?.asset?.sys?.uri;
  if (!uri) return null;
  if (/^https?:\/\//i.test(uri)) return uri;
  return `https://www.kcl.ac.uk${uri.startsWith("/") ? "" : "/"}${uri}`;
}

function normalize(item) {
  const slug = item?.sys?.slug;
  if (!slug || !item?.title || !item?.date?.from) return null;

  const online = isOnline(item);
  const locationName = item.location?.entryTitle || null;

  return {
    id: `kcl:${slug}`,
    sourceEventId: item.sys.id || null,
    title: item.cancelled ? `CANCELLED: ${item.title}` : item.title,
    desc: clean(item.description),
    source: "KCL",
    date: item.date.from,
    durationMin: durationMin(item.date.from, item.date.to),
    venue: online ? "Online" : (locationName || "Strand"),
    area: online ? "Online" : (locationName || "Strand"),
    price: 0,
    tags: pickTags(item),
    format: online ? "Online" : "In person",
    match: 70,
    url: `https://www.kcl.ac.uk/events/${slug}`,
    image: pickImage(item),
  };
}

async function fetchMonth({ year, month, userAgent, log }) {
  const url = `${CALENDAR_URL}?date=${year}-${month}`;
  const res = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "text/html" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`KCL ${url} returned ${res.status}`);
  }
  const html = await res.text();
  const data = extractReduxData(html);
  if (!data) {
    log.warn(`[kcl] ${year}-${month}: REDUX_DATA not found in page (KCL may have changed their SSR shape)`);
    return [];
  }
  const items = data?.listing?.items || [];
  log.info(`[kcl] ${year}-${month}: ${items.length} events on page 1 (totalCount=${data?.listing?.pagingInfo?.totalCount ?? "?"})`);
  return items;
}

export async function fetchKclEvents({ config = {}, log = console } = {}) {
  const monthsAhead = Math.max(1, Math.min(6, config.monthsAhead ?? 2));
  const userAgent = config.userAgent || "Signal-app/0.1";
  const months = monthsFromNow(monthsAhead);

  const seen = new Set();
  const events = [];
  const errors = [];
  // Drop events whose start is more than a day in the past — long-running
  // KCL programmes (exhibitions, multi-month series) would otherwise appear
  // in Discover with a stale start date.
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  for (const m of months) {
    try {
      const items = await fetchMonth({ ...m, userAgent, log });
      for (const item of items) {
        const slug = item?.sys?.slug;
        if (!slug || seen.has(slug)) continue;
        const startMs = Date.parse(item?.date?.from || "");
        if (Number.isFinite(startMs) && startMs < cutoff) continue;
        const norm = normalize(item);
        if (!norm) continue;
        seen.add(slug);
        events.push(norm);
      }
    } catch (err) {
      log.warn(`[kcl] ${m.year}-${m.month}: ${err.message}`);
      errors.push({ month: `${m.year}-${m.month}`, error: err.message });
    }
  }

  return { events, errors, skipped: false };
}
