/* ============================================================
   Signal — prototype interactions
   Scope: Feed, Search, Saved, Detail. 2 bottom tabs.
   ============================================================ */

(() => {
  // ----------------------------------------------------------
  // Data: sources, events, tag taxonomy
  // ----------------------------------------------------------
  const SOURCES = {
    IC:  { name: "Imperial",       cls: "src-IC" },
    EB:  { name: "Eventbrite",     cls: "src-EB" },
    MU:  { name: "Meetup",         cls: "src-MU" },
    UCL: { name: "UCL",            cls: "src-UCL" },
    RCA: { name: "RCA",            cls: "src-RCA" },
    KCL: { name: "King's College", cls: "src-KCL" },
    BB:  { name: "Barbican",       cls: "src-BB" },
    RSA: { name: "RSA House",      cls: "src-RSA" },
    WH:  { name: "Wired Health",   cls: "src-WH" },
    LH:  { name: "Lutyens Hall",   cls: "src-LH" },
  };

  // ISO date strings so "today / this week" can be computed against a fixed
  // anchor — keeps the prototype deterministic regardless of the real date.
  const TODAY = new Date("2026-05-12T00:00:00");

  const EVENTS = [
    {
      id: "e1",
      title: "Foundation Models in Clinical Imaging",
      desc: "A working session with NHS radiologists and DeepMind alumni on validating foundation models against real diagnostic workflows.",
      source: "IC",
      date: "2026-05-12T18:30:00",
      durationMin: 120,
      venue: "South Kensington",
      area: "South Kensington",
      price: 0,
      tags: ["AI in healthcare", "Machine learning", "University lectures"],
      format: "In person",
      match: 96,
    },
    {
      id: "e2",
      title: "Type as Infrastructure",
      desc: "A panel on typography systems for software products and the operational realities of maintaining them at scale.",
      source: "RCA",
      date: "2026-05-13T19:00:00",
      durationMin: 90,
      venue: "Battersea",
      area: "Battersea",
      price: 0,
      tags: ["Design", "Typography", "Talks"],
      format: "In person",
      match: 88,
    },
    {
      id: "e3",
      title: "AI Policy Briefing: Medical Devices Act",
      desc: "Regulatory briefing on what the Medical Devices Act means for AI-assisted diagnostics in the UK.",
      source: "RSA",
      date: "2026-05-14T12:30:00",
      durationMin: 75,
      venue: "Strand",
      area: "Strand",
      price: 15,
      tags: ["AI in healthcare", "Policy", "Briefings"],
      format: "In person",
      match: 84,
    },
    {
      id: "e4",
      title: "Speculative Futures Salon",
      desc: "Anab Jain in conversation about design fiction as a tool for institutional decision-making.",
      source: "RCA",
      date: "2026-05-16T18:30:00",
      durationMin: 90,
      venue: "Kensington",
      area: "Kensington",
      price: 0,
      tags: ["Design", "Talks", "Speculative design"],
      format: "In person",
      match: 91,
    },
    {
      id: "e5",
      title: "Practical Robotics Reading Group",
      desc: "Monthly reading group covering recent robotics learning papers, hosted by the UCL CDT cohort.",
      source: "UCL",
      date: "2026-05-13T17:00:00",
      durationMin: 90,
      venue: "Bloomsbury",
      area: "Bloomsbury",
      price: 0,
      tags: ["Robotics", "Reading group", "Machine learning"],
      format: "In person",
      match: 79,
    },
    {
      id: "e6",
      title: "Designing for AI-First Products",
      desc: "Workshop on patterns and pitfalls for designing interfaces where the primary collaborator is a model.",
      source: "EB",
      date: "2026-05-15T10:00:00",
      durationMin: 240,
      venue: "Shoreditch",
      area: "Shoreditch",
      price: 45,
      tags: ["Design", "AI", "Workshops"],
      format: "In person",
      match: 82,
    },
    {
      id: "e7",
      title: "Open Source Health Data Meetup",
      desc: "Lightning talks on open datasets and reproducibility in clinical ML research.",
      source: "MU",
      date: "2026-05-12T19:00:00",
      durationMin: 120,
      venue: "King's Cross",
      area: "King's Cross",
      price: 0,
      tags: ["AI in healthcare", "Open source", "Meetup"],
      format: "In person",
      match: 77,
    },
    {
      id: "e8",
      title: "Sound, Space and AI",
      desc: "Live spatial-audio performance paired with a talk on generative sound for installation work.",
      source: "BB",
      date: "2026-05-18T20:00:00",
      durationMin: 90,
      venue: "Barbican",
      area: "Barbican",
      price: 18,
      tags: ["Sound", "Performance", "AI"],
      format: "In person",
      match: 73,
    },
    {
      id: "e9",
      title: "Wired Health Curtain-Raiser",
      desc: "Preview programme for the Wired Health summit — short talks from clinical-AI startups.",
      source: "WH",
      date: "2026-05-20T09:30:00",
      durationMin: 180,
      venue: "Kensington",
      area: "Kensington",
      price: 25,
      tags: ["AI in healthcare", "Startups", "Conference"],
      format: "In person",
      match: 81,
    },
    {
      id: "e10",
      title: "Building with Claude: Office Hours",
      desc: "Open office hours for developers shipping with the Anthropic API. Bring your prompt failures.",
      source: "MU",
      date: "2026-05-14T17:30:00",
      durationMin: 90,
      venue: "Online",
      area: "Online",
      price: 0,
      tags: ["AI", "Developer", "Meetup"],
      format: "Online",
      match: 86,
    },
    {
      id: "e11",
      title: "Radiology AI: Failure Modes",
      desc: "Clinical reading session on where current radiology models fail, with case examples.",
      source: "KCL",
      date: "2026-05-19T18:00:00",
      durationMin: 120,
      venue: "Strand",
      area: "Strand",
      price: 0,
      tags: ["AI in healthcare", "Machine learning", "University lectures"],
      format: "In person",
      match: 89,
    },
    {
      id: "e12",
      title: "Designers Reading Foucault",
      desc: "Slow-reading group working through Discipline and Punish in the context of platform design.",
      source: "LH",
      date: "2026-05-15T19:00:00",
      durationMin: 120,
      venue: "Marylebone",
      area: "Marylebone",
      price: 5,
      tags: ["Design", "Reading group", "Theory"],
      format: "In person",
      match: 68,
    },
  ];

  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------
  const state = {
    screen: "feed",
    feedFilters: new Set(),           // quick filters: today, week, free, inperson
    searchTagFilters: new Set(),      // tag/source filters from search chips
    searchSources: new Set(),         // source filter keys
    searchQuery: "",
    saved: new Set(),
    savedView: "date",                // date | match | source
    recentSearches: ["radiology AI", "Anab Jain", "free this week"],
    currentEventId: null,
    city: "London",
  };

  const CITIES = ["London", "Manchester", "Edinburgh", "Bristol", "Cambridge"];

  const FEED_QUICK_FILTERS = [
    { id: "today",    label: "Today" },
    { id: "week",     label: "This week" },
    { id: "free",     label: "Free" },
    { id: "inperson", label: "In person" },
    { id: "online",   label: "Online" },
  ];

  const SEARCH_CATEGORY_CHIPS = [
    { id: "thisweek", label: "This week" },
    { id: "format",   label: "Format" },
    { id: "price",    label: "Price" },
    { id: "free",     label: "Free" },
  ];

  const SAVED_VIEWS = [
    { id: "date",   label: "By date" },
    { id: "match",  label: "By match" },
    { id: "source", label: "By source" },
  ];

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function fmtTime(d) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function fmtShortDay(d) {
    const wk = d.toLocaleDateString("en-GB", { weekday: "short" });
    const day = d.getDate();
    const mon = d.toLocaleDateString("en-GB", { month: "short" });
    return `${wk}, ${mon} ${day}`;
  }
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }
  function isThisWeek(d) {
    const diff = Math.floor((d - TODAY) / 86400000);
    return diff >= 0 && diff < 7;
  }
  function priceLabel(p) { return p === 0 ? "Free" : `£${p}`; }
  function durationLabel(m) {
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem ? `${h}h ${rem}m` : `${h}h`;
  }
  function sourceMeta(key) { return SOURCES[key] || { name: key, cls: "" }; }

  function badgeHTML(srcKey, size) {
    const s = sourceMeta(srcKey);
    const cls = size === "lg" ? " source-badge--lg" : "";
    return `<span class="source-badge${cls} ${s.cls}">${srcKey}</span>`;
  }

  function thumbHTML(srcKey) {
    const s = sourceMeta(srcKey);
    return `<span class="event-card__thumb ${s.cls}">${srcKey}</span>`;
  }

  function eventDate(ev) { return new Date(ev.date); }

  // ----------------------------------------------------------
  // Filtering
  // ----------------------------------------------------------
  function matchesFeedFilters(ev) {
    const d = eventDate(ev);
    if (state.feedFilters.has("today") && !isSameDay(d, TODAY)) return false;
    if (state.feedFilters.has("week") && !isThisWeek(d)) return false;
    if (state.feedFilters.has("free") && ev.price !== 0) return false;
    if (state.feedFilters.has("inperson") && ev.format !== "In person") return false;
    if (state.feedFilters.has("online") && ev.format !== "Online") return false;
    return true;
  }

  function matchesSearch(ev) {
    if (state.searchQuery) {
      const q = state.searchQuery.trim().toLowerCase();
      const hay = [
        ev.title, ev.desc, ev.venue, ev.area,
        sourceMeta(ev.source).name,
        ...ev.tags,
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.searchSources.size > 0 && !state.searchSources.has(ev.source)) return false;

    const tagFilters = state.searchTagFilters;
    if (tagFilters.has("thisweek") && !isThisWeek(eventDate(ev))) return false;
    if (tagFilters.has("free") && ev.price !== 0) return false;
    return true;
  }

  // ----------------------------------------------------------
  // Renderers
  // ----------------------------------------------------------
  function renderChip(c, selected, count) {
    const sel = selected ? " is-selected" : "";
    const countTxt = count !== undefined ? ` · ${count}` : "";
    return `
      <button class="chip${sel}" data-chip="${c.id}" role="tab" aria-selected="${selected}">
        <span class="chip__check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
        </span>
        <span class="chip__label">${c.label}${countTxt}</span>
      </button>
    `;
  }

  function renderFeedChips() {
    const host = $("#feed-chips");
    host.innerHTML = FEED_QUICK_FILTERS
      .map(c => renderChip(c, state.feedFilters.has(c.id)))
      .join("");
  }

  function renderSearchChips() {
    const host = $("#search-chips");
    const selectedCount = state.searchTagFilters.size + state.searchSources.size;
    const filtersChip = {
      id: "__filtersbadge",
      label: selectedCount > 0 ? `Filters · ${selectedCount}` : "Filters",
    };
    const chips = [filtersChip, ...SEARCH_CATEGORY_CHIPS];
    host.innerHTML = chips.map(c => {
      const isSel = c.id === "__filtersbadge"
        ? selectedCount > 0
        : state.searchTagFilters.has(c.id);
      return renderChip(c, isSel);
    }).join("");
  }

  function renderSourceChips() {
    const host = $("#source-chips");
    host.innerHTML = Object.keys(SOURCES).map(key => {
      const s = sourceMeta(key);
      const sel = state.searchSources.has(key) ? " is-selected" : "";
      return `
        <button class="chip${sel}" data-source="${key}" aria-pressed="${state.searchSources.has(key)}">
          <span class="chip__check"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span>
          ${badgeHTML(key)}
          <span>${s.name}</span>
        </button>
      `;
    }).join("");
  }

  function renderSegmented() {
    const host = $("#saved-segmented");
    host.innerHTML = SAVED_VIEWS
      .map(v => renderChip(v, state.savedView === v.id))
      .join("");
  }

  function renderEventCard(ev) {
    const d = eventDate(ev);
    const saved = state.saved.has(ev.id);
    const priceClass = ev.price === 0 ? " is-free" : "";
    return `
      <article class="event-card" data-event="${ev.id}">
        ${thumbHTML(ev.source)}
        <div class="event-card__body">
          <h3 class="event-card__title">${ev.title}</h3>
          <div class="event-card__meta">
            <span>${fmtShortDay(d)}</span>
            <span class="dot"></span>
            <span>${fmtTime(d)}</span>
            <span class="dot"></span>
            <span>${ev.area}</span>
            <span class="dot"></span>
            <span class="event-card__price${priceClass}">${priceLabel(ev.price)}</span>
          </div>
        </div>
        <button class="event-card__save${saved ? " is-saved" : ""}" data-action="toggle-save" data-event="${ev.id}" aria-label="${saved ? "Unsave" : "Save"}" aria-pressed="${saved}">
          <svg viewBox="0 0 24 24" width="22" height="22"
               fill="${saved ? "currentColor" : "none"}"
               stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 3h12v18l-6-3-6 3V3z"/>
          </svg>
        </button>
      </article>
    `;
  }

  function renderFeed() {
    const list = EVENTS
      .filter(matchesFeedFilters)
      .sort((a, b) => b.match - a.match);
    const host = $("#feed-list");
    host.innerHTML = list.map(renderEventCard).join("");
    $("#feed-empty").classList.toggle("hidden", list.length > 0);
  }

  function renderSearchResults() {
    const host = $("#search-results");
    const label = $("#search-results-label");
    const showResults =
      state.searchQuery.length > 0
      || state.searchSources.size > 0
      || state.searchTagFilters.size > 0;

    if (!showResults) {
      host.innerHTML = "";
      label.hidden = true;
      return;
    }
    const list = EVENTS.filter(matchesSearch).sort((a, b) => b.match - a.match);
    label.hidden = false;
    if (list.length === 0) {
      host.innerHTML = `<div class="empty"><p>No events match this search.</p></div>`;
      return;
    }
    host.innerHTML = list.map(renderEventCard).join("");
  }

  function renderRecent() {
    const host = $("#recent-list");
    host.innerHTML = state.recentSearches.map(q => `
      <li class="recent-item" data-recent="${q.replace(/"/g, "&quot;")}">
        <span class="recent-item__icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7"/>
            <path d="M3 3v5h5"/>
            <path d="M12 7v5l3 2"/>
          </svg>
        </span>
        <span class="recent-item__text">${q}</span>
        <span class="recent-item__arrow">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l10-10"/><path d="M9 7h8v8"/></svg>
        </span>
      </li>
    `).join("");
  }

  function renderSaved() {
    const items = EVENTS.filter(ev => state.saved.has(ev.id));
    const host = $("#saved-list");
    const empty = $("#saved-empty");

    if (items.length === 0) {
      host.innerHTML = "";
      empty.classList.remove("hidden");
      updateClashCard(0);
      return;
    }
    empty.classList.add("hidden");
    updateClashCard(items.length);

    // Group based on savedView
    let groups;
    if (state.savedView === "date") {
      groups = groupSavedByDate(items);
    } else if (state.savedView === "source") {
      groups = groupSavedBySource(items);
    } else {
      groups = groupSavedByMatch(items);
    }

    host.innerHTML = groups.map(g => `
      <div class="saved-group">
        <div class="saved-group-label">${g.label}</div>
        ${g.items.map(renderSavedItem).join("")}
      </div>
    `).join("");
  }

  function renderSavedItem(ev) {
    const d = eventDate(ev);
    return `
      <div class="saved-item" data-event="${ev.id}">
        <div class="saved-item__date">
          <div class="saved-item__date-m">${d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</div>
          <div class="saved-item__date-d">${d.getDate()}</div>
          <div class="saved-item__date-w">${d.toLocaleDateString("en-GB", { weekday: "short" })}</div>
        </div>
        <div class="saved-item__body">
          <div class="saved-item__title">${ev.title}</div>
          <div class="saved-item__meta">
            ${badgeHTML(ev.source)}
            <span class="dot"></span>
            <span>${fmtTime(d)}</span>
            <span class="dot"></span>
            <span>${ev.area}</span>
            <span class="dot"></span>
            <span>${priceLabel(ev.price)}</span>
          </div>
        </div>
        <button class="saved-item__save" data-action="toggle-save" data-event="${ev.id}" aria-label="Unsave">
          <svg viewBox="0 0 24 24" width="22" height="22"
               fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 3h12v18l-6-3-6 3V3z"/>
          </svg>
        </button>
      </div>
    `;
  }

  function groupSavedByDate(items) {
    const sorted = items.slice().sort((a, b) => eventDate(a) - eventDate(b));
    const buckets = new Map();
    for (const ev of sorted) {
      const d = eventDate(ev);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const key = `${weekStart.toISOString().slice(0,10)}`;
      const label = `${weekStart.toLocaleDateString("en-GB", { month: "short" })} ${weekStart.getDate()}–${weekEnd.getDate()}`;
      if (!buckets.has(key)) buckets.set(key, { label, items: [] });
      buckets.get(key).items.push(ev);
    }
    return Array.from(buckets.values());
  }

  function groupSavedBySource(items) {
    const buckets = new Map();
    for (const ev of items) {
      const label = sourceMeta(ev.source).name;
      if (!buckets.has(label)) buckets.set(label, { label, items: [] });
      buckets.get(label).items.push(ev);
    }
    return Array.from(buckets.values())
      .map(g => ({ ...g, items: g.items.sort((a, b) => eventDate(a) - eventDate(b)) }));
  }

  function groupSavedByMatch(items) {
    const high = []; const mid = []; const low = [];
    for (const ev of items) {
      if (ev.match >= 85) high.push(ev);
      else if (ev.match >= 75) mid.push(ev);
      else low.push(ev);
    }
    const groups = [];
    if (high.length) groups.push({ label: "Strong match", items: high });
    if (mid.length)  groups.push({ label: "Good match",   items: mid });
    if (low.length)  groups.push({ label: "Lower match",  items: low });
    return groups;
  }

  function updateClashCard(count) {
    const title = $("#clash-title");
    const sub = $("#clash-sub");
    if (count === 0) {
      title.textContent = "Nothing saved yet";
      sub.textContent = "Tap the bookmark on any event to save it.";
      return;
    }
    const items = EVENTS.filter(ev => state.saved.has(ev.id));
    const clash = detectClash(items);
    if (clash) {
      title.textContent = `Time clash on ${clash}`;
      sub.textContent = "Two saved events overlap.";
    } else {
      title.textContent = `No clashes across ${count} saved event${count === 1 ? "" : "s"}`;
      sub.textContent = "You're all set for this period.";
    }
  }

  function detectClash(items) {
    const sorted = items.slice().sort((a, b) => eventDate(a) - eventDate(b));
    for (let i = 0; i < sorted.length - 1; i++) {
      const aStart = eventDate(sorted[i]);
      const aEnd = new Date(aStart.getTime() + sorted[i].durationMin * 60000);
      const bStart = eventDate(sorted[i + 1]);
      if (bStart < aEnd) {
        return fmtShortDay(aStart);
      }
    }
    return null;
  }

  // ----------------------------------------------------------
  // Detail screen
  // ----------------------------------------------------------
  function openDetail(eventId) {
    const ev = EVENTS.find(e => e.id === eventId);
    if (!ev) return;
    closeCalendarDrawer();
    closeSavedCalendar();
    state.currentEventId = eventId;
    const d = eventDate(ev);
    const s = sourceMeta(ev.source);

    $("#detail-title").textContent = ev.title;
    $("#detail-desc").textContent = ev.desc;
    const sourceTag = `<span class="tag tag--source src-${ev.source}">${ev.source}</span>`;
    const tagHTML = ev.tags.map(t => `<span class="tag">${t}</span>`).join("");
    $("#detail-tags").innerHTML = `${sourceTag}${tagHTML}`;
    $("#detail-date").textContent = fmtShortDay(d);
    $("#detail-duration").textContent = `${fmtTime(d)} · ${durationLabel(ev.durationMin)}`;
    $("#detail-venue").textContent = ev.venue;
    $("#detail-price").textContent = priceLabel(ev.price);
    $("#detail-open-label").textContent = `Open on ${s.name}`;

    updateDetailSaveState();
    showScreen("detail");
  }

  function updateDetailSaveState() {
    if (!state.currentEventId) return;
    const saved = state.saved.has(state.currentEventId);
    $$("[data-action='toggle-save-detail']").forEach(btn => {
      const path = btn.querySelector("path");
      if (path) path.setAttribute("fill", saved ? "currentColor" : "none");
      btn.classList.toggle("is-active", saved);
      btn.setAttribute("aria-pressed", String(saved));
    });
  }

  // ----------------------------------------------------------
  // Calendar drawer (opened from Saved date block)
  // ----------------------------------------------------------
  function openCalendarDrawer(eventId) {
    const ev = EVENTS.find(e => e.id === eventId);
    if (!ev) return;
    const d = eventDate(ev);

    $("#drawer-title").textContent = `${d.toLocaleDateString("en-GB", { weekday: "long" })}, ${d.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;
    $("#cal-month").textContent = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    $("#cal-grid").innerHTML = renderMonthGrid(d);

    $("#drawer-backdrop").classList.remove("hidden");
    $("#calendar-drawer").classList.remove("hidden");
    $("#calendar-drawer").setAttribute("aria-hidden", "false");
  }

  function closeCalendarDrawer() {
    $("#drawer-backdrop").classList.add("hidden");
    $("#calendar-drawer").classList.add("hidden");
    $("#calendar-drawer").setAttribute("aria-hidden", "true");
  }

  function renderMonthGrid(target, opts = {}) {
    const { markedDays = null, selectedDay = null, interactive = false } = opts;
    const year = target.getFullYear();
    const month = target.getMonth();
    const eventDay = opts.eventDay !== undefined ? opts.eventDay : (markedDays ? null : target.getDate());
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();

    const today = new Date();
    const isToday = (y, m, d) =>
      today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

    const cells = [];
    for (let i = lead - 1; i >= 0; i--) {
      cells.push(`<span class="cal__cell cal__cell--muted"><span class="cal__pip">${prevDays - i}</span></span>`);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const cls = ["cal__cell"];
      const marked = markedDays && markedDays.has(d);
      if (marked) cls.push("cal__cell--has-events");
      if (selectedDay === d) cls.push("cal__cell--selected");
      else if (eventDay === d) cls.push("cal__cell--event");
      else if (isToday(year, month, d)) cls.push("cal__cell--today");
      const attr = interactive ? ` data-day="${d}"` : "";
      cells.push(`<span class="${cls.join(" ")}"${attr}><span class="cal__pip">${d}</span></span>`);
    }
    const trailing = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= trailing; d++) {
      cells.push(`<span class="cal__cell cal__cell--muted"><span class="cal__pip">${d}</span></span>`);
    }
    return cells.join("");
  }

  // ----------------------------------------------------------
  // City picker drawer
  // ----------------------------------------------------------
  function renderCityList() {
    const host = $("#city-list");
    host.innerHTML = CITIES.map(city => {
      const sel = city === state.city ? " is-current" : "";
      return `
        <li>
          <button class="city-row${sel}" data-city="${city}">
            <span class="city-row__pin" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 21s-7-6.4-7-11.5a7 7 0 1 1 14 0c0 5.1-7 11.5-7 11.5z"/>
                <circle cx="12" cy="9.5" r="2.5"/>
              </svg>
            </span>
            <span class="city-row__label">${city}</span>
            <span class="city-row__check" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
            </span>
          </button>
        </li>
      `;
    }).join("");
  }

  function openCityDrawer() {
    renderCityList();
    $("#city-backdrop").classList.remove("hidden");
    $("#city-drawer").classList.remove("hidden");
    $("#city-drawer").setAttribute("aria-hidden", "false");
  }

  function closeCityDrawer() {
    $("#city-backdrop").classList.add("hidden");
    $("#city-drawer").classList.add("hidden");
    $("#city-drawer").setAttribute("aria-hidden", "true");
  }

  function setCity(city) {
    state.city = city;
    $("#location-label").textContent = city;
    closeCityDrawer();
  }

  // ----------------------------------------------------------
  // Saved calendar drawer
  // ----------------------------------------------------------
  const savedCal = {
    year: TODAY.getFullYear(),
    month: TODAY.getMonth(),
    selectedDay: null,
  };

  function savedItemsForMonth(year, month) {
    return EVENTS.filter(ev => state.saved.has(ev.id))
      .filter(ev => {
        const d = eventDate(ev);
        return d.getFullYear() === year && d.getMonth() === month;
      });
  }

  function savedItemsForDay(year, month, day) {
    return EVENTS.filter(ev => state.saved.has(ev.id))
      .filter(ev => {
        const d = eventDate(ev);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
      })
      .sort((a, b) => eventDate(a) - eventDate(b));
  }

  function openSavedCalendar() {
    // Initial month + day: prefer the next upcoming saved event, else today.
    const saved = EVENTS.filter(ev => state.saved.has(ev.id))
      .sort((a, b) => eventDate(a) - eventDate(b));
    const next = saved.find(ev => eventDate(ev) >= TODAY) || saved[0];
    const anchor = next ? eventDate(next) : TODAY;
    savedCal.year = anchor.getFullYear();
    savedCal.month = anchor.getMonth();
    savedCal.selectedDay = anchor.getDate();

    renderSavedCalendar();
    $("#saved-cal-backdrop").classList.remove("hidden");
    $("#saved-calendar-drawer").classList.remove("hidden");
    $("#saved-calendar-drawer").setAttribute("aria-hidden", "false");
  }

  function closeSavedCalendar() {
    $("#saved-cal-backdrop").classList.add("hidden");
    $("#saved-calendar-drawer").classList.add("hidden");
    $("#saved-calendar-drawer").setAttribute("aria-hidden", "true");
  }

  function renderSavedCalendar() {
    const { year, month, selectedDay } = savedCal;
    const monthAnchor = new Date(year, month, 1);
    $("#saved-cal-month").textContent =
      monthAnchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

    const markedDays = new Set(
      savedItemsForMonth(year, month).map(ev => eventDate(ev).getDate())
    );
    $("#saved-cal-grid").innerHTML = renderMonthGrid(monthAnchor, {
      markedDays,
      selectedDay,
      interactive: true,
    });

    renderSavedCalendarDayList();
  }

  function renderSavedCalendarDayList() {
    const { year, month, selectedDay } = savedCal;
    const label = $("#saved-cal-day-label");
    const host = $("#saved-cal-day-list");
    if (!selectedDay) {
      label.textContent = "Select a date";
      host.innerHTML = "";
      return;
    }
    const d = new Date(year, month, selectedDay);
    label.textContent = `Events on ${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`;
    const items = savedItemsForDay(year, month, selectedDay);
    if (items.length === 0) {
      host.innerHTML = `<div class="saved-cal-day__empty">No saved events on this day.</div>`;
      return;
    }
    host.innerHTML = items.map(renderSavedItem).join("");
  }

  // ----------------------------------------------------------
  // Navigation between screens
  // ----------------------------------------------------------
  function showScreen(name) {
    state.screen = name;
    $$(".screen").forEach(el => {
      el.classList.toggle("is-active", el.dataset.screen === name);
    });

    // Bottom nav reflects only Feed / Saved. When on Search or Detail, leave
    // the most recent of those highlighted so the nav doesn't go blank.
    const navHighlight =
      (name === "feed" || name === "search") ? "feed"
      : (name === "saved") ? "saved"
      : null;
    $$(".nav-btn").forEach(b => {
      b.classList.toggle("is-active", b.dataset.nav === navHighlight);
    });

    // Hide bottom nav on detail
    $("#bottom-nav").style.display = (name === "detail") ? "none" : "";

    // Refresh dynamic content on enter
    if (name === "feed") renderFeed();
    if (name === "saved") renderSaved();
    if (name === "search") {
      renderRecent();
      renderSearchChips();
      renderSourceChips();
      renderSearchResults();
      setTimeout(() => $("#search-input")?.focus(), 50);
    }
  }

  // ----------------------------------------------------------
  // Save toggle
  // ----------------------------------------------------------
  function toggleSave(eventId) {
    if (state.saved.has(eventId)) state.saved.delete(eventId);
    else state.saved.add(eventId);

    // Re-render any list visible
    renderFeed();
    renderSearchResults();
    renderSaved();
    if (state.currentEventId === eventId) updateDetailSaveState();
    if (!$("#saved-calendar-drawer").classList.contains("hidden")) {
      renderSavedCalendar();
    }
  }

  // ----------------------------------------------------------
  // Event wiring (delegated)
  // ----------------------------------------------------------
  function wireEvents() {
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-action]");
      if (t) {
        const action = t.dataset.action;
        if (action === "open-search") { showScreen("search"); return; }
        if (action === "close-search") { showScreen("feed"); return; }
        if (action === "close-detail") {
          showScreen(state.saved.has(state.currentEventId) && state.screen === "saved" ? "saved" : "feed");
          return;
        }
        if (action === "toggle-save") {
          e.stopPropagation();
          toggleSave(t.dataset.event);
          return;
        }
        if (action === "toggle-save-detail") {
          if (state.currentEventId) toggleSave(state.currentEventId);
          return;
        }
        if (action === "share-detail") {
          shareCurrentEvent();
          return;
        }
        if (action === "reset-feed-filters") {
          state.feedFilters.clear();
          renderFeedChips();
          renderFeed();
          return;
        }
        if (action === "go-feed") { showScreen("feed"); return; }
        if (action === "open-city") { openCityDrawer(); return; }
        if (action === "close-city") { closeCityDrawer(); return; }
        if (action === "close-drawer") { closeCalendarDrawer(); return; }
        if (action === "open-saved-calendar") { openSavedCalendar(); return; }
        if (action === "close-saved-calendar") { closeSavedCalendar(); return; }
        if (action === "saved-cal-prev") {
          savedCal.month -= 1;
          if (savedCal.month < 0) { savedCal.month = 11; savedCal.year -= 1; }
          savedCal.selectedDay = null;
          renderSavedCalendar();
          return;
        }
        if (action === "saved-cal-next") {
          savedCal.month += 1;
          if (savedCal.month > 11) { savedCal.month = 0; savedCal.year += 1; }
          savedCal.selectedDay = null;
          renderSavedCalendar();
          return;
        }
      }

      // City picker row → set location and close
      const cityRow = e.target.closest(".city-row[data-city]");
      if (cityRow) {
        setCity(cityRow.dataset.city);
        return;
      }

      // Saved-calendar day cell selection
      const dayCell = e.target.closest("#saved-cal-grid .cal__cell[data-day]");
      if (dayCell) {
        savedCal.selectedDay = parseInt(dayCell.dataset.day, 10);
        renderSavedCalendar();
        return;
      }

      // Date block in Saved → per-event calendar drawer
      // (skip when the date block lives inside the Saved-calendar sheet,
      // since stacking another drawer on top would be confusing)
      const dateBlock = e.target.closest(".saved-item__date");
      if (dateBlock && !dateBlock.closest("#saved-calendar-drawer")) {
        e.stopPropagation();
        const row = dateBlock.closest(".saved-item");
        if (row) openCalendarDrawer(row.dataset.event);
        return;
      }

      // Card click → detail
      const card = e.target.closest(".event-card, .saved-item");
      if (card && !e.target.closest("[data-action='toggle-save']")) {
        openDetail(card.dataset.event);
        return;
      }

      // Feed chips
      const feedChip = e.target.closest("#feed-chips .chip");
      if (feedChip) {
        const id = feedChip.dataset.chip;
        if (state.feedFilters.has(id)) state.feedFilters.delete(id);
        else state.feedFilters.add(id);
        renderFeedChips();
        renderFeed();
        return;
      }

      // Search category chips
      const searchChip = e.target.closest("#search-chips .chip");
      if (searchChip) {
        const id = searchChip.dataset.chip;
        if (id === "__filtersbadge") {
          // Tapping the filters badge clears all search filters as a quick reset
          if (state.searchTagFilters.size + state.searchSources.size > 0) {
            state.searchTagFilters.clear();
            state.searchSources.clear();
            renderSearchChips();
            renderSourceChips();
            renderSearchResults();
          }
          return;
        }
        if (state.searchTagFilters.has(id)) state.searchTagFilters.delete(id);
        else state.searchTagFilters.add(id);
        renderSearchChips();
        renderSearchResults();
        return;
      }

      // Source chips
      const sourceChip = e.target.closest("#source-chips .chip");
      if (sourceChip) {
        const key = sourceChip.dataset.source;
        if (state.searchSources.has(key)) state.searchSources.delete(key);
        else state.searchSources.add(key);
        renderSearchChips();
        renderSourceChips();
        renderSearchResults();
        return;
      }

      // Saved segmented
      const seg = e.target.closest("#saved-segmented .chip");
      if (seg) {
        state.savedView = seg.dataset.chip;
        renderSegmented();
        renderSaved();
        return;
      }

      // Recent search → fill input
      const recent = e.target.closest("[data-recent]");
      if (recent) {
        const q = recent.dataset.recent;
        $("#search-input").value = q;
        state.searchQuery = q;
        renderSearchResults();
        return;
      }

      // Bottom nav
      const navBtn = e.target.closest(".nav-btn");
      if (navBtn) {
        showScreen(navBtn.dataset.nav);
        return;
      }
    });

    // Keyboard: enter on search trigger
    $(".search-trigger").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showScreen("search");
      }
    });

    // Search input
    $("#search-input").addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderSearchResults();
    });
    $("#search-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = state.searchQuery.trim();
        if (q && !state.recentSearches.includes(q)) {
          state.recentSearches.unshift(q);
          state.recentSearches = state.recentSearches.slice(0, 6);
          renderRecent();
        }
      }
    });
  }

  // ----------------------------------------------------------
  // Share (navigator.share with copy-link fallback)
  // ----------------------------------------------------------
  async function shareCurrentEvent() {
    if (!state.currentEventId) return;
    const ev = EVENTS.find(e => e.id === state.currentEventId);
    if (!ev) return;

    const url = window.location.href;
    const shareData = {
      title: ev.title,
      text: `${ev.title} — ${fmtShortDay(eventDate(ev))} · ${ev.area}`,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // user cancelled — exit silently
        if (err && err.name === "AbortError") return;
        // otherwise fall through to copy fallback
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch (_) {
      showToast("Unable to share");
    }
  }

  let toastTimer = null;
  function showToast(msg) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.remove("hidden");
    // next frame so the transition runs
    requestAnimationFrame(() => t.classList.add("is-visible"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove("is-visible");
      setTimeout(() => t.classList.add("hidden"), 220);
    }, 1800);
  }

  // ----------------------------------------------------------
  // Init
  // ----------------------------------------------------------
  function init() {
    renderFeedChips();
    renderFeed();
    renderSegmented();
    renderSearchChips();
    renderSourceChips();
    renderRecent();
    renderSaved();
    wireEvents();
    showScreen("feed");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
