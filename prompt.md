Refine the current deployed mobile web version of Signal with only these additional changes.

Do not redesign the product.
Do not change the overall app structure.
Only fix the following issues.

1. Remove fake device chrome from the deployed web app
- Remove all fake phone UI that duplicates the real mobile device chrome
- Remove the fake status bar
- Remove the fake time, signal, battery indicators
- Remove the fake Dynamic Island / top black pill
- Remove any fake phone shell presentation UI still rendered inside the page
- Keep only the real app content and use proper mobile safe-area spacing instead

2. Discover search bar
- Remove the right-side settings / filter icon from the search bar for now
- It currently has no real function and adds unnecessary visual noise
- Keep the search bar simple:

3. Fix the share button:
- it should not look disabled or greyed out
- style it as a normal active top-bar action using the same visual weight as the back button
- if interaction is wired, use navigator.share() on supported mobile browsers, with copy-link fallback if neede


4. Unify the icon system
- Use one consistent linear / outlined icon style across the app
- Apply this to:
  - back
  - share
  - bookmark
  - search
  - location
  - chevron
  - close
  - Use consistent icon size and touch target:
  - 24px icons
  - 44x44 touch targets where they are tappable
- Make stroke weight and visual style consistent across all screens

Goal:
This should now feel like a real deployed mobile web product, not a prototype shown inside a fake phone mockup.