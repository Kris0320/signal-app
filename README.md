# Signal

Signal is a cross-platform event discovery app prototype.

It helps users discover and evaluate relevant public events across fragmented sources such as Eventbrite, Meetup, university calendars, and cultural event pages.

## Current Direction
This project is currently focused on front-end prototype development.

The current UI baseline comes from an exported standalone HTML prototype.

The goal is to:
1. preserve the current visual prototype,
2. refactor it into a cleaner front-end structure,
3. and then gradually add interaction and logic.

## Core Screens
The prototype currently includes 5 screens:
- Onboarding
- Home feed
- Search & filters
- Event detail
- Saved

## Product Positioning
Signal is:
- an event discovery app
- a cross-platform aggregator
- a filtering and decision-support tool

Signal is not:
- a ticketing platform
- a payment platform
- a full event publishing system

## Current Priorities
- inspect and clean the standalone HTML prototype
- split into maintainable files
- preserve visual quality
- add interaction gradually

## Running locally
The front-end uses `fetch('data/events.json')`, so it must be served over HTTP — opening `index.html` via `file://` will fail CORS.

```bash
npm run serve         # python3 -m http.server 8000
# then visit http://localhost:8000
```

## Refreshing real data
Real-source connectors live in `scripts/connectors/`. Each one normalizes upstream records into the same `data/events.json` schema and namespaces its IDs (e.g. `kcl:...` for King's, `mu:...` for Meetup) so seed data and other sources are never disturbed.

```bash
npm run fetch
```

Each run drops the connector's namespaced entries from `data/events.json` and re-fetches them fresh. Seed entries (`e1`-`e12`) and other sources' entries are left untouched.

### KCL connector
Runs automatically — no credentials needed. Fetches `kcl.ac.uk/events/events-calendar?date=YYYY-M` for the current month and the next month, extracts the embedded `window.REDUX_DATA` JSON the React SPA server-renders, and normalizes ~15 events per month.

Tune behaviour in `data/sources/kcl.json` (e.g. `monthsAhead: 3` to widen the window).

### Imperial connector
Runs automatically — no credentials needed. One HTTP request to `imperial.ac.uk/events/`. Imperial's listing is fully server-rendered with semantic markup (`<a title="…"><h3 class="title"><time datetime="ISO">`), so the connector parses ~24 cards per fetch and ~20 survive the past-event filter.

Tune behaviour in `data/sources/imperial.json`.

### Feed ranking
Real fetched events (any id with a source prefix like `kcl:`, `ic:`, `mu:`) are ranked ahead of seed entries (`e1`-`e12`) in the Discover feed and Search results. Within each tier, the existing `match` score is preserved. Seed events remain as fallback content so the prototype still functions when all connectors are skipped.

### Connecting Meetup (optional)
Without credentials the script logs `meetup: skipped` and leaves Meetup entries (if any from a previous run) alone — the rest of the fetch continues. To enable, set up the signed-JWT (server-to-server) flow:

1. Generate an RSA keypair at the project root:
   ```bash
   openssl genpkey -algorithm RSA -out meetup-private.pem -pkeyopt rsa_keygen_bits:2048
   openssl rsa -in meetup-private.pem -pubout -out meetup-public.pem
   ```
   `meetup-private.pem` is ignored by git via `.gitignore`.
2. Sign in to Meetup and visit https://secure.meetup.com/meetup_api/. Create an OAuth consumer, upload `meetup-public.pem`, and note the `client_id`, the `kid` assigned to the key, and your own member id.
3. Copy `.env.example` to `.env` and fill in the four values.
4. Edit `data/sources/meetup-groups.json` to list the London Meetup group `urlname`s you want to follow. The urlname is the slug after `meetup.com/` in the group's URL.
5. Run `npm run fetch`.

## File Structure
```text
signal-app/
├── CLAUDE.md
├── README.md
├── brief.md
├── signal-standalone.html
├── index.html
├── styles.css
├── script.js
├── package.json
├── .env.example
├── data/
│   ├── events.json
│   └── sources/
│       ├── imperial.json
│       ├── kcl.json
│       └── meetup-groups.json
├── scripts/
│   ├── fetch.mjs
│   ├── connectors/
│   │   ├── imperial.mjs
│   │   ├── kcl.mjs
│   │   └── meetup.mjs
│   └── lib/
│       ├── meetup-auth.mjs
│       └── duration.mjs
└── assets/