# CLAUDE.md

## Project Context
This project is called Signal.

Signal is a cross-platform event discovery app.
It helps users discover relevant public events across fragmented sources such as:
- Eventbrite
- Meetup
- university event pages
- cultural institutions
- public event listings

The current project direction is a mobile app prototype based on a Material Design 3 style system.

## Current Stage
We are no longer working on the earlier event-scout scraping project.

The current project is now focused on:
- front-end app prototype work
- product structure
- search / filter / saved / detail flows
- using a standalone HTML export as the starting point

## Current Source
The current visual starting point is an exported standalone HTML prototype.

This file should be treated as:
- the visual reference
- the current UI baseline
- a starting point for refactoring into a cleaner front-end structure

## Main Goal
Refactor the standalone prototype into a cleaner and more maintainable project structure, then gradually add real interactions.

## Immediate Priorities
1. Inspect the standalone HTML file
2. Preserve the current Material-3-like visual design as much as possible
3. Refactor it into a cleaner structure:
   - index.html
   - styles.css
   - script.js
4. Keep the app easy to preview locally
5. After structure is stable, add interactions

## Product Scope
Signal is an event discovery app, not a ticketing platform.

Core product features include:
- onboarding / interest selection
- home feed
- search
- filtering
- event detail
- saved events
- relevance explanation
- link out to original source

## Interaction Priorities
After refactoring, the most important interactions are:
- onboarding interest selection
- screen or tab switching
- search input behavior
- filter chip toggling
- saved / unsaved state
- opening event detail
- link out CTA
- basic relevance / filter logic

## Design Direction
The current preferred design direction is:
- Material 3 influenced
- clean
- product-like
- consistent
- readable
- mobile-first

Avoid:
- overly editorial styling
- unnecessary visual experiments
- adding many decorative patterns
- redesigning the product concept from scratch

## Coding Preferences
- keep structure simple
- explain major changes before doing them
- avoid overengineering
- preserve visual fidelity during refactoring
- prefer small, clear steps over large rewrites

## Working Style
Before making large changes:
1. inspect files
2. explain plan
3. explain what will be preserved
4. explain what will change
5. then proceed