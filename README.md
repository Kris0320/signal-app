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

## Suggested Structure
```text
signal-app/
├── CLAUDE.md
├── README.md
├── brief.md
├── signal-standalone.html
├── index.html
├── styles.css
├── script.js
└── assets/