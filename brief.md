
---

## `brief.md`

```md id="signal-brief-md"
# brief.md

## Current Task
Use the exported standalone HTML prototype as the starting point for Signal.

## Goal
Refactor the current prototype into a cleaner front-end project structure without losing the existing visual design.

## Immediate Deliverables
Refactor into:
- index.html
- styles.css
- script.js

## Requirements
- preserve the current UI as much as possible
- keep the current 5-screen product flow
- keep the current Material-like mobile app direction
- make the code easier to edit and extend
- keep local preview simple

## After Refactoring
Once the structure is stable, the next phase is to add interaction.

## Next Interaction Priorities
1. onboarding interest selection
2. filter chip states
3. search bar behavior
4. open event detail
5. saved / unsaved interactions
6. source link CTA
7. basic result filtering logic

## Current App Structure
The app includes:
- onboarding
- home feed
- search & filters
- event detail
- saved list

## Constraints
Do not:
- redesign the whole product from scratch
- change the product concept
- overcomplicate the structure
- introduce a framework too early unless explicitly requested

## Preferred Workflow
1. inspect the standalone HTML
2. explain how it is structured
3. propose refactoring plan
4. refactor into separate files
5. verify local preview still works
6. then continue with functionality